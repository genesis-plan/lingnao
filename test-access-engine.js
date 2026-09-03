/*
 * 灵脑接入引擎端到端实测（零依赖，内嵌仿真设备，不依赖真实硬件）
 * 覆盖：① 标准文件优先(点表/Companion) ② 拓扑模糊识别 ③ 锚定兜底 ④ 诚实识别不了
 */
'use strict';
const net = require('net');
const { spawn } = require('child_process');
const LL = require('./lingnao-link-layer.js');
const E = require('./lingnao-access-engine.js');
const path = require('path');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  ' + extra : '')); }
}

// ── 内嵌仿真 Modbus PLC（寄存器 0=x,1=y 各一值）──
function startModbusPLC(port) {
  const regs = new Array(16).fill(0); regs[0] = 1234; regs[1] = 5678;
  const srv = net.createServer(sock => {
    let buf = Buffer.alloc(0);
    sock.on('data', d => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 12) {
        const tid = buf.readUInt16BE(0), len = buf.readUInt16BE(4), total = 6 + len;
        if (buf.length < total) break;
        const frame = buf.slice(0, total); buf = buf.slice(total);
        const unit = frame[6], fc = frame[7], pdu = frame.slice(7);
        if (fc === 0x03) {
          const addr = pdu.readUInt16BE(1), qty = pdu.readUInt16BE(3);
          const body = Buffer.alloc(2 + qty * 2); body[0] = 0x03; body[1] = qty * 2;
          for (let i = 0; i < qty; i++) body.writeUInt16BE(regs[(addr + i) % regs.length], 2 + i * 2);
          sock.write(mbap(tid, unit, body));
        } else if (fc === 0x06) {
          const addr = pdu.readUInt16BE(1), val = pdu.readUInt16BE(3);
          regs[addr % regs.length] = val; sock.write(frame); // 回显
        }
      }
    });
  });
  return new Promise(res => srv.listen(port, () => res(srv)));
}
function mbap(tid, unit, body) { const m = Buffer.alloc(7); m.writeUInt16BE(tid, 0); m.writeUInt16BE(0, 2); m.writeUInt16BE(body.length + 1, 4); m.writeUInt8(unit, 6); return Buffer.concat([m, body]); }

// ── 内嵌仿真 MQTT broker（中转 PUBLISH）──
function startMqttBroker(port) {
  const subs = new Map();
  const srv = net.createServer(sock => {
    let buf = Buffer.alloc(0);
    sock.on('data', d => {
      buf = Buffer.concat([buf, d]);
      let p;
      while ((p = parseFrame(buf))) {
        buf = buf.slice(p.total);
        const t = p.fixed >> 4, full = p.full;
        if (t === 1) { // CONNECT → CONNACK(rc=0)
          sock.write(pack(0x20, Buffer.from([0x00, 0x00])));
        } else if (t === 8) { // SUBSCRIBE
          const pid = p.payload.readUInt16BE(0), tl = p.payload.readUInt16BE(2), topic = p.payload.slice(4, 4 + tl).toString();
          if (!subs.has(topic)) subs.set(topic, []); subs.get(topic).push(sock);
          sock.write(pack(0x90, Buffer.concat([u16(pid), Buffer.from([0x00])])));
        } else if (t === 3) { // PUBLISH qos0
          const tl = p.payload.readUInt16BE(0), topic = p.payload.slice(2, 2 + tl).toString();
          (subs.get(topic) || []).forEach(s => { if (s !== sock) s.write(full); });
        }
      }
    });
  });
  return new Promise(res => srv.listen(port, () => res(srv)));
}
function parseFrame(buf) { if (buf.length < 2) return null; const fixed = buf[0]; let mul = 1, val = 0, i = 1, b; do { if (i >= buf.length) return null; b = buf[i++]; val += (b & 127) * mul; mul *= 128; } while (b & 128); const total = i + val; if (buf.length < total) return null; return { fixed, payload: buf.slice(i, total), total, full: buf.slice(0, total) }; }
function pack(fixed, body) { return Buffer.concat([Buffer.from([fixed]), mqttLen(body.length), body]); }
function mqttLen(n) { const a = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; a.push(b); } while (n > 0); return Buffer.from(a); }
function u16(n) { const x = Buffer.alloc(2); x.writeUInt16BE(n, 0); return x; }

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const plc = await startModbusPLC(1502);
  const broker = await startMqttBroker(11883);
  const sim = spawn('node', [path.join(__dirname, 'lingnao-body-sim-server.js'), '8787'], { stdio: 'ignore' });
  await wait(800);

  console.log('\n── ① 标准文件优先：Modbus 点表导入（零歧义识别 AGV）──');
  {
    const link1 = Object.assign(E.detect('127.0.0.1:1502'), { protocol: 'modbus-tcp' });
    const r = await E.connect({
      link: link1,
      standardFile: { kind: 'point-table', data: { '40001': { slot: 'x', scale: 0.01 }, '40002': { slot: 'y', scale: 0.01 } } }
    });
    check('① 标准导入后识别成功', r.ok, r.ok ? 'class=' + r.adapter.class : r.note);
    check('① 识别为 AGV', r.ok && r.adapter.class === 'agv.planar.se2', r.ok ? 'conf=' + r.adapter.confidence : '');
    check('① toCanonical 把 reg→x/y', r.ok && r.adapter.toCanonical({ '40001': 1234, '40002': 5678 }).x === 12.34, r.ok ? JSON.stringify(r.adapter.toCanonical({ '40001': 1234, '40002': 5678 })) : '');
    const s = r.ok ? await r.adapter.send({ slot: 'x', value: 5.0 }) : null;
    check('① send 经点表写寄存器(scale 还原)', r.ok && s && s.ok && s.wrote && s.wrote.value === 500, s ? JSON.stringify(s) : '');
  }

  console.log('\n── ② 拓扑模糊识别：MQTT 无线 JSON 遥测（无人机 SE(3)）──');
  {
    // 用 LL client 扮演"设备"往 state topic 发 JSON
    const dev = new LL.MqttClient({ host: '127.0.0.1', port: 11883, clientId: 'dev-drone' });
    await dev.connect();
    await wait(150);
    // 直接对样本识类（拓扑结构识别）
    const obs = { variables: { lat: 'number', lon: 'number', alt: 'number', battery: 'number', armed: 'number' }, actions: [] };
    const c2 = require('./lingnao-body-library.js').classify(obs);
    check('② 无人机 SE(3) 拓扑识别成功', c2.matched && c2.best.id === 'uav.multirotor', JSON.stringify({ best: c2.best && c2.best.id, conf: c2.confidence }));
    // 引擎先订阅再等上报（broker 不排队，必须先订阅；留足订阅握手时间）
    const p2 = E.connect({ url: 'mqtt://127.0.0.1:11883', deviceId: 'drone2', stateTopic: 'plant/drone2/state' });
    await wait(400);
    await dev.publish('plant/drone2/state', Buffer.from(JSON.stringify({ lat: 23.1, lon: 113.2, alt: 50, battery: 80, armed: 1 })));
    const r2 = await p2;
    check('② 引擎经 MQTT 摄入并识别无人机', r2.ok && r2.adapter.class === 'uav.multirotor', r2.ok ? 'conf=' + r2.adapter.confidence : r2.note);
    dev.close();
  }

  console.log('\n── ③ 锚定兜底：封闭私有无标签 Modbus → 锚 1 槽重识别 ──');
  {
    // 裸寄存器无点表：先连（识别不了），再锚定
    const link3 = Object.assign(E.detect('127.0.0.1:1502'), { protocol: 'modbus-tcp' });
    const r0 = await E.connect({ link: link3 });
    check('③ 无点表/无锚定 → 诚实 needsAnchor', !r0.ok && r0.needsAnchor, r0.note);
    const r1 = await E.connect({ link: link3, anchor: { '40001': 'x', '40002': 'y' } });
    check('③ 锚定 1 个语义槽后识别成功', r1.ok && r1.adapter.class === 'agv.planar.se2', r1.ok ? 'class=' + r1.adapter.class : r1.note);
    check('③ 锚定后 toCanonical 生效', r1.ok && r1.adapter.toCanonical({ '40001': 1234, '40002': 5678 }).x === 1234, r1.ok ? JSON.stringify(r1.adapter.toCanonical({ '40001': 1234, '40002': 5678 })) : '');
  }

  console.log('\n── ④ OPC-UA Companion Spec 语义导入（精确识别六轴臂）──');
  {
    const r = E.importStandard('companion', { nodes: [
      { browseName: 'Joint1', dataType: 'double', semanticSlot: 'j1' },
      { browseName: 'Joint2', dataType: 'double', semanticSlot: 'j2' },
      { browseName: 'Joint3', dataType: 'double', semanticSlot: 'j3' },
      { browseName: 'Joint4', dataType: 'double', semanticSlot: 'j4' },
      { browseName: 'Joint5', dataType: 'double', semanticSlot: 'j5' },
      { browseName: 'Joint6', dataType: 'double', semanticSlot: 'j6' }
    ] });
    const observed = { variables: r.nameMap, actions: [] };
    const cls = require('./lingnao-body-library.js').classify(observed);
    check('④ Companion 导入后精确识别六轴臂', cls.matched && cls.best.id === 'arm.6dof', JSON.stringify({ best: cls.best && cls.best.id, conf: cls.confidence, map: r.nameMap }));
  }

  console.log('\n── ⑤ ws 真身体（仿真 AGV）零填写接入 ──');
  {
    const r = await E.connect({ url: 'ws://localhost:8787' });
    check('⑤ ws 真身体自动识别为 AGV', r.ok && r.adapter.class === 'agv.planar.se2', r.ok ? 'conf=' + r.adapter.confidence : r.note);
    const s5 = r.ok ? await r.adapter.send({ cap: 'step_A_B' }) : null;
    check('⑤ ws 适配器 send 可翻译命令', r.ok && s5 && s5.ok, s5 ? JSON.stringify(s5) : '');
  }

  plc.close(); broker.close(); sim.kill();
  console.log('\n══════════════════════════════════');
  console.log('  通过 ' + pass + ' / 失败 ' + fail);
  console.log('══════════════════════════════════');
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e); process.exit(2); });

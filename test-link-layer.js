/*
 * 灵脑链路层自测：无线(MQTT) + 有线(Modbus-TCP) 两个真实驱动端到端验证
 * 不依赖真实硬件——内嵌仿真 PLC / 仿真 broker（均 net 零依赖）。
 */
const net = require('net');
const LL = require('./lingnao-link-layer.js');

let pass = 0, fail = 0;
function ok(name, cond) { (cond ? pass++ : fail++); console.log((cond ? '  PASS ' : '  FAIL ') + name); }

// ── 仿真 Modbus-TCP PLC ──────────────────────────────────────────
function startFakePlc(port) {
  const regs = new Array(16).fill(0).map((_, i) => 1000 + i);   // 保持寄存器
  const coils = new Array(8).fill(0);
  const srv = net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 7) {
        const len = buf.readUInt16BE(4), total = 6 + len;
        if (buf.length < total) break;
        const mbap = buf.slice(0, 7), pdu = buf.slice(7, total);
        buf = buf.slice(total);
        const tid = mbap.readUInt16BE(0), unit = mbap[6], fc = pdu[0];
        let resp;
        if (fc === 0x03) {
          const addr = pdu.readUInt16BE(1), qty = pdu.readUInt16BE(3);
          const body = Buffer.alloc(1 + qty * 2); body[0] = qty * 2;
          for (let i = 0; i < qty; i++) body.writeUInt16BE(regs[addr + i], 1 + i * 2);
          resp = Buffer.concat([Buffer.from([0x03]), body]);
        } else if (fc === 0x06) {
          const addr = pdu.readUInt16BE(1), val = pdu.readUInt16BE(3); regs[addr] = val;
          resp = pdu;
        } else if (fc === 0x10) {
          const addr = pdu.readUInt16BE(1), qty = pdu.readUInt16BE(3);
          for (let i = 0; i < qty; i++) regs[addr + i] = pdu.readUInt16BE(6 + i * 2);
          resp = Buffer.from([0x10, pdu[1], pdu[2], pdu[3], pdu[4]]);
        } else if (fc === 0x01) {
          const addr = pdu.readUInt16BE(1), qty = pdu.readUInt16BE(3);
          const n = Math.ceil(qty / 8); const body = Buffer.alloc(1 + n); body[0] = n;
          for (let i = 0; i < qty; i++) if (coils[addr + i]) body[1 + (i >> 3)] |= (1 << (i & 7));
          resp = Buffer.concat([Buffer.from([0x01]), body]);
        } else if (fc === 0x05) {
          const addr = pdu.readUInt16BE(1); coils[addr] = (pdu.readUInt16BE(3) === 0xff00) ? 1 : 0; resp = pdu;
        } else { resp = Buffer.from([fc | 0x80, 0x01]); }
        const out = Buffer.alloc(7); out.writeUInt16BE(tid, 0); out.writeUInt16BE(0, 2); out.writeUInt16BE(resp.length + 1, 4); out.writeUInt8(unit, 6);
        sock.write(Buffer.concat([out, resp]));
      }
    });
  });
  return new Promise((res) => srv.listen(port, () => res(srv)));
}

// ── 仿真 MQTT broker（connect/subscribe/publish 环回）──────────────
function startFakeBroker(port) {
  const clients = new Map();   // sock -> Set(topic)
  const srv = net.createServer((sock) => {
    let buf = Buffer.alloc(0); clients.set(sock, new Set());
    const send = (fixed, body) => sock.write(Buffer.concat([Buffer.from([fixed]), mqttLen(body.length), body]));
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      let p;
      while ((p = parseFrame(buf))) {
        buf = buf.slice(p.total); const t = p.fixed >> 4;
        if (t === 1) {  // CONNECT
          send(0x20, Buffer.from([0x00, 0x00]));
        } else if (t === 8) {  // SUBSCRIBE
          const pid = p.payload.readUInt16BE(0); const tl = p.payload.readUInt16BE(2);
          const topic = p.payload.slice(4, 4 + tl).toString('utf8');
          clients.get(sock).add(topic);
          send(0x90, Buffer.concat([u16(pid), Buffer.from([0x00])]));
        } else if (t === 3) {  // PUBLISH qos0
          const tl = p.payload.readUInt16BE(0); const topic = p.payload.slice(2, 2 + tl).toString('utf8');
          const data = p.payload.slice(2 + tl);
          clients.forEach((topics, cs) => { if (topics.has(topic)) { const b = Buffer.concat([u16(topic.length), Buffer.from(topic), data]); cs.write(Buffer.concat([Buffer.from([0x30]), mqttLen(b.length), b])); } });
        }
      }
    });
    sock.on('close', () => clients.delete(sock));
  });
  function mqttLen(n) { const a = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; a.push(b); } while (n > 0); return Buffer.from(a); }
  function u16(n) { const x = Buffer.alloc(2); x.writeUInt16BE(n, 0); return x; }
  function parseFrame(buf) {
    if (buf.length < 2) return null; const fixed = buf[0]; let mul = 1, val = 0, i = 1, b;
    do { if (i >= buf.length) return null; b = buf[i++]; val += (b & 127) * mul; mul *= 128; } while (b & 128);
    if (buf.length < i + val) return null; return { fixed, payload: buf.slice(i, i + val), total: i + val };
  }
  return new Promise((res) => srv.listen(port, () => res(srv)));
}

(async () => {
  console.log('== 链路层自测：无线 + 有线 ==\n');

  // 1. 介质/协议分类
  console.log('[1] classifyLink（无线/有线 推断）');
  ok('ws://...:8787 → 协议 ws / 介质 agnostic', (() => { const r = LL.classifyLink('ws://localhost:8787'); return r.protocol === 'ws' && r.mediumHint === 'agnostic'; })());
  ok('modbus://192.168.1.10:502 → 协议 modbus-tcp / 介质 wired', (() => { const r = LL.classifyLink('modbus://192.168.1.10:502'); return r.protocol === 'modbus-tcp' && r.mediumHint === 'wired'; })());
  ok('mqtt://broker:1883 → 协议 mqtt / 介质 wireless', (() => { const r = LL.classifyLink('mqtt://broker:1883'); return r.protocol === 'mqtt' && r.mediumHint === 'wireless'; })());
  ok('opc.tcp://plc:4840 → 协议 opc-ua / 介质 wired', (() => { const r = LL.classifyLink('opc.tcp://plc:4840'); return r.protocol === 'opc-ua' && r.mediumHint === 'wired'; })());
  ok('裸地址 10.0.0.5:502 → 协议 modbus-tcp / 介质 wired', (() => { const r = LL.classifyLink('10.0.0.5:502'); return r.protocol === 'modbus-tcp' && r.mediumHint === 'wired'; })());
  ok('LINK_MEDIA 含 wired/wireless 各 5 类介质', Object.keys(LL.LINK_MEDIA.wired.items).length === 5 && Object.keys(LL.LINK_MEDIA.wireless.items).length === 5);

  // 2. 有线驱动：Modbus-TCP 端到端
  console.log('\n[2] 有线 Modbus-TCP（仿真 PLC）');
  const plc = await startFakePlc(1502);
  const mb = new LL.ModbusTcpClient({ host: '127.0.0.1', port: 1502, unit: 1 });
  const t0 = Date.now();
  await mb.connect();
  const r1 = await mb.readHoldingRegisters(0, 4);
  ok('读保持寄存器 [1000,1001,1002,1003]', JSON.stringify(r1) === JSON.stringify([1000, 1001, 1002, 1003]));
  await mb.writeSingleRegister(2, 7777);
  const r2 = await mb.readHoldingRegisters(2, 1);
  ok('写单寄存器 reg[2]=7777', r2[0] === 7777);
  await mb.writeMultipleRegisters(4, [11, 22, 33]);
  const r3 = await mb.readHoldingRegisters(4, 3);
  ok('写多寄存器 [11,22,33]', JSON.stringify(r3) === JSON.stringify([11, 22, 33]));
  await mb.writeCoil(0, 1);
  const c1 = await mb.readCoils(0, 2);
  ok('写线圈 coil[0]=1', c1[0] === 1 && c1[1] === 0);
  mb.close();
  const q = new LL.LinkQuality({ timeoutMs: 5000 }); q.markRoundTrip(Date.now() - t0); q.markSeen();
  ok('LinkQuality 测到 RTT 且未过期', q.rttAvg() != null && q.stale() === false);
  plc.close();

  // 3. 无线驱动：MQTT 端到端
  console.log('\n[3] 无线 MQTT（仿真 broker，发布→订阅环回）');
  const brk = await startFakeBroker(1883);
  const got = [];
  const mq = new LL.MqttClient({ host: '127.0.0.1', port: 1883, clientId: 'ln-test' });
  await mq.connect();
  ok('MQTT 连接 CONNACK 成功', true);
  await mq.subscribe('plant/agv1/cmd');
  ok('订阅 plant/agv1/cmd 成功', true);
  mq.on('message', (topic, payload) => { got.push({ topic, payload: payload.toString() }); });
  await mq.publish('plant/agv1/cmd', Buffer.from(JSON.stringify({ x: 5, y: 3 })));
  await new Promise((r) => setTimeout(r, 150));   // 等 broker 环回
  ok('发布被订阅端收到（无线链路环回）', got.length === 1 && got[0].topic === 'plant/agv1/cmd' && JSON.parse(got[0].payload).x === 5);
  mq.close();
  brk.close();

  console.log('\n== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试异常:', e); process.exit(1); });

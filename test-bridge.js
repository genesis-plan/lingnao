/*
 * 灵脑 Node 驱动桥自测：经桥连 Modbus(多为有线接口) + MQTT(无线) 真实驱动，
 * 验证 探协议→连驱动→摄入→识类→驱动命令→状态新鲜度 全链路。
 */
const net = require('net');
const http = require('http');
const LL = require('./lingnao-link-layer.js');
let pass = 0, fail = 0;
function ok(n, c) { (c ? pass++ : fail++); console.log((c ? '  PASS ' : '  FAIL ') + n); }
function get(url) { return new Promise((res, rej) => { http.get(url, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej); }); }
function post(url, body) { return new Promise((res, rej) => { const data = JSON.stringify(body || {}); const u = new URL(url, 'http://localhost'); const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }); req.on('error', rej); req.write(data); req.end(); }); }

// 仿真 PLC / broker（同 link-layer 自测）
function startFakePlc(port) {
  const regs = new Array(16).fill(0).map((_, i) => 1000 + i); const coils = new Array(8).fill(0);
  const srv = net.createServer((sock) => { let buf = Buffer.alloc(0); sock.on('data', (d) => { buf = Buffer.concat([buf, d]); while (buf.length >= 7) { const len = buf.readUInt16BE(4), total = 6 + len; if (buf.length < total) break; const mbap = buf.slice(0, 7), pdu = buf.slice(7, total); buf = buf.slice(total); const tid = mbap.readUInt16BE(0), unit = mbap[6], fc = pdu[0]; let resp; if (fc === 0x03) { const addr = pdu.readUInt16BE(1), qty = pdu.readUInt16BE(3); const body = Buffer.alloc(1 + qty * 2); body[0] = qty * 2; for (let i = 0; i < qty; i++) body.writeUInt16BE(regs[addr + i], 1 + i * 2); resp = Buffer.concat([Buffer.from([0x03]), body]); } else if (fc === 0x06) { const addr = pdu.readUInt16BE(1), val = pdu.readUInt16BE(3); regs[addr] = val; resp = pdu; } else if (fc === 0x10) { const addr = pdu.readUInt16BE(1), qty = pdu.readUInt16BE(3); for (let i = 0; i < qty; i++) regs[addr + i] = pdu.readUInt16BE(6 + i * 2); resp = Buffer.from([0x10, pdu[1], pdu[2], pdu[3], pdu[4]]); } else if (fc === 0x01) { const addr = pdu.readUInt16BE(1), qty = pdu.readUInt16BE(3); const n = Math.ceil(qty / 8); const body = Buffer.alloc(1 + n); body[0] = n; for (let i = 0; i < qty; i++) if (coils[addr + i]) body[1 + (i >> 3)] |= (1 << (i & 7)); resp = Buffer.concat([Buffer.from([0x01]), body]); } else if (fc === 0x05) { const addr = pdu.readUInt16BE(1); coils[addr] = (pdu.readUInt16BE(3) === 0xff00) ? 1 : 0; resp = pdu; } else resp = Buffer.from([fc | 0x80, 0x01]); const out = Buffer.alloc(7); out.writeUInt16BE(tid, 0); out.writeUInt16BE(0, 2); out.writeUInt16BE(resp.length + 1, 4); out.writeUInt8(unit, 6); sock.write(Buffer.concat([out, resp])); } }); });
  return new Promise((r) => srv.listen(port, () => r(srv)));
}
function startFakeBroker(port) {
  const clients = new Map(); const srv = net.createServer((sock) => { let buf = Buffer.alloc(0); clients.set(sock, new Set()); const send = (f, b) => sock.write(Buffer.concat([Buffer.from([f]), mqttLen(b.length), b])); sock.on('data', (d) => { buf = Buffer.concat([buf, d]); let p; while ((p = parseFrame(buf))) { buf = buf.slice(p.total); const t = p.fixed >> 4; if (t === 1) send(0x20, Buffer.from([0x00, 0x00])); else if (t === 8) { const pid = p.payload.readUInt16BE(0), tl = p.payload.readUInt16BE(2); const topic = p.payload.slice(4, 4 + tl).toString('utf8'); clients.get(sock).add(topic); send(0x90, Buffer.concat([u16(pid), Buffer.from([0x00])])); } else if (t === 3) { const tl = p.payload.readUInt16BE(0), topic = p.payload.slice(2, 2 + tl).toString('utf8'), data = p.payload.slice(2 + tl); clients.forEach((topics, cs) => { if (topics.has(topic)) { const b = Buffer.concat([u16(topic.length), Buffer.from(topic), data]); cs.write(Buffer.concat([Buffer.from([0x30]), mqttLen(b.length), b])); } }); } } }); sock.on('close', () => clients.delete(sock)); });
  function mqttLen(n) { const a = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; a.push(b); } while (n > 0); return Buffer.from(a); }
  function u16(n) { const x = Buffer.alloc(2); x.writeUInt16BE(n, 0); return x; }
  function parseFrame(buf) { if (buf.length < 2) return null; const fixed = buf[0]; let mul = 1, val = 0, i = 1, b; do { if (i >= buf.length) return null; b = buf[i++]; val += (b & 127) * mul; mul *= 128; } while (b & 128); if (buf.length < i + val) return null; return { fixed, payload: buf.slice(i, i + val), total: i + val }; }
  return new Promise((r) => srv.listen(port, () => r(srv)));
}

(async () => {
  console.log('== 灵脑 Node 驱动桥自测 ==\n');
  const plc = await startFakePlc(1502);
  const brk = await startFakeBroker(1883);
  require('./lingnao-body-bridge-node.js');   // 启动桥 :8799
  await new Promise((r) => setTimeout(r, 300));

  console.log('[1] 健康');
  const h = await get('http://localhost:8799/health'); ok('桥 /health 在线', h.ok === true);

  console.log('\n[2] 经桥连 Modbus-TCP（多为有线接口）');
  const mc = await post('http://localhost:8799/connect', { url: 'modbus://127.0.0.1:1502' });
  ok('协议=modbus-tcp / 介质=wired', mc.protocol === 'modbus-tcp' && mc.medium === 'wired');
  ok('返回 sessionId', typeof mc.sessionId === 'number');
  ok('摄入到 16 个保持寄存器', Object.keys(mc.sample).length === 16);
  ok('识类引擎已跑（裸寄存器诚实 needsAnchor）', mc.match && mc.match.needsAnchor === true);
  const mcmd = await post('http://localhost:8799/command', { session: mc.sessionId, register: 3, value: 4242 });
  ok('经桥写寄存器 reg3=4242', mcmd.ok === true && mcmd.wrote.value === 4242);
  const ms = await get('http://localhost:8799/state?session=' + mc.sessionId);
  ok('状态新鲜度未过期(stale=false)', ms.ok && ms.quality.stale === false);

  console.log('\n[3] 经桥连 MQTT（无线）');
  // 先起桥订阅 plant/device/state，再发状态（AGV 语义 → 应自动识类 AGV）
  const mqc = await post('http://localhost:8799/connect', { url: 'mqtt://127.0.0.1:1883', deviceId: 'agv1' });
  ok('协议=mqtt / 介质=wireless', mqc.protocol === 'mqtt' && mqc.medium === 'wireless');
  ok('返回 sessionId', typeof mqc.sessionId === 'number');
  // 用独立 MQTT 客户端发布 AGV 状态到 plant/agv1/state
  const pub = new LL.MqttClient({ host: '127.0.0.1', port: 1883, clientId: 'test-pub' });
  await pub.connect();
  await pub.publish('plant/agv1/state', Buffer.from(JSON.stringify({ location: 'A', battery: 80, target: 'C' })));
  await new Promise((r) => setTimeout(r, 400));
  const mqs = await get('http://localhost:8799/state?session=' + mqc.sessionId);
  ok('桥收到 AGV 状态(location=A)', mqs.ok && mqs.sample && mqs.sample.location === 'A');
  // 重新识类（用收到的状态样本）
  const cls2 = LIB_classify(mqs.sample);
  ok('AGV 状态 → 自动识类 AGV', cls2.matched && cls2.best.id === 'agv.planar.se2');
  const mqcmd = await post('http://localhost:8799/command', { session: mqc.sessionId, topic: 'plant/agv1/cmd', payload: JSON.stringify({ go: 'C' }) });
  ok('经桥向设备发命令(无线)', mqcmd.ok === true);

  function LIB_classify(sample) { const LIB = require('./lingnao-body-library.js'); return LIB.classify({ protocol: 'mqtt', variables: sample, actions: [] }, {}); }

  plc.close(); brk.close();
  console.log('\n== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('桥测试异常:', e); process.exit(1); });

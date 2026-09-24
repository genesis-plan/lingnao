/*
 * 灵脑 LingNao · 物理接入 Node 驱动桥（零依赖）
 * ────────────────────────────────────────────────────────────
 * 目的：浏览器无法直接建裸 TCP（Modbus-TCP / MQTT），所以这些"机器有限接口"
 *       在 Node 侧跑——本桥用 lingnao-link-layer.js 真实驱动连设备，把
 *       识类结果 / 实时状态 / 链路新鲜度(SAFE-STOP) 经 HTTP 喂给控制台。
 *       ws 接口浏览器可直连，桥只做校验并提示前端直连。
 *
 * 轴（用户拍板）：连机器 = 无线（空中链路） + 插机器本来的各类接口（有限集）。
 *   本桥专注"插机器接口"那路（Modbus-TCP=多为有线 / MQTT=无线），
 *   把真实驱动结果归一为 {protocol, medium, match, sample} 交前端。
 *
 * 端点：
 *   GET  /health
 *   POST /connect   {url, variables?, deviceId?} → 探协议+连驱动+摄入+识类
 *   GET  /state?session=ID            → 最近一次摄入样本 + 链路质量(RTT/过期)
 *   POST /command   {session, register?, value? | topic?, payload?} → 转发到设备
 *
 * 用法：node lingnao-body-bridge-node.js   （默认 :8799，BRIDGE_PORT 可改）
 */
'use strict';
const http = require('http');
const LL = require('./lingnao-link-layer.js');
const LIB = require('./lingnao-body-library.js');

const PORT = parseInt(process.env.BRIDGE_PORT || '8799', 10);
const sessions = new Map();
let sid = 0;

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = ''; req.on('data', (c) => d += c);
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
  });
}

// 探协议 + 识类（name 基，对摄入的变量名/能力比结构）
function classifyWith(link, variables, actions) {
  const observed = { protocol: link.protocol, variables: variables || {}, actions: actions || [] };
  const cls = LIB.classify(observed, {});
  return cls;
}

async function connectModbus(link) {
  const c = new LL.ModbusTcpClient({ host: link.host, port: link.port, unit: 1, timeoutMs: 4000 });
  await c.connect();
  const regs = await c.readHoldingRegisters(0, 16);
  const variables = {}; regs.forEach((v, i) => variables['reg' + i] = 'number');
  const id = ++sid;
  const quality = new LL.LinkQuality({ timeoutMs: 5000 });
  quality.markSeen();   // 读寄存器即一次有效交互，刷新新鲜度
  sessions.set(id, { kind: 'modbus', client: c, url: link.url, host: link.host, port: link.port,
    lastSample: { regs: regs }, quality: quality });
  return { id: id, variables: variables };
}

async function connectMqtt(link, deviceId) {
  const id = ++sid;
  const c = new LL.MqttClient({ host: link.host, port: link.port, clientId: 'lingnao-bridge-' + Date.now() });
  await c.connect();
  const stateTopic = 'plant/' + (deviceId || 'device') + '/state';
  const cmdTopic = 'plant/' + (deviceId || 'device') + '/cmd';
  const sess = { kind: 'mqtt', client: c, url: link.url, host: link.host, port: link.port,
    stateTopic: stateTopic, cmdTopic: cmdTopic, lastSample: null,
    quality: new LL.LinkQuality({ timeoutMs: 5000 }) };
  sessions.set(id, sess);
  c.on('message', (t, p) => {
    if (t === stateTopic) {
      try { sess.lastSample = JSON.parse(p.toString()); } catch (e) { sess.lastSample = { raw: p.toString() }; }
      sess.quality.markSeen();
    }
  });
  await c.subscribe(stateTopic);
  // 等首个状态上报（最多 2.5s），否则返回空样本（前端提示"等待设备上报"）
  const waited = await new Promise((resolve) => {
    const to = setTimeout(resolve, 2500);
    const iv = setInterval(() => { if (sess.lastSample) { clearTimeout(to); clearInterval(iv); resolve(true); } }, 120);
  });
  return { id: id, variables: sess.lastSample || {}, waited: waited };
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && u.pathname === '/health') return send(res, 200, { ok: true, sessions: sessions.size });

    if (req.method === 'POST' && u.pathname === '/connect') {
      const body = await readBody(req);
      const link = LL.classifyLink(body.url || '');
      if (!link.protocol) return send(res, 400, { ok: false, error: '无法从地址识别协议' });
      if (link.protocol === 'ws') {
        return send(res, 200, { ok: true, protocol: 'ws', medium: 'agnostic',
          needsBrowserDirect: true, note: 'ws 浏览器可直连，前端走身体桥' });
      }
      if (link.protocol === 'modbus-tcp') {
        const r = await connectModbus(link);
        const cls = classifyWith(link, r.variables, []);
        return send(res, 200, { ok: true, protocol: 'modbus-tcp', medium: 'wired',
          sessionId: r.id, match: cls, sample: r.variables,
          note: '已连经 Node 桥（多为有线接口），读到 ' + Object.keys(r.variables).length + ' 个保持寄存器' });
      }
      if (link.protocol === 'mqtt') {
        const r = await connectMqtt(link, body.deviceId);
        const cls = classifyWith(link, r.variables, []);
        return send(res, 200, { ok: true, protocol: 'mqtt', medium: 'wireless',
          sessionId: r.id, match: cls, sample: r.variables,
          note: r.waited ? '已订阅并收到设备状态（无线链路）' : '已订阅，等待设备上报状态…' });
      }
      return send(res, 200, { ok: true, protocol: link.protocol, supported: false,
        medium: link.mediumHint, note: '该协议真实驱动待补（OPC-UA 等）' });
    }

    if (req.method === 'GET' && u.pathname === '/state') {
      const id = +u.searchParams.get('session');
      const s = sessions.get(id);
      if (!s) return send(res, 404, { ok: false, error: 'session 不存在' });
      return send(res, 200, { ok: true, kind: s.kind, sample: s.lastSample, quality: s.quality.report() });
    }

    if (req.method === 'POST' && u.pathname === '/command') {
      const body = await readBody(req);
      const s = sessions.get(+body.session);
      if (!s) return send(res, 404, { ok: false, error: 'session 不存在' });
      if (s.kind === 'modbus') {
        const reg = (body.register != null) ? body.register : 0;
        const val = (body.value != null) ? body.value : 0;
        await s.client.writeSingleRegister(reg, val);
        s.quality.markSeen();
        return send(res, 200, { ok: true, kind: 'modbus', wrote: { register: reg, value: val } });
      }
      if (s.kind === 'mqtt') {
        const payload = (body.payload != null) ? body.payload : (body.topic ? null : JSON.stringify(body.params || {}));
        await s.client.publish(body.topic || s.cmdTopic, Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)));
        s.quality.markSeen();
        return send(res, 200, { ok: true, kind: 'mqtt', published: body.topic || s.cmdTopic });
      }
      return send(res, 400, { ok: false, error: 'session 类型不可驱动' });
    }

    return send(res, 404, { ok: false, error: 'not found' });
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, () => console.log('[lingnao-body-bridge] 监听 http://localhost:' + PORT + '（物理接入 Node 驱动桥）'));
module.exports = server;

/*
 * 灵脑 LingNao · 真实身体仿真服务端（零依赖 WebSocket）
 * ────────────────────────────────────────────────────────────
 * 不用任何 npm 包，手工实现 RFC6455 握手 + 帧编解码，模拟一台
 * 「仓储搬运 AGV」真身体：它自己持有物理世界（位置图），校验动作
 * 是否真实可行，回报观测态，可被大脑指令复位 / 注入故障。
 *
 * 跑法：  node lingnao-body-sim-server.js [port]   （默认 8787）
 * 然后控制台选「真实身体（WebSocket）」填 ws://localhost:8787 连接。
 *
 * 注意：这是「仿真真身体」，用来证明真实驱动桥端到端可跑。
 * 接你自己的真机器人时，只需让机器人实现同样的 {action→result}
 * 协议（收到 cap+params，执行，回报 {ok,state}），并在 connect 时回 hello-ack。
 */
'use strict';
const http = require('http');
const crypto = require('crypto');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// 身体协议版本，须与 lingnao-body-bridge.js 的 BODY_PROTOCOL 主版本一致
const BODY_PROTOCOL = '1.0';

function acceptKey(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

// 服务端 → 客户端：文本帧（不加掩码）
function encodeText(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) { header = Buffer.from([0x81, len]); }
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}
// 控制帧（ping/pong/close），服务端→客户端不加掩码
function encodeCtrl(opcode, payload) {
  const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || '');
  const len = buf.length;
  let header;
  if (len < 126) { header = Buffer.from([0x80 | opcode, len]); }
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, buf]);
}

// 客户端 → 服务端：解析掩码帧
function tryDecode(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const fin = (buf[0] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let offset = 2;
  if (len === 126) { if (buf.length < 4) return null; len = buf.readUInt16BE(2); offset = 4; }
  else if (len === 127) { if (buf.length < 10) return null; len = Number(buf.readBigUInt64BE(2)); offset = 10; }
  const masked = (buf[1] & 0x80) !== 0;
  let mask = null;
  if (masked) { if (buf.length < offset + 4) return null; mask = buf.slice(offset, offset + 4); offset += 4; }
  if (buf.length < offset + len) return null;
  let payload = buf.slice(offset, offset + len);
  if (masked) { const out = Buffer.alloc(len); for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3]; payload = out; }
  return { fin, opcode, payload, rest: buf.slice(offset + len) };
}

function start(port) {
  port = port || parseInt(process.env.BODY_PORT || '8787', 10);

  // 身体的物理世界（与服务端演示身体一致）
  const WORLD = { CHARGE: ['A'], A: ['B', 'CHARGE'], B: ['C', 'A'], C: ['B', 'D'], D: ['C'] };
  let truth = { location: 'CHARGE' };
  let failNext = null;   // 持续失败的能力
  let failOnce = null;   // 单次失败

  const server = http.createServer((req, res) => { res.writeHead(426); res.end('WebSocket only'); });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      'Sec-WebSocket-Version: 13\r\n' +
      'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n'
    );

    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      let f;
      while ((f = tryDecode(buf))) {
        buf = f.rest;
        if (f.opcode === 0x8) { socket.end(); return; }            // close
        if (f.opcode === 0x9) { socket.write(encodeCtrl(0xA, f.payload)); continue; } // ping→pong
        if (f.opcode === 0x1) {                                     // text
          let msg; try { msg = JSON.parse(f.payload.toString('utf8')); } catch (e) { continue; }
          handleMsg(msg, socket);
        }
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => {});
  });

  function applyAction(cap) {
    if (failOnce && failOnce === cap) { failOnce = null; return { ok: false, error: 'injected single failure' }; }
    if (failNext && failNext === cap) { return { ok: false, error: 'injected persistent failure' }; }
    const m = /^step_(.+)_(.+)$/.exec(cap || '');
    if (!m) return { ok: false, error: 'unknown-capability:' + cap };
    const from = m[1], to = m[2];
    if (truth.location !== from) return { ok: false, error: 'precondition-failed: at ' + truth.location };
    const edges = WORLD[from] || [];
    if (edges.indexOf(to) < 0) return { ok: false, error: 'no-edge ' + from + '->' + to };
    truth = { location: to };
    return { ok: true, state: { location: to } };
  }

  function handleMsg(msg, socket) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'hello') {
      // 握手应答：声明身体协议版本（大脑比对 MAJOR，不符则拒绝连接）
      socket.write(encodeText(JSON.stringify({ type: 'hello-ack', id: msg.id, proto: BODY_PROTOCOL })));
      return;
    }
    if (msg.type === 'action') {
      const r = applyAction(msg.cap);
      socket.write(encodeText(JSON.stringify(Object.assign({ type: 'result', id: msg.id }, r))));
    } else if (msg.type === 'reset') {
      truth = (msg.state && msg.state.location) ? { location: msg.state.location } : { location: 'CHARGE' };
      failNext = msg.failNext || null;
      failOnce = msg.failOnce || null;
      socket.write(encodeText(JSON.stringify({ type: 'state', id: msg.id, state: { location: truth.location } })));
    } else if (msg.type === 'fail') {
      if (msg.mode === 'once') failOnce = msg.cap; else failNext = msg.cap;
      socket.write(encodeText(JSON.stringify({ type: 'ack', id: msg.id, mode: msg.mode, cap: msg.cap })));
    } else if (msg.type === 'ping') {
      socket.write(encodeText(JSON.stringify({ type: 'pong', t: msg.t })));
    }
  }

  server.listen(port, () => console.log('[body-sim] 真身体仿真服务端已启动 ws://localhost:' + port));
  return server;
}

if (require.main === module) {
  start(parseInt(process.argv[2] || process.env.BODY_PORT || '8787', 10));
}
module.exports = { start, acceptKey, encodeText, tryDecode, BODY_PROTOCOL };

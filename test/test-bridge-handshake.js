/*
 * 无头验证：真实身体桥的握手（协议版本协商）与 send 超时 fail-closed
 * 用极简身体服务端模拟三种行为：
 *   none     : 不回 hello-ack（模拟旧身体 / 不支持握手）
 *   mismatch : 回 hello-ack 但协议主版本不符
 *   silent   : 正常握手后忽略所有控制消息（触发 send 超时）
 */
'use strict';
const http = require('http');
const { acceptKey, encodeText, tryDecode, BODY_PROTOCOL } = require('../lingnao-body-sim-server.js');
const { createBodyBridge } = require('../lingnao-body-bridge.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  ' + extra : '')); }
}

// 极简身体服务端：只做 RFC6455 升级 + 帧收发，按 mode 决定握手行为
function startMockBody(port, mode) {
  const server = http.createServer((req, res) => { res.writeHead(426); res.end('x'); });
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n'
    );
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      let f;
      while ((f = tryDecode(buf))) {
        buf = f.rest;
        if (f.opcode === 0x8) { socket.end(); return; }   // close
        if (f.opcode === 0x1) {                            // text
          let msg; try { msg = JSON.parse(f.payload.toString('utf8')); } catch (e) { continue; }
          if (msg.type === 'hello') {
            if (mode === 'mismatch') socket.write(encodeText(JSON.stringify({ type: 'hello-ack', id: msg.id, proto: '9.0' })));
            else if (mode === 'silent') socket.write(encodeText(JSON.stringify({ type: 'hello-ack', id: msg.id, proto: BODY_PROTOCOL })));
            // mode==='none'：不回 hello-ack（模拟旧身体）
          }
          // silent 模式：握手后忽略所有控制消息 → 触发 send 超时
        }
      }
    });
    socket.on('error', () => {});
  });
  server.listen(port);
  return server;
}

(async () => {
  // 案例 A：身体不支持握手 → connect 必须 reject（fail-closed）
  console.log('\n[A] 身体无握手 → connect 拒绝');
  const sA = startMockBody(8801, 'none');
  await new Promise(r => setTimeout(r, 200));
  const bA = createBodyBridge('ws://localhost:8801', { helloTimeout: 800, timeout: 1000 });
  let errA = null;
  try { await bA.connect(); } catch (e) { errA = e; }
  check('connect 拒绝（无 hello-ack）', !!errA, errA ? errA.message : '竟连接成功');
  check('错误指明握手超时', !!errA && /handshake|握手/.test(errA.message), errA ? errA.message : '');
  check('连接未建立（isConnected=false）', !bA.isConnected());
  bA.disconnect(); sA.close();

  // 案例 B：协议主版本不符 → connect 必须 reject
  console.log('\n[B] 身体协议主版本不符 → connect 拒绝');
  const sB = startMockBody(8802, 'mismatch');
  await new Promise(r => setTimeout(r, 200));
  const bB = createBodyBridge('ws://localhost:8802', { helloTimeout: 800, timeout: 1000 });
  let errB = null;
  try { await bB.connect(); } catch (e) { errB = e; }
  check('connect 拒绝（协议不符）', !!errB, errB ? errB.message : '竟连接成功');
  check('错误指明 protocol mismatch', !!errB && /mismatch|protocol|协议/.test(errB.message), errB ? errB.message : '');
  bB.disconnect(); sB.close();

  // 案例 C：正常握手成功 + send 超时 fail-closed
  console.log('\n[C] 正常握手成功 → send 超时 fail-closed（拒绝而非谎称成功）');
  const sC = startMockBody(8803, 'silent');
  await new Promise(r => setTimeout(r, 200));
  const bC = createBodyBridge('ws://localhost:8803', { helloTimeout: 800, timeout: 600 });
  try { await bC.connect(); } catch (e) { console.error('connect 不应失败', e); process.exit(1); }
  check('connect 成功（握手 ok）', bC.isConnected());
  let errC = null;
  try { await bC.send({ type: 'reset', state: { location: 'CHARGE' } }); } catch (e) { errC = e; }
  check('send 超时 fail-closed（拒绝）', !!errC, errC ? errC.message : '竟 resolve 成功');
  check('错误指明 control timeout', !!errC && /control timeout|控制.*超时/.test(errC.message), errC ? errC.message : '');
  bC.disconnect(); sC.close();

  console.log('\n==== 握手/超时测试 ' + pass + '/' + (pass + fail) + ' 通过 ====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });

/*
 * 无头验证：身体桥的「物理现实性」守卫
 * ────────────────────────────────────────────────────────────
 * 背景：真实链路是 灵脑 → 身体适配器(软件) → 现场总线 → 传感器/执行器(纯物理)。
 * hello-ack 只能证明「对端软件在线」，证明不了物理侧存活与数据真伪。
 * 本测试验证四件物理上真正该保证的事：
 *   ① 连接存活 liveness  → 心跳看门狗：静默失效的身体必须被判死（fail-closed）
 *   ② 数据新鲜 freshness → 陈旧状态不许拿去规划（staleness）
 *   ③ 数据有效 validity  → 量程 / 变化率 / 卡死(stuck-at) 物理合理性校验
 *   ④ 慢 ≠ 死            → progress 帧延长 deadline；超过 maxActionTime 才判死
 *   ⑤ 动作幂等           → queryStatus 可查 running / done / unknown
 */
'use strict';
const http = require('http');
const { acceptKey, encodeText, tryDecode, BODY_PROTOCOL } = require('../lingnao-body-sim-server.js');
const { createBodyBridge, checkPlausibility, PHYSICAL_PRESET } = require('../lingnao-body-bridge.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  ' + extra : '')); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 可编程身体服务端：onMsg(msg, send, sock) 决定行为
function startMockBody(port, onMsg) {
  const server = http.createServer((req, res) => { res.writeHead(426); res.end('x'); });
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n'
    );
    const send = (obj) => { try { socket.write(encodeText(JSON.stringify(obj))); } catch (e) {} };
    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      let f;
      while ((f = tryDecode(buf))) {
        buf = f.rest;
        if (f.opcode === 0x8) { socket.end(); return; }
        if (f.opcode === 0x1) {
          let msg; try { msg = JSON.parse(f.payload.toString('utf8')); } catch (e) { continue; }
          try { onMsg(msg, send, socket); } catch (e) {}
        }
      }
    });
    socket.on('error', () => {});
  });
  server.listen(port);
  return server;
}

const ackBodies = (msg, send) => {
  if (msg.type === 'hello') send({ type: 'hello-ack', id: msg.id, proto: BODY_PROTOCOL });
};

(async () => {
  // ── ① 心跳看门狗：静默失效的身体必须被判死 ──────────────────
  console.log('\n[1] 身体静默失效（连 ping 都不回）→ 看门狗判死 fail-closed');
  {
    // 只回握手，之后彻底沉默：模拟拔网线 / MCU 复位 / WS 半开
    const s = startMockBody(8811, ackBodies);
    await sleep(150);
    let dead = null;
    const b = createBodyBridge('ws://localhost:8811', {
      helloTimeout: 800,
      heartbeatInterval: 200,
      heartbeatTimeout: 700,
      watchdogTick: 100,
      onDead: (r) => { dead = r; }
    });
    await b.connect();
    check('刚连上时 isConnected=true', b.isConnected());
    await sleep(1400);
    check('静默身体被判死（isConnected=false）', !b.isConnected(), String(b.isConnected()));
    check('给出 deadReason 且指明心跳超时', !!dead && /heartbeat timeout/.test(dead), dead || 'null');
    // 判死后不能继续下发动作
    let err = null;
    try { await b.adapter('move', {}); } catch (e) { err = e; }
    check('判死后下发动作被拒绝', !!err, err ? err.message : '竟放行');
    b.disconnect(); s.close();
  }

  // ── ① 心跳维持存活：会回 pong 的身体不该被误杀 ───────────────
  console.log('\n[2] 身体正常回 pong → 保持存活（不误杀）');
  {
    const s = startMockBody(8812, (msg, send) => {
      if (msg.type === 'hello') send({ type: 'hello-ack', id: msg.id, proto: BODY_PROTOCOL });
      if (msg.type === 'ping') send({ type: 'pong', t: msg.t });
    });
    await sleep(150);
    const b = createBodyBridge('ws://localhost:8812', {
      helloTimeout: 800,
      heartbeatInterval: 200,
      heartbeatTimeout: 700,
      watchdogTick: 100
    });
    await b.connect();
    await sleep(1500);   // 远超 heartbeatTimeout，但一直有 pong
    check('回 pong 的身体保持连接', b.isConnected());
    check('未产生 deadReason', b.deadReason() === null, String(b.deadReason()));
    check('心跳年龄 < 超时阈值', b.heartbeatAgeMs() < 700, b.heartbeatAgeMs() + 'ms');
    b.disconnect(); s.close();
  }

  // ── ② 数据新鲜度：陈旧状态不许拿去规划 ───────────────────────
  console.log('\n[3] 状态陈旧 → 拒绝据此行动（staleness）');
  {
    let sendState = null;
    const s = startMockBody(8813, (msg, send) => {
      if (msg.type === 'hello') {
        send({ type: 'hello-ack', id: msg.id, proto: BODY_PROTOCOL });
        sendState = send;
      }
      if (msg.type === 'ping') send({ type: 'pong', t: msg.t });
      if (msg.type === 'action') send({ type: 'result', id: msg.id, ok: true, state: { location: 'A' } });
    });
    await sleep(150);
    const b = createBodyBridge('ws://localhost:8813', {
      helloTimeout: 800,
      maxStateAge: 400,          // 400ms 不刷新即视为陈旧
      heartbeatInterval: 200, heartbeatTimeout: 700, watchdogTick: 100
    });
    await b.connect();
    sendState({ type: 'observation', state: { temp: 20 } });   // 注入一次状态
    await sleep(50);
    check('刚拿到状态时 isStale=false', !b.isStale(), 'age=' + b.stateAgeMs() + 'ms');
    let ok1 = null;
    try { ok1 = await b.adapter('move', {}); } catch (e) { ok1 = e; }
    check('新鲜状态下动作放行', ok1 && !(ok1 instanceof Error), ok1 instanceof Error ? ok1.message : 'ok');
    await sleep(600);            // 让状态过期
    check('超时后 isStale=true', b.isStale(), 'age=' + b.stateAgeMs() + 'ms');
    let err3 = null;
    try { await b.adapter('move', {}); } catch (e) { err3 = e; }
    check('陈旧状态拒绝行动', !!err3 && /state stale/.test(err3.message), err3 ? err3.message : '竟放行');
    b.disconnect(); s.close();
  }

  // ── ④ 慢 ≠ 死：progress 帧延长 deadline ────────────────────
  console.log('\n[4] 长动作持续报 progress → 不被误判超时（慢≠死）');
  {
    const s = startMockBody(8814, (msg, send) => {
      if (msg.type === 'hello') { send({ type: 'hello-ack', id: msg.id, proto: BODY_PROTOCOL }); return; }
      if (msg.type === 'ping') { send({ type: 'pong', t: msg.t }); return; }
      if (msg.type === 'action') {
        let n = 0;
        const t = setInterval(() => {
          n++;
          if (n <= 5) send({ type: 'progress', id: msg.id, pct: n * 20 });
          else { clearInterval(t); send({ type: 'result', id: msg.id, ok: true, state: { location: 'B' } }); }
        }, 100);
      }
    });
    await sleep(150);
    // 单帧超时只有 200ms，但 progress 每 100ms 续期 → 600ms 的长动作应能完成
    const b = createBodyBridge('ws://localhost:8814', {
      helloTimeout: 800, timeout: 200,
      heartbeatInterval: 200, heartbeatTimeout: 700, watchdogTick: 100
    });
    await b.connect();
    let res = null, err = null;
    try { res = await b.adapter('long_move', {}); } catch (e) { err = e; }
    check('长动作未被误杀（靠 progress 续期）', !err && res && res.ok === true, err ? err.message : 'ok');
    b.disconnect(); s.close();
  }

  // ── ④ 但无限期的"慢"必须封顶：maxActionTime ─────────────────
  console.log('\n[5] 无限期不完成的动作 → maxActionTime 封顶拒绝');
  {
    const s = startMockBody(8815, (msg, send) => {
      if (msg.type === 'hello') { send({ type: 'hello-ack', id: msg.id, proto: BODY_PROTOCOL }); return; }
      if (msg.type === 'ping') { send({ type: 'pong', t: msg.t }); return; }
      if (msg.type === 'action') {
        const t = setInterval(() => send({ type: 'progress', id: msg.id, pct: 1 }), 100);
        setTimeout(() => clearInterval(t), 5000);
      }
    });
    await sleep(150);
    const b = createBodyBridge('ws://localhost:8815', {
      helloTimeout: 800, timeout: 200, maxActionTime: 600,
      heartbeatInterval: 200, heartbeatTimeout: 700, watchdogTick: 100
    });
    await b.connect();
    let err = null;
    try { await b.adapter('never_ends', {}); } catch (e) { err = e; }
    check('超过 maxActionTime 被拒绝', !!err && /maxActionTime/.test(err.message), err ? err.message : '竟一直等');
    b.disconnect(); s.close();
  }

  // ── ③ 物理合理性校验（纯函数，确定性）────────────────────────
  console.log('\n[6] 传感器物理合理性：量程 / 变化率 / 卡死');
  {
    // 量程：温度 500°C 超出 -20~120 的物理量程
    let v = checkPlausibility({ temp: 500 }, null, 0, { fields: { temp: { min: -20, max: 120 } } }, []);
    check('超出物理量程被识别', !v.ok && v.issues.some(i => i.kind === 'out-of-range'),
      v.issues.map(i => i.kind).join(','));
    check('不通过时诚实标 U=true', v.U === true);

    // 变化率：1 秒内从 20°C 跳到 100°C，超出 5°C/s 的物理上界
    const t0 = Date.now() - 1000;
    v = checkPlausibility({ temp: 100 }, { temp: 20 }, t0, { fields: { temp: { maxRate: 5 } } }, []);
    check('物理上不可能的变化率被识别', !v.ok && v.issues.some(i => i.kind === 'rate-exceeds-physical'),
      v.issues.map(i => i.kind + ':' + i.detail).join(','));

    // 卡死：连续多次读数完全相同（传感器 stuck-at / 断线保持）
    const hist = [{ state: { temp: 50 } }, { state: { temp: 50 } }];
    v = checkPlausibility({ temp: 50 }, { temp: 50 }, t0,
      { fields: { temp: {} }, stuckAfter: 3 }, hist);
    check('传感器卡死(stuck-at)被识别', !v.ok && v.issues.some(i => i.kind === 'stuck-at'),
      v.issues.map(i => i.kind).join(','));

    // 正常数据不应误报
    v = checkPlausibility({ temp: 51 }, { temp: 50 }, t0,
      { fields: { temp: { min: -20, max: 120, maxRate: 5 } }, stuckAfter: 3 }, []);
    check('正常读数不误报', v.ok, v.issues.map(i => i.kind).join(',') || '无问题');
  }

  // ── ③ 集成：不合理读数必须拦住动作下发 ───────────────────────
  console.log('\n[7] 传感器读数物理上不合理 → 拒绝据此行动');
  {
    let sendState = null;
    const s = startMockBody(8816, (msg, send) => {
      if (msg.type === 'hello') { send({ type: 'hello-ack', id: msg.id, proto: BODY_PROTOCOL }); sendState = send; return; }
      if (msg.type === 'ping') { send({ type: 'pong', t: msg.t }); return; }
      if (msg.type === 'action') send({ type: 'result', id: msg.id, ok: true, state: { temp: 500 } });
    });
    await sleep(150);
    const b = createBodyBridge('ws://localhost:8816', {
      helloTimeout: 800,
      plausibility: { fields: { temp: { min: -20, max: 120 } } },
      heartbeatInterval: 200, heartbeatTimeout: 700, watchdogTick: 100
    });
    await b.connect();
    sendState({ type: 'observation', state: { temp: 500 } });   // 物理上不可能的读数
    await sleep(80);
    check('lastValidity 判定不通过', b.lastValidity().ok === false,
      JSON.stringify(b.lastValidity().issues.map(i => i.kind)));
    let err = null;
    try { await b.adapter('heat', {}); } catch (e) { err = e; }
    check('不合理读数拒绝行动', !!err && /state invalid/.test(err.message), err ? err.message : '竟放行');
    b.disconnect(); s.close();
  }

  // ── ⑤ 动作幂等：queryStatus 可查 ────────────────────────────
  console.log('\n[8] 动作幂等：running / done / unknown 可查询');
  {
    const s = startMockBody(8817, (msg, send) => {
      if (msg.type === 'hello') { send({ type: 'hello-ack', id: msg.id, proto: BODY_PROTOCOL }); return; }
      if (msg.type === 'ping') { send({ type: 'pong', t: msg.t }); return; }
      if (msg.type === 'action') setTimeout(() => send({ type: 'result', id: msg.id, ok: true, state: {} }), 300);
    });
    await sleep(150);
    const b = createBodyBridge('ws://localhost:8817', {
      helloTimeout: 800, timeout: 2000,
      heartbeatInterval: 200, heartbeatTimeout: 700, watchdogTick: 100
    });
    await b.connect();
    const p = b.adapter('dispense', {}, { actionId: 'dose-42' });   // 不 await
    await sleep(60);
    const ids = b.pendingActions();
    check('执行中可查到 pending 动作', ids.length === 1, ids.join(','));
    if (ids.length) {
      const st = b.queryStatus(ids[0]);
      check('执行中状态为 running', st.state === 'running', st.state);
    }
    await p;
    await sleep(30);
    const ids2 = b.pendingActions();
    check('完成后 pending 清空', ids2.length === 0, ids2.join(','));
    check('未知 id 返回 unknown', b.queryStatus('nope').state === 'unknown');
    b.disconnect(); s.close();
  }

  console.log('\n==== 身体物理现实性测试 ' + pass + '/' + (pass + fail) + ' 通过 ====');
  console.log('预设 PHYSICAL_PRESET = ' + JSON.stringify(PHYSICAL_PRESET));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });

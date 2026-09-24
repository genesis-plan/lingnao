/*
 * 灵脑 LingNao · 真实身体接入桥（WebSocket）
 * ────────────────────────────────────────────────────────────
 * 大脑保留 capability 模型（pre/eff/cost 用于「可审计规划」），
 * 本桥只负责把规划出的动作发到真实身体，并等身体的观测回报。
 * 规划在大脑、执行+感知在身体——职责分离，审计仍由大脑出。
 *
 * ★ 物理现实性（重要，别把软件会话当成物理现实）
 * ────────────────────────────────────────────────────────────
 * 真实链路是四层，不是一层：
 *   灵脑大脑(软件) ──► 身体适配器 bodyAdapter(软件,跑在上位机/PLC/ESP32)
 *                  ──► 现场总线(CAN / RS-485 Modbus / EtherCAT)
 *                  ──► 传感器·执行器(纯物理: 4-20mA/限位开关/编码器脉冲)
 *
 * 「回 hello-ack」的是**第 2 层的适配器软件**，不是传感器本身。
 * 4-20mA 变送器、限位开关、编码器脉冲根本没有回复通道——它们只能靠
 * 适配器轮询后合成状态。因此握手只能证明「对端软件在线」，
 * **证明不了物理侧存活，更证明不了数据是真的**。
 *
 * 所以本桥把三件事分开，各自用物理上正确的手段保证：
 *   ① 连接存活 liveness  → 心跳看门狗（ping/pong + 超时判死，fail-closed）
 *   ② 数据新鲜 freshness → 状态年龄（staleness），过期状态不许拿去规划
 *   ③ 数据有效 validity  → 物理合理性（量程 / 变化率 / 卡死 stuck-at）
 * 另加：④ 慢 ≠ 死（progress 帧延长 deadline）、⑤ 动作幂等（actionId 可查）
 *
 * 协议（JSON 文本帧）：
 *   大脑 → 身体 : {type:'hello', id, proto}             // 握手：声明大脑协议版本
 *   身体 → 大脑 : {type:'hello-ack', id, proto}         // 握手应答（适配器回，非传感器）
 *   大脑 → 身体 : {type:'ping', t}                      // 心跳（看门狗）
 *   身体 → 大脑 : {type:'pong', t}                      // 心跳应答
 *   大脑 → 身体 : {type:'action', id, cap, params, actionId?}
 *   身体 → 大脑 : {type:'progress', id, pct?, note?}    // 长动作进度（证明"慢"而非"死"）
 *   身体 → 大脑 : {type:'result', id, ok, state, error?}// 一次动作后的观测态
 *   身体 → 大脑 : {type:'observation', state}           // 身体自主上报（可选）
 *   大脑 → 身体 : {type:'reset', state, failNext?, failOnce?}
 *   大脑 → 身体 : {type:'fail', mode:'once'|'next', cap}
 *
 * 握手（fail-closed）：connect 时大脑先发 hello，适配器须回 hello-ack 且
 *   协议 MAJOR 相同，否则拒绝连接。破坏性协议变更不会静默失败。
 *
 * 零依赖：浏览器用原生 WebSocket；Node 22 用全局 WebSocket。
 */
(function (root) {
  'use strict';

  // 身体协议版本（major.minor）。破坏性变更须升 MAJOR；
  // 握手时只比对 MAJOR，不同则拒绝连接（fail-closed）。
  var BODY_PROTOCOL = '1.0';
  function protoMajor(v) { var m = /^(\d+)/.exec(v || ''); return m ? parseInt(m[1], 10) : -1; }

  // 物理现实性预设：真实部署建议显式传入或直接用这套。
  // 说明：结构性守卫（心跳/新鲜度）默认开启；领域性守卫（量程/变化率）
  // 必须由接入方声明——大脑不可能先验地知道某个温度传感器的物理量程。
  var PHYSICAL_PRESET = {
    heartbeatInterval: 5000,   // 每 5s 发一次 ping
    heartbeatTimeout: 15000,   // 15s 无任何入站帧 → 判定身体死亡（fail-closed）
    maxStateAge: 15000,        // 状态超过 15s 未刷新 → 视为陈旧，拒绝据此行动
    maxActionTime: 0,          // 0 = 不设总上限；>0 时 progress 最多把动作延长到该上限
    watchdogTick: 500          // 看门狗检查周期
  };

  function now() { return Date.now(); }

  // ── ③ 传感器物理合理性校验 ──────────────────────────────────
  // spec: { fields:{ <field>:{min,max,maxRate} }, stuckAfter:<n> }
  //   min/max   : 物理量程（超出即为不可能读数）
  //   maxRate   : 每秒最大物理变化率（超过即为物理上不可能的跳变）
  //   stuckAfter: 连续 n 次读数完全相同 → 疑似传感器卡死(stuck-at)
  // 返回 {ok, issues:[{field,kind,detail}], U}；不通过时 U:true（诚实标注不可信）
  function checkPlausibility(state, prev, prevT, spec, history) {
    var issues = [];
    if (!state || typeof state !== 'object' || !spec) return { ok: true, issues: issues, U: false };
    var t = now();
    var dt = prevT ? Math.max(1e-6, (t - prevT) / 1000) : 0;
    var fields = spec.fields || {};
    var keys = Object.keys(fields);
    keys.forEach(function (f) {
      var rule = fields[f] || {};
      var v = state[f];
      if (typeof v !== 'number' || !isFinite(v)) return;
      if (typeof rule.min === 'number' && v < rule.min)
        issues.push({ field: f, kind: 'out-of-range', detail: '读数 ' + v + ' 低于物理量程下限 ' + rule.min });
      if (typeof rule.max === 'number' && v > rule.max)
        issues.push({ field: f, kind: 'out-of-range', detail: '读数 ' + v + ' 高于物理量程上限 ' + rule.max });
      if (dt > 0 && prev && typeof prev[f] === 'number' && isFinite(prev[f]) && typeof rule.maxRate === 'number') {
        var rate = Math.abs(v - prev[f]) / dt;
        if (rate > rule.maxRate)
          issues.push({
            field: f, kind: 'rate-exceeds-physical',
            detail: '变化率 ' + rate.toFixed(3) + '/s 超过物理上界 ' + rule.maxRate + '/s'
          });
      }
    });
    var stuckAfter = spec.stuckAfter;
    if (stuckAfter && history && history.length) {
      keys.forEach(function (f) {
        if (typeof state[f] !== 'number') return;
        var n = 0;
        for (var i = history.length - 1; i >= 0; i--) {
          var hv = history[i].state && history[i].state[f];
          if (typeof hv === 'number' && hv === state[f]) n++;
          else break;
        }
        if (n >= stuckAfter - 1 && typeof prev === 'object' && prev && prev[f] === state[f])
          issues.push({ field: f, kind: 'stuck-at', detail: '连续多次读数完全相同（疑似传感器卡死/断线保持）' });
      });
    }
    return { ok: issues.length === 0, issues: issues, U: issues.length > 0 };
  }

  function createBodyBridge(url, opts) {
    opts = opts || {};
    var ws = null;
    var seq = 0;
    var pending = Object.create(null);
    var results = Object.create(null);   // 已完成动作，供 queryStatus 幂等查询
    var resultKeys = [];
    var connected = false;
    var deadReason = null;

    var onState = opts.onState || function () {};
    var onLog = opts.onLog || function () {};
    var onClose = opts.onClose || function () {};
    var onDead = opts.onDead || function () {};      // 心跳判死回调
    var onInvalid = opts.onInvalid || function () {}; // 物理合理性不通过回调

    var timeout = opts.timeout || 5000;
    var helloTimeout = opts.helloTimeout || 3000;

    // 物理现实性参数（缺省取预设，可用 opts 覆盖；传 0 表示关闭该项）
    function opt(name, dflt) { return (opts[name] === undefined) ? dflt : opts[name]; }
    var heartbeatInterval = opt('heartbeatInterval', PHYSICAL_PRESET.heartbeatInterval);
    var heartbeatTimeout = opt('heartbeatTimeout', PHYSICAL_PRESET.heartbeatTimeout);
    var maxStateAge = opt('maxStateAge', PHYSICAL_PRESET.maxStateAge);
    var maxActionTime = opt('maxActionTime', PHYSICAL_PRESET.maxActionTime);
    var watchdogTick = opt('watchdogTick', PHYSICAL_PRESET.watchdogTick);
    var plausibility = opts.plausibility || null;

    // 自动标定：不要求用户声明量程/变化率——大脑自己从观测数据里学出物理包络。
    // 这才是"暂时的规律"：先观察预热样本，再据此判定什么读数在物理上不合理。
    var autoCalibrate = opt('autoCalibrate', true);
    var warmup = opts.calibrationWarmup || 20;   // 每个字段至少观察 20 个样本才开始约束
    var fieldStats = Object.create(null);
    var calibrated = null;                       // 数据反推出的 {fields:{...}}

    // ① 连接存活：最近一次收到任何入站帧的时间
    var lastSeenAt = 0;
    var lastPingAt = 0;
    var hbTimer = null;

    // ② 数据新鲜：最近一次拿到状态的时间
    var lastStateAt = 0;
    var lastState = null;
    var lastValidity = { ok: true, issues: [], U: false };

    // ③ 数据有效：历史用于变化率/卡死检测
    var prevState = null;
    var prevStateAt = 0;
    var history = [];

    function clearTimers() {
      if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
    }

    function failAllPending(reason) {
      var ids = Object.keys(pending);
      ids.forEach(function (id) {
        var p = pending[id];
        if (p.timer) clearTimeout(p.timer);
        delete pending[id];
        try { p.reject(new Error(reason)); } catch (e) {}
      });
    }

    // fail-closed：判定身体死亡 → 断开、清空待决、通知
    function die(reason) {
      if (!connected && deadReason) return;
      deadReason = reason;
      connected = false;
      clearTimers();
      failAllPending(reason);
      onLog('bridge: ' + reason);
      try { if (ws) ws.close(); } catch (e) {}
      onDead(reason);
      onClose(reason);
    }

    function startWatchdog() {
      if (!heartbeatInterval || !heartbeatTimeout) return;   // 显式关掉则不启
      lastSeenAt = now();
      if (hbTimer) clearInterval(hbTimer);
      hbTimer = setInterval(function () {
        var t = now();
        // ① 看门狗：超时无任何入站帧 → 判死（fail-closed）
        if (t - lastSeenAt > heartbeatTimeout) {
          die('body heartbeat timeout：' + heartbeatTimeout + 'ms 内无任何入站帧（身体静默失效，已判死并拒绝）');
          return;
        }
        // 发心跳
        if (t - lastPingAt >= heartbeatInterval) {
          lastPingAt = t;
          try { ws.send(JSON.stringify({ type: 'ping', t: t })); } catch (e) {}
        }
      }, watchdogTick);
    }

    // 记录一次状态摄入（更新新鲜度 + 物理合理性）
    function ingestState(state, silent) {
      if (!state || typeof state !== 'object') return;
      var t = now();
      lastStateAt = t;
      lastState = state;
      lastSeenAt = t;
      if (autoCalibrate) updateCalibration(state, t);
      var spec = plausibility || (autoCalibrate ? calibrated : null);
      var v = checkPlausibility(state, prevState, prevStateAt, spec, history);
      lastValidity = v;
      history.push({ t: t, state: state });
      if (history.length > 64) history.shift();
      prevState = state;
      prevStateAt = t;
      if (!v.ok) onInvalid(v);
      if (!silent) onState(state, v);
    }

    // 从真实观测中反推物理包络（量程 / 变化率），替代"让用户填量程"这种反智能做法
  function updateCalibration(state, t) {
    if (!state || typeof state !== 'object') return;
    var keys = Object.keys(state);
    keys.forEach(function (f) {
      var v = state[f];
      if (typeof v !== 'number' || !isFinite(v)) return;   // 只标定数值型物理量
      var s = fieldStats[f] || (fieldStats[f] = { min: v, max: v, n: 0, rates: [], last: v, lastT: t });
      s.n++;
      if (v < s.min) s.min = v;
      if (v > s.max) s.max = v;
      if (s.lastT != null && t > s.lastT) {
        var dt = (t - s.lastT) / 1000;
        if (dt > 0) {
          s.rates.push(Math.abs(v - s.last) / dt);
          if (s.rates.length > 200) s.rates.shift();
        }
      }
      s.last = v; s.lastT = t;
    });
    var ready = keys.filter(function (f) { return fieldStats[f] && fieldStats[f].n >= warmup; });
    if (!ready.length) return;
    var fields = {};
    ready.forEach(function (f) {
      var s = fieldStats[f];
      var span = Math.max(1e-9, s.max - s.min);
      var pad = 0.25 * span;                       // 25% 余量，避免把正常波动误判为超量程
      fields[f] = { min: s.min - pad, max: s.max + pad };
      if (s.rates.length >= 5) {
        var sorted = s.rates.slice().sort(function (a, b) { return a - b; });
        var p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
        fields[f].maxRate = Math.max(1e-9, p95 * 3);   // 3 倍安全系数
      }
    });
    calibrated = { fields: fields, stuckAfter: 0, source: 'auto-calibrated', warmup: warmup };
  }

  function staleAge() { return lastStateAt ? (now() - lastStateAt) : Infinity; }
    function isStale(maxAge) {
      var lim = (maxAge === undefined || maxAge === null) ? maxStateAge : maxAge;
      if (!lim) return false;                 // 0 = 不启用
      if (!lastStateAt) return false;         // 从未收到状态时不阻断（避免误伤纯动作流）
      return (now() - lastStateAt) > lim;
    }

    // 前置守卫：把"物理上不该行动"的情况全部拦在发送之前（fail-closed）
    function guardBeforeAct() {
      if (!connected || !ws) return new Error('bridge not connected');
      if (deadReason) return new Error('body dead：' + deadReason);
      // ② 新鲜度：陈旧状态不能拿去规划
      if (isStale()) return new Error('body state stale：状态已 ' + (now() - lastStateAt) +
        'ms 未刷新（超过 maxStateAge=' + maxStateAge + 'ms），拒绝据此行动');
      // ③ 有效性：传感器读数物理上不合理 → 不许行动
      if ((plausibility || (autoCalibrate && calibrated)) && lastValidity && !lastValidity.ok)
        return new Error('body state invalid：传感器读数未通过物理合理性校验（' +
          lastValidity.issues.map(function (i) { return i.kind + '@' + i.field; }).join(', ') + '）');
      return null;
    }

    function armTimer(id, entry, ms) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.timer = setTimeout(function () {
        if (!pending[id]) return;
        delete pending[id];
        entry.reject(new Error('body timeout'));
      }, ms);
    }

    function connect() {
      return new Promise(function (resolve, reject) {
        try { ws = new WebSocket(url); }
        catch (e) { return reject(e); }
        ws.onopen = function () {
          onLog('bridge: transport open ' + url + '（等待握手…）');
          var hid = 'h' + (++seq);
          pending[hid] = {
            resolve: function (msg) {
              var bodyProto = msg && msg.proto;
              if (protoMajor(bodyProto) !== protoMajor(BODY_PROTOCOL)) {
                connected = false;
                try { ws.close(); } catch (e2) {}
                return reject(new Error('body protocol mismatch：brain=' + BODY_PROTOCOL +
                  ' body=' + (bodyProto || 'unknown') + '（请让身体适配器/大脑升到同一主版本）'));
              }
              connected = true;
              deadReason = null;
              lastSeenAt = now();
              onLog('bridge: 握手成功 proto=' + bodyProto);
              startWatchdog();
              resolve();
            },
            reject: function (e) { connected = false; try { ws.close(); } catch (e2) {} reject(e); }
          };
          try { ws.send(JSON.stringify({ type: 'hello', id: hid, proto: BODY_PROTOCOL })); }
          catch (e) { delete pending[hid]; connected = false; return reject(e); }
          setTimeout(function () {
            if (pending[hid]) {
              delete pending[hid]; connected = false;
              try { ws.close(); } catch (e2) {}
              reject(new Error('body handshake timeout：' + helloTimeout +
                'ms 内未收到 hello-ack（身体适配器不支持握手/协议版本，已拒绝连接）'));
            }
          }, helloTimeout);
        };
        ws.onerror = function (e) {
          onLog('bridge: error ' + (e && e.message ? e.message : 'unknown'));
          if (!connected) reject(e || new Error('ws connect error'));
        };
        ws.onclose = function () {
          connected = false; clearTimers();
          onLog('bridge: closed'); onClose();
        };
        ws.onmessage = function (ev) {
          var raw = ev.data;
          var str = (typeof raw === 'string') ? raw : (Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
          var msg;
          try { msg = JSON.parse(str); } catch (e) { onLog('bridge: bad msg'); return; }
          if (!msg) return;
          lastSeenAt = now();                       // ① 任何入站帧都算存活证据

          // ④ 慢 ≠ 死：progress 帧延长 deadline（受 maxActionTime 总上限约束）
          if (msg.type === 'progress' && msg.id && pending[msg.id]) {
            var pe = pending[msg.id];
            var elapsed = now() - pe.startedAt;
            if (maxActionTime && elapsed >= maxActionTime) {
              delete pending[msg.id];
              if (pe.timer) clearTimeout(pe.timer);
              pe.reject(new Error('body action exceeded maxActionTime：动作已运行 ' + elapsed +
                'ms 超过总上限 ' + maxActionTime + 'ms（拒绝继续等待）'));
              return;
            }
            armTimer(msg.id, pe, pe.timeoutMs);     // 续期：证明还活着，只是慢
            onLog('bridge: progress ' + (msg.pct === undefined ? '' : msg.pct + '% '));
            return;
          }

          if (msg.id && pending[msg.id]) {
            var p = pending[msg.id];
            delete pending[msg.id];
            if (p.timer) clearTimeout(p.timer);
            // 结果里带 state 则更新新鲜度（但不重复触发 onState，保持回调语义）
            if (msg.state && typeof msg.state === 'object') ingestState(msg.state, true);
            // ⑤ 幂等：记下已完成结果，供 queryStatus 查询
            results[msg.id] = { at: now(), msg: msg };
            resultKeys.push(msg.id);
            if (resultKeys.length > 128) { delete results[resultKeys.shift()]; }
            p.resolve(msg);
            return;
          }

          if (msg.type === 'pong') return;          // 心跳应答，lastSeenAt 已更新

          if (msg.type === 'observation' || msg.type === 'state') {
            if (msg.state) ingestState(msg.state, false);
          }
        };
      });
    }

    function disconnect() {
      clearTimers();
      if (ws) { try { ws.close(); } catch (e) {} }
      ws = null; connected = false;
    }

    // 实现内核 bodyAdapter 契约：(cap, params) => Promise<{ok, state}>
    function adapter(cap, params, actOpts) {
      actOpts = actOpts || {};
      return new Promise(function (resolve, reject) {
        var g = guardBeforeAct();
        if (g) return reject(g);
        var id = 'a' + (++seq);
        var ms = actOpts.timeout || timeout;
        var entry = {
          resolve: resolve, reject: reject, timer: null,
          startedAt: now(), timeoutMs: ms, actionId: actOpts.actionId || null
        };
        pending[id] = entry;
        var payload = JSON.stringify({
          type: 'action', id: id, cap: cap, params: params || {},
          actionId: entry.actionId
        });
        try { ws.send(payload); } catch (e) { delete pending[id]; return reject(e); }
        armTimer(id, entry, ms);
      });
    }

    // 发送任意控制消息（reset / fail），返回 Promise
    function send(obj) {
      return new Promise(function (resolve, reject) {
        if (!connected || !ws) return reject(new Error('bridge not connected'));
        if (deadReason) return new Error('body dead：' + deadReason);
        var id = 'c' + (++seq);
        pending[id] = { resolve: resolve, reject: reject, timer: null, startedAt: now(), timeoutMs: timeout };
        var payload = JSON.stringify(Object.assign({ id: id }, obj));
        try { ws.send(payload); } catch (e) { delete pending[id]; return reject(e); }
        setTimeout(function () {
          if (pending[id]) { delete pending[id]; reject(new Error('body control timeout：' + timeout +
            'ms 内未收到确认（已拒绝，不谎称成功）')); }
        }, timeout);
      });
    }

    return {
      connect: connect,
      disconnect: disconnect,
      adapter: adapter,
      send: send,
      isConnected: function () { return connected; },
      // ── 物理现实性可观测接口 ──
      deadReason: function () { return deadReason; },
      heartbeatAgeMs: function () { return lastSeenAt ? (now() - lastSeenAt) : Infinity; },
      stateAgeMs: function () { return staleAge(); },
      isStale: isStale,
      lastState: function () { return lastState; },
      lastValidity: function () { return lastValidity; },
      // 自动标定状态：看大脑自己学到了什么物理包络（无需用户声明）
      calibration: function () {
        var out = { source: plausibility ? 'user-declared' : (calibrated ? 'auto-calibrated' : 'warming-up'), warmup: warmup, fields: {} };
        Object.keys(fieldStats).forEach(function (f) {
          var s = fieldStats[f];
          out.fields[f] = { n: s.n, observedMin: s.min, observedMax: s.max, ready: s.n >= warmup };
        });
        if (calibrated) out.derived = calibrated;
        if (plausibility) out.derived = plausibility;
        return out;
      },
      // ⑤ 幂等：查询动作状态 running / done / unknown
      queryStatus: function (id) {
        if (pending[id]) return { state: 'running', elapsedMs: now() - pending[id].startedAt };
        if (results[id]) return { state: 'done', result: results[id].msg };
        return { state: 'unknown' };
      },
      pendingActions: function () { return Object.keys(pending); }
    };
  }

  var api = {
    createBodyBridge: createBodyBridge,
    checkPlausibility: checkPlausibility,
    PHYSICAL_PRESET: PHYSICAL_PRESET,
    BODY_PROTOCOL: BODY_PROTOCOL
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LingNaoBridge = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));

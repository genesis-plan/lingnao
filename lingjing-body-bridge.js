/*
 * 灵境 LingJing · 真实身体接入桥（WebSocket）
 * ────────────────────────────────────────────────────────────
 * 大脑保留 capability 模型（pre/eff/cost 用于「可审计规划」），
 * 本桥只负责把规划出的动作发到真实身体，并等身体的观测回报。
 * 规划在大脑、执行+感知在身体——职责分离，审计仍由大脑出。
 *
 * 协议（JSON 文本帧）：
 *   大脑 → 身体 : {type:'action', id, cap, params}
 *   身体 → 大脑 : {type:'result', id, ok, state, error?}   // 执行一次动作后的观测态
 *   身体 → 大脑 : {type:'observation', state}             // 身体自主上报（可选）
 *   大脑 → 身体 : {type:'reset', state, failNext?, failOnce?} // 复位/注入故障（演示用）
 *   大脑 → 身体 : {type:'fail', mode:'once'|'next', cap}  // 注入故障（演示用）
 *
 * 零依赖：浏览器用原生 WebSocket；Node 22 用全局 WebSocket。
 */
(function (root) {
  'use strict';

  function createBodyBridge(url, opts) {
    opts = opts || {};
    var ws = null;
    var seq = 0;
    var pending = Object.create(null);
    var connected = false;
    var onState = opts.onState || function () {};
    var onLog = opts.onLog || function () {};
    var onClose = opts.onClose || function () {};
    var timeout = opts.timeout || 5000;

    function connect() {
      return new Promise(function (resolve, reject) {
        try { ws = new WebSocket(url); }
        catch (e) { return reject(e); }
        ws.onopen = function () { connected = true; onLog('bridge: connected ' + url); resolve(); };
        ws.onerror = function (e) {
          onLog('bridge: error ' + (e && e.message ? e.message : 'unknown'));
          if (!connected) reject(e || new Error('ws connect error'));
        };
        ws.onclose = function () { connected = false; onLog('bridge: closed'); onClose(); };
        ws.onmessage = function (ev) {
          var raw = ev.data;
          var str = (typeof raw === 'string') ? raw : (Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
          var msg;
          try { msg = JSON.parse(str); } catch (e) { onLog('bridge: bad msg'); return; }
          // 任意带 id 的回复都匹配 pending（action 的 result / reset 的 state / fail 的 ack）
          if (msg && msg.id && pending[msg.id]) {
            var p = pending[msg.id];
            delete pending[msg.id];
            p.resolve(msg);
            return;
          }
          if (msg && (msg.type === 'observation' || msg.type === 'state')) {
            if (msg.state) onState(msg.state);
          }
        };
      });
    }

    function disconnect() {
      if (ws) { try { ws.close(); } catch (e) {} }
      ws = null; connected = false;
    }

    // 实现内核 bodyAdapter 契约：(cap, params) => Promise<{ok, state}>
    function adapter(cap, params) {
      return new Promise(function (resolve, reject) {
        if (!connected || !ws) return reject(new Error('bridge not connected'));
        var id = 'a' + (++seq);
        pending[id] = { resolve: resolve, reject: reject };
        var payload = JSON.stringify({ type: 'action', id: id, cap: cap, params: params || {} });
        try { ws.send(payload); } catch (e) { delete pending[id]; return reject(e); }
        setTimeout(function () {
          if (pending[id]) { delete pending[id]; reject(new Error('body timeout')); }
        }, timeout);
      });
    }

    // 发送任意控制消息（reset / fail），返回 Promise
    function send(obj) {
      return new Promise(function (resolve, reject) {
        if (!connected || !ws) return reject(new Error('bridge not connected'));
        var id = 'c' + (++seq);
        pending[id] = { resolve: resolve, reject: reject };
        var payload = JSON.stringify(Object.assign({ id: id }, obj));
        try { ws.send(payload); } catch (e) { delete pending[id]; return reject(e); }
        setTimeout(function () {
          if (pending[id]) { delete pending[id]; resolve({ type: 'ack-timeout' }); }
        }, timeout);
      });
    }

    return {
      connect: connect,
      disconnect: disconnect,
      adapter: adapter,
      send: send,
      isConnected: function () { return connected; }
    };
  }

  var api = { createBodyBridge: createBodyBridge };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LingJingBridge = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));

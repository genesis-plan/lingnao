/*
 * 灵脑 LingNao · 物理接入模块 · 真实驱动接入契约（connector contract）
 * ────────────────────────────────────────────────────────────
 * 你已有硬件（PLC / 伺服 / 网关 / Matter 边界路由器 / Zigbee 协调器 …），
 * 想让它接进灵脑——只需实现两件事，其余交给本模块：
 *
 *   1) ingest(link, opts) -> { variables, actions, sample, client? }
 *      把你硬件的原始读数，变成“变量名->类型”的观测，外加可选动作名列表。
 *   2) (可选) send(cmd) -> 把规范命令(slot+value)写回硬件。
 *
 * 字节解析直接用本模块已实装的 decode.*（见 lingnao-access.js），
 * 不用你自己写协议解析。
 *
 * ⚠ 诚实：下面【软件骨架】未连真机验证（本机无硬件），仅演示接线形状；
 *   你按自己硬件把 ingest 里的“样例数据”换成真实读数即可。
 * 跑： node connector-template.js
 */
'use strict';

var A = require('./lingnao-access.js');

// ── 最小骨架：硬件拥有者照抄，填 ingest/send 即可 ──────────
function MyConnector(deviceOpts) {
  this.opts = deviceOpts || {};
}

MyConnector.prototype.detect = function (url) {
  // 返回 { protocol, host, port, mediumHint }
  return {
    protocol: this.opts.protocol || 'my-proto',
    host: this.opts.host,
    port: this.opts.port,
    mediumHint: '你的硬件介质（无线/有线）'
  };
};

MyConnector.prototype.ingest = function (link, opts) {
  // TODO：用你的 SDK / 网卡读真实数据，替换下面样例。
  //       样例用 {speed,torque,current,temperature} 演示一台电机。
  var sample = this.opts.sample || { speed: 1500, torque: 12.3, current: 4.1, temperature: 41 };
  var variables = {};
  Object.keys(sample).forEach(function (k) { variables[k] = typeof sample[k]; });
  return Promise.resolve({
    variables: variables,
    actions: opts.actions || ['start', 'stop', 'set_speed'],
    sample: sample,
    client: null
  });
};

MyConnector.prototype.send = function (cmd) {
  // TODO：把规范命令写回硬件（cmd = { slot, value }）。
  return Promise.resolve({ ok: true, note: '已下发(样例): ' + cmd.slot + '=' + cmd.value });
};

// ── 演示：用骨架跑通“识别 → 翻译壳”全环（软件内，无需硬件）──
(function demo() {
  var c = new MyConnector({
    protocol: 'profidrive',
    sample: { speed: 1500, torque: 12.3, current: 4.1, temperature: 41 }
  });

  c.ingest(c.detect(''), {}).then(function (ing) {
    var cls = A.classify({
      protocol: c.opts.protocol,
      variables: ing.variables,
      actions: ing.actions
    });

    console.log('=== connector-template 演示（软件内，无硬件）===');
    console.log('识别设备类 :', cls.best && cls.best.id, '| 置信:', cls.confidence, '| 命中:', cls.matched);

    // 真实驱动里你会在 ingest 内调用本模块已实装的字节解码，例如：
    console.log('复用 CiA402 状态字 0x000F 解析:', JSON.stringify(A.decode.cia402Status(0x000F)));

    console.log('已接入协议数:', A.connectorStatus().length,
                '| 已实装规范卡:', A.listCards().length);
    console.log('✅ 接线形状正确：你只需把 ingest 换成真实硬件读数即可接真机。');
  });
})();

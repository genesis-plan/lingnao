/*
 * 灵脑 LingNao · 物理接入模块 · 统一公开入口（零依赖 Node）
 * ────────────────────────────────────────────────────────────
 * 本文件是接入模块的“门面”：把规范库(lingnao-body-library)与接入引擎
 * (lingnao-access-engine) 的公开能力聚到一起，给使用者一个清晰入口。
 *
 * ⚠ 今天就能用（无需任何硬件）的是【软件路径】：
 *   - classify(观测)            从“变量+动作”列表识别设备类
 *   - importStandard(kind,data) 把厂家标准文件映射成规范语义
 *   - decode.*                  把协议帧字节解成可读状态
 * 需要【硬件/网络】的是【实时路径】connect()（要真连 Modbus/MQTT/WS）。
 *
 * 跑示例： node demo-access.js
 * 看文档：  ACCESS-MODULE-GUIDE.md
 * 接真机：  connector-template.js（硬件拥有者照抄）
 */
'use strict';

var LIB = require('./lingnao-body-library.js');
var E = require('./lingnao-access-engine.js');

// 协议接入状态：诚实标出哪些是“仅建档(需硬件驱动)”、哪些软件/驱动已可用
function connectorStatus() {
  var ps = LIB.PROTOCOLS || {};
  return Object.keys(ps).map(function (k) {
    var p = ps[k];
    return {
      id: k,
      label: p.label,
      supported: !!p.supported,
      medium: p.medium || 'n/a',
      note: p.note || ''
    };
  });
}

// 已实装规范卡（设备类全集）：id / 中文名 / 分组
function listCards() {
  return (LIB.CANONICAL_MODELS || []).map(function (c) {
    return { id: c.id, label: c.label, group: (c.stateSpace && c.stateSpace.group) || c.group };
  });
}

module.exports = {
  // ── 软件路径（无硬件可跑）──────────────────────────────
  classify: LIB.classify,
  importStandard: E.importStandard,
  buildNameMap: E.buildNameMap,
  matchName: E.matchName,
  decode: {
    dl645: E.decodeDL645,
    cjt188: E.decodeCJT188,
    cia402Status: E.decodeCia402Status,
    cia402Control: E.encodeCia402Control,
    profidriveStatus: E.decodeProfidriveStatus,
    profidrive: E.decodeProfidrive,
    iolinkPD: E.decodeIOLinkPD,
    matterTLV: E.decodeMatterTLV,
    zclFrame: E.decodeZclFrame
  },

  // ── 实时路径（需硬件/网络；详见 connector-template.js）──
  connect: E.connect,

  // ── 元数据 ─────────────────────────────────────────────
  PROTOCOLS: LIB.PROTOCOLS,
  CANONICAL_MODELS: LIB.CANONICAL_MODELS,
  connectorStatus: connectorStatus,
  listCards: listCards
};

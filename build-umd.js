#!/usr/bin/env node
/**
 * build-umd.js — 从 灵境.html 单一真源抽取确定性内核，构建浏览器/Node 通用 UMD。
 * 输出 lingjing.umd.js：浏览器 window.LingJing / Node require / ESM import 三态可用。
 * 零依赖（仅 Node 内置 fs / path / vm）。与 lingjing-mcp.js 共用同一份内核，行为一致。
 */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '灵境.html');
const html = fs.readFileSync(HTML, 'utf8');

// 与 lingjing-mcp.js 同一正则抽取内核（单一真源）
const m = html.match(/\/\/ ==KERNEL START==[^\n]*\n([\s\S]*?)\n\/\/ ==KERNEL END==/);
if (!m) throw new Error('未在内核标记中找到世界大脑内核');
const KERNEL_SRC = m[1];

// 导出名列表（对齐 lingjing-mcp.js 的 __exp）
const EXPORT_NAMES = [
  'WORLD', 'IMA', 'imaKnowledge', 'loadIMAKB', 'setWorld', 'heuristic', 'aStar',
  'perceive', 'perceiveLLM', 'perceiveBelief', 'reconcile', 'configureLLM', 'getLLMConfig', 'system1', 'system2', 'reason', 'goalDirected',
  'buildRSG', 'generateAudit', 'learn', 'carrierReport', 'metaCognition',
  'symbolicSolve', 'algebraicSolve', 'verifyHoarePath', 'dmcts', 'pacSampleBound',
  'causalDiscovery', 'doQuery', 'causalIdentifiable', 'identifiabilityID', 'counterfactualIdentifiable', 'learnWorldModel', 'simulate', 'counterfactual',
  'SelfLearn', 'slRecord', 'slDiscover', 'slValidate', 'slMonitor', 'slStatus',
  'EventBus', 'KBFabric', 'runtimeMonitor', 'continuousVerify', 'fingerprintVec', 'simHash',
  'ALGO_VERSION', 'SEED', 'explainWithLLM', 'askBrain', 'causalEffect',
  'groundingMeta', 'GROUNDING', 'validateWorld',
  // 三根神经（2026-08-29）：记忆持久化 / 感知建图闭环 / 元认知调度
  'Memory', 'bootMemory', 'confirmObservation', 'exploreAlternatives',
  // 认知操作系统（切片融合）：统一编排 + 能力注册 + 图上资源流
  'Capabilities', 'cognitiveCycle', 'attachResources', 'discoverMismatch',
  'coordinateMismatch', 'planTransport', 'applyAllocations',
  'allPairsCost', 'reconstructPath', 'transportation', 'quantifyUncertainty',
  // 七元组 𝔹=(𝕎,K,Φ,Ψ,Θ,Λ,Ξ) 与八层（依 ARCHITECTURE.md）；ℙ=命题
  'Brain', 'Layers', 'brainManifest', 'evaluateProposition', 'edgeHolds',
  // 具身层（2026-08-29）：通用大脑 + 任意物理身体（具身智能在物理世界干活的通用大脑）
  'attachBody', 'capabilities', 'getState', 'setState', 'stateDiff', 'checkHard', 'hMax', 'planTask', 'execute', 'doWork', 'POSITIONING', 'BODY'
];
// 导出对象字面量源码：{ "WORLD":WORLD, ... }
const litSrc = '{' + EXPORT_NAMES.map(n => JSON.stringify(n) + ':' + n).join(',') + '}';

// 注入 UMD 的常量（JSON 安全转义）
const kernelJSON = JSON.stringify(KERNEL_SRC);
const litJSON = JSON.stringify(litSrc);

const umd = `(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory('node');
  } else if (typeof define === 'function' && define.amd) {
    define([], function () { return factory('browser'); });
  } else {
    root.LingJing = factory('browser');
  }
}(typeof self !== 'undefined' ? self : this, function (runtime) {
  'use strict';
  const KERNEL_SRC = ${kernelJSON};
  const litSrc = ${litJSON};

  if (runtime === 'node' && typeof require === 'function') {
    // ---- Node 分支：vm 隔离执行 + 内存桩（同 lingjing-mcp.js） ----
    const vm = require('vm');
    // 神经①：localStorage 桩落盘 —— 内核写 localStorage 即写磁盘，进程退出不再失忆。
    // 存档路径可用环境变量 LINGJING_MEMORY 覆盖；读写失败一律降级为纯内存，不影响内核运行。
    const _fs = require('fs'), _path = require('path');
    const MEM_FILE = process.env.LINGJING_MEMORY || _path.join(process.cwd(), '.lingjing-memory.json');
    let store = {};
    try { if (_fs.existsSync(MEM_FILE)) store = JSON.parse(_fs.readFileSync(MEM_FILE, 'utf8') || '{}'); } catch (e) { store = {}; }
    const localStorageStub = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
        try { _fs.writeFileSync(MEM_FILE, JSON.stringify(store)); } catch (e) { /* 只读环境下降级为内存 */ }
      },
      removeItem: (k) => {
        delete store[k];
        try { _fs.writeFileSync(MEM_FILE, JSON.stringify(store)); } catch (e) {}
      },
      __file: MEM_FILE
    };
    function makeProxy() {
      return new Proxy(function () {}, {
        get: (t, p) => {
          if (p === 'value' || p === 'textContent' || p === 'innerHTML') return '';
          if (p === 'style') return makeProxy();
          return makeProxy();
        },
        apply: () => makeProxy(),
        set: () => true
      });
    }
    let bridge;
    try { bridge = require('lingshu-solver'); }
    catch (e) { bridge = { available: false, algebraicSolve: () => ({ available: false, error: 'lingshu-solver 未安装：' + (e && e.message) }) }; }
    const sandbox = {
      console, Math, JSON, Date, Buffer, Object, Array, Set, Map, Number, String,
      Infinity, NaN, isNaN, parseFloat, parseInt,
      localStorage: localStorageStub, document: makeProxy(), process,
      fetch: (typeof fetch !== 'undefined' ? fetch : undefined),
      __LINGSHU__: bridge
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(KERNEL_SRC + '\\n;globalThis.__exp=' + litSrc + ';', ctx);
    return sandbox.__exp;
  }

  // ---- 浏览器分支：new Function 直接跑（内核零 DOM 依赖） ----
  const run = new Function(KERNEL_SRC + '\\n;return ' + litSrc + ';');
  return run();
}));
`;

fs.writeFileSync(path.join(__dirname, 'lingjing.umd.js'), umd, 'utf8');
console.log('OK 生成 lingjing.umd.js  bytes=' + umd.length + '  导出=' + EXPORT_NAMES.length);

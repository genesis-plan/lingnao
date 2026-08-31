#!/usr/bin/env node
/**
 * build-umd.js — 从 灵脑.html 单一真源抽取确定性内核，构建浏览器/Node 通用 UMD。
 * 输出 lingnao.umd.js：浏览器 window.LingNao / Node require / ESM import 三态可用。
 * 零依赖（仅 Node 内置 fs / path / vm）。与 lingnao-mcp.js 共用同一份内核，行为一致。
 */
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '灵脑.html');
const html = fs.readFileSync(HTML, 'utf8');

// 与 lingnao-mcp.js 同一正则抽取内核（单一真源）
const m = html.match(/\/\/ ==KERNEL START==[^\n]*\n([\s\S]*?)\n\/\/ ==KERNEL END==/);
if (!m) throw new Error('未在内核标记中找到世界大脑内核');
const KERNEL_SRC = m[1];

// 导出名列表（对齐 lingnao-mcp.js 的 __exp）
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
  'attachBody', 'capabilities', 'getState', 'setState', 'stateDiff', 'checkHard', 'hMax', 'planTask', 'execute', 'doWork', 'POSITIONING', 'BODY',
  // 连接契约（2026-08-30）：声明式契约求值 + 观测契约可区分性
  'evalRequire', 'applyEffect', 'capVerifiable', 'distinguishable', 'observationBlindSpots',
  // 量纲分析（2026-08-30）：物理正确性约束层（SI 七基本量纲 + Buckingham π）
  'DIM', 'DIM_AXES', 'dimOf', 'dimMul', 'dimDiv', 'dimPow', 'dimEq', 'dimAdd', 'dimFormat',
  'buckinghamPi', 'unwrapDimValue', 'checkDimensions',
  // 高等数学工具箱（2026-08-30）：已证明定理的可执行判据
  'dual', 'dAdd', 'dSub', 'dMul', 'dDiv', 'dPow', 'dNeg', 'dSin', 'dCos', 'dExp', 'dLog', 'dSqrt', 'dAbs',
  'grad', 'jacobian', 'lieDerivative',
  'graphColoring', 'planarityCheck', 'hallCondition',
  'KEPLER_DENSITY', 'packingBound', 'lyapunovCheck',
  // 控制障碍函数（2026-08-30）：CBF-QP 安全滤子（物理 AI 安全保证）
  'cbfFilter', 'cbfMargin',
  // 物理 AI 安全栈补齐（2026-08-30 下午）
  'STL', 'stlHorizon', 'stlRobustness', 'stlMonitor',                    // STL 定量语义 ρ
  'zono', 'zonoSupport', 'zonoBox', 'zonoLinear', 'zonoSum', 'zonoReduce',
  'zonoContains', 'zonoIntersectsHalfspace', 'zonoSafe', 'zonoReach',    // Zonotope 可达集过近似
  'cbfCompose',                                                          // 多约束组合 CBF（Hildreth 对偶 QP）
  'hybridAutomaton', 'hybridStep', 'hybridLipschitz', 'hybridReach',     // 混合自动机 × AD
  'heuristicEvolve',                                                     // 启发式自演化（保持可采纳性）
  // 最优分配与抽象解释（2026-08-30）
  'hungarian',                                                           // 匈牙利算法 + LP 对偶最优性证书
  'ITV_BOT', 'itv', 'itvIsBot', 'itvTop', 'itvLe', 'itvEq', 'itvJoin', 'itvMeet',
  'itvAddI', 'itvMulI', 'itvWiden', 'itvNarrow', 'absFixpoint', 'absSafe', // 抽象解释：区间格 + widening 不动点
  'learnedEdgePenalty', 'recordPlanHistory', 'getPlanHistory', 'resetPlanHistory', // 学习回流：真实反馈→规划
  'conformalQuantile', 'conformalInterval', 'conformalPValue', 'conformalIsAnomaly', // 融合①保形预测：分布无关覆盖保证
  'affordanceOf', 'sayCanRank', // 融合②SayCan：P(有用)×P(可行) 可分离审计
  'thompsonSample', // 融合③Thompson 采样：Beta 后验探索-利用（确定性 PRNG）
  'matEye', 'matT', 'matMul', 'matAdd', 'matSub', 'matScale', 'matInv', // 融合④零依赖数值线性代数基石
  'kalmanUpdate', // 融合⑤卡尔曼滤波（形式F 估计器）：线性高斯下最小方差无偏
  'lqrSolve', // 融合⑥LQR（形式G 控制器）：Riccati 解析求解连续控制，填 MPC 缺口
  'cvar', // 融合⑦CVaR（形式C 证书）：一致性风险度量，尾部风险（注意：不可加，禁止塞进 A* 边权）
  'effectiveSampleSize', 'particleFilterStep', // 融合⑧粒子滤波（形式F 估计器）：非线性/非高斯，补卡尔曼缺口
  'entropyOf', 'expectedInfoGain', 'selectByInfoGain', // 融合⑨EIG（形式E 选择器）：主动感知，互信息恒等式可交叉验证
  'shapleyValues', // 融合⑩Shapley（形式C 证书）：四公理唯一归因，效率公理可自检
  'wasserstein1', 'driftCheck', // 融合⑪漂移检测（形式C 证书）：W₁ 最优传输 + 保形 p 值，保形预测必要配套
  'absVerdict', // 审视①补抽象解释的另一半：用同一过近似得"确定安全/确定不安全/真𝕌"三值严格结论
  'galoisAlphaSet', 'galoisGammaContains', 'galoisCheck', // 审视②把 sound:true 从断言升级为 Galois 连接可验证性质
  'beliefPlausibility', 'decideImprecise', // 审视③𝕌 从布尔位升级为不精确概率区间 [belief, plausibility]
  'conservationCheck', // 物理正确性第二层：守恒律/Noether 不变量（沿流数值检验 dE/dt≈0）
  // 备用数学思想（2026-08-31 落地）：应对真实世界不可预测的工具箱，带诚实 UNKNOWN 边界
  'fDivergence',       // f-散度族（KL/TV/JS/Hellinger）：分布变化检测宽备用
  'roughSetApprox',    // 粗糙集上下近似：部分信息/unknown-unknown 结构化
  'decidabilityCheck', // 可计算性/不可判定登记：超出可判定范围须诚实 UNKNOWN
  'lyapunovExponent',  // 最大 Lyapunov 指数：混沌/敏感 ⇒ 长视野预测失效判定
  'modelAssumptions',  // 建模思想①：假设登记与失效检测（假设破 ⇒ 诚实 UNKNOWN，不续用破假设模型）
  'localLinearize',    // 建模思想②：非线性系统局部线性化（雅可比）+ 近似有效半径
  'variableScreening', // 建模思想③：高维降维/变量筛选（对抗维数灾难，前 k 主成分方差解释比）
  'MathKernel', 'CAPABILITY_THEOREMS', 'theoremOf', 'proofAudit', // 数学内核（LCF）：公理→定理→能力追溯
  'kernelVerify', 'kernelStatus', 'kernelFoundation', 'kernelProve', 'kernelConjectures',
  // 八元组 𝔹=(X,h,b,f,U,V,Inv,M) 数学形态（2026-08-31 落地）：把缺位的 h/U/V/M 正式建模为可审计对象
  'BrainTuple',
  // 自主能力等级（2026-08-31 完善）：DeepMind ASL 适配的分级人机协同配置
  'AUTONOMY'
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
    root.LingNao = factory('browser');
  }
}(typeof self !== 'undefined' ? self : this, function (runtime) {
  'use strict';
  const KERNEL_SRC = ${kernelJSON};
  const litSrc = ${litJSON};

  if (runtime === 'node' && typeof require === 'function') {
    // ---- Node 分支：vm 隔离执行 + 内存桩（同 lingnao-mcp.js） ----
    const vm = require('vm');
    // 神经①：localStorage 桩落盘 —— 内核写 localStorage 即写磁盘，进程退出不再失忆。
    // 存档路径可用环境变量 LINGNAO_MEMORY 覆盖（旧名 LINGJING_MEMORY 仍兼容）；
    // 读写失败一律降级为纯内存，不影响内核运行。
    const _fs = require('fs'), _path = require('path');
    const MEM_FILE = process.env.LINGNAO_MEMORY || process.env.LINGJING_MEMORY || _path.join(process.cwd(), '.lingnao-memory.json');
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
    try { bridge = require('./lingshu-bridge'); }   // 走适配层（与 lingnao-mcp.js 一致）：把原始包包成内核期望的 {available, algebraicSolve}
    catch (e) { bridge = { available: false, algebraicSolve: () => ({ available: false, error: 'lingshu-bridge 未载入：' + (e && e.message) }) }; }
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

fs.writeFileSync(path.join(__dirname, 'lingnao.umd.js'), umd, 'utf8');
console.log('OK 生成 lingnao.umd.js  bytes=' + umd.length + '  导出=' + EXPORT_NAMES.length);

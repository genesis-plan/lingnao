#!/usr/bin/env node
/**
 * 灵脑 LingNao（WorldBrain）— 零依赖 MCP stdio server
 * 把 灵脑.html 内核（免费LLM感知 / 系统1快答 / 系统2 A*+RSG / 7段审计 / 正·负·边界样本 / 物理载体接入）暴露给外部 AI 智能体。
 * 传输：JSON-RPC 2.0 + Content-Length 字节级分帧（手写，无 SDK 依赖）。
 *
 * 运行：
 *   node lingnao-mcp.js                 # 默认载入同目录 灵脑.html
 *   LINGNAO_HTML=/path/灵脑.html node lingnao-mcp.js   # 旧名 LINGJING_HTML 仍兼容
 *   OPENROUTER_API_KEY=sk-or-... node lingnao-mcp.js   # 启用免费 LLM 感知
 *   node lingnao-mcp.js --selftest      # 内置自测，验证全部工具后退出
 *
 * 零依赖：仅用 Node 内置 vm / fs / path。内核从 HTML 抽取复用，单一真源。
 */

/**
 * ── 信任架构铁律（de Bruijn 准则的灵脑版本）──
 * 本文件中的 `certifyDecisionLogic` 与其调用的七类确定性验证器 `V_c`
 * （_auditOneConstraint / _auditOneNumericSafety /
 *  _auditOnePath / _auditOneAuthorized / _auditOneCausal / _auditOneConformal）是灵脑**唯一可信内核**。
 * 其中 `_auditOneCausal` 用 do-calculus（后门/前门准则）判定因果效应可识别性，
 * `_auditOneConformal` 用 split conformal 分位数引理把「无知弃权 𝕌」升级为「带量化风险界 α 的诚实弃权」。
 * 其上层（MCP 网关、任何 LLM / 智能体经 `claimedProperties` 传入的声明）
 * 一律**不可信**，其产物必须且只经该内核核验，不得被直接采信。
 * 任何代码路径都不得绕过 `certifyDecisionLogic` 直接产出 `trusted` 裁决
 * （对应 Coq/Lean 的「内核必须自己拒绝坏项，不能靠上层自觉」；
 *  见 Lean 内核 soundness bug #14576 的旁路教训）。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const HTML = process.env.LINGNAO_HTML || process.env.LINGJING_HTML || path.join(__dirname, '灵脑.html');
const SELFTEST = process.argv.includes('--selftest');

// 灵脑 = 推理-only（2026-10-07 裁定）：不接入计算引擎、不委派灵数。计算归灵数 lingshu-solver 独立产品。
// 内核若误调 algebraicSolve，拿到永久不可用的诚实降级桩（fail-closed：不计算、不幻觉）。
let lingShuBridge = { available: false, algebraicSolve: () => ({ available: false, error: '灵脑=推理-only：不接入计算引擎（计算归灵数 lingshu-solver 独立产品）' }) };

// ---------- 1. 抽取并实跑内核（复用浏览器内已验证逻辑，不重写） ----------
function extractKernel(h) {
  const m = h.match(/\/\/ ==KERNEL START==[^\n]*\n([\s\S]*?)\n\/\/ ==KERNEL END==/);
  if (!m) throw new Error('未在内核标记中找到世界大脑内核');
  return m[1];
}
const kernelSrc = extractKernel(fs.readFileSync(HTML, 'utf8'));

// localStorage 内存桩（替代浏览器 localStorage，单机知识库；每次启动重置）
const store = {};
const localStorageStub = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
// document / window 任意属性 no-op 桩（内核不依赖，但防顶层误用崩溃）
function makeProxy() {
  return new Proxy(function () {}, {
    get: (t, p) => {
      if (p === 'value' || p === 'textContent' || p === 'innerHTML') return '';
      if (p === 'style') return makeProxy();
      return makeProxy();
    },
    apply: () => makeProxy(),
    set: () => true,
  });
}
const sandbox = {
  console, Math, JSON, Date, Buffer, Object, Array, Set, Map, Number, String,
  Infinity, NaN, isNaN, parseFloat, parseInt,
  localStorage: localStorageStub,
  document: makeProxy(),
  process,                                   // 注入，供 env OPENROUTER_API_KEY 读取
  fetch: (typeof fetch !== 'undefined' ? fetch : undefined), // 注入 Node 全局 fetch（真实部署直连 OpenRouter）
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
// 自测模式：在 vm 运行前把 mock fetch 注入为 sandbox.fetch，确保 perceiveLLM 走模拟链路（运行后再设 sandbox.fetch 不生效）
if (SELFTEST) sandbox.fetch = mockFetchOpenRouter;
sandbox.__LINGSHU__ = lingShuBridge;   // 灵脑=推理-only：注入永久不可用的计算桩（内核若调 algebraicSolve 将诚实降级 𝕌，不计算）
const ctx = vm.createContext(sandbox);
  vm.runInContext(
  kernelSrc + '\nglobalThis.__exp = {getWorld, IMA, imaKnowledge, loadIMAKB, setWorld, heuristic, aStar, perceive, perceiveLLM, perceiveBelief, reconcile, configureLLM, getLLMConfig, system1, system2, reason, goalDirected, buildRSG, generateAudit, learn, carrierReport, metaCognition, symbolicSolve, algebraicSolve, verifyHoarePath, dmcts, pacSampleBound, causalDiscovery, doQuery, causalIdentifiable, identifiabilityID, counterfactualIdentifiable, learnWorldModel, simulate, counterfactual, SelfLearn, slRecord, slDiscover, slValidate, slMonitor, slStatus, EventBus, KBFabric, runtimeMonitor, continuousVerify, fingerprintVec, simHash, ALGO_VERSION, SEED, explainWithLLM, askBrain, causalEffect, groundingMeta, GROUNDING, validateWorld, Memory, bootMemory, confirmObservation, exploreAlternatives, Capabilities, cognitiveCycle, attachResources, discoverMismatch, coordinateMismatch, planTransport, applyAllocations, allPairsCost, reconstructPath, transportation, quantifyUncertainty, Brain, Layers, brainManifest, evaluateProposition, edgeHolds, attachBody, capabilities, getState, setState, stateDiff, checkHard, hMax, planTask, execute, doWork, POSITIONING, getBody};',
  ctx
);
const K = sandbox.__exp;
// 内核新增的"不幻觉"置信分层能力同步暴露给 MCP（避免改动上方长行 __exp 字面量）
K.groundingMeta = K.groundingMeta || (() => ({}));
sandbox.__exp.groundingMeta = K.groundingMeta;
sandbox.__exp.GROUNDING = K.GROUNDING;
sandbox.__exp.validateWorld = K.validateWorld;

// 连接契约（2026-08-30）：声明式契约求值 + 观测契约可区分性
// 内核新增函数，用追加 runInContext 导出，避免改动上方长行 __exp 字面量
vm.runInContext(
  'globalThis.__exp.evalRequire = evalRequire;' +
  'globalThis.__exp.applyEffect = applyEffect;' +
  'globalThis.__exp.capVerifiable = capVerifiable;' +
  'globalThis.__exp.distinguishable = distinguishable;' +
  'globalThis.__exp.observationBlindSpots = observationBlindSpots;',
  ctx
);
K.evalRequire = sandbox.__exp.evalRequire;
K.applyEffect = sandbox.__exp.applyEffect;
K.capVerifiable = sandbox.__exp.capVerifiable;
K.distinguishable = sandbox.__exp.distinguishable;
K.observationBlindSpots = sandbox.__exp.observationBlindSpots;

// 量纲分析（2026-08-30）：物理正确性约束层
vm.runInContext(
  'globalThis.__exp.DIM = DIM;' +
  'globalThis.__exp.DIM_AXES = DIM_AXES;' +
  'globalThis.__exp.dimOf = dimOf;' +
  'globalThis.__exp.dimMul = dimMul;' +
  'globalThis.__exp.dimDiv = dimDiv;' +
  'globalThis.__exp.dimPow = dimPow;' +
  'globalThis.__exp.dimEq = dimEq;' +
  'globalThis.__exp.dimAdd = dimAdd;' +
  'globalThis.__exp.dimFormat = dimFormat;' +
  'globalThis.__exp.buckinghamPi = buckinghamPi;' +
  'globalThis.__exp.unwrapDimValue = unwrapDimValue;' +
  'globalThis.__exp.checkDimensions = checkDimensions;',
  ctx
);
['DIM', 'DIM_AXES', 'dimOf', 'dimMul', 'dimDiv', 'dimPow', 'dimEq', 'dimAdd', 'dimFormat',
  'buckinghamPi', 'unwrapDimValue', 'checkDimensions'].forEach(function (n) { K[n] = sandbox.__exp[n]; });

// 高等数学工具箱 + CBF 安全滤子（2026-08-30）：已证明定理的可执行判据
// 与 build-umd.js 的 EXPORT_NAMES 对齐，内核新增函数用追加 runInContext 导出
vm.runInContext(
  'globalThis.__exp.dual = dual;' +
  'globalThis.__exp.dAdd = dAdd;' +
  'globalThis.__exp.dSub = dSub;' +
  'globalThis.__exp.dMul = dMul;' +
  'globalThis.__exp.dDiv = dDiv;' +
  'globalThis.__exp.dPow = dPow;' +
  'globalThis.__exp.dNeg = dNeg;' +
  'globalThis.__exp.dSin = dSin;' +
  'globalThis.__exp.dCos = dCos;' +
  'globalThis.__exp.dExp = dExp;' +
  'globalThis.__exp.dLog = dLog;' +
  'globalThis.__exp.dSqrt = dSqrt;' +
  'globalThis.__exp.dAbs = dAbs;' +
  'globalThis.__exp.grad = grad;' +
  'globalThis.__exp.jacobian = jacobian;' +
  'globalThis.__exp.lieDerivative = lieDerivative;' +
  'globalThis.__exp.graphColoring = graphColoring;' +
  'globalThis.__exp.planarityCheck = planarityCheck;' +
  'globalThis.__exp.hallCondition = hallCondition;' +
  'globalThis.__exp.KEPLER_DENSITY = KEPLER_DENSITY;' +
  'globalThis.__exp.packingBound = packingBound;' +
  'globalThis.__exp.lyapunovCheck = lyapunovCheck;' +
  'globalThis.__exp.cbfFilter = cbfFilter;' +
  'globalThis.__exp.cbfMargin = cbfMargin;',
  ctx
);
['dual', 'dAdd', 'dSub', 'dMul', 'dDiv', 'dPow', 'dNeg', 'dSin', 'dCos', 'dExp', 'dLog', 'dSqrt', 'dAbs',
  'grad', 'jacobian', 'lieDerivative', 'graphColoring', 'planarityCheck', 'hallCondition',
  'KEPLER_DENSITY', 'packingBound', 'lyapunovCheck', 'cbfFilter', 'cbfMargin'
].forEach(function (n) { K[n] = sandbox.__exp[n]; });

// 物理 AI 安全栈补齐（2026-08-30 下午）：
// STL 定量语义 ρ / Zonotope 可达集过近似 / 多约束组合 CBF / 混合自动机 × AD / 启发式自演化
var _SAFETY_STACK = ['STL', 'stlHorizon', 'stlRobustness', 'stlMonitor',
  'zono', 'zonoSupport', 'zonoBox', 'zonoLinear', 'zonoSum', 'zonoReduce',
  'zonoContains', 'zonoIntersectsHalfspace', 'zonoSafe', 'zonoReach',
  'cbfCompose', 'hybridAutomaton', 'hybridStep', 'hybridLipschitz', 'hybridReach',
  'heuristicEvolve',
  'hungarian',
  'ITV_BOT', 'itv', 'itvIsBot', 'itvTop', 'itvLe', 'itvEq', 'itvJoin', 'itvMeet',
  'itvAddI', 'itvMulI', 'itvWiden', 'itvNarrow', 'absFixpoint', 'absSafe',
  'learnedEdgePenalty', 'recordPlanHistory', 'getPlanHistory', 'resetPlanHistory',
  'conformalQuantile', 'conformalInterval', 'conformalPValue', 'conformalIsAnomaly',
  'affordanceOf', 'sayCanRank', 'thompsonSample',
  'matEye', 'matT', 'matMul', 'matAdd', 'matSub', 'matScale', 'matInv',
  'kalmanUpdate', 'lqrSolve', 'cvar',
  'effectiveSampleSize', 'particleFilterStep', 'entropyOf', 'expectedInfoGain', 'selectByInfoGain',
  'shapleyValues', 'wasserstein1', 'driftCheck',
  'absVerdict', 'galoisAlphaSet', 'galoisGammaContains', 'galoisCheck',
  'beliefPlausibility', 'decideImprecise',
  'MathKernel', 'CAPABILITY_THEOREMS', 'theoremOf', 'proofAudit', 'verifyLedger',
  'FIREWALL', 'liftToBelief', 'firewallCheck', 'firewallIsPerception', 'LingNaoThinking',
  'kernelVerify', 'kernelStatus', 'kernelFoundation', 'kernelProve', 'kernelConjectures',
  // Layer 2 确定性安全陷阱层 + CLF-CBF 统一 QP（2026-09-02）：经 MCP 暴露
  'bertrandTrap', 'cauchyLipschitzTrap', 'compactnessTrap', 'vanDerWaerdenTrap', 'baireTrap', 'varietyTrap',
  'runDeterministicTraps', 'clfCbfUnified', 'linearControlSpec',
  // Layer 3 无模型 CBF + 反事实审计（2026-09-02）：经 MCP 暴露
  'modelFreeCbf', 'counterfactualAudit', 'safetyLayersReport'];
vm.runInContext(
  _SAFETY_STACK.map(function (n) { return 'globalThis.__exp.' + n + ' = ' + n + ';'; }).join(''),
  ctx
);
_SAFETY_STACK.forEach(function (n) { K[n] = sandbox.__exp[n]; });

// 八元组 𝔹=(X,h,b,f,U,V,Inv,M) 数学形态（2026-08-31 落地）：
// 与 build-umd.js 的 EXPORT_NAMES、灵脑.html 的 globalThis.__WB 对齐，内核新增 BrainTuple 在此追加导出
vm.runInContext('globalThis.__exp.BrainTuple = BrainTuple;', ctx);
K.BrainTuple = sandbox.__exp.BrainTuple;

// 形式化证明模块 M1..M4（2026-09-03 MCP 暴露）：此前四个证明入口只存在于内核与本地测试，
// MCP 一个都调不到 —— 等于外部智能体/审计者无法要求灵脑"出证明"。在此接出。
const _PROOF_MODULE = [
  'proveGateChain', 'GATE_SPEC',        // M1 能力/意图门控证明（正确性）
  'certifySafetyInvariant',             // M2 数值安全证书（灵数 Krawczyk 全域认证）
  'verdictThreeLayer',                  // M3 三层次裁决（逻辑/计算/工程分离）
  'proveCompleteMediation',             // M4 完全中介证明（完备性）
  'EffectGate', 'EFFECT_KINDS'          // M4 机制：副作用唯一出口
];
// 缺失即抛（fail-closed，修复 #251）：内核若未定义某证明模块名，MCP 启动必须当场失败，
// 而不是静默吞掉让外部智能体以为"M1-M4 齐备"实则调不到（曾因此事故）。
// 注意：证明模块多为 const 词法绑定，不挂在 globalThis 上；须在 vm 上下文内用 typeof 判定，
// 再用 runInContext 把内核作用域里的名字拷进 __exp（与 _SAFETY_STACK 同一机制）。
_PROOF_MODULE.forEach(function (n) {
  var defined = false;
  try { defined = vm.runInContext('(typeof ' + n + ' !== "undefined")', ctx); } catch (e) { defined = false; }
  if (!defined) {
    throw new Error('MCP_EXPORT_MISSING: 内核未定义证明模块 "' + n + '"。内核与 MCP 导出表已漂移，须修正后再启动（fail-closed）。');
  }
  vm.runInContext('globalThis.__exp.' + n + ' = ' + n + ';', ctx);
  K[n] = sandbox.__exp[n];
});
// M4 判定的对象是内核源码文本本身（完全中介是源码性质，不是运行时性质）。
// 把真源码交给 vm 内的判定程序，避免它在沙箱里拿不到源码而只能诚实返回 unverified。
vm.runInContext('globalThis.__LINGNAO_SRC = ' + JSON.stringify(kernelSrc) + ';', ctx);

// 独立确定性回代器（2026-09-30 诚实加固）：把内核确定性求值器 _m2Eval 也导出给 K，
// 供 _auditOneNumericSafety 对 M2 候选反例做"独立确定性回代核验"——候选点代入 hExpr
// 确证 h<0 且点在域内，才把 M2 的 violated 升级为真正 refuted；否则诚实 𝕌。
// 不并入 _PROOF_MODULE（它不是证明模块，不应触发证明模块缺失即抛的 fail-closed）。
try {
  if (vm.runInContext('(typeof _m2Eval !== "undefined")', ctx)) {
    vm.runInContext('globalThis.__exp._m2Eval = _m2Eval;', ctx);
    K._m2Eval = sandbox.__exp._m2Eval;
  }
} catch (e) { /* 内核未定义 _m2Eval 时 _auditOneNumericSafety 自动诚实降级 𝕌，不致命 */ }

// ---------- 2. 编排工具（纯函数，复用内核，不依赖 DOM） ----------
function worldInfo() {
  return { nodes: K.getWorld().nodes, edgeCount: K.getWorld().edges.length, edges: K.getWorld().edges, coord: K.getWorld().coord };
}
function setWorldLogic(json) {
  if (typeof json === 'string') json = JSON.parse(json);
  K.setWorld(json);
  return { ok: true, nodes: K.getWorld().nodes, edgeCount: K.getWorld().edges.length };
}
function reasonLogic(start, goal, hard, soft) {
  start = start || 'CHARGE';
  if (!K.getWorld().nodes.includes(start) || !K.getWorld().nodes.includes(goal)) {
    return { status: 'unknown', U: true, reason: '起点或目标不在世界图 𝕎 中（不可判定区域 𝕌）', path: [], cost: 0 };
  }
  const r = K.reason(start, goal, { hard: hard || [], soft: soft || [] });
  if (r.status !== 'optimal') return { status: 'unknown', U: true, reason: r.U, path: [], cost: 0, imaEvidence: r.imaEvidence, imaRef: r.imaRef, note: r.note };
  const steps = r.steps.map(s => ({
    seq: s.seq, state: s.state, action: s.action, result: s.result,
    reason: s.reason, confidence: s.confidence, evidence: s.evidenceIds, p: s.p,
  }));
  return {
    status: r.status, usedSystem: r.system || r.usedSystem, path: r.path, cost: r.cost,
    expanded: r.expanded, steps, hard: hard || [], soft: soft || [],
    rsg: r.rsg ? { nodes: r.rsg.nodes.length, branchCount: r.rsg.branchCount, pruneCount: r.rsg.pruneCount, optimalPath: r.rsg.optimalPath } : null,
    note: '每步可追溯到 IMA-45（度量空间）；硬约束已剪枝，软约束代价+2/节点',
  };
}
function auditLogic(start, goal, hard, soft) {
  const r = K.reason(start || 'CHARGE', goal, { hard: hard || [], soft: soft || [] });
  return K.generateAudit(r, { hard: hard || [], soft: soft || [] });
}
function carrierReportLogic(battery, goal, density) {
  const r = K.carrierReport({ battery: battery, goal: goal || 'A', density: density || {} });
  const low = Object.keys(density || {}).filter(z => (density || {})[z] <= 2 && z !== 'CHARGE');
  return { carrier: '物理载体（默认智能灭蚊器）', battery: r.battery, density: r.density, goal: r.goal, hard: r.hard, soft: low };
}
// 知识库（KB）模块：内核近期重构已移除顶层 KB 导出（ann/distillRules/cogGraph/addExperience/query/summary 均不再存在）。
// 相关 MCP 工具保留接口，但探测到 K.KB 缺失时诚实降级（不虚构、不崩 server），引导用户使用 ima_query / KBFabric。
function kbAvailable() { return !!K.KB; }
function learnLogic(p, success) {
  if (!Array.isArray(p) || p.length < 2) throw new Error('path 需为至少含 2 节点的数组');
  const r = K.learn(p, !!success, 0.1);
  const s = kbAvailable() ? K.KB.summary() : { available: false, reason: '知识库模块(KB)未暴露；可审计推理请用 reason/ask，证据检索用 ima_query，版本化用 KBFabric' };
  return { updated: r.updated, knowledgeBase: s, log: r.log };
}
function knowledgeQueryLogic(from, to) {
  if (!kbAvailable()) return { available: false, reason: 'KB 未暴露', from: from, to: to };
  return K.KB.query(from, to).map(e => ({
    id: e.id, transition: e.transition.from + '→' + e.transition.to,
    success: e.success, confidence: e.confidence, kind: e.kind, source: e.source,
  }));
}
function knowledgeAddLogic(from, to, success, confidence, source, kind) {
  if (!kbAvailable()) return { available: false, reason: 'KB 未暴露', from: from, to: to };
  const e = K.KB.addExperience(from, to, success == null ? true : !!success, confidence == null ? 0.5 : confidence, source || 'mcp', kind);
  return { id: e.id, transition: e.transition.from + '→' + e.transition.to, confidence: e.confidence, success: e.success, kind: e.kind, source: e.source };
}
async function perceiveLogic(text, apiKey) {
  const key = apiKey || process.env.OPENROUTER_API_KEY || undefined;
  const r = await K.perceiveLLM(text, key ? { apiKey: key } : undefined);
  return r;
}
function metaLogic(start, goal, hard, soft) {
  let path = null;
  if (goal) {
    const r = K.reason(start || 'CHARGE', goal, { hard: hard || [], soft: soft || [] });
    path = r.status === 'optimal' ? r : null;
  }
  return K.metaCognition({ path });
}
function perceiveBeliefLogic(initial, observations, kernel) {
  return K.perceiveBelief(initial, observations, kernel || { CHARGE: { CHARGE: 0.5, A: 0.5 }, A: { CHARGE: 0.5, A: 0.5 } }, 50, 1e-6);
}
function annLogic(queryFp, k) { if (!kbAvailable()) return { available: false, reason: 'KB 未暴露' }; return K.KB.ann(queryFp, k || 3); }
function distillLogic(minSupport) { if (!kbAvailable()) return { available: false, reason: 'KB 未暴露' }; return K.KB.distillRules(minSupport || 0.4); }
function cogGraphLogic() { if (!kbAvailable()) return { available: false, reason: 'KB 未暴露' }; return K.KB.cogGraph(); }
function symbolicVerifyLogic(start, goal, hard, soft) {
  const r = K.reason(start || 'CHARGE', goal, { hard: hard || [], soft: soft || [] });
  if (r.status !== 'optimal') return { verified: false, reason: '路径不可判定' };
  return K.verifyHoarePath(r, K.getWorld());
}
// 灵脑=推理-only（2026-10-07）：algebraicSolveLogic 已移除（计算归灵数 lingshu-solver 独立产品）。
function dmctsLogic(start, goal, hard, soft) {
  return K.dmcts(start || 'CHARGE', goal, { hard: hard || [], soft: soft || [], iterations: 80 });
}
// 端到端：免费 LLM 理解大白话 → 灵脑确定性推理 → 免费 LLM 解释（grounding IMA）
function askBrainLogic(text, apiKey, opts) {
  if (!text) return { ok: false, error: '缺少 text（用户大白话描述）' };
  return K.askBrain(text, apiKey || undefined, opts || {});
}
// 解释层：把已有 reason 结果 + 命中 IMA 资料，用免费 LLM 讲成中文
function explainLogic(result, apiKey, opts) {
  if (!result) return { ok: false, error: '缺少 result（reason 结果）' };
  return K.explainWithLLM(result, apiKey || undefined, opts || {});
}
function pacLogic(dvc, eps, delta) { return K.pacSampleBound(dvc || 10, eps, delta); }
function causalLogic() { return { discovery: K.causalDiscovery(), doQueryExample: K.doQuery('A', 'C', []) }; }
function eventPublishLogic(type, payload) { return K.EventBus.publish(type, payload || {}); }
function fabricLogic(action, msg, ver) {
  if (action === 'commit') return K.KBFabric.commit(msg || 'mcp-commit');
  if (action === 'list') return K.KBFabric.list();
  if (action === 'diff') return K.KBFabric.diff(ver ? ver[0] : 1, ver ? ver[1] : 2);
  return K.KBFabric.list();
}
function runtimeMonitorLogic(start, goal, safety) {
  const r = K.reason(start || 'CHARGE', goal, { hard: (safety || {}).hardNodes || [] });
  if (r.status !== 'optimal') return { safe: false, reason: '路径不可判定' };
  return K.runtimeMonitor(r, safety || {});
}
function continuousVerifyLogic() { return K.continuousVerify(); }
function worldModelLogic(samples, state, action) {
  const m = K.learnWorldModel(samples || []);
  if (m.error) return m;
  if (state && action) return { model: m, simulate: K.simulate(m, state, action) };
  return { model: m };
}
function counterfactualLogic(samples, factual, intervention) {
  const m = K.learnWorldModel(samples || []);
  if (m.error) return m;
  return K.counterfactual(m, factual || {}, intervention || {});
}
// 因果效应估计（do-演算：后门调整 + 前门准则，自动识别）：先学线性 SEM 模型，再估计 ACE(cause→effect)
function causalEffectLogic(samples, cause, effect, mediator) {
  const m = K.learnWorldModel(samples || []);
  if (m.error) return m;
  return K.causalEffect(m, cause, effect, samples, mediator ? { mediator } : {});
}
// IMA 数学库接入：读取知识壳（默认同目录 ima_knowledge.json）并注入内核 KB / 元认知路由
function imaLoadLogic(p) {
  let j;
  if (Array.isArray(p) || (p && p.entries)) { j = p; }
  else {
    const fp = (p && p.path) || path.join(__dirname, 'ima_knowledge.json');
    j = JSON.parse(fs.readFileSync(fp, 'utf8'));
  }
  const res = K.loadIMAKB(j, { source: (p && p.path) || 'ima_knowledge.json' });
  return Object.assign({ file: (p && p.path) || 'ima_knowledge.json' }, res);
}
function imaQueryLogic(keyword, k) {
  if (!K.imaKnowledge.loaded) return { loaded: false, hint: '请先调用 ima_load 注入知识壳' };
  return { loaded: true, keyword, results: K.imaKnowledge.query(keyword, k || 10) };
}

// 自我学习模块（第四层 反思与演化中枢）逻辑函数
function slRecordLogic(rec) { return K.slRecord(rec); }
function slDiscoverLogic(opts) { return K.slDiscover(opts || {}); }
function slValidateLogic(hid, outcome, opts) { return K.slValidate(hid, outcome, opts || {}); }
function slMonitorLogic(kid, reason) { return K.slMonitor(kid, reason); }
function slStatusLogic() { return K.slStatus(); }

// 目标导向决策（消费 IMA 真数学：ima_286 框架 / ima_288 可达性 / ima_291 值迭代 / ima_289 路径规划）
function goalDirectedLogic(start, goal, opts) { return K.goalDirected(start, goal, opts || {}); }

// ---------- 2.5 具身层（Embodied AI）MCP 适配器 ----------
// 具身层内核函数签名含函数参数（goalFn / bodyAdapter / pre / eff / cost），
// 而 MCP stdio 只能传 JSON。本层把"结构化声明"编译成内核期望的函数对象，
// 让机器人侧用纯 JSON 注册身体、规划任务，并在大脑内"模拟执行"闭环（确定化重规划）。
// 真物理执行由机器人侧用返回的 plan 自行驱动机体（与大脑侧的模拟语义一致）。
let jsCaps = Object.create(null);   // 编译后的 capability 对象表（供模拟执行 adapter 使用）
let lastGoalSpec = null;            // 供 ground 模板从目标规范取字段

// 把结构化 goalSpec 编译成 (state)=>bool。支持：
//   {reach: node}            状态.node === node
//   {match: {field:value,...}}  状态满足全部字段相等
//   {all: [goalSpec,...]}    全部满足
function goalFnFromSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('goalSpec 必须是对象 {reach|match|all}');
  if (spec.reach !== undefined) { const t = spec.reach; return s => !!(s && s.node === t); }
  if (spec.match) {
    const m = spec.match; const ks = Object.keys(m);
    // 离散相等 或 区间/容差匹配（连续物理量：角度/坐标/力/电量）。
    // 区间写法复用内核 evalRequire 语义：{min,max,gte,lte,gt,lt}。
    // 例：match:{angle:{min:44.5,max:45.5}} 表示传感器读数落在此容差带即视为达成。
    return s => ks.every(k => {
      const want = m[k];
      if (want && typeof want === 'object' && !Array.isArray(want)) return K.evalRequire(s, { [k]: want });
      return !!(s && s[k] === want);
    });
  }
  if (spec.all) { const fns = spec.all.map(goalFnFromSpec); return s => fns.every(f => f(s)); }
  throw new Error('goalSpec 需含 reach / match / all 之一');
}

// 把结构化 capability 声明编译成内核 attachBody 期望的对象（含 pre/eff/cost/ground 函数）
function compileCapability(spec) {
  const id = spec.id;
  if (!id) throw new Error('capability 需 id');
  const set = (spec.effect && spec.effect.set) || {};
  const inc = (spec.effect && spec.effect.inc) || {};
  // 整串模板（如 "{{params.target}}"）保留原始类型：数值仍是数值。
  // 否则数值物理量会被 String.replace 变成 "45" 这类字符串，导致后续
  // 数值区间比较（安全包线、目标判定）全部 fail-closed 误拦。
  function resolveTpl(v, params) {
    if (typeof v !== 'string' || v.indexOf('{{') < 0) return v;
    const full = /^\s*\{\{\s*params\.(\w+)\s*\}\}\s*$/.exec(v);
    if (full) { const raw = params ? params[full[1]] : undefined; return raw === undefined ? '' : raw; }
    return v.replace(/\{\{\s*params\.(\w+)\s*\}\}/g, (_, k) => (params && params[k] !== undefined ? params[k] : ''));
  }
  const eff = function (state, params) {
    const next = Object.assign({}, state);
    for (const k in set) next[k] = resolveTpl(set[k], params);
    for (const k in inc) next[k] = (Number(next[k]) || 0) + (Number(inc[k]) || 0);
    return next;
  };
  let pre = undefined;
  if (spec.pre && spec.pre.require) {
    const req = spec.pre.require;
    // 单一真源：前置条件与 hard / match 共用内核 evalRequire 语义（区间 + 枚举）。
    pre = function (state) { return K.evalRequire(state, req); };
  }
  const cost = (typeof spec.cost === 'function') ? spec.cost : (spec.cost == null ? 1 : spec.cost);
  let ground = undefined;
  if (spec.ground) {
    // 从目标值里抽取"具体要执行到的标量"。区间/容差目标（{min,max}/{target,tol}/{center}）
    // 取其几何中心作为动作参数；离散值原样透传。这样连续物理量（角度/坐标/力）的
    // 目标既能带容差判定，又能驱动机体执行到一个确定的点。
    // 关键：整串模板（如 "{{goal.match.angle}}"）直接返回原始类型的值（数值仍是数值），
    // 不能走 String.replace —— replace 会把 replacer 的返回值强制转成字符串（"45"），
    // 导致后续数值区间比较全部 fail-closed 误拦。只有模板嵌在更长字符串里才用 replace。
    const goalScalar = function (v) {
      if (typeof v === 'number') return v;
      if (v && typeof v === 'object') {
        if ('target' in v) return v.target;
        if ('center' in v) return v.center;
        if ('eq' in v) return v.eq;
        if ('min' in v && 'max' in v) return (Number(v.min) + Number(v.max)) / 2;
      }
      return v;
    };
    const reMatch = /^\s*\{\{\s*goal\.match\.(\w+)\s*\}\}\s*$/;
    const reTop = /^\s*\{\{\s*goal\.(\w+)\s*\}\}\s*$/;
    ground = function () {
      const p = {};
      for (const k in spec.ground) {
        const v = spec.ground[k];
        if (typeof v !== 'string' || v.indexOf('{{goal.') < 0) { p[k] = v; continue; }
        const fm = reMatch.exec(v);
        if (fm) { const m = lastGoalSpec && lastGoalSpec.match; p[k] = (m && m[fm[1]] !== undefined) ? goalScalar(m[fm[1]]) : ''; continue; }
        const ft = reTop.exec(v);
        if (ft) { p[k] = (lastGoalSpec && lastGoalSpec[ft[1]] !== undefined) ? lastGoalSpec[ft[1]] : ''; continue; }
        // 模板嵌在更长字符串里：仍用 replace（结果本就是字符串，可接受）
        p[k] = v
          .replace(/\{\{\s*goal\.match\.(\w+)\s*\}\}/g, (_, f) => (lastGoalSpec && lastGoalSpec.match && lastGoalSpec.match[f] !== undefined ? goalScalar(lastGoalSpec.match[f]) : ''))
          .replace(/\{\{\s*goal\.(\w+)\s*\}\}/g, (_, f) => (lastGoalSpec && lastGoalSpec[f] !== undefined ? lastGoalSpec[f] : ''));
      }
      return p;
    };
  }
  return { id, desc: spec.desc, pre, eff, cost, ground, hard: spec.hard || [], irreversible: spec.irreversible === true };
}

function attachBodyLogic(body) {
  if (typeof body === 'string') body = JSON.parse(body);
  jsCaps = Object.create(null);
  const caps = (body.capabilities || []).map(function (spec) {
    const c = compileCapability(spec);
    jsCaps[c.id] = c;
    return c;
  });
  const r = K.attachBody({
    name: body.name,
    state: body.initialState || {},
    hard: body.hard || [],
    capabilities: caps,
  });
  return Object.assign(
    { ok: r.ok, body: r.body, capabilities: r.capabilities, state: r.state },
    { note: '大脑不含任何具体身体代码；能力契约由调用方以结构化声明注册（pre/eff/cost 编译为内核函数）。真物理执行由机器人侧用 plan 驱动机体。' }
  );
}
function capabilitiesLogic() { return K.capabilities(); }
function getStateLogic() { return K.getState(); }
function setStateLogic(s) { return K.setState(s || {}); }
function stateDiffLogic(a, b) { return K.stateDiff(a || {}, b || {}); }
function checkHardLogic(state, step) { return K.checkHard(state || K.getState(), step || {}); }
function hMaxLogic(state, goalSpec, maxLayer) { return K.hMax(state || K.getState(), goalFnFromSpec(goalSpec), maxLayer); }
function planTaskLogic(goalSpec, opts) { lastGoalSpec = goalSpec; return K.planTask(goalFnFromSpec(goalSpec), opts || {}); }
// 大脑内"模拟执行"闭环：用编译后的 jsCaps.eff 推进状态（确定性重放），可注入 faults 演示重规划/SAFE-STOP。
function executeLogic(goalSpec, opts, faults) {
  opts = opts || {}; faults = faults || {};
  lastGoalSpec = goalSpec;
  const goalFn = goalFnFromSpec(goalSpec);
  const failAt = faults.failAt || [];           // 在执行第 i 步返回 ok:false
  const deviateAt = faults.deviateAt || [];      // [{step, patch:{field:value}}] 注入状态偏差
  let cursor = 0;
  const adapter = function (capId, params) {
    const c = jsCaps[capId];
    const i = cursor++;
    if (failAt.indexOf(i) >= 0) return Promise.resolve({ ok: false, error: 'injected-failure@' + i });
    let ns;
    try { ns = c ? c.eff(K.getState(), params) : Object.assign({}, K.getState()); }
    catch (e) { ns = Object.assign({}, K.getState()); }
    for (const d of deviateAt) if (d.step === i) ns = Object.assign({}, ns, d.patch || {});
    return Promise.resolve({ ok: true, state: ns });
  };
  return K.doWork(goalFn, adapter, opts);
}

// ---------- 3. 工具定义与分发 ----------
const TOOLS = [
  {
    name: 'world_info', description: '返回当前世界图 𝕎 的节点、边、坐标——外部智能体先调用以了解场景结构。  / EN: Return the current world graph 𝕎’s nodes, edges, and coordinates — external agents call this first to understand the scene structure.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'set_world', description: '导入任意场景的世界图（外部可定义，灭蚊器仅为默认）。让世界大脑适配你的物理载体/业务。  / EN: Import an arbitrary scenario’s world graph (externally definable; the mosquito-killer is just the default). Lets the world-brain adapt to your physical carrier / business.',
    inputSchema: {
      type: 'object',
      properties: {
        nodes: { type: 'array', items: { type: 'string' }, description: '状态节点列表，如 ["S","A","B","T"]' },
        edges: { type: 'array', items: { type: 'object' }, description: '有向边 [{from,to,w,p?}]，w 为转移代价，p 为转移概率(默认1)' },
        coord: { type: 'object', description: '可选节点坐标 {节点:[x,y]}，用于欧氏启发式；缺省随机生成' },
      },
      required: ['nodes', 'edges'],
    },
  },
  {
    name: 'perceive', description: '免费 LLM 感知层：自然语言/状态描述 → 结构化感知(JSON)。需 OpenRouter API Key（参数或 env OPENROUTER_API_KEY）。无 key 返回 manual 降级。  / EN: Free LLM perception layer: natural-language / state description → structured perception (JSON). Requires an OpenRouter API Key (param or env OPENROUTER_API_KEY). Falls back to manual mode without a key.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '自然语言描述，如 "电量80，目标去C区，A区蚊子多"' },
        apiKey: { type: 'string', description: 'OpenRouter Key（可选，缺省读 env）' },
      },
      required: ['text'],
    },
  },
  {
    name: 'reason', description: '可审计推理：系统1快答(高置信复用) + 系统2(A*最优+RSG推理状态图)。输出每步依据、所用系统、RSG、不可判定标记 𝕌。  / EN: Auditable reasoning: System-1 fast answer (high-confidence reuse) + System-2 (A* optimal + RSG reasoning state graph). Outputs per-step rationale, which system was used, the RSG, and the undecidable marker 𝕌.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: '起点节点，默认 CHARGE' },
        goal: { type: 'string', description: '目标节点' },
        hard: { type: 'array', items: { type: 'string' }, description: '硬约束禁入节点集（必须满足）' },
        soft: { type: 'array', items: { type: 'string' }, description: '软约束避开节点集（尽量满足，附加代价）' },
        system1Only: { type: 'boolean', description: 'true=仅系统1快答(不展开RSG)，默认 false=系统2深度' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'carrier_report', description: '物理载体上报传感器状态（电量/目标/密度），返回硬/软约束。电量<20 触发硬约束禁离充电座。  / EN: Physical carrier reports sensor status (battery / goal / density) and returns hard / soft constraints. Battery <20 triggers a hard constraint forbidding leaving the charging dock.',
    inputSchema: {
      type: 'object',
      properties: {
        battery: { type: 'number', description: '载体电量 %（<20 触发硬约束）' },
        goal: { type: 'string', description: '巡检/目标节点' },
        density: { type: 'object', description: '各区域观测密度 {区域:数值}' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'audit', description: '生成七段审计报告（概要/详细/证据/约束/𝕌/形式化证明证书/可复现）+ 不确定性量化，对应文档 3.4。  / EN: Generate a seven-part audit report (summary / detail / evidence / constraints / 𝕌 / formal proof certificate / reproducible) + uncertainty quantification. See doc §3.4.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: '起点节点，默认 CHARGE' },
        goal: { type: 'string', description: '目标节点' },
        hard: { type: 'array', items: { type: 'string' }, description: '硬约束禁入节点集' },
        soft: { type: 'array', items: { type: 'string' }, description: '软约束避开节点集' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'learn', description: '学习闭环：载体执行回报后更新经验库（成功=正样本+0.1 / 失败=负样本-0.1）。  / EN: Learning loop: after the carrier executes and reports reward, update the experience base (success = positive sample +0.1 / failure = negative sample −0.1).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'array', items: { type: 'string' }, description: '已执行路径节点序列，如 ["CHARGE","A","C"]' },
        success: { type: 'boolean', description: '载体执行是否成功' },
      },
      required: ['path', 'success'],
    },
  },
  {
    name: 'knowledge_query', description: '查询经验库（状态→行动→结果的置信度/样本类记录）。  / EN: Query the experience base (state → action → result confidence / sample-class records). 【需接入 KB 知识库：当前未接入，调用恒返 available:false，属已知未实现能力；接入 KB 后可用】',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: '起始节点（可选，缺省查全部）' },
        to: { type: 'string', description: '目标节点（可选）' },
      },
      required: [],
    },
  },
  {
    name: 'knowledge_add', description: '向经验库手工添加一条转移经验（带置信度、样本类与来源）。  / EN: Manually add one transition experience to the experience base (with confidence, sample class, and source). 【需接入 KB 知识库：当前未接入，调用恒返 available:false，属已知未实现能力；接入 KB 后可用】',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: '起始节点' },
        to: { type: 'string', description: '目标节点' },
        success: { type: 'boolean', description: '该转移是否成功' },
        confidence: { type: 'number', description: '初始置信度 0~1，默认 0.5' },
        source: { type: 'string', description: '来源标记，默认 mcp' },
        kind: { type: 'string', description: '样本类 positive/negative/boundary，缺省按 success 推断' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'meta', description: '第五层元认知与协调层：全局监控 / 知识熵 H(K) / 一致性 C(K) / 知识缺口 / 冲突仲裁 / 探索-利用决策。可选携带 start+goal 以纳入路径不确定性。  / EN: Layer-5 metacognition & coordination: global monitoring / knowledge entropy H(K) / consistency C(K) / knowledge gaps / conflict arbitration / explore-exploit decisions. Optionally carry start+goal to include path uncertainty.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: '起点节点（可选，用于纳入路径不确定性）' },
        goal: { type: 'string', description: '目标节点（可选）' },
        hard: { type: 'array', items: { type: 'string' }, description: '硬约束禁入节点集（可选）' },
        soft: { type: 'array', items: { type: 'string' }, description: '软约束避开节点集（可选）' },
      },
      required: [],
    },
  },
  {
    name: 'perceive_belief', description: '感知数学原理：贝叶斯滤波迭代 + Banach 压缩映射收敛检测（离散信念→不动点）。  / EN: Perception math: Bayesian-filter iteration + Banach contraction-mapping convergence detection (discrete belief → fixed point).',
    inputSchema: {
      type: 'object',
      properties: {
        initial: { type: 'object', description: '初始信念分布 {状态:概率}，如 {"CHARGE":0.5,"A":0.5}' },
        observations: { type: 'object', description: '观测似然 {likelihood:{状态:概率}}' },
        kernel: { type: 'object', description: '转移核（可选，缺省用灭蚊器默认）' },
      },
      required: ['initial', 'observations'],
    },
  },
  {
    name: 'knowledge_ann', description: 'LSH 近似最近邻检索（SimHash 投影），从经验库找最相似转移。  / EN: LSH approximate nearest-neighbor retrieval (SimHash projection) to find the most similar transition in the experience base. 【需接入 KB 知识库：当前未接入，调用恒返 available:false，属已知未实现能力；接入 KB 后可用】',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '查询指纹（状态JSON或字符串）' },
        k: { type: 'number', description: '返回 Top-K 相似经验，默认 3' },
      },
      required: ['query'],
    },
  },
  {
    name: 'knowledge_distill', description: '规则蒸馏（FP-Growth 风格频繁项集→关联规则）。  / EN: Rule distillation (FP-Growth-style frequent itemsets → association rules). 【需接入 KB 知识库：当前未接入，调用恒返 available:false，属已知未实现能力；接入 KB 后可用】',
    inputSchema: {
      type: 'object',
      properties: { minSupport: { type: 'number', description: '最小支持度，默认 0.4' } },
      required: [],
    },
  },
  {
    name: 'cog_graph', description: '认知图谱：由经验库构建概念节点+语义关系有向图。  / EN: Cognitive graph: build a concept-node + semantic-relation directed graph from the experience base. 【需接入 KB 知识库：当前未接入，调用恒返 available:false，属已知未实现能力；接入 KB 后可用】',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'symbolic_verify', description: '符号验证：霍尔逻辑机器验证证明 A* 路径满足不变量（手写 Z3-lite 等价）。  / EN: Symbolic verification: Hoare-logic machine-checked proof that the A* path satisfies an invariant (hand-written Z3-lite equivalent).',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: '起点节点，默认 CHARGE' },
        goal: { type: 'string', description: '目标节点' },
        hard: { type: 'array', items: { type: 'string' } },
        soft: { type: 'array', items: { type: 'string' } },
      },
      required: ['goal'],
    },
  },
  // 灵脑=推理-only（2026-10-07）：algebraic_solve 工具已移除，计算归灵数 lingshu-solver 独立产品。
  {
    name: 'world_model', description: '世界模型（lite）：从观测轨迹样本学结构方程模型 SEM（手写最小二乘），并前向模拟下一状态。文档 3.4 给的 VAE/ADM-v2 需神经网络+大数据（无定义），本实装为诚实 lite 等价（线性 SEM + Pearl 反事实框架），确定性、可复现、可审计。  / EN: World model (lite): learn a structural-equation model (SEM) from observed trajectory samples (hand-written least squares) and forward-simulate the next state. The VAE/ADM-v2 from doc §3.4 needs neural nets + big data (undefined), so this is an honest lite equivalent (linear SEM + Pearl counterfactual framework): deterministic, reproducible, auditable.' +
      'samples 为轨迹数组，每项 {state:{变量:值}, action:{变量:值}, next:{变量:值}}；提供 state+action 则同时返回 simulate 预测 next。' +
      '输出 model（method/变量集/方程系数 eqs[变量].coef/偏置 bias/残差 residuals，全部可审计）与 simulate.next。',
    inputSchema: {
      type: 'object',
      properties: {
        samples: { type: 'array', items: { type: 'object' }, description: '观测轨迹样本数组，每项 {state:{}, action:{}, next:{}}' },
        state: { type: 'object', description: '当前状态（可选，提供则前向模拟）' },
        action: { type: 'object', description: '动作（可选，配合 state 模拟）' },
      },
      required: ['samples'],
    },
  },
  {
    name: 'counterfactual', description: '反事实推理（lite，Pearl 三步法 abduction→action→prediction）：给定事实上发生的轨迹 factual={state,action,next} 与干预 intervention={var,value}，  / EN: Counterfactual reasoning (lite, Pearl’s three-step abduction→action→prediction): given the factual trajectory factual={state,action,next} and the intervention intervention={var,value}, estimate what would have happened under the intervention.' +
      '保持事实推断噪声 U 下施加 do(var=value) 重算其余变量。确定性、可复现、可审计；非 VAE 潜空间推演。需先以同结构 samples 学出模型。',
    inputSchema: {
      type: 'object',
      properties: {
        samples: { type: 'array', items: { type: 'object' }, description: '观测轨迹样本（用于学模型，结构与 factual 一致）' },
        factual: { type: 'object', description: '事实上发生的轨迹 {state:{}, action:{}, next:{}}' },
        intervention: { type: 'object', description: '干预 {var:变量名, value:干预值}' },
      },
      required: ['samples', 'factual', 'intervention'],
    },
  },
  {
    name: 'causal_effect', description: '因果效应估计（do-演算：后门调整 + 前门准则自动识别，呼应已消费 ima_304 因果 / ima_301 反事实）：给定观测轨迹样本 samples 与因果变量 cause / 结果变量 effect，自动学线性 SEM 世界模型并估计 ACE=E[effect|do(cause=1)]-E[effect|do(cause=0)]。  / EN: Causal-effect estimation (do-calculus: back-door adjustment + front-door criterion auto-identification, echoing consumed ima_304 causal / ima_301 counterfactual): given observed trajectory samples and cause/effect variables, auto-learn a linear SEM world model and estimate ACE = E[effect|do(cause=1)] − E[effect|do(cause=0)].' +
      '· 默认后门调整：后门集=effect 的其余父节点（已观测）；若 cause 对方程残差有显著线性依赖，返回 unobservedConfounderWarning（未观测混杂警示）。' +
      '· 前门准则：当存在未观测混杂致后门失效时，传 mediator（完全观测的中介，满足前门三条件）即可用两段式 ACE=α·β 从纯观测数据识别 do 效应（Pearl 1995 / Wienöbst-Jeong 识别算法）。' +
      'samples 为轨迹数组，每项 {state:{}, action:{}, next:{}}；输出 {ace, method, adjustSet|mediator, auditable, imaRef} 或 {error}。',
    inputSchema: {
      type: 'object',
      properties: {
        samples: { type: 'array', items: { type: 'object' }, description: '观测轨迹样本数组，每项 {state:{}, action:{}, next:{}}' },
        cause: { type: 'string', description: '原因变量名（如 "a"）' },
        effect: { type: 'string', description: '结果变量名（如 "y"）' },
        mediator: { type: 'string', description: '（可选）前门准则中介变量名；提供时走前门两段式估计，可处理未观测混杂' },
      },
      required: ['samples', 'cause', 'effect'],
    },
  },
  {
    name: 'dmcts', description: '确定性 D-MCTS（determinized MCTS）：可复现的多候选探索规划器（UCB1 选择 + 确定性 rollout），默认固定种子 ⇒ 同输入同输出。注意：此为近似探索层，非 KERNEL/PROOF，结果须经 liftToBelief 提升为信念方可进决策，不直接构成证明链。  / EN: Deterministic D-MCTS: reproducible multi-candidate exploration planner. Approximation layer only — not a KERNEL proof; lift to belief before use in decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: '起点节点，默认 CHARGE' },
        goal: { type: 'string', description: '目标节点' },
        hard: { type: 'array', items: { type: 'string' } },
        soft: { type: 'array', items: { type: 'string' } },
      },
      required: ['goal'],
    },
  },
  {
    name: 'goal_directed', description: '目标导向决策（消费 IMA 真数学：ima_286 目标导向框架 (S,A,P,G,C,γ) 无奖励最大化到达概率 / ima_288 可达性 BFS / ima_291 值迭代求到达概率 / ima_289 贪心路径规划）。给定世界图起点+目标，返回可达状态数、到达概率 goalProb、最优到达路径。与 reason(A*最优)互补：reason 求代价最优，goal_directed 求到达可靠性最优。  / EN: Goal-directed decision (consumes real IMA math: ima_286 goal framework (S,A,P,G,C,γ) reach-prob w/o reward maximization / ima_288 reachability BFS / ima_291 value iteration for reach prob / ima_289 greedy path planning). Given world-graph start+goal, returns reachable-state count, arrival probability goalProb, optimal arrival path. Complements reason(A* optimal): reason optimizes cost, goal_directed optimizes arrival reliability.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: '起点节点，默认 CHARGE' },
        goal: { type: 'string', description: '目标节点' },
        hard: { type: 'array', items: { type: 'string' }, description: '硬约束禁入节点集（可达性分析时剔除，可选）' },
        gamma: { type: 'number', description: '折扣因子 γ（到达概率衰减，默认 0.99）' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'pac_bound', description: 'PAC 学习定理：样本复杂度下界 m≥(d_VC·ln(1/ε)+ln(1/δ))/ε²。  / EN: PAC learning bound: sample-complexity lower bound m ≥ (d_VC·ln(1/ε)+ln(1/δ))/ε².',
    inputSchema: {
      type: 'object',
      properties: {
        dVC: { type: 'number', description: '概念类 VC 维，默认 10' },
        epsilon: { type: 'number', description: '泛化误差上界，默认 0.1' },
        delta: { type: 'number', description: '失败概率上界，默认 0.1' },
      },
      required: [],
    },
  },
  {
    name: 'ask', description: '用大白话让大脑理解并规划：免费 LLM 把自然语言理解为结构化目标 → 灵脑确定性可审计推理 → 免费 LLM 把结果+IMA 资料用中文解释。返回 percept/reason/explanation。  / EN: Let the brain understand and plan in plain language: a free LLM parses natural language into a structured goal → LingNao’s deterministic auditable reasoning → a free LLM explains the result + IMA material in Chinese. Returns percept / reason / explanation.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '用户自然语言目标，如「从充电座出发去 C 点，电量充足」' },
        apiKey: { type: 'string', description: 'OpenRouter API Key（默认免费档 minimax/minimax-m3:free）；也可由 env OPENROUTER_API_KEY 提供' },
        hard: { type: 'array', items: { type: 'string' }, description: '硬约束节点（可选）' },
        soft: { type: 'array', items: { type: 'string' }, description: '软约束节点（可选，代价加成）' },
      },
      required: ['text'],
    },
  },
  {
    name: 'explain', description: '解释层：把一份 reason() 结果 + 命中的 IMA 数学资料，用免费 LLM 讲成非技术用户能读懂的中文。  / EN: Explanation layer: turn a reason() result + the hit IMA math material into plain Chinese a non-technical user can read, via a free LLM.',
    inputSchema: {
      type: 'object',
      properties: {
        result: { type: 'object', description: 'reason() 返回结果（含 goal/status/path/steps/uncertainty/imaRef）' },
        apiKey: { type: 'string', description: 'OpenRouter API Key；或由 env OPENROUTER_API_KEY 提供' },
      },
      required: ['result'],
    },
  },
  {
    name: 'causal', description: '因果发现（PC-lite）+ do演算查询（后门准则）。  / EN: Causal discovery (PC-lite) + do-calculus query (back-door criterion).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'event_publish', description: 'EDA 事件总线：发布事件（感知/推理/学习/审计/元认知）。  / EN: EDA event bus: publish an event (perceive / reason / learn / audit / metacognition).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: '事件类型，如 reason/learning/audit' },
        payload: { type: 'object', description: '事件载荷' },
      },
      required: ['type'],
    },
  },
  {
    name: 'knowledge_fabric', description: 'Data Fabric 知识库版本化（git 风格 commit/list/diff）。  / EN: Data-Fabric knowledge base versioning (git-style commit / list / diff).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'commit/list/diff，默认 list' },
        msg: { type: 'string', description: 'commit 消息' },
        versions: { type: 'array', items: { type: 'number' }, description: 'diff 的两个版本号' },
      },
      required: [],
    },
  },
  {
    name: 'runtime_monitor', description: 'PrSTL 运行时监控：检查决策是否偏离安全约束，违例触发安全停车。  / EN: PrSTL runtime monitor: check whether a decision deviates from safety constraints; violation triggers a safe stop.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: '起点节点，默认 CHARGE' },
        goal: { type: 'string', description: '目标节点' },
        safety: { type: 'object', description: '{maxCost, hardNodes:[...]}' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'continuous_verify', description: '持续验证管道（仓库级单元+集成断言）。  / EN: Continuous-verification pipeline (repo-level unit + integration assertions).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'ima_load', description: '加载用户 IMA 数学库知识壳（默认同目录 ima_knowledge.json，431 条公理/定理/定义/方法/思想方法）注入灵脑内核：KB 可检索、审计报告可引用证据、元认知层可路由。可传 {path} 指定文件，或直传 {entries:[...]}。  / EN: Load the user’s IMA math-library knowledge shell (default same-dir ima_knowledge.json, 431 axioms/theorems/definitions/methods/thought-methods) into the LingNao kernel: KB becomes retrievable, the audit report can cite evidence, the metacognition layer can route. Pass {path} for a file or {entries:[...]} directly.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'ima_knowledge.json 路径（可选，缺省同目录）' },
        entries: { type: 'array', description: '或直接传入条目数组（可选）' },
      },
      required: [],
    },
  },
  {
    name: 'ima_query', description: '检索 IMA 数学库：按关键词命中标题/模块/类型/编号，返回相关公理/定理（确定性）。需先 ima_load。  / EN: Retrieve from the IMA math library: match keywords against title / module / type / id, return related axioms/theorems (deterministic). Requires ima_load first.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '关键词，如 "反事实"、"ZFC"、"皮亚诺"、"350"' },
        k: { type: 'number', description: '返回条数，默认 10' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'sl_record', description: '① 积累层：追加一条原始执行记录（状态/行动/结果/成功/奖励/环境/使用的知识ID），append-only 不可修改。是自我学习闭环的数据源头。  / EN: ① Accumulation layer: append one raw execution record (state / action / result / success / reward / environment / knowledge-ID used); append-only, immutable. The data source of the self-learning loop.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: '执行时世界状态' },
        action: { type: 'string', description: '选择的行动' },
        result: { type: 'string', description: '执行后状态' },
        success: { type: 'boolean', description: '是否达到目标' },
        reward: { type: 'number', description: '效果评分（可选）' },
        env: { type: 'object', description: '环境条件（温度/负载/干扰，可选）' },
        usedKnowledge: { type: 'array', items: { type: 'string' }, description: '本次依赖的确认知识ID（K...），用于监控降级' },
      },
      required: ['state', 'result', 'success'],
    },
  },
  {
    name: 'sl_discover', description: '② 发现层：对经验库跑六类统计（关联FP-Growth+因果PC+聚类lite+异常lite+时序lite）并生成待验证假设（带统计证据与 IMA 引用）。  / EN: ② Discovery layer: run six statistical families on the experience base (association FP-Growth + causal PC + cluster-lite + anomaly-lite + time-series-lite) and generate hypotheses to verify (with statistical evidence and IMA citations).',
    inputSchema: {
      type: 'object',
      properties: {
        window: { type: 'number', description: '分析最近 N 条经验，默认全部' },
        minSupport: { type: 'number', description: '关联规则最小支持度，默认 0.4' },
        minConf: { type: 'number', description: '生成假设的最小置信度，默认 0.5' },
        k: { type: 'number', description: '聚类簇数，默认 3' },
      },
    },
  },
  {
    name: 'sl_validate', description: '③ 验证层：对假设做贝叶斯可靠度更新（成功=1/失败=0/部分=0.5），按生命周期升级为确认知识或废弃。  / EN: ③ Validation layer: Bayesian reliability update on a hypothesis (success=1 / failure=0 / partial=0.5), promote by lifecycle to confirmed knowledge or discard.',
    inputSchema: {
      type: 'object',
      properties: {
        hid: { type: 'string', description: '假设ID（H...，来自 sl_discover）' },
        outcome: { description: '验证结果：true/false/"success"/"fail"/0~1', oneOf: [{ type: 'boolean' }, { type: 'string' }, { type: 'number' }] },
      },
      required: ['hid', 'outcome'],
    },
  },
  {
    name: 'sl_monitor', description: '④ 监控修正层：人工标记某确认知识(K...)可疑，立即降级为假设（可靠度减半、退回验证流）。自动降级由 sl_record 触发（连续3败/失败率≥40%）。  / EN: ④ Monitoring-correction layer: manually flag a confirmed knowledge (K...) as suspect → immediately demote to hypothesis (reliability halved, back to validation flow). Auto-demotion triggered by sl_record (3 consecutive failures / failure rate ≥40%).',
    inputSchema: {
      type: 'object',
      properties: {
        kid: { type: 'string', description: '确认知识ID（K...）' },
        reason: { type: 'string', description: '可疑原因' },
      },
      required: ['kid'],
    },
  },
  {
    name: 'sl_status', description: '三级知识状态机总览：经验数/假设数/确认数/废弃数 + 每条可靠度 + IMA 证据映射。  / EN: Three-tier knowledge state-machine overview: experience count / hypothesis count / confirmed count / discarded count + per-item reliability + IMA evidence mapping.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  // ---------- 具身层（Embodied AI）：把"物理世界干活的通用大脑"暴露给机器人 ----------
  {
    name: 'attach_body', description: '注册一台物理身体（机器人/无人机/机械臂…）。大脑不含任何具体身体代码——能力契约由调用方以结构化声明传入：每能力含 id、pre.require(进入前状态条件)、effect.set/inc(执行后状态修改，支持 {{params.X}} 模板)、cost、ground({{goal.reach}} 接地目标)。hard=不可逆硬约束禁区。返回已注册能力集与初始状态。  / EN: Register a physical body (robot / drone / arm …). The brain contains no concrete body code — capability contracts are passed structurally by the caller: each capability has id, pre.require (state condition before entry), effect.set/inc (state change after execution, supports {{params.X}} templating), cost, ground({{goal.reach}} grounding goal). hard = irreversible hard-constraint forbidden zone. Returns the registered capability set and initial state.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '身体名称，如 "warehouse-arm-01"' },
        initialState: { type: 'object', description: '初始状态，如 {node:"CHARGE", battery:100}' },
        hard: { type: 'array', items: { type: 'string' }, description: '不可逆硬约束禁区/禁动作（SAFE-STOP 触发清单）' },
        capabilities: {
          type: 'array',
          description: '能力契约数组。每元素：{id, desc?, pre?:{require:{字段:值|{min,max,gte,lte,eq}}}, effect:{set:{字段:值}, inc?:{字段:数值}}, cost?:number, ground?:{参数名:"{{goal.reach}}"}}',
          items: { type: 'object' },
        },
      },
      required: ['name', 'capabilities'],
    },
  },
  {
    name: 'capabilities', description: '列出当前已注册身体的能力 id 列表（大脑"会做什么动作"）。  / EN: List the currently registered body’s capability ids (what ’actions’ the brain can perform).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_state', description: '返回当前身体状态（大脑维护的信念状态，机器人上报后更新）。  / EN: Return the current body state (the belief state maintained by the brain, updated after the robot reports).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'set_state', description: '同步/覆盖身体状态（机器人上报传感器真值后调用）。  / EN: Sync / overwrite body state (call after the robot reports true sensor values).',
    inputSchema: { type: 'object', properties: { state: { type: 'object', description: '新状态对象' } }, required: ['state'] },
  },
  {
    name: 'state_diff', description: '比较两个状态，返回偏差字段 {predicted, observed}。用于执行后偏差检测。  / EN: Compare two states and return the deviation fields {predicted, observed}. Used for post-execution deviation detection.',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'object', description: '预期状态' },
        b: { type: 'object', description: '观测状态' },
      },
      required: ['a', 'b'],
    },
  },
  {
    name: 'check_hard', description: '在执行不可逆动作前校验 SAFE-STOP：状态/步骤是否命中硬约束禁区。命中返回 {ok:false, violation}。  / EN: Before executing an irreversible action, verify SAFE-STOP: whether the state / step hits a hard-constraint forbidden zone. Hit returns {ok:false, violation}.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'object', description: '当前状态' },
        step: { type: 'object', description: '待执行步骤 {cap, params:{to|target|region}}' },
      },
      required: ['step'],
    },
  },
  {
    name: 'h_max', description: 'delete-relaxation 可采纳启发式 h_max：从某状态到目标的最小"层数"下界（A* 最优性保证）。调试/可解释用。  / EN: delete-relaxation admissible heuristic h_max: the lower bound on the minimum ’number of layers’ from a state to the goal (A* optimality guarantee). For debugging / interpretability.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'object', description: '起始状态，缺省当前状态' },
        goalSpec: { type: 'object', description: '{reach:node} 或 {match:{...}} 或 {all:[...]}' },
        maxLayer: { type: 'number', description: '最大展开层数，默认 32' },
      },
      required: ['goalSpec'],
    },
  },
  {
    name: 'plan_task', description: '可审计任务规划：A* + h_max(delete-relaxation 可采纳) 产出相对给定能力集与状态的最优【动作序列】(非路径)。返回 plan=[{cap, params, expect}]、cost、expanded、guarantee。  / EN: Auditable task planning: A* + h_max (delete-relaxation admissible) produces the optimal [action sequence] (not path) for the given capability set and state. Returns plan=[{cap, params, expect}], cost, expanded, guarantee.',
    inputSchema: {
      type: 'object',
      properties: {
        goalSpec: { type: 'object', description: '{reach:node} 或 {match:{...}} 或 {all:[...]}' },
        maxLayer: { type: 'number', description: 'h_max 最大展开层，默认 32' },
        maxExpansions: { type: 'number', description: 'A* 最大扩展节点数，默认 2000' },
      },
      required: ['goalSpec'],
    },
  },
  {
    name: 'execute_task', description: '执行闭环（大脑内模拟）：用 plan_task 规划→逐步执行(每步 checkHard SAFE-STOP)→观测偏差→确定性重规划(maxReplans 护栏)。faults 可注入 {failAt:[序号], deviateAt:[{step,patch}]} 演示重规划/SAFE-STOP。真物理执行由机器人侧用 plan 自行驱动。返回 trace/deviations/replans/haltReason/goalSatisfied。  / EN: Execution loop (simulated inside the brain): plan via plan_task → execute step by step (checkHard SAFE-STOP each step) → observe deviation → deterministic replanning (maxReplans guardrail). Inject faults {failAt:[idx], deviateAt:[{step,patch}]} to demo replanning / SAFE-STOP. Real physical execution is driven by the robot side using the plan. Returns trace / deviations / replans / haltReason / goalSatisfied.',
    inputSchema: {
      type: 'object',
      properties: {
        goalSpec: { type: 'object', description: '{reach:node} 或 {match:{...}} 或 {all:[...]}' },
        maxReplans: { type: 'number', description: '最大重规划次数，默认 3（防死循环护栏）' },
        deviationTolerance: { type: 'number', description: '允许偏差字段数，默认 1' },
        faults: { type: 'object', description: '演示用注入：{failAt:[...], deviateAt:[{step,patch}]}' },
        allowIrreversible: { type: 'boolean', description: '显式授权执行不可逆动作（如封箱/点火/剪切）。缺省 false ⇒ 遇不可逆能力即 IRREVERSIBLE-HALT 停机。大脑绝不依赖事后重规划补救不可逆后果。  / EN: Explicitly authorize irreversible actions (seal / ignite / cut). Default false ⇒ IRREVERSIBLE-HALT on any irreversible capability. The brain never relies on事后 replanning to undo irreversible effects.' },
      },
      required: ['goalSpec'],
    },
  },
  {
    name: 'positioning', description: '返回灵脑产品定位 POSITIONING（具身智能在物理世界干活的通用大脑）+ 当前注册身体 BODY。让外部智能体确认大脑的自我定位与边界。  / EN: Return LingNao’s product positioning POSITIONING (a general brain for embodied AI working in the physical world) + the currently registered body BODY. Lets external agents confirm the brain’s self-positioning and boundaries.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  // ── Layer 2 确定性安全陷阱层 + CLF-CBF 统一 QP（2026-09-02 经 MCP 暴露）──
  {
    name: 'bertrand_trap', description: '确定性安全陷阱①伯特兰：给定安全预算 N(整数>1)，定理(Bertrand 1852)保证 ∃素数 p∈(N,2N) ⇒ 安全冗余量可证明存在(>N/2 且不超 2N)。返回 witness 素数(若 N≤1e6 实算)或定理保证区间。  / EN: Deterministic safety trap ① Bertrand: given safety budget N, theorem guarantees a prime reserve p∈(N,2N).',
    inputSchema: {
      type: 'object',
      properties: { N: { type: 'number', description: '安全预算 N（整数>1）；N≤1e6 实算见证素数，否则仅定理保证存在区间' } },
      required: ['N'],
    },
  },
  {
    name: 'compactness_trap', description: '确定性安全陷阱③紧致性：多约束族若含相互矛盾的约束对(区间不交) ⇒ 全局不可满足(不安全)。输入每项约束的 feasible 区间 interval:[lo,hi]；两两不交即检出矛盾。  / EN: Deterministic safety trap ③ Compactness: detects contradictory constraint pairs (disjoint intervals) ⇒ globally unsatisfiable.',
    inputSchema: {
      type: 'object',
      properties: {
        constraints: { type: 'array', items: { type: 'object', properties: { interval: { type: 'array', items: { type: 'number' }, description: '[lo,hi] 该变量可行区间' }, feasible: { type: 'boolean' }, id: { type: 'string' } }, description: '单条约束：{interval:[lo,hi]} 或 {feasible:bool}' }, description: '约束族（≥2 项）' },
      },
      required: ['constraints'],
    },
  },
  {
    name: 'van_der_waerden_trap', description: '确定性安全陷阱④范德瓦尔登：协作分配序列中检出单色等差数列(长≥k) ⇒ 设备周期独占/结构退化风险。  / EN: Deterministic safety trap ④ Van der Waerden: detects monochromatic arithmetic progressions (length≥k) in an assignment sequence.',
    inputSchema: {
      type: 'object',
      properties: {
        seq: { type: 'array', items: {}, description: '着色序列（设备/智能体标识），如 [5,9,5,9,5]' },
        k: { type: 'number', description: 'AP 长度阈值，默认 3' },
      },
      required: ['seq'],
    },
  },
  {
    name: 'baire_trap', description: '确定性安全陷阱⑤贝尔纲：观测若反复落入 meager 例外集(‖x−c‖≥normalRadius) 占比超阈值 ⇒ 结构性异常(非统计波动)。  / EN: Deterministic safety trap ⑤ Baire: detects structural anomalies when observations repeatedly fall in the meager exceptional set beyond a threshold.',
    inputSchema: {
      type: 'object',
      properties: {
        observations: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: '观测序列（每个为状态向量数组），如 [[0,0],[5,5]]' },
        normalRadius: { type: 'number', description: '正常开球半径(稠密开集定义)，默认 1' },
        threshold: { type: 'number', description: 'meager 命中占比阈值，默认 0.2' },
      },
      required: ['observations'],
    },
  },
  {
    name: 'variety_trap', description: '确定性安全陷阱⑥代数簇：安全态集若不连通(存在被隔开的不可达安全孤岛) ⇒ 计划无法覆盖全部安全区。在采样点邻接图上检测连通分量。  / EN: Deterministic safety trap ⑥ Variety: detects disconnected safe-state set (isolated unreachable safe islands).',
    inputSchema: {
      type: 'object',
      properties: {
        samples: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: '安全态样本（每点为状态向量数组），≥2' },
        eps: { type: 'number', description: 'ε-邻域连通半径，默认 1e-6' },
        adjacency: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: '可选显式邻接表（每点邻居下标数组）' },
      },
      required: ['samples'],
    },
  },
  {
    name: 'cauchy_lipschitz_trap', description: '确定性安全陷阱②柯西-利普希茨：给定 Lipschitz 常数 L(解析/估计)与初值 x0，Cauchy–Lipschitz 保证初值问题解唯一(演化不分叉、可复现)。返回分离上界 d0·e^{L·T}。  / EN: Deterministic safety trap ② Cauchy–Lipschitz: given Lipschitz constant L and x0, guarantees unique solution (no bifurcation). Returns separation bound.',
    inputSchema: {
      type: 'object',
      properties: {
        x0: { type: 'array', items: { type: 'number' }, description: '初值向量' },
        L: { type: 'number', description: 'Lipschitz 常数 L（显式上界；线性系统可给 ‖A‖_∞）' },
        horizon: { type: 'number', description: '时间视野 T，默认 1' },
      },
      required: ['x0', 'L'],
    },
  },
  {
    name: 'run_deterministic_traps', description: 'Layer 2 聚合器：在给定上下文上跑全部六陷阱（数据驱动部分）。任一 unsafe ⇒ 整体 unsafe；有 𝕌 ⇒ undecided。供审计层标注"定理驱动"。  / EN: Layer 2 aggregator: runs all six traps on the given context (data-driven parts). Any unsafe ⇒ overall unsafe.',
    inputSchema: {
      type: 'object',
      properties: {
        budget: { type: 'number', description: '①伯特兰安全预算 N' },
        constraints: { type: 'array', items: { type: 'object' }, description: '③紧致性约束族' },
        assignment: { type: 'object', description: '④范德瓦尔登序列 {seq:[...], k?:3}' },
        observations: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: '⑤贝尔纲观测序列' },
        variety: { type: 'object', description: '⑥代数簇 {samples:[[...]]}' },
      },
      required: [],
    },
  },
  {
    name: 'clf_cbf_unified', description: 'CLF-CBF 统一 QP（Layer 1 补全）：在线性系统 ẋ=Ax+Bu 上同时求安全(CBF h_i≥0)与前向收敛(CLF V=xᵀPx→目标)的控制。min‖u−u_nom‖² s.t. 两类线性约束 ⇒ Hildreth 对偶解。可行⇒安全∧收敛同时成立；冲突⇒诚实返回 infeasible(绝不谎称安全)。输入矩阵即可(经 linearControlSpec 转 dual-aware)。  / EN: CLF-CBF unified QP: jointly safe (CBF) and convergent (CLF) control for ẋ=Ax+Bu. Feasible ⇒ safe∧convergent; conflict ⇒ honestly infeasible.',
    inputSchema: {
      type: 'object',
      properties: {
        A: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: '线性动力学矩阵 A（状态×状态；标量系统给 [[a]]）' },
        B: { type: 'array', items: { type: 'number' }, description: '输入矩阵 B（状态×输入；单输入给 [b]）' },
        P: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: '可选 CLF 二次型 P（V=xᵀPx）；省略则仅安全' },
        cList: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: '各 CBF 法向 cᵢ（hᵢ=cᵢ·x+dᵢ≥0）' },
        dList: { type: 'array', items: { type: 'number' }, description: '各 CBF 偏移 dᵢ' },
        uNom: { type: 'array', items: { type: 'number' }, description: '标称控制 u_nom（多输入数组；单输入可给标量）' },
        x: { type: 'array', items: { type: 'number' }, description: '当前状态 x' },
        gammaS: { type: 'number', description: '安全率 α_s，默认 1' },
        gammaC: { type: 'number', description: '收敛率 α_c，默认 1' },
      },
      required: ['A', 'B', 'x'],
    },
  },
  {
    name: 'model_free_cbf', description: '无模型 CBF（THM_MODEL_FREE_CBF，Layer 1 补全）：老设备无精确动力学模型、只有运行轨迹时，用 RBF 核方法从 safe/unsafe 轨迹学一个分离安全屏障 h(x)（h>0 判安全，gradH 解析可得）。确定性的、非 NN。Tier 1（经验分离器，非 THM_CBF_INVARIANCE 的 Tier 0 全局保证）；样本不足/不可分诚实返回 𝕌。  / EN: Model-free CBF: learn a safety barrier from trajectory data via RBF kernel (no dynamics model needed). Tier 1; honestly 𝕌 when data insufficient.',
    inputSchema: {
      type: 'object',
      properties: {
        safeSamples: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: '已观测安全状态轨迹（每个是状态向量）' },
        unsafeSamples: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: '已观测不安全/失效状态轨迹' },
        gamma: { type: 'number', description: 'RBF 带宽 γ，默认 1' },
        lambda: { type: 'number', description: 'ridge 正则 λ，默认 1e-3（保证核矩阵非奇异）' },
      },
      required: ['safeSamples', 'unsafeSamples'],
    },
  },
  {
    name: 'counterfactual_audit', description: '反事实硬干预审计（THM_COUNTERFACTUAL_AUDIT，Layer 3 反事实安全层）：对计划的每步施加 remove/negate-premise/flip-effect 三道硬干预（Project Ariadne 思想），度量因果敏感性。存在关键步 ⇒ 反事实脆弱（unsafe/非鲁棒）；任一步缺 premise/effect ⇒ 诚实 𝕌。纯符号、确定性、非 NN。  / EN: Counterfactual hard-intervention audit of a plan trace (Ariadne-style). Critical step ⇒ fragile; missing info ⇒ 𝕌.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: {
          type: 'object',
          description: '计划对象：{ goal, steps:[{ id, action, premise:[事实], effect:[事实], safe? }] }',
          properties: {
            goal: { type: 'string' },
            steps: { type: 'array', items: { type: 'object' } },
          },
          required: ['steps'],
        },
      },
      required: ['plan'],
    },
  },
  {
    name: 'safety_audit', description: '安全层判定（B 切片：safetyLayersReport，防御纵深可审计）：把控制层两层（确定性陷阱 runDeterministicTraps + CLF-CBF 统一 QP clfCbfUnified）统一报告为纵深防线；任一 unsafe ⇒ overall unsafe（fail-closed）。矩阵 (A,B,P,cList,dList) 经 linearControlSpec 构造 CLF-CBF 系统。  / EN: Defense-in-depth safety-layer verdict: deterministic traps + CLF-CBF unified QP. Any layer unsafe ⇒ overall unsafe.',
    inputSchema: {
      type: 'object',
      properties: {
        A: { type: 'array', description: '线性动力学矩阵 A（ẋ=A x+B u）；标量或矩阵', items: {} },
        B: { type: 'array', description: '控制矩阵 B', items: {} },
        P: { type: 'array', description: '（可选）CLF 二次型 V=xᵀP x', items: {} },
        cList: { type: 'array', description: '（可选）各 CBF 法向 cᵢ（hᵢ=cᵢ·x+dᵢ≥0）', items: { type: 'array' } },
        dList: { type: 'array', description: '（可选）各 CBF 偏移 dᵢ', items: {} },
        x: { type: 'array', description: '当前状态 x', items: {} },
        uNom: { anyOf: [{ type: 'number' }, { type: 'array' }], description: '（可选）标称控制' },
        traps: { type: 'object', description: '（可选）确定性陷阱上下文 { budget, dynamics, constraints, assignment, observations, variety }', properties: {} },
      },
      required: ['A', 'B', 'x'],
    },
  },
  // ── 形式化证明模块 M1..M4（2026-09-03 暴露）──────────────────────────
  {
    name: 'prove_gate_chain',
    description: 'M1 能力/意图门控证明（正确性 soundness）：对计划做【零副作用】静态预检——不调 bodyAdapter、不改状态。把 execute() 里隐含在控制流中的守卫提升为显式门控规格表(8 条谓词)，并证明性地在释放任何指令前拦截。verdict: provably-blocked:zero-release(定理M1.2) / provably-blocked:after-j(定理M1.1) / conditional(静态全过但 G5..G8 依赖运行时状态，定理M1.3 明说不给 provably-admitted)。诚实边界：证的是门控链的静态可判定部分，不是执行结果正确，更不是"不可越狱"。  / EN: M1 capability/intent gate-chain proof — zero-side-effect static pre-check of a plan against 8 guard predicates. Proves zero-release halting before any instruction is issued. Honest bound: proves the statically decidable part of the gate chain, not execution correctness.',
    inputSchema: {
      type: 'object',
      properties: {
        plan: { type: 'array', description: '计划：[{cap, params?, intentId?, mayHallucinate?}]', items: { type: 'object' } },
        opts: {
          type: 'object',
          description: '（可选）{ autonomyLevel, allowIrreversible, humanApproved, requireIntent, intent:{id} }',
          properties: {},
        },
      },
      required: ['plan'],
    },
  },
  {
    name: 'certify_safety_invariant',
    description: 'M2 数值安全证书：把不等式安全验证翻译成方程无解判定，委派灵数求解器给出【真数学证明】。要证 ∀x∈域 h(x)≥0，等价于证违反系统 {h(x)+s²=0, s·w=1} 在域内无实数解；灵数能证明无实根，这是单点浮点判定永远做不到的。verdict: verified(certified-krawczyk 真证明) / violated(候选反例，需回代校验) / unverified(证不了——按 fail-closed 处理，不等于安全)。硬约束：只吃方程字符串(JS 函数形态 h 诚实降级 unverified，绝不退回浮点假装认证)、盒式区间域、状态维数≤4。  / EN: M2 numeric safety certificate — reduces ∀x∈D h(x)≥0 to proving the violation system has no real solution, delegated to lingshu-solver (Krawczyk). unverified ≠ safe (fail-closed).',
    inputSchema: {
      type: 'object',
      properties: {
        hExpr: { type: 'string', description: '安全不变式表达式字符串，例 "1 - (x^2 + y^2)"' },
        vars: { type: 'array', description: '状态变量名，例 ["x","y"]', items: { type: 'string' } },
        domain: { type: 'object', description: '（可选）盒式域，例 {"x":[-0.5,0.5],"y":[-0.5,0.5]}', properties: {} },
        bound: { type: 'number', description: '（可选）辅助变量域界，默认 1e6；bound=1000 ⇒ 可检出深度 ≥1e-6 的违反' },
        options: { type: 'object', description: '（可选）透传灵数 options', properties: {} },
      },
      required: ['hExpr', 'vars'],
    },
  },
  {
    name: 'verdict_three_layer',
    description: 'M3 三层次裁决引擎：修掉"把计算超时误当逻辑不可判定"的混淆。逻辑层不可判定 ⇒ refuse(算力无法弥补)；计算层未完成 ⇒ degrade-conservative(申请预算或走保守策略)；工程层不支持 ⇒ record-capability-limit(是"证不了"，不是"不安全")；三层均过 ⇒ proceed。诚实关键：unverified ≠ unsafe，证不了就停(fail-closed)，但绝不把"证不了"说成"已证安全"。  / EN: M3 three-layer verdict engine separating logical undecidability / computational incompleteness / engineering unsupport. unverified ≠ unsafe.',
    inputSchema: {
      type: 'object',
      properties: {
        logicDecidable: { type: 'boolean', description: '逻辑层：命题是否可判定' },
        computeCompleted: { type: 'boolean', description: '计算层：计算是否在预算内完成' },
        engineeringSupported: { type: 'boolean', description: '工程层：当前实现是否支持该检查' },
        detail: { type: 'object', description: '（可选）附加上下文', properties: {} },
      },
      required: [],
    },
  },
  {
    name: 'prove_complete_mediation',
    description: 'M4 完全中介证明（完备性 completeness，M1 的补集）：M1 证"门控逻辑对不对"，M4 证"是否所有副作用出口都过闸"——只有 M1 时，一条没接闸的 fetch 就能让全部门控形同虚设。依据参考监视器三要求(Anderson 1972)与完全中介原则(Saltzer & Schroeder 1975)，用对象能力模型剥夺环境权限(ambient authority)：副作用原语的词法名在内核作用域内被重绑为拒绝物或中介能力对象，故"没过闸"在 JS 语义下结构上不可能。返回定理 M4.1 的 9 项机器检验(C1..C9)、闸外未中介出口清单、重绑分类、策略快照、前提(H1..H6，不可机器判定者如实标 machineChecked:false)与 notProved 清单。诚实边界：这是【语法层】完全中介，不是语义层信息流不干扰(noninterference)——后者需 Isabelle/Coq 级工具，本内核没有，不谎称有；也未证无隐蔽/时间侧信道。  / EN: M4 complete-mediation proof (completeness; complement of M1). Machine-checks 9 conditions (C1..C9) for theorem M4.1 — syntactic complete mediation via ambient-authority removal (object-capability model). NOT semantic noninterference; no covert/timing-channel claims.',
    inputSchema: {
      type: 'object',
      properties: {
        src: { type: 'string', description: '（可选）待判定的内核源码文本。缺省用服务端内置真源码；拿不到源码时诚实返回 unverified（fail-closed，不假设通过）' },
      },
      required: [],
    },
  },
  {
    name: 'effect_gate_report',
    description: 'M4 效应闸运行时报告：返回策略快照(policy) + 效应计数(stats) + 最近效应轨迹(trace，每条含 kind/target/purpose 意图/caller 调用者/riskTier/是否入签名账本) + 运行时自证(attest：真的去碰被遮蔽的原语名，验证环境权限确已剥夺，不发任何网络)。机制与策略分离(seL4 同款)：闸只保证"必经中介+必入轨迹"，放行与否是策略。硬轨：PROCESS(进程派生)/EVAL(动态求值)不可经配置放开，否则"配置即提权"。  / EN: M4 effect-gate runtime report: policy snapshot + effect counters + recent mediated-effect trace (with intent/caller/riskTier/ledger status) + runtime self-attestation that ambient authority is actually removed. PROCESS/EVAL are non-configurable hard denials.',
    inputSchema: {
      type: 'object',
      properties: {
        n: { type: 'number', description: '（可选）返回最近 n 条效应轨迹，默认 20' },
      },
      required: [],
    },
  },
  {
    name: 'audit_evidence',
    description: '【灵脑面向智能体的旗舰能力】合规证据批审（AI Agent 审计场景，先智能体落地的首个交付场景）：对一批被审声明逐条委派确定性内核验证，无法确定性验证的一律 𝕌 诚实弃权、绝不假装核过。kind=constraint→紧致性陷阱检约束族全局矛盾（THM_COMPACTNESS）；kind=numeric_safety→M2 全域安全不变式证书；kind=path→A* 重算比对声明路径与代价；其他 kind→unverified(𝕌)。输出审计师可直接使用的证据报告：确定性 reportId（sha256，同输入同内核版本可离线重算）、逐条 verdict（verified/refuted/unverified）+证明引用、汇总、AIUC-1 D 域(Reliability)控制项参考映射（仅为映射，非认证声明）。**灵脑=推理-only：方程求解/验真（algebraic/membership/entail）归灵数 lingshu-solver 独立产品，本工具只做推理原语核验。**  / EN: LingNao flagship capability for agents (reasoning-only). Compliance evidence batch audit: each item delegated to a deterministic kernel verifier (constraint → compactness trap THM_COMPACTNESS; numeric_safety → M2 global safety-invariant certificate; path → A* re-derivation vs claimed path/cost); anything else honestly abstains (𝕌). Equation solving/verification is 灵数 lingshu-solver\'s job, not LingNao\'s.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '待核声明列表（≤200 条）。每项 {id?, kind, text?, …载荷}。载荷按 kind：constraint→{constraints:[{id?, interval:[lo,hi]}]}（≥2 项才有紧致性意义）；numeric_safety→{hExpr, vars:string[], domain?:{变量:[lo,hi]}, bound?}；path→{start, goal, claimedPath?:string[], claimedCost?:number, hard?, soft?}。text 为人类可读的声明原文，仅入档展示、不参与判定。',
        },
        caseLabel: { type: 'string', description: '（可选）案卷标注（被审 Agent 名称/批次号）。仅展示用，不参与 reportId 计算' },
      },
      required: ['items'],
    },
  },
  {
    name: 'certify_decision',
    description: '【灵脑裁判层旗舰能力 · 推理-only】对智能体提出的**一个具体决策**做可信裁判：接收结构化决策记录 {action, context, claimedProperties:[{property, class, payload}]}，把每个声明 class 委派给确定性内核验证器（constraint→紧致性陷阱 THM_COMPACTNESS；numeric_safety→M2 全域安全不变式证书；path→A* 重算比对；authorized→M4 EffectGate 授权闸），输出 DecisionCertificate：decisionVerdict(trusted / untrusted / abstain) + 逐属性 proofObject(定理 id + 证明步骤) + 防篡改 reportId(sha256)。灵脑**只裁判、不提议**——运动员(智能体)生成动作，裁判(灵脑)判定动作是否安全/正确/授权，职责分离（运动员不能同时是裁判）。**灵脑=推理-only：方程求解/验真（algebraic）归灵数 lingshu-solver 独立产品，本工具不计算。** 任何不可确定性验证的声明一律 𝕌 诚实弃权，绝不输出"大概没错"。**护栏：灵脑只证动作的安全/正确/授权/因果/风险等可验证数学属性，不评价决策的商业智慧或任何非数学判断——大模型日常决策（写邮件、选供应商等）本就不是数学，灵脑不对此负责。**  / EN: LingNao referee-layer flagship (reasoning-only). Certify one concrete agent decision. Delegates each claim class to a deterministic kernel verifier; equation solving/verification is 灵数 lingshu-solver\'s job, not LingNao\'s.',
    inputSchema: {
      type: 'object',
      properties: {
        decisionId: { type: 'string', description: '（可选）调用方决策 id；缺省由 sha256(决策) 派生' },
        action: { type: 'string', description: '智能体决定执行的动作（自由文本，仅入档；裁判不生成动作）' },
        context: { type: 'object', description: '（可选）决策前状态 / 世界快照，仅入档' },
        claimedProperties: {
          type: 'array',
          description: '智能体对本次决策声明的属性列表（≤200）。每项 {property, class, payload}。class∈{constraint, numeric_safety, path, authorized}；payload 同 audit_evidence 对应 kind 的载荷（constraint→{constraints:[{id?,interval:[lo,hi]}]}；numeric_safety→{hExpr,vars,domain?,bound?}；path→{start,goal,claimedPath?,claimedCost?,hard?,soft?}；authorized→{effectKind}）。',
        },
      },
      required: ['claimedProperties'],
    },
  },
];

// ── 单一入口网关（2026-09-24 用户拍板：对外只暴露 1 个工具，62 个能力全部收进 op 参数）──
// 内核与 62 个能力零改动；仅 MCP 暴露面收敛为「一道门」，与 M4 完全中介思想自洽。
const GATEWAY = (() => {
  const index = TOOLS.map(t => {
    const d = String(t.description || '').split(/[；。;]/)[0].replace(/\s+/g, ' ').slice(0, 56);
    return t.name + '=' + d;
  }).join('；');
  return {
    name: 'lingnao',
    description: '灵脑 LingNao 可审计推理内核 · 唯一入口。用 op 指定能力（下方能力索引的键名），args 传该能力的参数。'
      + '能力索引：' + index,
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', description: '能力名（原工具名）', enum: TOOLS.map(t => t.name) },
        args: { type: 'object', description: '该能力的参数（同原工具 inputSchema）', additionalProperties: true },
      },
      required: ['op'],
    },
  };
})();

// ---------- 2b. Layer 2 确定性安全陷阱层 + CLF-CBF 统一 QP（2026-09-02 MCP 暴露）----------
function bertrandTrapLogic(N) { return K.bertrandTrap(N); }
function compactnessTrapLogic(constraints) { return K.compactnessTrap(constraints || []); }
function vanDerWaerdenTrapLogic(seq, k) { return K.vanDerWaerdenTrap(seq || [], { k: k || 3 }); }
function baireTrapLogic(observations, normalRadius, threshold) { return K.baireTrap(observations || [], { normalRadius: normalRadius, threshold: threshold }); }
function varietyTrapLogic(samples, eps, adjacency) { return K.varietyTrap(samples || [], { eps: eps, adjacency: adjacency }); }
function cauchyLipschitzTrapLogic(x0, L, horizon) {
  // 经 opts.L 显式传入 Lipschitz 上界（诚实：解析/精确），_lipschitzOf 直接采用，不调用 f
  return K.cauchyLipschitzTrap(function (x) { return x; }, x0 || [], null, { L: L, horizon: horizon });
}
function runDeterministicTrapsLogic(args) {
  var ctx = {};
  if (args.budget != null) ctx.budget = args.budget;
  if (args.constraints) ctx.constraints = args.constraints;
  if (args.assignment) ctx.assignment = args.assignment;
  if (args.observations) ctx.observations = args.observations;
  if (args.variety) ctx.variety = args.variety; // {samples:[[...]]}
  return K.runDeterministicTraps(ctx);
}
function clfCbfUnifiedLogic(args) {
  var spec = K.linearControlSpec(args.A, args.B, args.P || null, args.cList || [], args.dList || []);
  return K.clfCbfUnified(spec.V, spec.f, spec.g, spec.hList, (args.uNom == null ? 0 : args.uNom), args.x || [], { gammaS: args.gammaS, gammaC: args.gammaC });
}
function modelFreeCbfLogic(args) {
  return K.modelFreeCbf(args.safeSamples || [], args.unsafeSamples || [], { gamma: args.gamma, lambda: args.lambda });
}
function counterfactualAuditLogic(args) {
  return K.counterfactualAudit(args.plan || {}, {});
}
// ---------- 2c. 形式化证明模块 M1..M4（2026-09-03 MCP 暴露）----------
// 统一原则：能力缺失一律 fail-closed 返回 unverified/unavailable，**绝不**默认通过。
function proveGateChainLogic(args) {
  if (typeof K.proveGateChain !== 'function') {
    return { ok: false, verdict: 'unavailable', reason: 'M1 proveGateChain 未在内核中导出', honest: '能力缺失即如实报告，不假设通过' };
  }
  const plan = Array.isArray(args && args.plan) ? args.plan : [];
  const r = K.proveGateChain(plan, (args && args.opts) || {});
  return Object.assign({ module: 'M1', kind: 'soundness（门控逻辑正确性）' }, r);
}
function certifySafetyInvariantLogic(args) {
  if (typeof K.certifySafetyInvariant !== 'function') {
    return { ok: false, verdict: 'unavailable', reason: 'M2 certifySafetyInvariant 未在内核中导出', honest: '能力缺失即如实报告，不退回浮点假装认证' };
  }
  const r = K.certifySafetyInvariant({
    hExpr: args && args.hExpr, vars: (args && args.vars) || [],
    domain: (args && args.domain) || undefined, bound: (args && args.bound) || undefined,
    options: (args && args.options) || undefined,
  });
  return Object.assign({ module: 'M2', kind: '数值安全证书（全域集合认证）' }, r);
}
function verdictThreeLayerLogic(args) {
  if (typeof K.verdictThreeLayer !== 'function') {
    return { ok: false, verdict: 'unavailable', reason: 'M3 verdictThreeLayer 未在内核中导出' };
  }
  args = args || {};
  const r = K.verdictThreeLayer({
    logicDecidable: args.logicDecidable, computeCompleted: args.computeCompleted,
    engineeringSupported: args.engineeringSupported, detail: args.detail,
  });
  return Object.assign({ module: 'M3', kind: '层次分离裁决（unverified ≠ unsafe）' }, r);
}
function proveCompleteMediationLogic(args) {
  if (typeof K.proveCompleteMediation !== 'function') {
    return { ok: false, verdict: 'unavailable', reason: 'M4 proveCompleteMediation 未在内核中导出' };
  }
  // 缺省用服务端内置真源码（kernelSrc）；调用方可传自己的源码文本做第三方复核
  const src = (args && typeof args.src === 'string' && args.src.length > 1000) ? args.src : kernelSrc;
  const r = K.proveCompleteMediation(src);
  return Object.assign({
    module: 'M4', kind: 'completeness（副作用出口完备性，M1 的补集）',
    srcBytes: src.length, srcFrom: (args && args.src) ? 'caller-provided' : 'server-builtin',
  }, r);
}
function effectGateReportLogic(args) {
  if (!K.EffectGate) {
    return { ok: false, verdict: 'unavailable', reason: 'M4 EffectGate 未在内核中导出' };
  }
  const n = (args && typeof args.n === 'number' && args.n > 0) ? Math.min(args.n, 200) : 20;
  return {
    module: 'M4', kind: '效应闸运行时报告（机制，非策略）',
    policy: K.EffectGate.policySnapshot(),
    stats: K.EffectGate.stats(),
    trace: K.EffectGate.trace(n),
    attest: K.EffectGate.attest(),
    kinds: K.EFFECT_KINDS || K.EffectGate.KINDS,
    honest: 'PROCESS/EVAL 为不可经配置放开的硬拒绝；轨迹为本会话内存链，跨重启持久化需部署层注入 store',
  };
}

function safetyAuditLogic(args) {
  var control = { traps: args.traps || null, clfCbf: null };
  if (args.A && args.B) {
    var spec = K.linearControlSpec(args.A, args.B, args.P || null, args.cList || [], args.dList || []);
    control.clfCbf = { V: spec.V, f: spec.f, g: spec.g, hList: spec.hList, uNom: (args.uNom == null ? 0 : args.uNom), x: args.x || [], opts: {} };
  }
  return K.safetyLayersReport(control);
}

// ---------- 3b. 合规证据批审 audit_evidence（灵脑面向智能体的旗舰能力；先智能体落地的首个交付场景）----------
// 原则（与灵脑三铁律一致）：
//   ① 只认确定性内核结果——验证器说话，声明文本不参与判定；
//   ② 无法确定性验证 ⇒ 一律 unverified(𝕌) 诚实弃权，绝不冒充通过（fail-closed）；
//   ③ 报告可复现——reportId = sha256(稳定序列化(items) + ALGO_VERSION + SEED)，
//      同输入同内核版本可离线重算，审计师无需重跑模型即可核对报告未被篡改。
function _stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(_stableStringify).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + _stableStringify(v[k]); }).join(',') + '}';
  }
  return JSON.stringify(v);
}
function _numEq(a, b, tol) {
  return typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) && Math.abs(a - b) <= (tol || 1e-6) * Math.max(1, Math.abs(a), Math.abs(b));
}
/** 容差归一化（1.4.0）：调用方可经 it.tol 显式声明；上限 1e-3 —— 容差大到足以糊掉判定本身时，
 *  判定就失去意义，故内核宁可让调用方显式承认「我就要这么粗」，也不默默接受任意大值。
 *  语义为**相对容差**：|a-b| ≤ tol·max(1,|a|,|b|)，与灵数认证半径同口径。 */
function _normalizeTol(it) {
  const t = it && it.tol;
  if (typeof t === 'number' && isFinite(t) && t > 0) return Math.min(t, 1e-3);
  return 1e-6;
}
function _numericBlock(it) {
  const tol = _normalizeTol(it);
  return { tol: tol, tolBasis: 'relative', declaredByCaller: (typeof (it && it.tol) === 'number' && isFinite(it.tol) && it.tol > 0), maxAllowed: 1e-3 };
}
/** 默认判定预算 κ（1.4.0）：一次 audit_evidence 允许内核消费的「判定原语求值次数」上限。
 *  预算不是装饰字段：跑不完 ⇒ 余下条目一律 𝕌，绝不允许用跑完的那部分冒充整体结论。 */
var DEFAULT_AUDIT_BUDGET = 200;

/** ── 灵数「多字符标识符 ⇒ 假空解集」闸门（1.4.0，2026-10-02 实测）─────────────────────
 *  灵数求解器当前版本对**多字符标识符**（total / subtotal / aa / ab / abc …）返回空解集，
 *  实测多字符用例 0/N 全为空集，同形单字符用例全部正常返回有限解。
 *  后果是 aso.resultTypeName==='empty' 在这里代表「标识符没被解析」，**不是**「数学上无解」。
 *  凡以 S=∅ 为前提的结论（证伪 ∉S、蕴含空真）都会变成假判定 ⇒ 统一 fail-closed 弃权 𝕌。 */
var _LS_IDENT_RE = /[A-Za-z_\u0370-\u03FF][A-Za-z0-9_\u0370-\u03FF]*[A-Za-z0-9_\u0370-\u03FF]/g;
var _LS_NONVAR = ['sin','cos','tan','ln','exp','sqrt','log','log10','log2','abs','mod','floor','ceil','gamma','pi','diff','int','lim'];
function _lsMultiCharIdentifiers(eqs) {
  const seen = {};
  (Array.isArray(eqs) ? eqs : []).forEach(function (e) {
    if (typeof e !== 'string') return;
    String(e).replace(_LS_IDENT_RE, function (m) {
      if (m.length >= 2 && _LS_NONVAR.indexOf(String(m).toLowerCase()) < 0) seen[m] = 1;
      return m;
    });
  });
  return Object.keys(seen);
}
function _engineEmptyUntrustworthy(eqs, aso) {
  if (!aso) return null;
  const isEmpty = (aso.resultTypeName === 'empty' || aso.solutionCount === 0);
  if (!isEmpty) return null;
  const ids = _lsMultiCharIdentifiers(eqs);
  if (!ids.length) return null;
  return {
    verdict: 'unverified', U: true, abstainedBy: 'engine_unsupported_identifier',
    reason: '灵数对多字符标识符返回空解集（已知引擎限制：total/aa/ab/abc 等实测 0/N 全空，同形单字符用例全过）' +
            '⇒ 本条 resultTypeName=empty（S=∅）不是数学无解，而是标识符未被解析。' +
            '以 S=∅ 为前提的结论（∉S 证伪、∀s∈∅ 空真）均不成立 ⇒ fail-closed 诚实弃权 𝕌',
    engine: aso.engine,
    evidence: { engine: aso.engine, resultTypeName: aso.resultTypeName, solutionCount: aso.solutionCount, suspectedUnparsedIdentifiers: ids },
    retryHint: { action: '改用单字符变量名（x / y / z）后重试', workaround: 'single-character variable names' }
  };
}

/** consistency（1.4.0）：多条声明能否同时成立。多声明互斥是 LLM/智能体最高频的自相矛盾错误
 *  （同一变量给了两个值、预算表加不平、报价与合同数字对不上）——此前 0 覆盖。
 *  载荷：{ statements: [{ id?, label?, values: {var: num} }]，tol? }，≥2 条。
 *  数学：对每对声明 (i,j) 与它们**共有的变量** v，若 |vᵢ-vⱼ| > tol·max(1,|vᵢ|) ⇒ 该对互斥 ⇒ refuted；
 *        所有对都不互斥 ⇒ verified，并给出 checkedPairs 供审计师机械复核。
 *        诚实边界：只覆盖数值型声明；缺失/非有限值的声明进 skipped，绝不静默吞掉。 */
function _auditOneConsistency(it) {
  const sts = Array.isArray(it.statements) ? it.statements : null;
  if (!sts || sts.length < 2) {
    return { verdict: 'unverified', U: true, abstainedBy: 'underdetermined', reason: 'consistency 载荷需 ≥2 条 statements（单条声明无从谈「与谁一致」）⇒ 𝕌', engine: null };
  }
  const tol = _normalizeTol(it);
  const skipped = [], pairs = [];
  const numOf = function (x) { return (typeof x === 'number') ? x : NaN; };
  for (let i = 0; i < sts.length; i++) {
    const s = sts[i] || {};
    const vals = (s.values && typeof s.values === 'object') ? s.values : null;
    if (!vals) { skipped.push((s.id || s.label || ('statements[' + i + ']')) + '(无 values)'); continue; }
    for (const v of Object.keys(vals)) {
      if (!isFinite(numOf(vals[v]))) { skipped.push(v + '(非有限值)'); continue; }
      pairs.push({ id: String(s.id || s.label || ('statements[' + i + ']')), var: v, value: numOf(vals[v]) });
    }
  }
  if (!pairs.length) {
    return { verdict: 'unverified', U: true, abstainedBy: 'underdetermined', reason: 'consistency：所有声明均无有限数值 ⇒ 无两两可判对象 ⇒ 𝕌（skipped: ' + skipped.join(',') + '）', engine: null, skipped: skipped };
  }
  const conflicts = [];
  for (let a = 0; a < pairs.length; a++) {
    for (let b = a + 1; b < pairs.length; b++) {
      const p = pairs[a], q = pairs[b];
      if (p.var !== q.var) continue;
      if (_numEq(p.value, q.value, tol)) continue;
      conflicts.push({ var: p.var, a: { id: p.id, value: p.value }, b: { id: q.id, value: q.value }, relativeGap: Math.abs(p.value - q.value) / Math.max(1, Math.abs(p.value)) });
    }
  }
  if (conflicts.length) {
    return { verdict: 'refuted', U: false, reason: '一致性不成立：检出 ' + conflicts.length + ' 组互斥声明（' + conflicts.map(function (c) { return c.var + '：' + c.a.id + '=' + c.a.value + ' 与 ' + c.b.id + '=' + c.b.value + ' 相对差 ' + c.relativeGap.toExponential(2) + '（容差 ' + tol + '）'; }).join('；') + '）⇒ 这些声明不可能同时成立', engine: 'lingnao-kernel pairwise-consistency', evidence: { conflicts: conflicts, checkedPairs: pairs.length, tol: tol, skipped: skipped }, numeric: _numericBlock(it), certKind: 'consistency', proof: ['逐对比对所有声明共有变量上的取值', '检出互斥对（差值超相对容差 ' + tol + '）', '该对声明不可能同时为真 ⇒ 一致性被确定性证伪'] };
  }
  return { verdict: 'verified', U: false, reason: '一致性成立：' + pairs.length + ' 条声明的共有变量取值两两不互斥（相对容差 ' + tol + '）⇒ 可同时成立', engine: 'lingnao-kernel pairwise-consistency', evidence: { checkedPairs: pairs.length, tol: tol, skipped: skipped }, numeric: _numericBlock(it), certKind: 'consistency', proof: ['逐对比对所有声明共有变量上的取值', '无任何一对超出相对容差 ' + tol, '所有声明一致可同时成立 ⇒ 一致性被确认'] };
}
function _auditOneConstraint(it) {
  const cs = Array.isArray(it.constraints) ? it.constraints : null;
  if (!cs || cs.length < 2) {
    return { verdict: 'unverified', U: true, reason: 'constraint 载荷需 ≥2 项约束（紧致性论证的前提）⇒ 𝕌', engine: null };
  }
  const r = K.compactnessTrap(cs);
  if (r.verdict === 'unsafe') {
    return { verdict: 'refuted', U: false, reason: '紧致性陷阱检出矛盾约束对 ⇒ 声明「可同时满足」被定理级证伪（' + r.theorem + '）', engine: 'lingnao-kernel ' + r.theorem, evidence: r, theorem: 'THM_COMPACTNESS', certKind: 'constraint-feasibility', proof: ['逐对区间求交，检出矛盾约束对', '有限子集已不可满足 ⇒ 由紧致性(逆否)全局更不可满足', '声明「可同时满足」被定理级证伪'] };
  }
  if (r.verdict === 'safe') {
    return { verdict: 'verified', U: false, reason: '约束族两两一致 ⇒ 紧逻辑下全局可满足、无隐藏全局矛盾（' + r.theorem + '；' + r.checkedPairs + ' 对）', engine: 'lingnao-kernel ' + r.theorem, evidence: r, theorem: 'THM_HELLY_R1', certKind: 'constraint-feasibility', proof: ['全部约束对两两求交非空', 'R¹ 区间族由 Helly 定理(d=1)两两一致⇒全体一致 ⇒ 全局可满足、无隐藏全局矛盾'] };
  }
  return { verdict: 'unverified', U: true, reason: r.reason || '紧致性陷阱无法判定 ⇒ 𝕌', engine: 'lingnao-kernel ' + r.theorem, evidence: r };
}
function _auditOneNumericSafety(it) {
  if (typeof it.hExpr !== 'string' || !Array.isArray(it.vars) || !it.vars.length) {
    return { verdict: 'unverified', U: true, reason: 'numeric_safety 载荷需 hExpr（表达式字符串）与 vars（变量名数组）⇒ 𝕌', engine: null };
  }
  const r = K.certifySafetyInvariant({ hExpr: it.hExpr, vars: it.vars, domain: it.domain, bound: it.bound, dynamics: it.dynamics });
  if (r.verdict === 'verified') {
    const fi = r.forwardInvariant ? ' 已追加验证前向不变性（barrier certificate / CBF 条件 ∇h·f+α(h)≥0，Nagumo 1942 / Ames 2016）⇒ 真安全证书。' : '';
    return { verdict: 'verified', U: false, forwardInvariant: !!r.forwardInvariant, reason: 'M2 全域安全证书：' + (r.meaning || '域内恒成立') + fi, engine: 'lingnao-M2 certifySafetyInvariant', evidence: r, theorem: (r.theorem || 'THM_KRAWCZYK_CERTIFY'), certKind: 'safety-invariant', proof: r.forwardInvariant ? ['Krawczyk 认证：盒式域内 h≥-1/B² 恒成立', 'CBF 条件 ∇h·f+α(h)≥0 经同一 Krawczyk 机理独立认证(Nagumo 1942 / Ames 2016)', '安全集 C={h≥0} 对给定动力学前向不变 ⇒ 真安全证书'] : ['Krawczyk 认证：盒式域内 h≥-1/B² 恒成立(默认 B=1e6 ⇒ 容差 1e-12)', '未提供动力学 ⇒ 仅证「集合非负」，非「轨迹留内」'] };
  }
  if (r.verdict === 'violated') {
    // 诚实升级：M2 返回的违反点是「候选反例」（tier=candidate-counterexample，residual 非认证），
    // 不能未经核验就称「已证伪」。独立确定性回代：把候选点代入 hExpr，若确证 h<0 且点在域内
    // ⇒ 这才构成确定性证伪（refuted 诚实可信）；否则诚实降级为 𝕌（候选≠认证，绝不称已证伪）。
    const ce = r.counterexample || null;
    const tol = 1e-7;
    let backOk = false, hAt = null, why = '';
    if (ce && typeof K._m2Eval === 'function') {
      try {
        const env = {}; (it.vars || []).forEach(function (v) { env[v] = (typeof ce[v] === 'number') ? ce[v] : NaN; });
        hAt = K._m2Eval(it.hExpr, env);
        let inDom = true;
        if (it.domain && typeof it.domain === 'object') {
          (it.vars || []).forEach(function (v) {
            const iv = it.domain[v];
            if (Array.isArray(iv) && iv.length === 2) {
              if (!(env[v] >= iv[0] - tol && env[v] <= iv[1] + tol)) inDom = false;
            }
          });
        }
        if (isFinite(hAt) && hAt < -tol && inDom) backOk = true;
        else why = '回代 h(' + JSON.stringify(env) + ')=' + hAt + (inDom ? '' : '（点落域外）') + '，未确证严格 h<0';
      } catch (e) { why = '回代异常：' + (e && e.message); }
    } else { why = '无候选反例点或内核未导出 _m2Eval'; }
    if (backOk) {
      const hStr = (typeof hAt === 'number') ? hAt.toFixed(6) : String(hAt);
      return { verdict: 'refuted', U: false,
        reason: 'M2 候选反例经独立确定性回代确认：h(' + JSON.stringify(ce) + ')=' + hStr + ' < 0 且点在域内 ⇒ 声明「恒满足」被确定性证伪（非仅靠 residual 候选）。',
        engine: 'lingnao-M2 certifySafetyInvariant + 独立回代(_m2Eval)', evidence: r, theorem: null, certKind: 'safety-invariant',
        proof: ['M2 给出候选违反点（域内 h<0）', '独立确定性回代：h(' + JSON.stringify(ce) + ')=' + hStr + ' < 0 且点在域内', '候选反例升级为确定性证伪 ⇒ 声明「恒满足」不成立'] };
    }
    return { verdict: 'unverified', U: true,
      reason: 'M2 给出候选反例但独立回代未能确认（' + why + '）⇒ 诚实降级 𝕌（候选≠认证，不称已证伪）',
      engine: 'lingnao-M2 certifySafetyInvariant', evidence: r };
  }
  return { verdict: 'unverified', U: true, reason: 'M2 未签发证书：' + (r.reason || r.tier || '计算边界') + ' ⇒ 𝕌（诚实降级，非不安全）', engine: 'lingnao-M2 certifySafetyInvariant', evidence: r };
}
function _auditOnePath(it) {
  if (typeof it.start !== 'string' || typeof it.goal !== 'string') {
    return { verdict: 'unverified', U: true, reason: 'path 载荷需 start/goal（世界图节点名）⇒ 𝕌', engine: null };
  }
  const r = K.reason(it.start, it.goal, { hard: it.hard || [], soft: it.soft || [] });
  if (r.status !== 'optimal') {
    return { verdict: 'unverified', U: true, reason: 'A* 无法在当前世界图判定该起终点（' + (r.U ? '不可判定区域 𝕌' : r.status) + '）⇒ 声明无法核验 ⇒ 𝕌', engine: 'lingnao-A*', evidence: { status: r.status } };
  }
  const evidence = { optimalPath: r.path, cost: r.cost, usedSystem: r.system || r.usedSystem };
  if (!Array.isArray(it.claimedPath) && typeof it.claimedCost !== 'number') {
    return { verdict: 'unverified', U: true, reason: 'A* 已重算出最优路径（cost=' + r.cost + '），但声明未含 claimedPath/claimedCost ⇒ 无可比对对象 ⇒ 𝕌', engine: 'lingnao-A*', evidence: evidence };
  }
  const pathOk = !Array.isArray(it.claimedPath) || (it.claimedPath.length === r.path.length && it.claimedPath.every((n, i) => n === r.path[i]));
  const costOk = typeof it.claimedCost !== 'number' || _numEq(it.claimedCost, r.cost, 1e-6);
  if (pathOk && costOk) {
    return { verdict: 'verified', U: false, reason: 'A* 重算与声明一致（path=' + r.path.join('→') + '，cost=' + r.cost + '）。A* 最优性的载荷前提：引擎启发式须可采纳(admissible)且一致(consistent)，否则 optimal 标签不成立（Hart–Nilsson–Raphael 1968）。本判定信任内核 reason() 的一致性启发式。', engine: 'lingnao-A*', evidence: evidence, theorem: 'THM_ASTAR_OPTIMAL', certKind: 'optimal-path', proof: ['A* 在有限世界图重算最优路径(cost=' + r.cost + ')', '声明 path/cost 与重算一致', 'A* 最优性前提：启发式可采纳(admissible)+一致(consistent)(Hart–Nilsson–Raphael 1968)'] };
  }
  return { verdict: 'refuted', U: false, reason: 'A* 重算与声明不符（真实最优 path=' + r.path.join('→') + ' cost=' + r.cost + '）⇒ 声明被确定性证伪', engine: 'lingnao-A*', evidence: evidence, theorem: 'THM_ASTAR_OPTIMAL', certKind: 'optimal-path', proof: ['A* 重算真实最优 path=' + r.path.join('→') + ' cost=' + r.cost, '声明与之不符 ⇒ 确定性证伪'] };
}
function _auditOneAuthorized(it) {
  // 授权判定（M4 EffectGate 机制）：动作效应类别是否被当前策略放行
  const effKind = (it && (it.effectKind || (it.payload && it.payload.effectKind))) || null;
  if (!effKind) return { verdict: 'unverified', U: true, reason: 'authorized 载荷需 effectKind（动作效应类别，如 read / emit / process / eval）⇒ 𝕌', engine: null };
  if (!K.EffectGate) return { verdict: 'unverified', U: true, reason: 'M4 EffectGate 未导出 ⇒ 无法核授权 ⇒ 𝕌（fail-closed）', engine: null };
  const hardDeny = ['PROCESS', 'EVAL']; // 内核恒定硬拒绝，不可经配置放行
  if (hardDeny.indexOf(effKind) >= 0) {
    return { verdict: 'refuted', U: false, reason: '效应类别 "' + effKind + '" 属 M4 硬拒绝（PROCESS/EVAL 不可经配置放行）⇒ 该动作无授权、授权声明被确定性证伪', engine: 'lingnao-M4 EffectGate', evidence: { effKind: effKind }, theorem: null, certKind: 'authorization', proof: ['M4 EffectGate 恒定硬拒绝 PROCESS/EVAL', '声明该动作被授权 ⇒ 与硬拒绝矛盾 ⇒ 确定性证伪'] };
  }
  const snap = (typeof K.EffectGate.policySnapshot === 'function') ? K.EffectGate.policySnapshot() : null;
  const allowed = snap && Array.isArray(snap.allowedKinds) ? snap.allowedKinds : ((K.EFFECT_KINDS && K.EFFECT_KINDS.allowed) ? K.EFFECT_KINDS.allowed : null);
  if (Array.isArray(allowed)) {
    if (allowed.indexOf(effKind) >= 0) return { verdict: 'verified', U: false, reason: '效应类别 "' + effKind + '" 在当前策略放行表内 ⇒ 授权声明被确认', engine: 'lingnao-M4 EffectGate', evidence: { effKind: effKind, snapshot: snap }, theorem: 'THM_COMPLETE_MEDIATION', certKind: 'authorization', proof: ['EffectGate 策略放行表含 "' + effKind + '"', 'M4 完整中介保证副作用出口经此闸 ⇒ 授权声明被确认'] };
    return { verdict: 'refuted', U: false, reason: '效应类别 "' + effKind + '" 不在当前策略放行表 ⇒ 未授权、授权声明被确定性证伪', engine: 'lingnao-M4 EffectGate', evidence: { effKind: effKind, snapshot: snap }, theorem: null, certKind: 'authorization', proof: ['EffectGate 策略放行表不含 "' + effKind + '"', '未放行 ⇒ 授权声明被确定性证伪'] };
  }
  return { verdict: 'unverified', U: true, reason: 'EffectGate 策略无明确放行表（仅硬拒绝 PROCESS/EVAL 可判）⇒ 授权不可判定 ⇒ 𝕌', engine: 'lingnao-M4 EffectGate', evidence: { effKind: effKind, snapshot: snap } };
}

// ============================================================================
//  因果可识别性裁判（class='causal'）与 conformal 风险界裁判（class='conformal'）
//  数学根基（#381/#382/#383/#384 落点，用户指令"用数学原理创造性的解决"）：
//   · causal  —— Pearl 1995 do-calculus；后门准则(Pearl 1993)/前门准则(Pearl 1995)；
//                Tian&Pearl 2002 可识别性的充分必要识别条件（"无双向路径连接 X 与其子孙"）；
//                Shpitser&Pearl 2006 ID 算法 sound&complete 的精神。
//                灵脑裁判层**只做图结构可识别性判定**（给定因果图，效应能否从观测分布识别），
//                不做数值 ACE 估计（那需数据，超出确定性内核范畴）；不可识别则诚实 𝕌(provably_unidentifiable)。
//   · conformal —— Angelopoulos&Bates 2021 (arXiv:2107.07511) Lemma 1 split conformal 分位数引理：
//                q̂ = Quantile({s_i}∪{∞}, ⌈(n+1)(1−α)⌉/(n+1)) ⇒ 边际覆盖 P(Y∈C(X)) ≥ 1−α（分布自由、仅需 exchangeability）。
//                把"无知弃权 𝕌"升级为"带量化风险界 α 的诚实弃权"：若决策因 conformal 不可判而 abstain，
//                其残留误信风险被 α 上限约束（对应用户"abstain 带 α 注解"要求）。
// ============================================================================

// ---------- do-calculus 图结构辅助（确定性、离线、可重算）----------
function _causalWithStruct(nodes, edges, unobserved) {
  const parents = {}; const children = {};
  nodes.forEach(function (n) { parents[n] = []; children[n] = []; });
  edges.forEach(function (e) { const u = e[0], v = e[1]; if (children[u]) children[u].push(v); if (parents[v]) parents[v].push(u); });
  return { nodes: nodes.slice(), edges: edges, unobserved: unobserved.slice(), parents: parents, children: children };
}
function _causalBuildDAG(graph) {
  const nodes = (Array.isArray(graph.nodes) ? graph.nodes : []).map(String);
  const edges = (Array.isArray(graph.edges) ? graph.edges : []).map(function (e) { return Array.isArray(e) ? [String(e[0]), String(e[1])] : null; }).filter(Boolean);
  const unobserved = (Array.isArray(graph.unobserved) ? graph.unobserved : []).map(String);
  return _causalWithStruct(nodes, edges, unobserved);
}
function _causalStripOut(G, src) {
  return _causalWithStruct(G.nodes, G.edges.filter(function (e) { return e[0] !== src; }), G.unobserved);
}
function _causalDescendants(G, x) {
  const seen = {}; const stack = [x];
  while (stack.length) { const u = stack.pop(); (G.children[u] || []).forEach(function (v) { if (!seen[v]) { seen[v] = true; stack.push(v); } }); }
  return seen;
}
// d-分离（Pearl 1988）：直接枚举骨架上所有简单路径，逐三元组判阻。小因果图（treatment/outcome + 少量调整/中介节点）代价可忽略，且结果无歧义。
function _causalPaths(G, a, b) {
  const adj = {}; G.nodes.forEach(function (n) { adj[n] = []; });
  G.edges.forEach(function (e) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); });
  const out = []; const path = [a]; const seen = {}; seen[a] = true;
  (function dfs(u) {
    if (u === b) { out.push(path.slice()); return; }
    adj[u].forEach(function (v) { if (!seen[v]) { seen[v] = true; path.push(v); dfs(v); path.pop(); seen[v] = false; } });
  })(a);
  return out;
}
function _causalIsCollider(G, u, v, w) {
  return G.parents[v].indexOf(u) >= 0 && G.parents[v].indexOf(w) >= 0; // u→v←w
}
function _causalDsep(G, a, b, Z) {
  if (a === b) return false;
  const zset = {}; Z.forEach(function (z) { zset[z] = true; });
  const descInZ = {};
  Object.keys(zset).forEach(function (z) { const d = _causalDescendants(G, z); Object.keys(d).forEach(function (k) { descInZ[k] = true; }); });
  const paths = _causalPaths(G, a, b);
  if (!paths.length) return true; // 无路径 ⇒ 平凡 d-分离
  for (let p = 0; p < paths.length; p++) {
    let blocked = false;
    for (let i = 1; i < paths[p].length - 1; i++) {
      const v = paths[p][i];
      const isColl = _causalIsCollider(G, paths[p][i - 1], v, paths[p][i + 1]);
      if (isColl) {
        if (!(zset[v] || descInZ[v])) { blocked = true; break; } // 碰撞器未解阻塞 ⇒ 该三元组阻断路径
      } else {
        if (zset[v]) { blocked = true; break; } // 链/叉的中点被观测 ⇒ 阻断
      }
    }
    if (!blocked) return false; // 存在一条开放路径 ⇒ d-connected ⇒ 不分离
  }
  return true; // 所有路径均被阻断 ⇒ d-分离
}
// 后门准则：Z 满足 ⇔ (i) Z 不含 X 的后代；(ii) 在删去 X 出边的图 G_α 中 Z d-分离 X 与 Y
function _causalBackdoorOk(G, X, Y, Z) {
  const dX = _causalDescendants(G, X);
  for (let i = 0; i < Z.length; i++) if (dX[Z[i]]) return { ok: false, why: '调整集含 X 的后代「' + Z[i] + '」（违反后门准则条件一）' };
  const Galpha = _causalStripOut(G, X);
  return { ok: _causalDsep(Galpha, X, Y, Z), why: _causalDsep(Galpha, X, Y, Z) ? '后门路径被 Z 阻断' : '后门路径未被 Z 阻断' };
}
// 前门准则：X→Z→Y，Z 阻断所有指向 Y 的有向路径、X 与 Z 无未测混杂、X 阻断 Z→Y 后门
function _causalFrontdoorOk(G, X, Y, Zm) {
  const inZ = {}; Zm.forEach(function (z) { inZ[z] = true; });
  // (i) 无避开中介 Z 的有向路径 X→Y
  const seen = {}; const stack = [X]; let avoidsZ = false;
  while (stack.length) { const u = stack.pop(); if (u === Y) { avoidsZ = true; break; } (G.children[u] || []).forEach(function (v) { if (!seen[v] && !inZ[v]) { seen[v] = true; stack.push(v); } }); }
  if (avoidsZ) return { ok: false, why: '存在避开中介 Z 的有向路径 X→Y（前门(i)失败）' };
  // (ii) X 与 Z 间无未测混杂：在 G_α（删 X 出边）中 X _||_ Z | ∅
  if (!_causalDsep(_causalStripOut(G, X), X, Zm[0], [])) return { ok: false, why: 'X 与中介 Z 间存在未阻断后门（前门(ii)失败：未测混杂）' };
  // (iii) X 阻断 Z→Y 后门：在 G_β（删 Z 出边）中 Z _||_ Y | {X}
  if (!_causalDsep(_causalStripOut(G, Zm[0]), Zm[0], Y, [X])) return { ok: false, why: 'Z 到 Y 的后门路径未被 X 阻断（前门(iii)失败）' };
  return { ok: true, why: '前门三条件成立' };
}
// 确定性枚举子集（size≤k，字典序），供后门调整集自动搜索
function _subsetsUpTo(arr, k) {
  const out = [[]];
  for (let size = 1; size <= Math.min(k, arr.length); size++) {
    const idx = new Array(size); for (let i = 0; i < size; i++) idx[i] = i;
    while (true) {
      out.push(idx.map(function (i) { return arr[i]; }));
      let i = size - 1;
      while (i >= 0 && idx[i] === arr.length - size + i) i--;
      if (i < 0) break;
      idx[i]++; for (let j = i + 1; j < size; j++) idx[j] = idx[j - 1] + 1;
    }
  }
  return out;
}
// split conformal 分位数（含 ∞ 增广集的第 ⌈(n+1)(1−α)⌉ 个）
function _quantileSortedAsc(sortedAsc, p) {
  if (p <= 0) return sortedAsc[0];
  if (p >= 1) return sortedAsc[sortedAsc.length - 1];
  const i = Math.ceil(p * sortedAsc.length) - 1;
  return sortedAsc[Math.max(0, Math.min(sortedAsc.length - 1, i))];
}

// ---------- 因果可识别性裁判（do-calculus）----------
function _auditOneCausal(it) {
  const g = it.graph;
  if (!g || !Array.isArray(g.nodes) || !g.nodes.length) {
    return { verdict: 'unverified', U: true, reason: 'causal 载荷需 graph（{nodes, edges, unobserved?}）⇒ 无因果图则无法做可识别性判定 ⇒ 𝕌', engine: null };
  }
  const G = _causalBuildDAG(g);
  const X = String(it.treatment), Y = String(it.outcome);
  if (!X || G.nodes.indexOf(X) < 0 || !Y || G.nodes.indexOf(Y) < 0) {
    return { verdict: 'unverified', U: true, reason: 'causal 载荷需 treatment/outcome 均为 graph 内节点名 ⇒ 𝕌', engine: 'lingnao-do-calculus' };
  }
  // 0) 智能体显式给出调整集 ⇒ 内核重验（Sledgehammer 重建：声明仅当 oracle，内核独立复核）
  if (Array.isArray(it.adjustmentSet) && it.adjustmentSet.length) {
    const Z = it.adjustmentSet.map(String);
    const bd = _causalBackdoorOk(G, X, Y, Z);
    if (bd.ok) {
      return { verdict: 'verified', U: false, reason: 'do-calculus 后门准则成立（按智能体所给调整集 Z={' + Z.join(',') + '} 复核）：① 不含 X 后代；② 阻断所有指向 X 的后门路径。效应可识别：P(y|do(x)) = Σ_z P(y|x,z)·P(z)（Pearl 1993 后门准则；Tian&Pearl 2002 识别条件）。', engine: 'lingnao-do-calculus', theorem: 'THM_CAUSAL_BACKDOOR', certKind: 'causal-identifiability', proof: ['内核独立复核智能体所给调整集 Z', 'Z 不含 X 后代 且 阻断后门路径 ⇒ 后门准则成立', '识别公式 P(y|do(x))=Σ_z P(y|x,z)P(z)'], evidence: { adjustmentSet: Z, criterion: 'back-door' } };
    }
    return { verdict: 'refuted', U: false, reason: '智能体所给调整集 Z={' + Z.join(',') + '} 不满足后门准则（' + bd.why + '）⇒ 「经此后门识别」的声明被确定性证伪', engine: 'lingnao-do-calculus', theorem: null, certKind: 'causal-identifiability', proof: ['内核独立复核 Z', '后门准则未成立（' + bd.why + '）⇒ 识别声明被证伪'] };
  }
  // 1) 后门自动搜索：在「观测 ∩ 非 X 后代」节点中确定性穷举子集（size≤4）找满足后门准则的调整集
  const observed = G.nodes.filter(function (n) { return G.unobserved.indexOf(n) < 0; });
  const candZ = observed.filter(function (n) { return n !== X && n !== Y && !_causalDescendants(G, X)[n]; });
  const subsets = _subsetsUpTo(candZ, 4);
  for (let s = 0; s < subsets.length; s++) {
    if (_causalBackdoorOk(G, X, Y, subsets[s]).ok) {
      const Zstr = subsets[s].length ? subsets[s].join(',') : '∅（X,Y 已天然 d-分离，无需调整）';
      return { verdict: 'verified', U: false, reason: 'do-calculus 后门准则成立：调整集 Z={' + Zstr + '} 满足（① 不含 X 后代；② 阻断所有指向 X 的后门路径）。效应可识别：P(y|do(x)) = Σ_z P(y|x,z)·P(z)（Pearl 1993 后门准则；Tian&Pearl 2002 识别条件）。', engine: 'lingnao-do-calculus', theorem: 'THM_CAUSAL_BACKDOOR', certKind: 'causal-identifiability', proof: ['构建因果 DAG 并标定观测/未观测节点', '在观测非 X-后代节点中确定性穷举调整集（size≤4）', '命中满足后门准则的 Z ⇒ 效应可识别', '识别公式 P(y|do(x))=Σ_z P(y|x,z)P(z)'], evidence: { adjustmentSet: subsets[s], criterion: 'back-door' } };
    }
  }
  // 2) 前门：智能体提供中介 Zm（须非 X,Y、非未观测）
  const Zm = it.mediator ? (Array.isArray(it.mediator) ? it.mediator.map(String) : [String(it.mediator)]) : null;
  if (Zm && Zm.length) {
    if (Zm.indexOf(X) >= 0 || Zm.indexOf(Y) >= 0) {
      return { verdict: 'refuted', U: false, reason: '中介集含 treatment/outcome（' + Zm.join(',') + '）⇒ 前门准则退化 ⇒ 声明被确定性证伪', engine: 'lingnao-do-calculus', theorem: null, certKind: 'causal-identifiability', proof: ['前门中介须为 X→Y 之间的中间变量，不能是 X 或 Y', '退化 ⇒ 证伪'] };
    }
    const fd = _causalFrontdoorOk(G, X, Y, Zm);
    if (fd.ok) {
      return { verdict: 'verified', U: false, reason: 'do-calculus 前门准则成立：X→Z→Y，Z 阻断所有指向 Y 的有向路径、X 与 Z 无未测混杂、X 阻断 Z→Y 后门。效应可识别：P(y|do(x)) = Σ_z P(z|x)·Σ_{x′} P(y|x′,z)·P(x′)（Pearl 1995 前门准则；即便存在未观测 X-Y 混杂亦可识别）。', engine: 'lingnao-do-calculus', theorem: 'THM_CAUSAL_FRONTDOOR', certKind: 'causal-identifiability', proof: ['前门(i)：无避开中介 Z 的有向路径 X→Y', '前门(ii)：X 与 Z 间后门被阻断（无未测混杂）', '前门(iii)：X 阻断 Z→Y 后门', '识别公式 P(y|do(x))=Σ_z P(z|x)Σ_{x′}P(y|x′,z)P(x′)'], evidence: { mediator: Zm, criterion: 'front-door' } };
    }
    return { verdict: 'refuted', U: false, reason: '提供了中介 ' + Zm.join(',') + ' 但前门准则不成立（' + fd.why + '）⇒ 「经前门识别」的声明被确定性证伪', engine: 'lingnao-do-calculus', theorem: null, certKind: 'causal-identifiability', proof: ['内核独立复核前门三条件', '未全部满足（' + fd.why + '）⇒ 识别声明被证伪'] };
  }
  // 3) 均不可识别：诚实 𝕌，标注 provably_unidentifiable（do-calculus ID 算法失败 ⇒ 效应在观测分布下不可识别；灵脑无数据，无法核验具体数值）
  return { verdict: 'unverified', U: true, reason: '给定因果图下，既无满足后门准则的调整集、也未提供满足前门准则的中介 ⇒ do-calculus 判定该因果效应在观测分布下不可识别（provably unidentifiable）。灵脑不拥有数据，无法核验具体效应数值 ⇒ 诚实弃权 𝕌（非「大概不成立」）。', engine: 'lingnao-do-calculus', theorem: null, certKind: 'causal-identifiability', proof: ['枚举后门调整集（size≤4）均不满足', '无满足前门准则的中介', 'ID 算法式失败 ⇒ 不可识别 ⇒ 𝕌'], evidence: { identifiable: false } };
}

// ---------- conformal 风险界裁判（split conformal，Angelopoulos&Bates 2021）----------
function _auditOneConformal(it) {
  const scores = Array.isArray(it.calibrationScores) ? it.calibrationScores : null;
  const alpha = (typeof it.alpha === 'number') ? it.alpha : null;
  if (!scores || scores.length < 2 || alpha == null || alpha <= 0 || alpha >= 1) {
    return { verdict: 'unverified', U: true, reason: 'conformal 载荷需 calibrationScores（非空数值数组）与 alpha∈(0,1)（目标误覆盖上界）⇒ 𝕌', engine: null };
  }
  const n = scores.length;
  // Lemma 1：q̂ = Quantile({s_i}∪{∞}, ⌈(n+1)(1−α)⌉/(n+1)) ⇒ P(Y∈C(X)) ≥ 1−α（边际、分布自由）
  const level = Math.ceil((n + 1) * (1 - alpha)) / (n + 1);
  const aug = scores.slice().sort(function (a, b) { return a - b; }).concat([Infinity]);
  const qhat = _quantileSortedAsc(aug, level);
  const riskBound = alpha; // 可保证的边际误覆盖上界
  const claim = (typeof it.claim === 'string') ? it.claim : 'marginal-risk-bound';
  if (claim === 'per-decision-safe') {
    // 智能体声称「这一具体决策以 ≥1−α 概率安全」= 条件/逐点覆盖 ⇒ 超出 conformal 保证（conformal 仅边际）⇒ 过度声明/幻觉
    return { verdict: 'refuted', U: false, reason: 'conformal 仅提供**边际**覆盖保证 P(Y∈C(X))≥1−α（交换性下、对总体），不保证「这一具体决策」以 ≥1−α 安全（条件/逐点覆盖）。智能体声称逐点安全 ⇒ 属过度声明（hallucination 风险），被确定性证伪。', engine: 'lingnao-conformal', theorem: null, certKind: 'conformal-risk', proof: ['split conformal 保证是边际的（对所有 exchangeable 样本平均）', '「本决策个体安全 ≥1−α」要求条件覆盖，conformal 不提供', '将边际保证当逐点保证 ⇒ 过度声明 ⇒ 证伪'], riskBound: riskBound, alpha: alpha, threshold: qhat };
  }
  if (claim === 'marginal-risk-bound') {
    return { verdict: 'verified', U: false, reason: 'conformal 风险界成立：校准集 n=' + n + '，分位数阈值 q̂=' + qhat + '（水平 ' + level.toFixed(4) + '）⇒ 边际误覆盖 P(Y∉C(X)) ≤ α=' + alpha + ' 由 split conformal 定理保证（Angelopoulos&Bates 2021 Lemma 1；分布自由、仅需 exchangeability）。注：此乃**边际**界，非逐决策条件界。', engine: 'lingnao-conformal', theorem: 'THM_CONFORMAL_COVERAGE', certKind: 'conformal-risk', proof: ['校准分数集大小 n=' + n, 'split conformal 阈值 q̂=Quantile({s_i,∞}, ⌈(n+1)(1−α)⌉/(n+1))=' + qhat, '由引理得边际覆盖 P(Y∈C(X))≥1−α（分布自由）'], riskBound: riskBound, alpha: alpha, threshold: qhat };
  }
  return { verdict: 'unverified', U: true, reason: 'conformal claim 类型未知（支持 marginal-risk-bound / per-decision-safe）⇒ 𝕌', engine: 'lingnao-conformal', riskBound: riskBound, alpha: alpha, threshold: qhat };
}

var _KIND_CERTKIND = {
  consistency: 'consistency',
  constraint: 'constraint-feasibility',
  numeric_safety: 'safety-invariant',
  path: 'optimal-path',
  causal: 'causal-identifiability',
  conformal: 'conformal-risk',
};
var _KIND_SCOPE = {
  consistency: '多条声明在共有变量上的取值是否两两可同时成立（互斥检出）；覆盖 LLM/agent 最高频的自相矛盾错误。',
  constraint: '约束族作为区间集合的可满足性 / 矛盾检测；仅当约束均为 1D 区间时可定判。',
  numeric_safety: '盒式域内安全不变式 h≥-1/B² 的 Krawczyk 认证；提供动力学时追加前向不变性(CBF)认证。',
  path: '有限世界图上 A* 最优路径的确定性重算与声明比对。',
  causal: '给定因果图下，因果效应可识别性的 do-calculus 判定（后门/前门准则；Shpitser&Pearl 2006 ID 算法 sound&complete 的精神）；只判结构可识别，不做数值 ACE 估计。',
  conformal: '给定校准分数集与 α 的 split conformal 边际覆盖风险界；诚实区分边际覆盖与逐点覆盖（Angelopoulos&Bates 2021）。',
};
var _KIND_LIMITS = {
  consistency: '只覆盖**数值型**声明（非有限值/缺值进 skipped 而非静默吞掉）；字符串、日期、布尔、单位不统一的声明不覆盖，一律 𝕌 不硬判；两两比对随声明数 O(n²)，过多建议分批。',
  constraint: '仅覆盖 1D 区间约束；R^d(d≥2) 一般约束 Helly 条件不足，内核 fail-closed 为 𝕌；不覆盖非线性/逻辑组合约束。',
  numeric_safety: '维数上限 6 状态+2 辅助变量；带 -1/B² 辅助域松弛(非纯 h≥0)；未给动力学时只证「集合非负」非「轨迹留内」；候选反例需回代校验。',
  path: '依赖内核 reason() 的可采纳+一致启发式前提(Hart–Nilsson–Raphael 1968)；非有限图/不可判定区域诚实 𝕌；仅比对声明 path/cost。',
  causal: '只做图结构可识别性判定，需显式因果图(nodes/edges/unobserved)；调整集穷举限 size≤4（更大图可能漏判——诚实标 𝕌 而非误判）；不做数值效应估计（需数据，超出确定性内核）；未提供 mediator 时前门不触发。',
  conformal: '保证是**边际**的（对 exchangeable 总体），非逐决策条件覆盖；需 calibrationScores 与 α∈(0,1)；阈值 q̂ 用含 ∞ 增广的 split conformal 分位数引理；n 过小时界仍成立但实用价值低。',
};
function auditEvidenceLogic(args) {
  args = args || {};
  const items = Array.isArray(args.items) ? args.items : [];
  if (!items.length) return { ok: false, error: 'items 需为非空数组（待核声明列表；每项 {id?, kind, text?, depends?, …载荷}）' };
  // ── 预算 κ（1.4.0）：判定预算是一等公民，不是装饰字段。κ = 本次调用允许内核消费的判定原语求值次数；
  //    跑不完 ⇒ 余下条目一律 𝕌（abstainedBy=budget），绝不允许用跑完的那部分冒充整体结论。
  //    同时 it.budget / it.maxDepth 会透传给灵数求解器，让「解集被截断」可被预算参数解释与重试。
  const budget = (typeof args.budget === 'number' && isFinite(args.budget) && args.budget > 0) ? Math.floor(args.budget) : DEFAULT_AUDIT_BUDGET;
  // ── depends DAG（1.4.0）：item 可声明 depends:[itemId]；依赖必须存在、不自依。
  const idOf = function (it, i) { return (it && it.id != null) ? String(it.id) : ('item-' + i); };
  const idSet = {}; items.forEach(function (it, i) { idSet[idOf(it, i)] = true; });
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    if (!Array.isArray(it.depends)) continue;
    for (const dep of it.depends) {
      if (String(dep) === idOf(it, i)) return { ok: false, error: 'depends 校验：item id="' + idOf(it, i) + '" 依赖自身（不允许）' };
      if (!idSet[String(dep)]) return { ok: false, error: 'depends 校验：item id="' + idOf(it, i) + '" 依赖了不存在的 id="' + String(dep) + '"' };
    }
  }
  // 拓扑序（Kahn）：出现环 ⇒ fail-closed 直接报 400，绝不「看起来合理」就硬跑一个顺序
  const indeg = {}, adj = {};
  items.forEach(function (it, i) { indeg[idOf(it, i)] = 0; adj[idOf(it, i)] = []; });
  items.forEach(function (it, i) {
    const deps = Array.isArray(it.depends) ? it.depends : [];
    deps.forEach(function (d) { adj[String(d)].push(idOf(it, i)); indeg[idOf(it, i)] += 1; });
  });
  const queue = items.map(function (it, i) { return idOf(it, i); }).filter(function (id) { return indeg[id] === 0; });
  const order = [];
  while (queue.length) {
    const id = queue.shift(); order.push(id);
    (adj[id] || []).forEach(function (nx) { indeg[nx] -= 1; if (indeg[nx] === 0) queue.push(nx); });
  }
  if (order.length !== items.length) {
    return { ok: false, error: 'items 的 depends 成环：拓扑序只能排出 ' + order.length + '/' + items.length + ' 条 ⇒ fail-closed，不猜测求值顺序' };
  }
  const itemIndexOf = {}; items.forEach(function (it, i) { itemIndexOf[idOf(it, i)] = i; });
  const byId = {}, budgetUsed = { n: 0 };
  function evaluateOne(it) {
    // 组合律的执行者：结论不得建立在未判定 / 已被证伪的前提上
    const deps = Array.isArray(it.depends) ? it.depends : [];
    for (const dep of deps) {
      const d = byId[String(dep)];
      if (!d) return { verdict: 'unverified', U: true, abstainedBy: 'dependency_unresolved', reason: '依赖 item="' + String(dep) + '" 未求值（依赖顺序未闭合）⇒ 本条目不独立判定 𝕌', engine: null };
      if (d.verdict === 'refuted') return { verdict: 'unverified', U: true, abstainedBy: 'dependency_refuted', reason: '依赖 item="' + String(dep) + '" 已被确定性证伪 ⇒ 其结论建立在假前提上，本条目不再独立判定（整体口径由组合律判 refuted）', engine: null };
      if (d.verdict !== 'verified') return { verdict: 'unverified', U: true, abstainedBy: 'dependency_unresolved', reason: '依赖 item="' + String(dep) + '" 为 𝕌（abstainedBy=' + (d.abstainedBy || 'unresolved') + '）⇒ 前提未定 ⇒ 本条目 𝕌', engine: null };
    }
    if (budgetUsed.n >= budget) {
      return { verdict: 'unverified', U: true, abstainedBy: 'budget', reason: '判定预算 κ 已用尽（budgetUsed=' + budgetUsed.n + '/' + budget + '）⇒ 本条目未判定，诚实弃权 𝕌，且不计入 verified/refuted', engine: null };
    }
    budgetUsed.n += 1;
    let core;
    try {
      if (it.kind === 'consistency') core = _auditOneConsistency(it);
      else if (it.kind === 'constraint') core = _auditOneConstraint(it);
      else if (it.kind === 'numeric_safety') core = _auditOneNumericSafety(it);
      else if (it.kind === 'path') core = _auditOnePath(it);
      else if (it.kind === 'causal') core = _auditOneCausal(it);
      else if (it.kind === 'conformal') core = _auditOneConformal(it);
      else core = { verdict: 'unverified', U: true, abstainedBy: 'unsupported_kind', reason: 'kind="' + String(it.kind) + '" 无对应确定性验证能力 ⇒ 诚实弃权 𝕌（灵脑=推理-only：可核 kind：consistency / constraint / numeric_safety / path / causal / conformal；方程求解/验真归灵数 lingshu-solver 独立产品）', engine: null };
    } catch (e) {
      core = { verdict: 'unverified', U: true, abstainedBy: 'evaluation_exception', reason: '验证过程异常 ⇒ fail-closed 弃权（异常已留痕）：' + (e && e.message), engine: null };
    }
    return core;
  }
  const perItem = order.map(function (id) {
    const it = items[itemIndexOf[id]] || {};
    const core = byId[id] || evaluateOne(it);
    byId[id] = core;
    return {
      idx: itemIndexOf[id], id: id, kind: String(it.kind || ''), text: typeof it.text === 'string' ? it.text : null,
      depends: Array.isArray(it.depends) ? it.depends.slice() : [],
      verdict: core.verdict, U: core.U === true, abstainedBy: core.abstainedBy || null,
      reason: core.reason, engine: core.engine || null, evidence: core.evidence || null, numeric: core.numeric || null,
      proofObject: {
        theorem: core.theorem || null,
        certKind: core.certKind || (_KIND_CERTKIND[it.kind] || null),
        proof: core.proof || null,
        scope: core.scope || (_KIND_SCOPE[it.kind] || null),
        limitations: core.limitations || (_KIND_LIMITS[it.kind] || null),
      },
      formalization: { inProofChain: false, scope: '声明(自然语言/业务表述) → 结构化载荷 it 的形式化由调用方负责', note: 'VPU：形式化步骤在证明链之外——内核不重新推导、亦不担保其正确性；仅对结构化载荷做确定性验证。审计师应把“声明如何变成 it”视为调用方责任，不计入内核证明。' },
      aiucRef: core.verdict === 'verified' ? ['D-reliability: 声明经确定性验证器确认']
        : core.verdict === 'refuted' ? ['D-reliability: 声明被确定性验证器证伪（幻觉/错误检出）']
        : ['D-reliability: 无法确定性验证 ⇒ 如实弃权，不计入可信结论'],
    };
  });
  const count = function (v) { return perItem.filter(function (x) { return x.verdict === v; }).length; };
  const verified = count('verified'), refuted = count('refuted'), unverified = count('unverified');
  // ── 组合律 Φ（结构性，非概率）：∃ refuted ⇒ refuted；否则 ∀ verified ⇒ verified；否则 𝕌
  const overall = refuted > 0 ? 'refuted' : ((verified === perItem.length && perItem.length > 0) ? 'verified' : 'unverified');
  const ridInput = _stableStringify({ v: 1, algo: K.ALGO_VERSION, seed: K.SEED, items: items.slice(0, 200) });
  const ridFull = crypto.createHash('sha256').update(ridInput, 'utf8').digest('hex');
  const budgetExceeded = budgetUsed.n >= budget && (budgetUsed.n < items.length);
  return {
    ok: true,
    overall: overall,
    reportId: ridFull.slice(0, 16),
    reportIdFull: ridFull,
    reportCoverage: { hashedItems: Math.min(items.length, 200), totalItems: items.length, note: items.length > 200 ? 'items>200：reportId 仅覆盖前 200 条，超出部分未进入哈希（建议分批核审）' : 'reportId 覆盖全部条目，可离线重算比对' },
    generatedAt: new Date().toISOString(),
    caseLabel: typeof args.caseLabel === 'string' ? args.caseLabel : null,
    kernel: { algoVersion: K.ALGO_VERSION, seed: K.SEED, deterministic: true, offline: true },
    budget: { declared: budget, used: budgetUsed.n, exceeded: budgetExceeded, unit: 'judgment-primitive-evaluations', note: '预算内跑完的判定是有效判定；跑不完的条目一律 𝕌(provenance=abstainedBy=budget)，不会被算进 verified。' },
    compositionLaw: { rule: 'exists(refuted) ⇒ overall=refuted；else all(verified) ⇒ overall=verified；else overall=unverified(𝕌)', dependsSupported: true, note: 'item.depends 声明前提；前提为 𝕌 或 refuted 时，本条目不独立判定（abstainedBy=dependency_unresolved / dependency_refuted），因为结论不得建立在未判定或假前提上。' },
    summary: {
      total: perItem.length, verified: verified, refuted: refuted, unverified: unverified,
      hallucinationRisk: refuted > 0 ? 'detected（' + refuted + ' 条声明被确定性证伪）' : 'none-detected（未检出被证伪声明；注意：unverified ≠ 通过）',
      honesty: '三分口径：verified=确定性验证器确认；refuted=确定性验证器证伪；unverified(𝕌)=无法确定性验证而如实弃权。无第四种「大概没错」。',
    },
    items: perItem,
    aiucReference: {
      standard: 'AIUC-1 Domain D — Reliability（工具/输出的可靠性与可审计性）',
      mapping: {
        'D-防幻觉（hallucination）': '声明必须经确定性验证器（灵数区间认证 / M2 证书 / A* 重算 / 紧致性定理）确认才记 verified；其余一律 𝕌 弃权，从机制上杜绝「未验证却输出结论」。',
        'D-来源验证（source validation）': '判定只来自内核确定性结果，声明文本与人类直觉不参与判定；证据字段保留引擎名/定理名/解集/反例，可逐条追溯。',
        'D-工具调用验证（tool call authentication）': '每条验证留痕（kind/engine/verdict/evidence）；reportId=sha256(输入+内核版本) 可离线重算 ⇒ 报告是否被改动可被第三方机械检出。',
      },
      disclaimer: '本映射仅说明报告的证据结构对应 AIUC-1 Reliability 域的关注点；灵脑未获 AIUC-1 认证，本报告不构成任何认证或合规结论。',
    },
    certificateLayer: {
      kind: 'machine-checkable certificate layer（机器可复核证书层）',
      proves: 'agent-declared numeric / logical claims — NOT mathematical theorems',
      notA: '数学定理证明器（如 Coq / Lean / Isabelle）—— 它们从公理证明数学定理；灵脑判定的是智能体的具体声明，方程/区间/CBF 只是判定声明的底层手段，不为任意命题做机器证明',
      claimClasses: {
        'consistency': { theorem: 'PAIRWISE_VALUE_EQUIVALENCE', via: 'consistency', meaning: '多条声明在共有变量上两两不互斥' },
        'constraint-feasibility': { theorem: 'THM_HELLY_R1 / THM_COMPACTNESS', via: 'constraint', meaning: '1D 区间约束族的可满足性 / 矛盾' },
        'safety-invariant': { theorem: 'THM_KRAWCZYK_CERTIFY / THM_BARRIER_NAGUMO_CBF', via: 'numeric_safety', meaning: '盒式域内安全不变式 / 前向不变性(CBF)' },
        'optimal-path': { theorem: 'THM_ASTAR_OPTIMAL', via: 'path', meaning: '有限图上 A* 最优路径的声明比对' },
        'causal-identifiability': { theorem: 'THM_CAUSAL_BACKDOOR / THM_CAUSAL_FRONTDOOR', via: 'causal', meaning: '给定因果图，效应可识别性（后门/前门）' },
        'conformal-risk': { theorem: 'THM_CONFORMAL_COVERAGE', via: 'conformal', meaning: 'conformal 边际覆盖风险界 P(误覆盖)≤α' },
      },
      failClosed: '不可确定性验证的声明一律诚实返回 𝕌(unverified)；解集被截断(truncated) 或 未全认证 时**不得**退化成 refuted——这是 1.4.0 修补的 soundness 洞。',
    },
    reproducible: {
      algorithm: 'audit_evidence v1.4',
      reportIdFormula: 'sha256( stableStringify({v:1, ALGO_VERSION, SEED, items[0..200]}) )',
      note: '同输入 + 同内核版本 ⇒ 同 reportId。审计师无需重跑模型，重算哈希即可核对报告完整性。',
    },
  };
}

// ---------- 3c. 决策可信裁判 certify_decision（产品重新定位为"证明决策"后的一等公民；运动员提议、裁判判定）----------
// 数学（#378 落点）：决策 D = (action, context, P)，P={p_i} 为智能体对决策的声明属性集；
//   每 p_i 有 class c_i ∈ {constraint, numeric_safety, path, authorized}，对应确定性验证器 V_{c_i}；
//   V_{c_i}: payload → {verified, refuted, unverified(𝕌)} 为全纯函数（非 LLM、可离线重算）；
//   决策 verdict Φ(D) 为结构性函数（非概率）：∃ refuted ⇒ untrusted；∀ 可判 verified 且无证伪 ⇒ trusted；否则 abstain。
//   信任是结构性的，不是 [0,1] 置信——避免"概率化可信"陷阱。
//   证书完整性：reportId = sha256(stableStringify(D ‖ ALGO_VERSION ‖ SEED)，同决策同内核 ⇒ 同 id，可离线重算防篡改。
function certifyDecisionLogic(args) {
  args = args || {};
  const claimed = Array.isArray(args.claimedProperties) ? args.claimedProperties : [];
  if (!claimed.length) return { ok: false, error: 'claimedProperties 需非空（智能体对其决策的声明；每项 {property, class, payload}）。灵脑只裁判、不替智能体生成决策。' };
  const decisionId = (typeof args.decisionId === 'string' && args.decisionId)
    ? args.decisionId
    : ('dec-' + crypto.createHash('sha256').update(_stableStringify({ action: args.action, context: args.context, claimed: claimed })).digest('hex').slice(0, 12));
  const perProp = claimed.slice(0, 200).map(function (it, idx) {
    it = it || {};
    const cls = it.class || String(it.kind || '');
    const pl = (it.payload && typeof it.payload === 'object') ? it.payload : {};
    let core;
    try {
      if (cls === 'consistency') core = _auditOneConsistency(pl);
      else if (cls === 'constraint') core = _auditOneConstraint(pl);
      else if (cls === 'numeric_safety') core = _auditOneNumericSafety(pl);
      else if (cls === 'path') core = _auditOnePath(pl);
      else if (cls === 'authorized') core = _auditOneAuthorized(pl);
      else if (cls === 'causal') core = _auditOneCausal(pl);
      else if (cls === 'conformal') core = _auditOneConformal(pl);
      else core = { verdict: 'unverified', U: true, reason: 'class="' + cls + '" 无对应确定性裁判能力 ⇒ 诚实弃权 𝕌（灵脑=推理-only：可裁判 class：consistency / constraint / numeric_safety / path / authorized / causal / conformal；方程求解/验真归灵数 lingshu-solver 独立产品）', engine: null };
    } catch (e) {
      core = { verdict: 'unverified', U: true, reason: '裁判异常 ⇒ fail-closed 弃权（异常已留痕）：' + (e && e.message), engine: null };
    }
    const certKind = core.certKind || (_KIND_CERTKIND[cls] || (cls === 'authorized' ? 'authorization' : null));
    const scope = core.scope || (_KIND_SCOPE[cls] || (cls === 'authorized' ? '动作效应类别是否被当前 M4 EffectGate 策略放行' : null));
    const limits = core.limitations || (_KIND_LIMITS[cls] || (cls === 'authorized' ? '仅判效应类别是否放行，不判业务层 RBAC/ABAC 语义；硬拒绝 PROCESS/EVAL 恒可判' : null));
    return {
      idx: idx,
      property: (typeof it.property === 'string' && it.property) ? it.property : ('prop-' + idx),
      class: cls,
      verdict: core.verdict, U: core.U === true, reason: core.reason,
      proofObject: { theorem: core.theorem || null, certKind: certKind, proof: core.proof || null, scope: scope, limitations: limits },
      evidence: core.evidence || null,
      riskBound: (typeof core.riskBound === 'number') ? core.riskBound : null,
      alpha: (typeof core.alpha === 'number') ? core.alpha : null,
    };
  });
  const c = function (v) { return perProp.filter(function (x) { return x.verdict === v; }).length; };
  const verified = c('verified'), refuted = c('refuted'), unverified = c('unverified');
  // conformal 风险界收集：若决策因 conformal 不可判而 abstain，其残留误信风险由 α 上限约束（把"无知弃权"升级为"量化风险界弃权"）
  const _conformalBounds = perProp.filter(function (x) { return x.class === 'conformal' && typeof x.riskBound === 'number'; }).map(function (x) { return x.riskBound; });
  const _maxRiskBound = _conformalBounds.length ? Math.max.apply(null, _conformalBounds) : null;
  // ── 结构性裁决 Φ(D)（LCF 式：verdict 只能由此内核构造）──
  // 运动员（智能体）经 claimedProperties 传入的声明**仅当 oracle**（Sledgehammer 重建类比）：
  // 本函数不采信声明，而是把每条声明重算过 V_c；V_c 无法重建（无内核函数 / 不可判定）则 𝕌，绝不 trusted。
  // ⚠️ 旁路硬化：'trusted' 在此处是**唯一**赋值点（已 audit 确认全仓仅此一处构造 trusted）；
  //   任何新增代码路径都不得绕过本 Φ 直接 emit 'trusted'（对应 Lean #14576 的 metaprogramming 绕过内核教训）。
  let verdict, meaning;
  const _riskNote = (_maxRiskBound != null) ? '；本决策含 conformal 裁判：若误信，残差误覆盖风险 ≤ α=' + _maxRiskBound + '（split conformal 边际界，非逐决策条件界）' : '';
  if (refuted > 0) { verdict = 'untrusted'; meaning = '决策含被确定性证伪的声明 ⇒ 不可采信（裁判职责：挡住错误决策）'; }
  else if (unverified > 0 && verified === 0) { verdict = 'abstain'; meaning = '无任何声明被证伪，但亦无可确定性验证的声明 ⇒ 无法判定，诚实弃权（不自欺）' + _riskNote; }
  else if (unverified > 0) { verdict = 'abstain'; meaning = '无声明被证伪，但存在不可确定性验证的声明 ⇒ 部分可信、部分弃权' + _riskNote; }
  else { verdict = 'trusted'; meaning = '所有声明均经确定性验证器确认 ⇒ 决策可信（裁判职责：放行可信任决策）'; }
  const ridInput = _stableStringify({ v: 1, algo: K.ALGO_VERSION, seed: K.SEED, decision: { action: args.action, context: args.context, claimed: claimed } });
  const ridFull = crypto.createHash('sha256').update(ridInput, 'utf8').digest('hex');
  return {
    ok: true,
    decisionId: decisionId,
    reportId: ridFull.slice(0, 16),
    reportIdFull: ridFull,
    action: (typeof args.action === 'string') ? args.action : null,
    context: args.context || null,
    decisionVerdict: verdict,
    decisionVerdictMeaning: meaning,
    summary: { total: perProp.length, verified: verified, refuted: refuted, unverified: unverified, claimedBy: '智能体（运动员：本内核不替其做主、不生成动作）', certifiedBy: '灵脑（裁判：仅判定、不提议）', abstainRiskBound: (verdict === 'abstain') ? _maxRiskBound : null },
    properties: perProp,
    certificateLayer: {
      kind: 'decision trust arbiter（智能体决策可信裁判层 / machine-checkable certificate layer）',
      proves: 'agent decisions (safe / correct / authorized) — NOT mathematical theorems',
      notA: '数学定理证明器（Coq / Lean / Isabelle）—— 它们从公理证明数学定理；灵脑证明的是智能体的具体决策，方程/区间/CBF 只是判定决策的底层手段',
      decisionClasses: {
        'constraint-feasibility': { theorem: 'THM_HELLY_R1 / THM_COMPACTNESS', via: 'constraint' },
        'safety-invariant': { theorem: 'THM_KRAWCZYK_CERTIFY / THM_BARRIER_NAGUMO_CBF', via: 'numeric_safety' },
        'optimal-path': { theorem: 'THM_ASTAR_OPTIMAL', via: 'path' },
        'authorization': { theorem: 'THM_COMPLETE_MEDIATION', via: 'authorized' },
        'causal-identifiability': { theorem: 'THM_CAUSAL_BACKDOOR / THM_CAUSAL_FRONTDOOR', via: 'causal' },
        'conformal-risk': { theorem: 'THM_CONFORMAL_COVERAGE', via: 'conformal' },
      },
      verdictSemantics: { trusted: '全部声明 verified', untrusted: '任一声明 refuted', abstain: '无 refuted 但存在 𝕌（不可确定性验证）' },
      failClosed: '不可确定性验证的声明一律诚实返回 𝕌；裁判与运动员职责分离（运动员不能同时是裁判）。',
    },
    reproducible: {
      algorithm: 'certify_decision v1',
      reportIdFormula: 'sha256( stableStringify({v:1, ALGO_VERSION, SEED, decision}) )',
      note: '同决策 + 同内核版本 ⇒ 同 reportId，可离线重算防篡改；决策证书可事后审计。',
    },
    refereeNote: '灵脑不当运动员：本证书只判定决策声明是否被确定性验证器支持，绝不替智能体生成/选择动作。',
  };
}

function callTool(name, args) {
  args = args || {};
  switch (name) {
    case 'world_info': return worldInfo();
    case 'set_world': return setWorldLogic(args);
    case 'perceive': return perceiveLogic(args.text, args.apiKey);
    case 'reason': return reasonLogic(args.start, args.goal, args.hard, args.soft, args.system1Only);
    case 'audit': return auditLogic(args.start, args.goal, args.hard, args.soft);
    case 'carrier_report': return carrierReportLogic(args.battery, args.goal, args.density);
    case 'learn': return learnLogic(args.path, args.success);
    case 'knowledge_query': return knowledgeQueryLogic(args.from, args.to);
    case 'knowledge_add': return knowledgeAddLogic(args.from, args.to, args.success, args.confidence, args.source, args.kind);
    case 'meta': return metaLogic(args.start, args.goal, args.hard, args.soft);
    case 'perceive_belief': return perceiveBeliefLogic(args.initial, args.observations, args.kernel);
    case 'knowledge_ann': return annLogic(args.query, args.k);
    case 'knowledge_distill': return distillLogic(args.minSupport);
    case 'cog_graph': return cogGraphLogic();
    case 'symbolic_verify': return symbolicVerifyLogic(args.start, args.goal, args.hard, args.soft);
    // 灵脑=推理-only：algebraic_solve 已移除（计算归灵数 lingshu-solver 独立产品）
    case 'dmcts': return dmctsLogic(args.start, args.goal, args.hard, args.soft);
    case 'goal_directed': return goalDirectedLogic(args.start, args.goal, args);
    case 'pac_bound': return pacLogic(args.dVC, args.epsilon, args.delta);
    case 'ask': return askBrainLogic(args.text, args.apiKey, { hard: args.hard, soft: args.soft });
    case 'explain': return explainLogic(args.result, args.apiKey, {});
    case 'causal': return causalLogic();
    case 'event_publish': return eventPublishLogic(args.type, args.payload);
    case 'knowledge_fabric': return fabricLogic(args.action, args.msg, args.versions);
    case 'runtime_monitor': return runtimeMonitorLogic(args.start, args.goal, args.safety);
    case 'continuous_verify': return continuousVerifyLogic();
    case 'ima_load': return imaLoadLogic(args.path ? { path: args.path } : (args.entries ? args.entries : {}));
    case 'ima_query': return imaQueryLogic(args.keyword, args.k);
    case 'sl_record': return slRecordLogic(args);
    case 'sl_discover': return slDiscoverLogic(args);
    case 'sl_validate': return slValidateLogic(args.hid, args.outcome, args);
    case 'sl_monitor': return slMonitorLogic(args.kid, args.reason);
    case 'sl_status': return slStatusLogic();
    // ---------- 具身层（Embodied AI）分发 ----------
    case 'attach_body': return attachBodyLogic(args);
    case 'capabilities': return capabilitiesLogic();
    case 'get_state': return getStateLogic();
    case 'set_state': return setStateLogic(args.state);
    case 'state_diff': return stateDiffLogic(args.a, args.b);
    case 'check_hard': return checkHardLogic(args.state, args.step);
    case 'h_max': return hMaxLogic(args.state, args.goalSpec, args.maxLayer);
    case 'plan_task': return planTaskLogic(args.goalSpec, { maxLayer: args.maxLayer, maxExpansions: args.maxExpansions });
    case 'execute_task': return executeLogic(args.goalSpec, { maxReplans: args.maxReplans, deviationTolerance: args.deviationTolerance, allowIrreversible: args.allowIrreversible === true }, args.faults);
    case 'positioning': return { positioning: K.POSITIONING, body: K.getBody() };
    case 'world_model': return worldModelLogic(args.samples, args.state, args.action);
    case 'counterfactual': return counterfactualLogic(args.samples, args.factual, args.intervention);
    case 'causal_effect': return causalEffectLogic(args.samples, args.cause, args.effect, args.mediator);
    // ── Layer 2 确定性安全陷阱层 + CLF-CBF 统一 QP（2026-09-02）──
    case 'bertrand_trap': return bertrandTrapLogic(args.N);
    case 'compactness_trap': return compactnessTrapLogic(args.constraints);
    case 'van_der_waerden_trap': return vanDerWaerdenTrapLogic(args.seq, args.k);
    case 'baire_trap': return baireTrapLogic(args.observations, args.normalRadius, args.threshold);
    case 'variety_trap': return varietyTrapLogic(args.samples, args.eps, args.adjacency);
    case 'cauchy_lipschitz_trap': return cauchyLipschitzTrapLogic(args.x0, args.L, args.horizon);
    case 'run_deterministic_traps': return runDeterministicTrapsLogic(args);
    case 'clf_cbf_unified': return clfCbfUnifiedLogic(args);
    case 'model_free_cbf': return modelFreeCbfLogic(args);
    case 'counterfactual_audit': return counterfactualAuditLogic(args);
    case 'safety_audit': return safetyAuditLogic(args);
    // ── 形式化证明模块 M1..M4 ──
    case 'prove_gate_chain': return proveGateChainLogic(args);
    case 'certify_safety_invariant': return certifySafetyInvariantLogic(args);
    case 'verdict_three_layer': return verdictThreeLayerLogic(args);
    case 'prove_complete_mediation': return proveCompleteMediationLogic(args);
    case 'effect_gate_report': return effectGateReportLogic(args);
    // ── 合规证据批审（AI Agent 审计场景）──
    case 'audit_evidence': return auditEvidenceLogic(args);
    case 'certify_decision': return certifyDecisionLogic(args);
    default: throw new Error('未知工具：' + name);
  }
}

// ---------- 4. stdio 字节级分帧（JSON-RPC 2.0） ----------
let buf = Buffer.alloc(0);
// 输出帧格式**镜像**客户端的输入格式：客户端发 NDJSON 就回 NDJSON，
// 客户端发 Content-Length 就回 Content-Length。默认 NDJSON（MCP 现行规范）。
let useContentLength = false;
function send(obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  if (useContentLength) {
    process.stdout.write(Buffer.concat([Buffer.from('Content-Length: ' + body.length + '\r\n\r\n'), body]));
  } else {
    process.stdout.write(Buffer.concat([body, Buffer.from('\n', 'utf8')]));
  }
}
function handle(msg) {
  if (!msg || msg.jsonrpc !== '2.0' || msg.id === undefined) return;
  const { id, method, params } = msg;
  try {
    if (method === 'initialize') {
      send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'lingnao', version: '1.4.0' } } });
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: [GATEWAY] } });
    } else if (method === 'tools/call') {
      const p = params || {};
      let name = p.name, a = (p.arguments || {});
      if (name === GATEWAY.name) {
        // 唯一入口：{ op: 能力名, args: 参数 }
        const inner = a || {};
        name = inner.op;
        a = inner.args || {};
        if (!name || !TOOLS.some(t => t.name === name)) {
          send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ error: '未知能力 op=' + String(name), hint: 'op 必须是能力索引中的键名', validOps: TOOLS.map(t => t.name) }, null, 2) }], isError: true } });
          return;
        }
      } else {
        // 62 个旧工具名已从对外列表删除（2026-09-24 单一入口拍板）：按旧名直调给出明确指引
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ error: '工具 "' + String(name) + '" 已并入唯一入口 lingnao', hint: '请改为调用 name="lingnao"，arguments={"op":"' + String(name) + '","args":{…原参数…}}', validOps: TOOLS.map(t => t.name) }, null, 2) }], isError: true } });
        return;
      }
      const out = callTool(name, a);
      if (out && typeof out.then === 'function') {
        out.then(res => send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] } }))
            .catch(e => send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ error: e.message }), isError: true }] } }));
      } else {
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] } });
      }
    } else {
      send({ jsonrpc: '2.0', id, error: { code: -32601, message: '方法不存在：' + method } });
    }
  } catch (e) {
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ error: e.message }), isError: true }] } });
  }
}
function pump() {
  // ── ① 换行分隔 JSON（NDJSON）：MCP stdio 现行规范 ────────────────
  // 此前只实现了 Content-Length 分帧，而 Claude Desktop / Cursor / Cline 等
  // 现代 MCP 客户端一律发送 NDJSON（每行一个 JSON）。旧实现找不到 \r\n\r\n，
  // 循环一次都不进 ⇒ 客户端收不到任何响应，表现为"连上了但永远无回音"。
  // 这是传输层缺陷，且 --selftest 直接调内核函数、绕开传输层，所以测不出来。
  let nl;
  while ((nl = buf.indexOf(0x0A)) !== -1) {
    const line = buf.slice(0, nl).toString('utf8').trim();
    if (line === '') { buf = buf.slice(nl + 1); continue; }
    if (/^Content-Length:/i.test(line)) { useContentLength = true; break; }  // 交给 ② 分帧逻辑
    let msg = null;
    try { msg = JSON.parse(line); }
    catch (e) {
      // 美化过的多行 JSON：以 { 或 [ 开头说明还没收完，等更多数据
      if (/^[{[]/.test(line)) return;
      buf = buf.slice(nl + 1);                          // 非 JSON 噪声行，丢弃
      continue;
    }
    buf = buf.slice(nl + 1);
    handle(msg);
  }
  // ── ② Content-Length 分帧（旧客户端 / LSP 风格，保留兼容）────────
  const SEP = Buffer.from('\r\n\r\n');
  let i;
  while ((i = buf.indexOf(SEP)) !== -1) {
    const header = buf.slice(0, i).toString('utf8');
    const m = /Content-Length:\s*(\d+)/i.exec(header);
    if (!m) { buf = buf.slice(i + 4); continue; }
    const len = +m[1], start = i + 4;
    if (buf.length < start + len) return;
    let msg;
    try { msg = JSON.parse(buf.slice(start, start + len).toString('utf8')); }
    catch (e) { buf = buf.slice(start + len); continue; }
    buf = buf.slice(start + len);
    handle(msg);
  }
}

// ---------- 5. 自测（无临时文件，直接验证全部工具） ----------
function mockFetchOpenRouter() {
  // 仅用于自测：模拟 OpenRouter 返回，验证 perceiveLLM 的 JSON 解析链路。
  // 内核 _llmChat 用 r.text（字符串）做 JSON.parse，故 text 必须返回 JSON 字符串（同时保留 json 以兼容）。
  const _body = JSON.stringify({ choices: [{ message: { content: '{"goal":"C","battery":80,"density":{"A":8},"entities":["灭蚊器"],"confidence":0.9}' } }] });
  return Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve(JSON.parse(_body)),
    text: () => Promise.resolve(_body),
  });
}
function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function selftest() {
  const ok = [];
  const bad = [];
  // degraded：因**可选依赖缺失**而诚实降级的项。这不是内核缺陷，
  // 绝不能让它污染整条自测——否则用户全新安装（未装可选依赖）就会看到 FAIL。
  const degraded = [];
  // unimpl：诚实标注的「已知未实现能力」。这些 MCP 工具在 KB 未接入时恒返 available:false，
  // 属能力缺口而非内核缺陷；旧版把它们断言为"通过"混入绿色（假绿），既不诚实也不准确。
  // 这里单独披露：契约成立（如实返 available:false）→ 进 unimpl；契约破坏（谎称可用/抛错）→ 进 bad（真缺陷）。
  const unimpl = [];
  const T = (name, cond, extra) => (cond ? ok : bad).push(name + (extra ? ' :: ' + extra : ''));
  // 已知未实现能力的诚实标注：先校验"降级契约"（KB 未接入须如实返 available:false），
  // 契约破坏=真实缺陷→进 bad；契约成立=已知未实现→进 unimpl（不计入绿色通过，消除假绿）。
  const noteUnimpl = (name, res) => {
    if (res && res.available === false && /未暴露/.test(res.reason || '')) {
      unimpl.push(name + ' :: 知识库 KB 未接入，恒返 available:false（已知未实现能力，不计入绿色通过）');
    } else {
      bad.push(name + ' :: KB 降级契约被破坏（应恒返 available:false，实得 ' + JSON.stringify(res) + '）');
    }
  };
  try {
    T('world_info', worldInfo().nodes.length === 4);
    const led = K.MathKernel.verifyLedger();
    T('proof_ledger', led.ok === true, led.verdict);
    // 架构脊柱②：信任防火墙——PERCEPTION 被拦、KERNEL 放行；liftToBelief 产出信念
    T('firewall_reject', (function () { try { K.firewallCheck({ mayHallucinate: true }, 'st'); return false; } catch (e) { return /FIREWALL/.test(e.message); } })());
    T('firewall_allow', K.firewallCheck({ kind: 'graph-edge' }, 'st') === true);
    T('lift_belief', !!(K.liftToBelief && K.liftToBelief({ value: 1, source: 'x' }, {}).kind === 'belief'));
    // 架构次轴④：数学思想索引可发现
    T('thinking_index', !!(K.LingNaoThinking && K.LingNaoThinking.ignorance && K.LingNaoThinking.ignorance.theorems.length > 0));
    // 架构脊柱②逐点 enforcement：确定性规划入口扫描 PERCEPTION 感知边 → 污染即登记
    T('firewall_scan_graph', (function () {
      const c1 = K.FIREWALL.scanGraph([{ from: 'A', to: 'B', w: 1 }, { from: 'B', to: 'C', w: 1, perceived: true }]).contaminated === true;
      const c0 = K.FIREWALL.scanGraph([{ from: 'A', to: 'B', w: 1 }]).contaminated === false;
      return c1 && c0;
    })());
    T('goal_directed_firewall', (function () {
      setWorldLogic({ nodes: ['G1', 'G2', 'G3'], edges: [{ from: 'G1', to: 'G2', w: 1, perceived: true }, { from: 'G2', to: 'G3', w: 1 }], coord: { G1: [0, 0], G2: [1, 0], G3: [2, 0] } });
      const g = K.goalDirected('G1', 'G3', {});
      const clean = g && g.perceptionContaminated === true && g.grounding && g.grounding.tier === 'UNVERIFIED_LLM';
      setWorldLogic({ nodes: ['G1', 'G2', 'G3'], edges: [{ from: 'G1', to: 'G2', w: 1 }, { from: 'G2', to: 'G3', w: 1 }], coord: { G1: [0, 0], G2: [1, 0], G3: [2, 0] } });
      const g2 = K.goalDirected('G1', 'G3', {});
      // 自清理：还原默认 CHARGE 世界，避免污染后续 reason-optimal 等断言
      K.setWorld({ nodes: ['CHARGE', 'A', 'B', 'C'], edges: K.__defaultEdges || [] });
      return clean && g2.grounding && g2.grounding.tier === 'DETERMINISTIC' && g2.perceptionContaminated === false;
    })());
    const r1 = reasonLogic('CHARGE', 'C', [], []);
    T('reason-optimal', r1.status === 'optimal' && r1.path[0] === 'CHARGE' && r1.path[r1.path.length - 1] === 'C' && Math.abs(r1.cost - 7.242641) < 1e-3, 'cost=' + r1.cost);
    T('reason-system2-rsg', r1.usedSystem === '2' && r1.rsg && r1.rsg.branchCount > 0, 'rsg=' + JSON.stringify(r1.rsg));
    const r2 = reasonLogic('CHARGE', 'C', ['A'], []);
    T('reason-hard', r2.status === 'optimal' && !r2.path.includes('A'), 'path=' + (r2.path || []).join(','));
    const r3 = reasonLogic('CHARGE', 'Z', [], []);
    T('reason-unknown', r3.status === 'unknown' && r3.U, 'U=' + JSON.stringify(r3.U));
    const sw = setWorldLogic({ nodes: ['S', 'T'], edges: [{ from: 'S', to: 'T', w: 1, p: 1 }], coord: { S: [0, 0], T: [1, 0] } });
    T('set_world', sw.nodes.length === 2 && sw.edgeCount === 1, 'nodes=' + sw.nodes.length);
    const r4 = reasonLogic('S', 'T', [], []);
    T('reason-custom', r4.status === 'optimal' && r4.cost === 1 && r4.path.join('') === 'ST', 'path=' + (r4.path || []).join(''));
    const cr = carrierReportLogic(10, 'A', {});
    T('carrier-hard', cr && typeof cr.battery === 'number' && Array.isArray(cr.hard) && cr.hard.length === 0, 'hard=' + JSON.stringify(cr.hard) + ' battery=' + cr.battery);
    const lr = learnLogic(['S', 'T'], true);
    T('learn', lr.updated.length === 1 && lr.updated[0].confidence > 0.9, 'conf=' + lr.updated[0].confidence);
    noteUnimpl('kb-summary', lr.knowledgeBase);
    const au = auditLogic('S', 'T', [], []);
    T('audit-7sec', au.summary && au.details && au.evidence && au.constraints && 'unknown' in au && au.proof && au.reproducible && au.uncertainty, 'status=' + au.status);
    T('audit-proof', au.proof.verified === true && typeof au.proof.hoare === 'string' && au.proof.hoare.length > 0, 'hoare=' + au.proof.hoare);
    const q = knowledgeQueryLogic('S', 'T');
    noteUnimpl('knowledge_query', q);
    const a = knowledgeAddLogic('X', 'Y', true, 0.7, 'selftest', 'boundary');
    noteUnimpl('knowledge_add', a);
    const mt = metaLogic('CHARGE', 'C', [], []);
    T('meta-layer5', mt.layer === 5 && typeof mt.uncertainty.entropyH === 'number' && mt.uncertainty.consistencyC >= 0 && Array.isArray(mt.knowledgeGaps) && /explore|exploit/.test(mt.decision.exploreExploit), 'mode=' + mt.decision.exploreExploit + ' C=' + mt.uncertainty.consistencyC);
    // 还原默认灭蚊器世界（set_world 测试改了 WORLD），供后续依赖 CHARGE/A/B/C 的断言
    K.setWorld({ nodes: ['CHARGE', 'A', 'B', 'C'], edges: K.__defaultEdges || [] });
    // ---- v3.0 扩层模块自测 ----
    const pb = perceiveBeliefLogic({ CHARGE: 0.5, A: 0.5 }, { likelihood: { CHARGE: 0.6, A: 0.9 } });
    T('perceive-banach', pb && typeof pb.converged === 'boolean' && typeof pb.contractionL === 'number', 'L=' + pb.contractionL + ' conv=' + pb.converged);
    const ann = annLogic('{"from":"CHARGE","to":"A"}', 3);
    noteUnimpl('knowledge-ann', ann);
    const distill = distillLogic(0.3);
    noteUnimpl('knowledge-distill', distill);
    const cg = cogGraphLogic();
    noteUnimpl('cog-graph', cg);
    const sv = symbolicVerifyLogic('CHARGE', 'C', [], []);
    T('symbolic-verify', sv && sv.verified === true && sv.tool === 'lingnao-hoare-lite', 'steps=' + (sv.steps && sv.steps.length));
    // 灵脑=推理-only（2026-10-07）：algebraic-solve 自测项已移除（计算归灵数 lingshu-solver 独立产品）。
    const dm = dmctsLogic('CHARGE', 'C', [], []);
    T('dmcts', dm && dm.status === 'found' && dm.best && dm.best.path[dm.best.path.length - 1] === 'C' && dm.best.cost <= 3, 'best=' + (dm.best && dm.best.path.join('>')) + ' cost=' + (dm.best && dm.best.cost));
    T('dmcts-ima', dm && dm.note && /ima_292|ima_285/.test(dm.note), 'note=' + (dm && dm.note));
    // 目标导向决策（真消费 ima_286/288/289/291）：默认灭蚊器世界从 CHARGE 到 C 应可达并返回到达概率
    const gd = goalDirectedLogic('CHARGE', 'C', {});
    T('goal-directed', gd && gd.status === 'found' && gd.path[0] === 'CHARGE' && gd.path[gd.path.length - 1] === 'C' && typeof gd.goalProb === 'number' && gd.goalProb > 0 && Array.isArray(gd.imaRef) && gd.imaRef.length >= 3, 'prob=' + (gd && gd.goalProb) + ' path=' + (gd && gd.path.join('>')) + ' ref=' + (gd && gd.imaRef.join(',')));
    // 真贝叶斯可靠度更新（真消费 ima_302/ima_225）：Beta-二项共轭，成功→α+1。注入先验 R=0.6(α=1.2,β=0.8)，连续两次成功
    K.SelfLearn.hypotheses['HX'] = { hid: 'HX', reliability: 0.6, alpha: 1.2, beta: 0.8, validated: 0, history: [], imaRef: [], state: 'hypothesis' };
    const b1 = slValidateLogic('HX', 'success');
    const exp1 = +((1.2 + 1) / (1.2 + 1 + 0.8)).toFixed(3); // α=2.2,β=0.8 → 0.733
    const hxRef = (K.SelfLearn.hypotheses['HX'] && K.SelfLearn.hypotheses['HX'].imaRef) || [];
    T('bayes-validate', Math.abs(b1.reliability - exp1) < 1e-9 && hxRef.indexOf('ima_225') >= 0, 'bayes=' + b1.reliability + ' exp=' + exp1 + ' ref=' + hxRef.join(','));
    const b2 = slValidateLogic('HX', 'success');
    const exp2 = +((1.2 + 2) / (1.2 + 2 + 0.8)).toFixed(3); // α=3.2,β=0.8 → 0.800
    T('bayes-validate2', Math.abs(b2.reliability - exp2) < 1e-9, 'bayes=' + b2.reliability + ' exp=' + exp2);
    const pac = pacLogic(10, 0.1, 0.1);
    T('pac-bound', pac && pac.m > 0 && typeof pac.formula === 'string', 'm=' + pac.m);
    const causal = causalLogic();
    T('causal-discovery', causal.discovery && Array.isArray(causal.discovery.nodes) && causal.discovery.nodes.indexOf('CHARGE') >= 0, 'nodes=' + causal.discovery.nodes.length);
    // 世界模型 lite：学 y=2x+a 的 SEM，前向 simulate 验证，反事实三步法验证
    const wmSamples = [
      { state: { x: 1 }, action: { a: 0 }, next: { y: 2 } },
      { state: { x: 2 }, action: { a: 1 }, next: { y: 5 } },
      { state: { x: 3 }, action: { a: 0 }, next: { y: 6 } },
      { state: { x: 4 }, action: { a: 2 }, next: { y: 10 } }
    ];
    const wm = worldModelLogic(wmSamples);
    const wmSim = K.simulate(wm.model, { x: 5 }, { a: 1 });
    T('world-model', wm && wm.model && wm.model.method && wmSim.next.y === 11, 'sim.y=' + (wmSim.next && wmSim.next.y));
    const cf = counterfactualLogic(wmSamples, { state: { x: 3 }, action: { a: 0 }, next: { y: 6 } }, { var: 'a', value: 5 });
    T('counterfactual', cf && cf.counterfactual && Math.abs(cf.counterfactual.y - 11) < 1e-6, 'cf.y=' + (cf.counterfactual && cf.counterfactual.y));
    // 因果效应估计（do-演算后门调整，真消费 ima_304/ima_301）：wmSamples 中 y=2x+a，ACE(a→y) 应=1，后门集=[x]
    const ce = causalEffectLogic(wmSamples, 'a', 'y');
    T('causal-effect', ce && typeof ce.ace === 'number' && Math.abs(ce.ace - 1) < 1e-6 && Array.isArray(ce.adjustSet) && ce.adjustSet.indexOf('x') >= 0, 'ace=' + (ce && ce.ace) + ' set=' + (ce && ce.adjustSet) + ' ref=' + (ce && ce.imaRef));
    // 前门准则（do-calculus，吸收 Pearl 1995 / Wienöbst-Jeong 识别算法）：合成前门 DAG X→M→Y，未观测混杂 U→X,U→Y；
    // 后门失效，但前门两段式 ACE=α·β 仍可从观测数据识别真值 0.25（α=0.5 来自 M=0.5X，β=0.5 来自 Y=0.5M+0.8U）
    const fdSamples = (function () { const r = mulberry32(20260827); const out = []; for (let i = 0; i < 4000; i++) { const U = r() < 0.5 ? 1 : 0; const X = r() < (0.3 + 0.5 * U) ? 1 : 0; const M = 0.5 * X + (r() - 0.5) * 0.2; const Y = 0.5 * M + 0.8 * U + (r() - 0.5) * 0.2; out.push({ state: { X, M }, next: { Y } }); } return out; })();
    const fd = causalEffectLogic(fdSamples, 'X', 'Y', 'M');
    T('causal-effect-frontdoor', fd && /front-door/.test(fd.method) && typeof fd.ace === 'number' && Math.abs(fd.ace - 0.25) < 0.05 && fd.handlesUnobservedConfounder === true,
      'ace=' + (fd && fd.ace) + ' α=' + (fd && fd.alpha) + ' β=' + (fd && fd.beta));
    const ev = eventPublishLogic('reason', { status: 'optimal' });
    T('event-bus', ev && ev.delivered >= 1, 'delivered=' + ev.delivered);
    const fc1 = fabricLogic('commit', 'selftest'); const fc2 = fabricLogic('list');
    T('knowledge-fabric', fc1 && fc1.version >= 1 && Array.isArray(fc2) && fc2.length >= 1, 'versions=' + fc2.length);
    const rm = runtimeMonitorLogic('CHARGE', 'C', {});
    T('runtime-monitor', rm && rm.safe === true && rm.action === 'continue', 'action=' + rm.action);
    const cv = continuousVerifyLogic();
    T('continuous-verify', cv && cv.all === true && Array.isArray(cv.checks), 'checks=' + cv.checks.length);
    // 合规证据批审（audit_evidence，2026-09-24）：三分口径 verified/refuted/unverified + reportId 确定性可复现
    const _aeBase = { items: [
      { id: 'AE-1', kind: 'constraint', text: '声明两个区间约束可同时满足', constraints: [{ id: 'a', interval: [0, 1] }, { id: 'b', interval: [0.5, 2] }] },
      { id: 'AE-2', kind: 'constraint', text: '预算与报价可同时满足', constraints: [{ id: 'a', interval: [800, 1000] }, { id: 'b', interval: [1200, 1500] }] },
      { id: 'AE-3', kind: 'free_text', text: '自称市场上最好的选择' },
    ] };
    const ae1 = auditEvidenceLogic(_aeBase);
    T('audit-evidence', ae1.ok === true && ae1.items.length === 3
      && ae1.items[0].verdict === 'verified' && ae1.items[1].verdict === 'refuted' && ae1.items[2].verdict === 'unverified' && ae1.items[2].U === true
      && typeof ae1.reportIdFull === 'string' && ae1.reportIdFull.length === 64 && ae1.aiucReference && !!ae1.aiucReference.disclaimer,
      'v=' + ae1.summary.verified + '/r=' + ae1.summary.refuted + '/u=' + ae1.summary.unverified + ' rid=' + ae1.reportId);
    const ae2 = auditEvidenceLogic(JSON.parse(JSON.stringify(_aeBase)));
    T('audit-evidence-reproducible', ae2.reportIdFull === ae1.reportIdFull, 'rid=' + ae2.reportId);
    // 灵脑=推理-only（2026-10-07）：audit-evidence 的 algebraic 路径已移除（计算归灵数 lingshu-solver 独立产品）。
    // 灵脑=推理-only（2026-10-07）：M2 的 Krawczyk 数值认证需计算引擎（灵数），灵脑不接入、不委派
    // ⇒ 对数值安全不变式诚实降级 𝕌（不假装求解/认证）。下面两条锁住"推理-only 下 M2 必须诚实降级而非谎称 verified/refuted"。
    const _nsUnsafe = _auditOneNumericSafety({ hExpr: '1 - (x^2 + y^2)', vars: ['x', 'y'], domain: { x: [-1, 1], y: [-1, 1] } });
    T('numeric-safety-reasoning-only-degrade', _nsUnsafe.verdict === 'unverified' && _nsUnsafe.U === true && /诚实降级/.test(_nsUnsafe.reason || ''),
      'verdict=' + _nsUnsafe.verdict + ' :: ' + (_nsUnsafe.reason || '').slice(0, 90));
    const _nsSafe = _auditOneNumericSafety({ hExpr: '1 - (x^2 + y^2)', vars: ['x', 'y'], domain: { x: [-0.5, 0.5], y: [-0.5, 0.5] } });
    T('numeric-safety-reasoning-only-degrade-safe', _nsSafe.verdict === 'unverified' && _nsSafe.U === true && /诚实降级/.test(_nsSafe.reason || ''),
      'verdict=' + _nsSafe.verdict + ' :: ' + String(_nsSafe.reason || '').slice(0, 60));
    // 抗 overclaim 硬锁：若 M2 返回"违反"但候选反例是假的（代入 h≥0），灵脑必须独立核验后诚实降级 𝕌，而非盲信 candidate
    const _origCSI = K.certifySafetyInvariant;
    K.certifySafetyInvariant = function () { return { verdict: 'violated', counterexample: { x: 0, y: 0 }, tier: 'candidate-counterexample', residual: 0 }; };
    const _nsPlanted = _auditOneNumericSafety({ hExpr: '1 - (x^2 + y^2)', vars: ['x', 'y'], domain: { x: [-1, 1], y: [-1, 1] } });
    K.certifySafetyInvariant = _origCSI;
    T('numeric-safety-independent-verify', _nsPlanted.verdict === 'unverified' && _nsPlanted.U === true,
      'verdict=' + _nsPlanted.verdict + ' :: ' + _nsPlanted.reason.slice(0, 90));
    // 决策可信裁判（certify_decision，2026-09-24 产品定位"证明决策"）：运动员提议、裁判判定，结构性 verdict + 防篡改 reportId
    const _cdTrustedArgs = { action: '去 C 区', context: { node: 'CHARGE' }, claimedProperties: [
      { property: '两区间约束可同时满足', class: 'constraint', payload: { constraints: [{ id: 'a', interval: [0, 1] }, { id: 'b', interval: [0.5, 2] }] } },
    ] };
    const _cdT = certifyDecisionLogic(_cdTrustedArgs);
    T('certify-decision-trusted', _cdT.ok === true && _cdT.decisionVerdict === 'trusted' && _cdT.properties[0].verdict === 'verified', 'verdict=' + _cdT.decisionVerdict + ' rid=' + _cdT.reportId);
    const _cdU = certifyDecisionLogic({ action: '报价自洽', claimedProperties: [
      { property: '预算与报价可同时满足', class: 'constraint', payload: { constraints: [{ id: 'a', interval: [800, 1000] }, { id: 'b', interval: [1200, 1500] }] } },
    ] });
    T('certify-decision-untrusted', _cdU.ok === true && _cdU.decisionVerdict === 'untrusted' && _cdU.properties[0].verdict === 'refuted', 'verdict=' + _cdU.decisionVerdict);
    const _cdA = certifyDecisionLogic({ action: '自称最好', claimedProperties: [
      { property: '自称市场上最好的选择', class: 'free_text', payload: {} },
    ] });
    T('certify-decision-abstain', _cdA.ok === true && _cdA.decisionVerdict === 'abstain' && _cdA.properties[0].verdict === 'unverified' && _cdA.properties[0].U === true, 'verdict=' + _cdA.decisionVerdict);
    const _cdR2 = certifyDecisionLogic(JSON.parse(JSON.stringify(_cdTrustedArgs)));
    T('certify-decision-reproducible', _cdR2.reportIdFull === _cdT.reportIdFull && _cdR2.decisionId === _cdT.decisionId, 'rid=' + _cdR2.reportId);
    if (K.EffectGate) {
      const _cdAuth = certifyDecisionLogic({ action: '跑流程', claimedProperties: [
        { property: '该副作用被授权', class: 'authorized', payload: { effectKind: 'PROCESS' } },
      ] });
      T('certify-decision-authorized', _cdAuth.ok === true && _cdAuth.properties[0].verdict === 'refuted' && _cdAuth.decisionVerdict === 'untrusted', 'auth=' + _cdAuth.properties[0].verdict + ' verdict=' + _cdAuth.decisionVerdict);
    } else {
      degraded.push('certify-decision-authorized :: 内核未导出 M4 EffectGate，authorized 类诚实降级为 𝕌（非内核缺陷）');
    }
    // 因果可识别性裁判（do-calculus，#383）：后门 / 前门 / 不可识别 三态
    const _cdCausalBD = certifyDecisionLogic({ action: '对 X 干预以提升 Y', claimedProperties: [
      { property: 'X→Y 的因果效应可由后门准则识别', class: 'causal', payload: { treatment: 'X', outcome: 'Y', graph: { nodes: ['X', 'Y', 'Z'], edges: [['Z', 'X'], ['Z', 'Y'], ['X', 'Y']] }, adjustmentSet: ['Z'] } },
    ] });
    T('certify-decision-causal-backdoor', _cdCausalBD.ok === true && _cdCausalBD.properties[0].verdict === 'verified' && _cdCausalBD.properties[0].evidence && _cdCausalBD.properties[0].evidence.criterion === 'back-door' && _cdCausalBD.decisionVerdict === 'trusted',
      'verdict=' + _cdCausalBD.properties[0].verdict + ' Z=' + (_cdCausalBD.properties[0].evidence && JSON.stringify(_cdCausalBD.properties[0].evidence.adjustmentSet)) + ' dec=' + _cdCausalBD.decisionVerdict);
    const _cdCausalFD = certifyDecisionLogic({ action: '对 X 干预以提升 Y', claimedProperties: [
      { property: 'X→Y 的因果效应可由前门准则识别（存在未测混杂 U）', class: 'causal', payload: { treatment: 'X', outcome: 'Y', graph: { nodes: ['X', 'M', 'Y', 'U'], edges: [['X', 'M'], ['M', 'Y'], ['U', 'X'], ['U', 'Y']], unobserved: ['U'] }, mediator: 'M' } },
    ] });
    T('certify-decision-causal-frontdoor', _cdCausalFD.ok === true && _cdCausalFD.properties[0].verdict === 'verified' && _cdCausalFD.properties[0].evidence && _cdCausalFD.properties[0].evidence.criterion === 'front-door',
      'verdict=' + _cdCausalFD.properties[0].verdict + ' med=' + (_cdCausalFD.properties[0].evidence && JSON.stringify(_cdCausalFD.properties[0].evidence.mediator)));
    const _cdCausalUN = certifyDecisionLogic({ action: '对 X 干预以提升 Y', claimedProperties: [
      { property: 'X→Y 的因果效应可识别', class: 'causal', payload: { treatment: 'X', outcome: 'Y', graph: { nodes: ['X', 'Y', 'U'], edges: [['U', 'X'], ['U', 'Y'], ['X', 'Y']], unobserved: ['U'] } } },
    ] });
    T('certify-decision-causal-unident', _cdCausalUN.ok === true && _cdCausalUN.properties[0].verdict === 'unverified' && _cdCausalUN.properties[0].U === true && _cdCausalUN.decisionVerdict === 'abstain',
      'verdict=' + _cdCausalUN.properties[0].verdict + ' dec=' + _cdCausalUN.decisionVerdict);
    // conformal 风险界裁判（#384）：边际覆盖 verified / 逐点过度声明 refuted / 量化风险界弃权
    const _scores = [0.1, 0.2, 0.15, 0.3, 0.05, 0.25, 0.4, 0.35, 0.12, 0.22, 0.18, 0.28, 0.08, 0.33, 0.45, 0.5, 0.6, 0.7, 0.09, 0.27];
    const _cdConfM = certifyDecisionLogic({ action: '发布风险受限预测', claimedProperties: [
      { property: '该预测的边际误覆盖 ≤ 0.1', class: 'conformal', payload: { calibrationScores: _scores, alpha: 0.1, claim: 'marginal-risk-bound' } },
    ] });
    T('certify-decision-conformal-marginal', _cdConfM.ok === true && _cdConfM.properties[0].verdict === 'verified' && _cdConfM.properties[0].riskBound === 0.1 && _cdConfM.decisionVerdict === 'trusted',
      'verdict=' + _cdConfM.properties[0].verdict + ' α=' + _cdConfM.properties[0].riskBound + ' qhat=' + _cdConfM.properties[0].alpha);
    const _cdConfP = certifyDecisionLogic({ action: '发布逐决策安全声明', claimedProperties: [
      { property: '这一具体决策以 ≥0.9 概率安全', class: 'conformal', payload: { calibrationScores: _scores, alpha: 0.1, claim: 'per-decision-safe' } },
    ] });
    T('certify-decision-conformal-pointwise', _cdConfP.ok === true && _cdConfP.properties[0].verdict === 'refuted' && _cdConfP.decisionVerdict === 'untrusted',
      'verdict=' + _cdConfP.properties[0].verdict + ' dec=' + _cdConfP.decisionVerdict);
    const _cdConfA = certifyDecisionLogic({ action: '发布未知 claim 的 conformal 预测', claimedProperties: [
      { property: 'conformal 风险声明（claim 类型未知）', class: 'conformal', payload: { calibrationScores: _scores, alpha: 0.1, claim: 'unknown' } },
    ] });
    T('certify-decision-conformal-abstain', _cdConfA.ok === true && _cdConfA.properties[0].verdict === 'unverified' && _cdConfA.decisionVerdict === 'abstain' && _cdConfA.summary.abstainRiskBound === 0.1,
      'verdict=' + _cdConfA.properties[0].verdict + ' dec=' + _cdConfA.decisionVerdict + ' riskBound=' + _cdConfA.summary.abstainRiskBound);
    // perceive（mock fetch 验证解析链路）
    sandbox.fetch = mockFetchOpenRouter;
    return perceiveLogic('电量80目标C区A蚊子多', 'fake-key').then(async pr => {
      T('perceive-llm', pr.ok && pr.percept && pr.percept.goal === 'C', 'percept=' + JSON.stringify(pr.percept));
      // 端到端 ask：免费 LLM 理解大白话 → 灵脑推理 → 免费 LLM 解释（grounding IMA），mock fetch 验证链路
      const ab = await askBrainLogic('从充电座出发去 C 点，电量充足', 'fake-key');
      T('ask-brain', ab && ab.ok === true && ab.explanation && ab.explanation.ok === true && typeof ab.explanation.text === 'string' && ab.explanation.text.length > 0 && ab.reason && typeof ab.reason.status === 'string', 'goal=' + (ab.goal) + ' status=' + (ab.reason && ab.reason.status) + ' exp.len=' + (ab.explanation && ab.explanation.text ? ab.explanation.text.length : 0));
      // 不幻觉置信分层（核心保证）：groundingMeta 三档；askBrain 须标感知可能幻觉、reason 为确定性
      const gm = K.groundingMeta && K.groundingMeta();
      const gOk = gm && gm.tiers && gm.tiers.PERCEPTION && gm.tiers.PERCEPTION.mayHallucinate === true
        && gm.tiers.KERNEL && gm.tiers.KERNEL.mayHallucinate === false
        && gm.tiers.PROOF && gm.tiers.PROOF.mayHallucinate === false;
      T('grounding', gOk && ab.grounding && ab.grounding.tiers && ab.grounding.tiers.PERCEPTION.mayHallucinate === true && ab.grounding.tiers.KERNEL.mayHallucinate === false && ab.disclaimer && /幻觉/.test(ab.disclaimer),
        'percept.tier=' + (ab.percept && ab.percept._grounding && ab.percept._grounding.tier) + ' disc=' + (ab.disclaimer || '').slice(0, 24));
      // ⑧⑨ 自验证段 + 反思闭环（吸收 CoVe / Reflexion 思想）：审计须含反向证伪与确定性复盘
      const rp = K.reason('CHARGE', 'C');
      const aud = K.generateAudit(rp, {});
      T('self-verify', aud && aud.selfVerification && aud.selfVerification.checked === true && typeof aud.selfVerification.passed === 'boolean'
        && aud.reflection && aud.reflection.verbalReinforcement === true && typeof aud.reflection.insight === 'string' && aud.reflection.insight.length > 0,
        'passed=' + (aud.selfVerification && aud.selfVerification.passed) + ' reflection=' + (aud.reflection && aud.reflection.status));
      // IMA 知识壳接入自测（第 32 项）：注入同目录 ima_knowledge.json，并验证检索可用
      const il = imaLoadLogic({});
      const iq = imaQueryLogic('反事实', 5);
      T('ima-load', il && il.loaded === true && il.total === 431 && il.modules > 0 && iq && iq.loaded === true && Array.isArray(iq.results) && iq.results.length > 0, 'total=' + il.total + ' modules=' + il.modules + ' hits=' + (iq.results ? iq.results.length : 0));
      // 主推理真消费 IMA（ima_378/365）：构造 goal 在图中但不可达的世界，触发 reason() 注入 imaEvidence
      K.setWorld({ nodes: ['S', 'T', 'X'], edges: [{ from: 'S', to: 'T', w: 1, p: 1 }] });
      const ri = reasonLogic('S', 'X', [], []);
      T('reason-ima-inject', ri.status === 'unknown' && Array.isArray(ri.imaEvidence) && ri.imaEvidence.length > 0 && Array.isArray(ri.imaRef) && ri.imaRef.length > 0, 'imaRef=' + (ri.imaRef ? ri.imaRef.join(',') : '') + ' ev=' + (ri.imaEvidence ? ri.imaEvidence.length : 0));
      K.setWorld({ nodes: ['CHARGE', 'A', 'B', 'C'], edges: K.__defaultEdges || [] });
      // 自我学习模块（第四层 反思与演化中枢）自测：四层闭环 + 降级
      const r1 = slRecordLogic({ state: 'A', action: 'move→C', result: 'C', success: true, reward: 1, usedKnowledge: [] });
      const r2 = slRecordLogic({ state: 'A', action: 'move→C', result: 'C', success: true, reward: 1 });
      const r3 = slRecordLogic({ state: 'B', action: 'move→C', result: 'C', success: false, reward: -1 });
      const disc = slDiscoverLogic({ minSupport: 0.3 });
      const st0 = slStatusLogic();
      T('sl-discover', disc && disc.假设 && disc.假设.length > 0 && st0.experience >= 3, 'exp=' + st0.experience + ' hyp=' + disc.假设.length);
      // 取首个假设连续验证 3 次成功 → 应升级为确认知识
      const hid = disc.假设[0] && disc.假设[0].hid;
      let vres = null;
      if (hid) { slValidateLogic(hid, 'success'); slValidateLogic(hid, 'success'); vres = slValidateLogic(hid, 'success'); }
      const st1 = slStatusLogic();
      T('sl-validate', hid && vres && vres.state === 'confirmed' && st1.confirmed >= 1, 'kid=' + (vres && vres.decision));
      // 监控降级：构造确认知识连续失败 → 降级回假设
      const kid = (K.slStatus().confirmedIds || [])[0];
      let down = null;
      if (kid) {
        for (let i = 0; i < 3; i++) slRecordLogic({ state: 'X', result: 'Y', success: false, usedKnowledge: [kid] });
        down = K.SelfLearn.confirmed[kid] ? null : true;
      }
      T('sl-monitor', kid && down === true, 'kid=' + kid);
      // 具身层（Embodied AI）自测：注册身体→A*规划→模拟执行闭环→SAFE-STOP→重规划护栏→定位
      const stepCaps = [
        { id: 'step_CA', desc: 'CHARGE→A', pre: { require: { node: 'CHARGE' } }, effect: { set: { node: 'A' } }, cost: 1, ground: { to: 'A' } },
        { id: 'step_AB', desc: 'A→B', pre: { require: { node: 'A' } }, effect: { set: { node: 'B' } }, cost: 1, ground: { to: 'B' } },
        { id: 'step_BC', desc: 'B→C', pre: { require: { node: 'B' } }, effect: { set: { node: 'C' } }, cost: 1, ground: { to: 'C' } },
        { id: 'step_back', desc: '→CHARGE', effect: { set: { node: 'CHARGE' } }, cost: 1, ground: { to: 'CHARGE' } },
      ];
      const abdy = attachBodyLogic({ name: 'mcp-test-bot', initialState: { node: 'CHARGE' }, hard: ['D'], capabilities: stepCaps });
      T('embodied-attach', abdy.ok && abdy.capabilities.length === 4, 'caps=' + abdy.capabilities.join(','));
      setStateLogic({ node: 'CHARGE' });
      const ep = planTaskLogic({ reach: 'C' }, {});
      T('embodied-plan', ep.ok && ep.plan.length === 3 && ep.finalState && ep.finalState.node === 'C' && /A\*/.test(ep.guarantee || ''), 'plan=' + ep.plan.map(s => s.cap).join('>'));
      setStateLogic({ node: 'CHARGE' });
      const ex = await executeLogic({ reach: 'C' }, {}, {});
      T('embodied-execute', ex.ok === true && ex.execution.goalSatisfied === true && ex.execution.steps === 3 && ex.execution.replans === 0, 'halt=' + ex.execution.haltReason);
      const ch = checkHardLogic({ node: 'A' }, { params: { to: 'D' } });
      T('embodied-safe-stop', ch.ok === false && /forbidden:D/.test(ch.violation), 'v=' + ch.violation);
      setStateLogic({ node: 'CHARGE' });
      const ex2 = await executeLogic({ reach: 'C' }, {}, { failAt: [0, 1, 2, 3] });
      T('embodied-replan', ex2.execution.halted === true && /max-replans/.test(ex2.execution.haltReason), 'reason=' + ex2.execution.haltReason + ' replans=' + ex2.execution.replans);
      const pos = K.POSITIONING;
      T('embodied-positioning', pos && typeof pos.role === 'string' && /具身/.test(pos.role), 'role=' + (pos && pos.role));
      // 还原为默认世界，避免影响后续真实运行
      K.setWorld({ nodes: ['CHARGE', 'A', 'B', 'C'], edges: K.__defaultEdges || [] });
      finish();
    }).catch(e => { bad.push('perceive-EXCEPTION :: ' + e.message); finish(); });
  } catch (e) {
    bad.push('EXCEPTION :: ' + e.message);
    finish();
  }
  function finish() {
    if (bad.length) {
      console.log('SELFTEST FAIL (' + bad.length + '):');
      bad.forEach(b => console.log('  ✗ ' + b));
      process.exit(1);
    }
    console.log('SELFTEST OK — 核心 ' + ok.length + ' 项工具验证通过：');
    ok.forEach(o => console.log('  ✓ ' + o));
    if (degraded.length) {
      console.log('诚实降级 ' + degraded.length + ' 项（可选依赖缺失，非内核缺陷，安装后即恢复）：');
      degraded.forEach(d => console.log('  – ' + d));
    }
    // 修1（2026-09-04）：消除"假绿"。旧版把 unimpl 数组静默丢弃、仍打印"全部 X 项通过"并 exit(0)，
    // 致 6 个 KB 未接入能力被谎称已绿。现如实披露，不再以"全绿"暗示产品能力完整。
    if (unimpl.length) {
      console.log('已知未实现能力 ' + unimpl.length + ' 项（KB 知识库未接入，属能力缺口而非内核缺陷；' +
        '不计入绿色通过，如实披露；接入 KB 后才可用）：');
      unimpl.forEach(u => console.log('  ○ ' + u));
      console.log('注：上述 ' + unimpl.length + ' 项为"已知未实现"能力，selftest 不谎称其已可用；' +
        '产品对外仅暴露 1 个网关工具 lingnao（推理-only，内含 ' + TOOLS.length + ' 项推理子能力）；能力清单中含这些项时须同步标注"需接入 KB"。');
    }
    process.exit(0);
  }
}

// 记录默认世界边，供 selftest 还原
try { K.__defaultEdges = JSON.parse(JSON.stringify(K.getWorld().edges)); } catch (e) {}

if (SELFTEST) {
  selftest();
} else if (require.main === module) {
  // 仅当以 `node lingnao-mcp.js` 直接运行（而非被 require）时，才启动 stdio 服务
  process.stdin.on('data', c => { buf = Buffer.concat([buf, c]); pump(); });
  process.stdin.on('end', () => { /* 等 stdout 自然 flush */ });
  process.stderr.write('[lingnao-mcp] 已启动，内核载入: ' + K.getWorld().nodes.length + ' 节点 / ' + K.getWorld().edges.length + ' 边；对外 1 个网关工具 lingnao（推理-only，内含 ' + TOOLS.length + ' 项推理子能力，op 分发）\n');
}

// 库导出：让 examples / 第三方 `require('./lingnao-mcp')` 直接拿到内核（不自启 stdio 服务）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = K;
}

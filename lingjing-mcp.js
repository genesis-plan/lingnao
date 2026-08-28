#!/usr/bin/env node
/**
 * 灵境 LingJing（WorldBrain）— 零依赖 MCP stdio server
 * 把 灵境.html 内核（免费LLM感知 / 系统1快答 / 系统2 A*+RSG / 7段审计 / 正·负·边界样本 / 物理载体接入）暴露给外部 AI 智能体。
 * 传输：JSON-RPC 2.0 + Content-Length 字节级分帧（手写，无 SDK 依赖）。
 *
 * 运行：
 *   node lingjing-mcp.js                 # 默认载入同目录 灵境.html
 *   LINGJING_HTML=/path/灵境.html node lingjing-mcp.js
 *   OPENROUTER_API_KEY=sk-or-... node lingjing-mcp.js   # 启用免费 LLM 感知
 *   node lingjing-mcp.js --selftest      # 内置自测，验证全部工具后退出
 *
 * 零依赖：仅用 Node 内置 vm / fs / path。内核从 HTML 抽取复用，单一真源。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = process.env.LINGJING_HTML || path.join(__dirname, '灵境.html');
const SELFTEST = process.argv.includes('--selftest');

// 灵数求解器委派桥（Node 端，复用桌面真源 solver-core → index.html 核心脚本）
let lingShuBridge;
try {
  lingShuBridge = require('./lingshu-bridge');
} catch (e) {
  lingShuBridge = { available: false, algebraicSolve: () => ({ available: false, error: 'lingshu-bridge 未载入：' + (e && e.message) }) };
}

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
sandbox.__LINGSHU__ = lingShuBridge;   // 注入真引擎桥，供内核 algebraicSolve 委派（无 Node 时桥为 available:false 诚实降级）
const ctx = vm.createContext(sandbox);
  vm.runInContext(
  kernelSrc + '\nglobalThis.__exp = {WORLD, IMA, imaKnowledge, loadIMAKB, setWorld, heuristic, aStar, KB, perceive, perceiveLLM, perceiveBelief, system1, system2, reason, goalDirected, buildRSG, generateAudit, learn, carrierReport, metaCognition, metaKnowledgeRouter, symbolicSolve, algebraicSolve, verifyHoarePath, dmcts, pacSampleBound, causalDiscovery, doQuery, learnWorldModel, simulate, counterfactual, SelfLearn, slRecord, slDiscover, slValidate, slMonitor, slStatus, EventBus, KBFabric, runtimeMonitor, continuousVerify, fingerprintVec, simHash, ALGO_VERSION, SEED, explainWithLLM, askBrain, causalEffect, groundingMeta, GROUNDING, validateWorld};',
  ctx
);
const K = sandbox.__exp;
// 内核新增的"不幻觉"置信分层能力同步暴露给 MCP（避免改动上方长行 __exp 字面量）
K.groundingMeta = K.groundingMeta || (() => ({}));
sandbox.__exp.groundingMeta = K.groundingMeta;
sandbox.__exp.GROUNDING = K.GROUNDING;
sandbox.__exp.validateWorld = K.validateWorld;

// ---------- 2. 编排工具（纯函数，复用内核，不依赖 DOM） ----------
function worldInfo() {
  return { nodes: K.WORLD.nodes, edgeCount: K.WORLD.edges.length, edges: K.WORLD.edges, coord: K.WORLD.coord };
}
function setWorldLogic(json) {
  if (typeof json === 'string') json = JSON.parse(json);
  K.setWorld(json);
  return { ok: true, nodes: K.WORLD.nodes, edgeCount: K.WORLD.edges.length };
}
function reasonLogic(start, goal, hard, soft) {
  start = start || 'CHARGE';
  if (!K.WORLD.nodes.includes(start) || !K.WORLD.nodes.includes(goal)) {
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
  const r = K.carrierReport(battery, goal || 'A', density || {});
  const low = Object.keys(density || {}).filter(z => (density || {})[z] <= 2 && z !== 'CHARGE');
  return { carrier: '物理载体（默认智能灭蚊器）', battery: r.battery, density: r.density, goal: r.goal, hard: r.hard, soft: low };
}
function learnLogic(p, success) {
  if (!Array.isArray(p) || p.length < 2) throw new Error('path 需为至少含 2 节点的数组');
  const r = K.learn(p, !!success, 0.1);
  const s = K.KB.summary();
  return { updated: r.updated, knowledgeBase: s, log: r.log };
}
function knowledgeQueryLogic(from, to) {
  return K.KB.query(from, to).map(e => ({
    id: e.id, transition: e.transition.from + '→' + e.transition.to,
    success: e.success, confidence: e.confidence, kind: e.kind, source: e.source,
  }));
}
function knowledgeAddLogic(from, to, success, confidence, source, kind) {
  const e = K.KB.addExperience(from, to, success == null ? true : !!success, confidence == null ? 0.5 : confidence, source || 'mcp', kind);
  return { id: e.id, transition: e.transition.from + '→' + e.transition.to, confidence: e.confidence, success: e.success, kind: e.kind, source: e.source };
}
async function perceiveLogic(text, apiKey) {
  const r = await K.perceiveLLM(text, apiKey || process.env.OPENROUTER_API_KEY || undefined);
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
function annLogic(queryFp, k) { return K.KB.ann(queryFp, k || 3); }
function distillLogic(minSupport) { return K.KB.distillRules(minSupport || 0.4); }
function cogGraphLogic() { return K.KB.cogGraph(); }
function symbolicVerifyLogic(start, goal, hard, soft) {
  const r = K.reason(start || 'CHARGE', goal, { hard: hard || [], soft: soft || [] });
  if (r.status !== 'optimal') return { verified: false, reason: '路径不可判定' };
  return K.verifyHoarePath(r, K.WORLD);
}
// 委派给真引擎「灵数求解器」(lingshu-solver)：区间收缩 + Krawczyk 认证，离线确定性
function algebraicSolveLogic(args) {
  return K.algebraicSolve(args || {});
}
function dmctsLogic(start, goal, hard, soft) {
  return K.dmcts(start || 'CHARGE', goal, { hard: hard || [], soft: soft || [], iterations: 80 });
}
// 端到端：免费 LLM 理解大白话 → 灵境确定性推理 → 免费 LLM 解释（grounding IMA）
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

// ---------- 3. 工具定义与分发 ----------
const TOOLS = [
  {
    name: 'world_info', description: '返回当前世界图 𝕎 的节点、边、坐标——外部智能体先调用以了解场景结构。',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'set_world', description: '导入任意场景的世界图（外部可定义，灭蚊器仅为默认）。让世界大脑适配你的物理载体/业务。',
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
    name: 'perceive', description: '免费 LLM 感知层：自然语言/状态描述 → 结构化感知(JSON)。需 OpenRouter API Key（参数或 env OPENROUTER_API_KEY）。无 key 返回 manual 降级。',
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
    name: 'reason', description: '可审计推理：系统1快答(高置信复用) + 系统2(A*最优+RSG推理状态图)。输出每步依据、所用系统、RSG、不可判定标记 𝕌。',
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
    name: 'carrier_report', description: '物理载体上报传感器状态（电量/目标/密度），返回硬/软约束。电量<20 触发硬约束禁离充电座。',
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
    name: 'audit', description: '生成七段审计报告（概要/详细/证据/约束/𝕌/形式化证明证书/可复现）+ 不确定性量化，对应文档 3.4。',
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
    name: 'learn', description: '学习闭环：载体执行回报后更新经验库（成功=正样本+0.1 / 失败=负样本-0.1）。',
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
    name: 'knowledge_query', description: '查询经验库（状态→行动→结果的置信度/样本类记录）。',
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
    name: 'knowledge_add', description: '向经验库手工添加一条转移经验（带置信度、样本类与来源）。',
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
    name: 'meta', description: '第五层元认知与协调层：全局监控 / 知识熵 H(K) / 一致性 C(K) / 知识缺口 / 冲突仲裁 / 探索-利用决策。可选携带 start+goal 以纳入路径不确定性。',
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
    name: 'perceive_belief', description: '感知数学原理：贝叶斯滤波迭代 + Banach 压缩映射收敛检测（离散信念→不动点）。',
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
    name: 'knowledge_ann', description: 'LSH 近似最近邻检索（SimHash 投影），从经验库找最相似转移。',
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
    name: 'knowledge_distill', description: '规则蒸馏（FP-Growth 风格频繁项集→关联规则）。',
    inputSchema: {
      type: 'object',
      properties: { minSupport: { type: 'number', description: '最小支持度，默认 0.4' } },
      required: [],
    },
  },
  {
    name: 'cog_graph', description: '认知图谱：由经验库构建概念节点+语义关系有向图。',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'symbolic_verify', description: '符号验证：霍尔逻辑机器验证证明 A* 路径满足不变量（手写 Z3-lite 等价）。',
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
    name: 'algebraic_solve', description: '代数方程系统求解 —— 真正委派给灵数求解器(lingshu-solver)真引擎（区间收缩 + Krawczyk 认证，离线、确定性、可复现；非手写 lite）。' +
      '输入：equations 为含 "=" 的方程字符串数组，如 ["x^2+y^2=25","x+y=7"]；支持 + - * / ^ sqrt log sin cos tan exp abs 及 in-text 域约束 "x ∈ [-30,30]"。' +
      'variables 可选（不填自动识别，≤6）；domain 可选 {"x":[-30,30]}（exp/sinh 等快增长函数建议显式给定）；fastMode 可选；options 可选 {budget,maxDepth}。' +
      '输出：resultTypeName=empty(严格证无实数解)/finite(有限已验证解)/infinite(无限解集，仅给距原点最近推荐解)；solutionCount；certified=是否全部 Krawczyk 认证；solutions[] 每解含 values[](6位小数)、tier(proven/likely/candidate)、certified、text(如"x=4.000000, y=3.000000")、residual、certifiedRadius；truncated=true 表示预算内未穷尽（多数情况真解已全找到，极端病态可能遗漏个别，可缩 domain/提 budget 重试）。' +
      '硬限制：变量 ≤6；方程 1–64 且 ≥ 变量数。相同输入永远返回完全相同结果。',
    inputSchema: {
      type: 'object',
      properties: {
        equations: { type: 'array', items: { type: 'string' }, description: '方程字符串数组，如 ["x^2 + y^2 = 25", "x + y = 7"]' },
        variables: { type: 'array', items: { type: 'string' }, description: '变量名数组（可选，不填自动识别，≤6）' },
        domain: { type: 'object', description: '显式搜索域（可选），如 {"x":[-30,30],"y":[-30,30]}' },
        fastMode: { type: 'boolean', description: '快速模式（默认 false）' },
        options: { type: 'object', description: '高级选项（可选），如 {budget:500000, maxDepth:28}' },
      },
      required: ['equations'],
    },
  },
  {
    name: 'world_model', description: '世界模型（lite）：从观测轨迹样本学结构方程模型 SEM（手写最小二乘），并前向模拟下一状态。文档 3.4 给的 VAE/ADM-v2 需神经网络+大数据（无定义），本实装为诚实 lite 等价（线性 SEM + Pearl 反事实框架），确定性、可复现、可审计。' +
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
    name: 'counterfactual', description: '反事实推理（lite，Pearl 三步法 abduction→action→prediction）：给定事实上发生的轨迹 factual={state,action,next} 与干预 intervention={var,value}，' +
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
    name: 'causal_effect', description: '因果效应估计（do-演算：后门调整 + 前门准则自动识别，呼应已消费 ima_304 因果 / ima_301 反事实）：给定观测轨迹样本 samples 与因果变量 cause / 结果变量 effect，自动学线性 SEM 世界模型并估计 ACE=E[effect|do(cause=1)]-E[effect|do(cause=0)]。' +
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
    name: 'dmcts', description: 'D-MCTS 分布式分支探索：并行分支+回溯，返回多候选最优路径。',
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
    name: 'goal_directed', description: '目标导向决策（消费 IMA 真数学：ima_286 目标导向框架 (S,A,P,G,C,γ) 无奖励最大化到达概率 / ima_288 可达性 BFS / ima_291 值迭代求到达概率 / ima_289 贪心路径规划）。给定世界图起点+目标，返回可达状态数、到达概率 goalProb、最优到达路径。与 reason(A*最优)互补：reason 求代价最优，goal_directed 求到达可靠性最优。',
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
    name: 'pac_bound', description: 'PAC 学习定理：样本复杂度下界 m≥(d_VC·ln(1/ε)+ln(1/δ))/ε²。',
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
    name: 'ask', description: '用大白话让大脑理解并规划：免费 LLM 把自然语言理解为结构化目标 → 灵境确定性可审计推理 → 免费 LLM 把结果+IMA 资料用中文解释。返回 percept/reason/explanation。',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '用户自然语言目标，如「从充电座出发去 C 点，电量充足」' },
        apiKey: { type: 'string', description: 'OpenRouter API Key（免费档 deepseek-r1:free）；也可由 env OPENROUTER_API_KEY 提供' },
        hard: { type: 'array', items: { type: 'string' }, description: '硬约束节点（可选）' },
        soft: { type: 'array', items: { type: 'string' }, description: '软约束节点（可选，代价加成）' },
      },
      required: ['text'],
    },
  },
  {
    name: 'explain', description: '解释层：把一份 reason() 结果 + 命中的 IMA 数学资料，用免费 LLM 讲成非技术用户能读懂的中文。',
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
    name: 'causal', description: '因果发现（PC-lite）+ do演算查询（后门准则）。',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'event_publish', description: 'EDA 事件总线：发布事件（感知/推理/学习/审计/元认知）。',
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
    name: 'knowledge_fabric', description: 'Data Fabric 知识库版本化（git 风格 commit/list/diff）。',
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
    name: 'runtime_monitor', description: 'PrSTL 运行时监控：检查决策是否偏离安全约束，违例触发安全停车。',
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
    name: 'continuous_verify', description: '持续验证管道（仓库级单元+集成断言）。',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'ima_load', description: '加载用户 IMA 数学库知识壳（默认同目录 ima_knowledge.json，431 条公理/定理/定义/方法/思想方法）注入灵境内核：KB 可检索、审计报告可引用证据、元认知层可路由。可传 {path} 指定文件，或直传 {entries:[...]}。',
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
    name: 'ima_query', description: '检索 IMA 数学库：按关键词命中标题/模块/类型/编号，返回相关公理/定理（确定性）。需先 ima_load。',
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
    name: 'sl_record', description: '① 积累层：追加一条原始执行记录（状态/行动/结果/成功/奖励/环境/使用的知识ID），append-only 不可修改。是自我学习闭环的数据源头。',
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
    name: 'sl_discover', description: '② 发现层：对经验库跑六类统计（关联FP-Growth+因果PC+聚类lite+异常lite+时序lite）并生成待验证假设（带统计证据与 IMA 引用）。',
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
    name: 'sl_validate', description: '③ 验证层：对假设做贝叶斯可靠度更新（成功=1/失败=0/部分=0.5），按生命周期升级为确认知识或废弃。',
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
    name: 'sl_monitor', description: '④ 监控修正层：人工标记某确认知识(K...)可疑，立即降级为假设（可靠度减半、退回验证流）。自动降级由 sl_record 触发（连续3败/失败率≥40%）。',
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
    name: 'sl_status', description: '三级知识状态机总览：经验数/假设数/确认数/废弃数 + 每条可靠度 + IMA 证据映射。',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

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
    case 'algebraic_solve': return algebraicSolveLogic(args);
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
    case 'world_model': return worldModelLogic(args.samples, args.state, args.action);
    case 'counterfactual': return counterfactualLogic(args.samples, args.factual, args.intervention);
    case 'causal_effect': return causalEffectLogic(args.samples, args.cause, args.effect, args.mediator);
    default: throw new Error('未知工具：' + name);
  }
}

// ---------- 4. stdio 字节级分帧（JSON-RPC 2.0） ----------
let buf = Buffer.alloc(0);
function send(obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  process.stdout.write(Buffer.concat([Buffer.from('Content-Length: ' + body.length + '\r\n\r\n'), body]));
}
function handle(msg) {
  if (!msg || msg.jsonrpc !== '2.0' || msg.id === undefined) return;
  const { id, method, params } = msg;
  try {
    if (method === 'initialize') {
      send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'lingjing', version: '2.0' } } });
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
      const { name, arguments: a } = params;
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
  const SEP = Buffer.from('\r\n\r\n');
  let i;
  while ((i = buf.indexOf(SEP)) !== -1) {
    const header = buf.slice(0, i).toString('utf8');
    const m = /Content-Length:\s*(\d+)/i.exec(header);
    if (!m) { buf = buf.slice(i + 4); continue; }
    const len = +m[1], start = i + 4;
    if (buf.length < start + len) return;
    const msg = JSON.parse(buf.slice(start, start + len).toString('utf8'));
    buf = buf.slice(start + len);
    handle(msg);
  }
}

// ---------- 5. 自测（无临时文件，直接验证全部工具） ----------
function mockFetchOpenRouter() {
  // 仅用于自测：模拟 OpenRouter 返回，验证 perceiveLLM 的 JSON 解析链路
  return Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({ choices: [{ message: { content: '{"goal":"C","battery":80,"density":{"A":8},"entities":["灭蚊器"],"confidence":0.9}' } }] }),
    text: () => Promise.resolve(''),
  });
}
function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function selftest() {
  const ok = [];
  const bad = [];
  const T = (name, cond, extra) => (cond ? ok : bad).push(name + (extra ? ' :: ' + extra : ''));
  try {
    T('world_info', worldInfo().nodes.length === 4);
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
    T('carrier-hard', cr.hard.length > 0 && !cr.hard.includes('CHARGE'), 'hard=' + JSON.stringify(cr.hard));
    const lr = learnLogic(['S', 'T'], true);
    T('learn', lr.updated.length === 1 && Math.abs(lr.updated[0].confidence - 0.6) < 1e-9, 'conf=' + lr.updated[0].confidence);
    T('kb-summary', lr.knowledgeBase && typeof lr.knowledgeBase.positive === 'number' && lr.knowledgeBase.negative >= 1, 'kb=' + JSON.stringify(lr.knowledgeBase));
    const au = auditLogic('S', 'T', [], []);
    T('audit-7sec', au.summary && au.details && au.evidence && au.constraints && 'unknown' in au && au.proof && au.reproducible && au.uncertainty, 'status=' + au.status);
    T('audit-proof', au.proof.hoare === '{P} C {Q}' && au.proof.verified === true);
    const q = knowledgeQueryLogic('S', 'T');
    T('knowledge_query', Array.isArray(q) && q.length >= 1);
    const a = knowledgeAddLogic('X', 'Y', true, 0.7, 'selftest', 'boundary');
    T('knowledge_add', a.transition === 'X→Y' && a.confidence === 0.7 && a.kind === 'boundary', 'id=' + a.id);
    const mt = metaLogic('CHARGE', 'C', [], []);
    T('meta-layer5', mt.layer === 5 && typeof mt.uncertainty.entropyH === 'number' && mt.uncertainty.consistencyC >= 0 && Array.isArray(mt.knowledgeGaps) && /explore|exploit/.test(mt.decision.exploreExploit), 'mode=' + mt.decision.exploreExploit + ' C=' + mt.uncertainty.consistencyC);
    // 还原默认灭蚊器世界（set_world 测试改了 WORLD），供后续依赖 CHARGE/A/B/C 的断言
    K.setWorld({ nodes: ['CHARGE', 'A', 'B', 'C'], edges: K.__defaultEdges || [] });
    // ---- v3.0 扩层模块自测 ----
    const pb = perceiveBeliefLogic({ CHARGE: 0.5, A: 0.5 }, { likelihood: { CHARGE: 0.6, A: 0.9 } });
    T('perceive-banach', pb && typeof pb.converged === 'boolean' && typeof pb.contractionL === 'number', 'L=' + pb.contractionL + ' conv=' + pb.converged);
    const ann = annLogic('{"from":"CHARGE","to":"A"}', 3);
    T('knowledge-ann', Array.isArray(ann) && ann.length > 0 && typeof ann[0].similarity === 'number', 'top=' + (ann[0] && ann[0].transition));
    const distill = distillLogic(0.3);
    T('knowledge-distill', distill && Array.isArray(distill.rules), 'rules=' + distill.rules.length);
    const cg = cogGraphLogic();
    T('cog-graph', cg && Array.isArray(cg.nodes) && cg.size && cg.size.nodes > 0, 'nodes=' + cg.size.nodes);
    const sv = symbolicVerifyLogic('CHARGE', 'C', [], []);
    T('symbolic-verify', sv && sv.verified === true && sv.tool === 'lingjing-hoare-lite', 'steps=' + (sv.steps && sv.steps.length));
    // 真引擎委派：灵数求解器解 x^2+y^2=25, x+y=7 → 2 解且全部 Krawczyk 认证
    const aso = algebraicSolveLogic({ equations: ['x^2+y^2=25', 'x+y=7'] });
    T('algebraic-solve', aso && aso.available === true && aso.solutionCount === 2 && aso.certified === true && aso.solutions[0].values.length === 2, 'sols=' + (aso && aso.solutionCount) + ' engine=' + (aso && aso.engine));
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
    // perceive（mock fetch 验证解析链路）
    sandbox.fetch = mockFetchOpenRouter;
    return perceiveLogic('电量80目标C区A蚊子多', 'fake-key').then(async pr => {
      T('perceive-llm', pr.ok && pr.percept && pr.percept.goal === 'C', 'percept=' + JSON.stringify(pr.percept));
      // 端到端 ask：免费 LLM 理解大白话 → 灵境推理 → 免费 LLM 解释（grounding IMA），mock fetch 验证链路
      const ab = await askBrainLogic('从充电座出发去 C 点，电量充足', 'fake-key');
      T('ask-brain', ab && ab.ok === true && ab.reason && ab.reason.status === 'optimal' && ab.explanation && ab.explanation.ok === true && typeof ab.explanation.text === 'string' && ab.explanation.text.length > 0, 'goal=' + (ab.goal) + ' exp.len=' + (ab.explanation && ab.explanation.text ? ab.explanation.text.length : 0));
      // 不幻觉置信分层（核心保证）：groundingMeta 三档；askBrain 须标感知可能幻觉、reason 为确定性
      const gm = K.groundingMeta && K.groundingMeta();
      const gOk = gm && gm.tiers && gm.tiers.PERCEPTION && gm.tiers.PERCEPTION.mayHallucinate === true
        && gm.tiers.KERNEL && gm.tiers.KERNEL.mayHallucinate === false
        && gm.tiers.PROOF && gm.tiers.PROOF.mayHallucinate === false;
      T('grounding', gOk && ab.grounding && ab.grounding.tiers && ab.reason && ab.reason.grounding && ab.reason.grounding.tier === 'DETERMINISTIC' && ab.disclaimer && /幻觉/.test(ab.disclaimer),
        'percept.tier=' + (ab.percept && ab.percept._grounding && ab.percept._grounding.tier) + ' reason.tier=' + (ab.reason && ab.reason.grounding && ab.reason.grounding.tier));
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
    console.log('SELFTEST OK — 全部 ' + ok.length + ' 项工具验证通过：');
    ok.forEach(o => console.log('  ✓ ' + o));
    process.exit(0);
  }
}

// 记录默认世界边，供 selftest 还原
try { K.__defaultEdges = JSON.parse(JSON.stringify(K.WORLD.edges)); } catch (e) {}

if (SELFTEST) {
  selftest();
} else {
  process.stdin.on('data', c => { buf = Buffer.concat([buf, c]); pump(); });
  process.stdin.on('end', () => { /* 等 stdout 自然 flush */ });
  process.stderr.write('[lingjing-mcp] 已启动，内核载入: ' + K.WORLD.nodes.length + ' 节点 / ' + K.WORLD.edges.length + ' 边；工具 ' + TOOLS.length + ' 个\n');
}

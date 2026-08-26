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
const ctx = vm.createContext(sandbox);
vm.runInContext(
  kernelSrc + '\nglobalThis.__exp = {WORLD, IMA, setWorld, heuristic, aStar, KB, perceive, perceiveLLM, perceiveBelief, system1, system2, reason, buildRSG, generateAudit, learn, carrierReport, metaCognition, metaKnowledgeRouter, symbolicSolve, verifyHoarePath, dmcts, pacSampleBound, causalDiscovery, doQuery, EventBus, KBFabric, runtimeMonitor, continuousVerify, fingerprintVec, simHash, ALGO_VERSION, SEED};',
  ctx
);
const K = sandbox.__exp;

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
  if (r.status !== 'optimal') return { status: 'unknown', U: true, reason: r.U, path: [], cost: 0 };
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
function dmctsLogic(start, goal, hard, soft) {
  return K.dmcts(start || 'CHARGE', goal, { hard: hard || [], soft: soft || [], iterations: 80 });
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
    case 'dmcts': return dmctsLogic(args.start, args.goal, args.hard, args.soft);
    case 'pac_bound': return pacLogic(args.dVC, args.epsilon, args.delta);
    case 'causal': return causalLogic();
    case 'event_publish': return eventPublishLogic(args.type, args.payload);
    case 'knowledge_fabric': return fabricLogic(args.action, args.msg, args.versions);
    case 'runtime_monitor': return runtimeMonitorLogic(args.start, args.goal, args.safety);
    case 'continuous_verify': return continuousVerifyLogic();
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
    const dm = dmctsLogic('CHARGE', 'C', [], []);
    T('dmcts', dm && dm.status === 'found' && dm.best && Math.abs(dm.best.cost - 7.242641) < 1e-3, 'best=' + (dm.best && dm.best.cost));
    const pac = pacLogic(10, 0.1, 0.1);
    T('pac-bound', pac && pac.m > 0 && typeof pac.formula === 'string', 'm=' + pac.m);
    const causal = causalLogic();
    T('causal-discovery', causal.discovery && Array.isArray(causal.discovery.nodes) && causal.discovery.nodes.indexOf('CHARGE') >= 0, 'nodes=' + causal.discovery.nodes.length);
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
    return perceiveLogic('电量80目标C区A蚊子多', 'fake-key').then(pr => {
      T('perceive-llm', pr.ok && pr.percept && pr.percept.goal === 'C', 'percept=' + JSON.stringify(pr.percept));
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

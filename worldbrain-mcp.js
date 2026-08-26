#!/usr/bin/env node
/**
 * 世界大脑 WorldBrain — 零依赖 MCP stdio server
 * 把 世界大脑.html 内核（A* 可审计推理 / IMA 素材 / 经验库 / 物理载体接入）暴露给外部 AI 智能体。
 * 传输：JSON-RPC 2.0 + Content-Length 字节级分帧（手写，无 SDK 依赖）。
 *
 * 运行：
 *   node worldbrain-mcp.js                 # 默认载入同目录 世界大脑.html
 *   WORLDBRAIN_HTML=/path/世界大脑.html node worldbrain-mcp.js
 *   node worldbrain-mcp.js --selftest      # 内置自测，验证全部工具后退出
 *
 * 零依赖：仅用 Node 内置 vm / fs / path。内核从 HTML 抽取复用，单一真源。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = process.env.WORLDBRAIN_HTML || path.join(__dirname, '世界大脑.html');
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
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(
  kernelSrc + '\nglobalThis.__exp = {WORLD, IMA, setWorld, heuristic, aStar, KB, perceive, generateAudit, learn, carrierReport, findExperience, updateConfidence};',
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
  const r = K.aStar(start, goal, { hard: hard || [], soft: soft || [] });
  if (r.status !== 'optimal') return { status: 'unknown', U: true, reason: r.U, path: [], cost: 0 };
  const steps = r.steps.map(s => ({
    seq: s.seq, state: s.state, action: s.action, result: s.result,
    reason: s.reason, confidence: s.confidence, evidence: s.evidenceIds,
  }));
  return {
    status: r.status, path: r.path, cost: r.cost, expanded: r.expanded, steps,
    hard: hard || [], soft: soft || [],
    note: '每步可追溯到 IMA-45（度量空间）；硬约束已剪枝，软约束代价+2/节点',
  };
}
function auditLogic(start, goal, hard, soft) {
  const r = K.aStar(start || 'CHARGE', goal, { hard: hard || [], soft: soft || [] });
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
  return { updated: r.updated, knowledgeBaseSize: K.KB.stats().count, log: r.log };
}
function knowledgeQueryLogic(from, to) {
  return K.KB.query(from, to).map(e => ({
    id: e.id, transition: e.transition.from + '→' + e.transition.to,
    success: e.success, confidence: e.confidence, source: e.source,
  }));
}
function knowledgeAddLogic(from, to, success, confidence, source) {
  const e = K.KB.addExperience(from, to, success == null ? true : !!success, confidence == null ? 0.5 : confidence, source || 'mcp');
  return { id: e.id, transition: e.transition.from + '→' + e.transition.to, confidence: e.confidence, success: e.success, source: e.source };
}

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
        edges: { type: 'array', items: { type: 'object' }, description: '有向边 [{from,to,w}]，w 为转移代价' },
        coord: { type: 'object', description: '可选节点坐标 {节点:[x,y]}，用于欧氏启发式；缺省随机生成' },
      },
      required: ['nodes', 'edges'],
    },
  },
  {
    name: 'reason', description: '可审计推理：在 𝕎 上用 A* 求最优路径，输出每步依据与不可判定标记 𝕌。',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: '起点节点，默认 CHARGE' },
        goal: { type: 'string', description: '目标节点' },
        hard: { type: 'array', items: { type: 'string' }, description: '硬约束禁入节点集（必须满足）' },
        soft: { type: 'array', items: { type: 'string' }, description: '软约束避开节点集（尽量满足，附加代价）' },
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
    name: 'audit', description: '生成五段审计报告（概要/详细/证据/约束/附录）+ 不可判定列表，对应文档 3.4。',
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
    name: 'learn', description: '学习闭环：载体执行回报后更新经验库置信度（成功+0.1 / 失败-0.1）。',
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
    name: 'knowledge_query', description: '查询经验库（状态→行动→结果的置信度记录）。',
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
    name: 'knowledge_add', description: '向经验库手工添加一条转移经验（带置信度与来源）。',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: '起始节点' },
        to: { type: 'string', description: '目标节点' },
        success: { type: 'boolean', description: '该转移是否成功' },
        confidence: { type: 'number', description: '初始置信度 0~1，默认 0.5' },
        source: { type: 'string', description: '来源标记，默认 mcp' },
      },
      required: ['from', 'to'],
    },
  },
];

function callTool(name, args) {
  args = args || {};
  switch (name) {
    case 'world_info': return worldInfo();
    case 'set_world': return setWorldLogic(args);
    case 'reason': return reasonLogic(args.start, args.goal, args.hard, args.soft);
    case 'audit': return auditLogic(args.start, args.goal, args.hard, args.soft);
    case 'carrier_report': return carrierReportLogic(args.battery, args.goal, args.density);
    case 'learn': return learnLogic(args.path, args.success);
    case 'knowledge_query': return knowledgeQueryLogic(args.from, args.to);
    case 'knowledge_add': return knowledgeAddLogic(args.from, args.to, args.success, args.confidence, args.source);
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
      send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'worldbrain', version: '1.0' } } });
    } else if (method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    } else if (method === 'tools/call') {
      const { name, arguments: a } = params;
      const out = callTool(name, a);
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] } });
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
function selftest() {
  const ok = [];
  const bad = [];
  const T = (name, cond, extra) => (cond ? ok : bad).push(name + (extra ? ' :: ' + extra : ''));
  try {
    T('world_info', worldInfo().nodes.length === 4);
    const r1 = reasonLogic('CHARGE', 'C', [], []);
    T('reason-optimal', r1.status === 'optimal' && r1.path[0] === 'CHARGE' && r1.path[r1.path.length - 1] === 'C' && Math.abs(r1.cost - 7.242641) < 1e-3, 'cost=' + r1.cost);
    const r2 = reasonLogic('CHARGE', 'C', ['A'], []);
    T('reason-hard', r2.status === 'optimal' && !r2.path.includes('A'), 'path=' + (r2.path || []).join(','));
    const r3 = reasonLogic('CHARGE', 'Z', [], []);
    T('reason-unknown', r3.status === 'unknown' && r3.U, 'U=' + JSON.stringify(r3.U));
    const sw = setWorldLogic({ nodes: ['S', 'T'], edges: [{ from: 'S', to: 'T', w: 1 }], coord: { S: [0, 0], T: [1, 0] } });
    T('set_world', sw.nodes.length === 2 && sw.edgeCount === 1, 'nodes=' + sw.nodes.length);
    const r4 = reasonLogic('S', 'T', [], []);
    T('reason-custom', r4.status === 'optimal' && r4.cost === 1 && r4.path.join('') === 'ST', 'path=' + (r4.path || []).join(''));
    const cr = carrierReportLogic(10, 'A', {});
    T('carrier-hard', cr.hard.length > 0 && !cr.hard.includes('CHARGE'), 'hard=' + JSON.stringify(cr.hard));
    const lr = learnLogic(['S', 'T'], true);
    T('learn', lr.updated.length === 1 && Math.abs(lr.updated[0].confidence - 0.6) < 1e-9, 'conf=' + lr.updated[0].confidence);
    const au = auditLogic('S', 'T', [], []);
    T('audit', au.summary && au.details && au.evidence && au.constraints && 'unknown' in au, 'status=' + au.status);
    const q = knowledgeQueryLogic('S', 'T');
    T('knowledge_query', Array.isArray(q) && q.length >= 1);
    const a = knowledgeAddLogic('X', 'Y', true, 0.7, 'selftest');
    T('knowledge_add', a.transition === 'X→Y' && a.confidence === 0.7, 'id=' + a.id);
    // 还原为默认世界，避免影响后续真实运行
    K.setWorld({ nodes: ['CHARGE', 'A', 'B', 'C'], edges: K.__defaultEdges || [] });
  } catch (e) {
    bad.push('EXCEPTION :: ' + e.message);
  }
  if (bad.length) {
    console.log('SELFTEST FAIL (' + bad.length + '):');
    bad.forEach(b => console.log('  ✗ ' + b));
    process.exit(1);
  }
  console.log('SELFTEST OK — 全部 ' + ok.length + ' 项工具验证通过：');
  ok.forEach(o => console.log('  ✓ ' + o));
  process.exit(0);
}

// 记录默认世界边，供 selftest 还原
try { K.__defaultEdges = JSON.parse(JSON.stringify(K.WORLD.edges)); } catch (e) {}

if (SELFTEST) {
  selftest();
} else {
  process.stdin.on('data', c => { buf = Buffer.concat([buf, c]); pump(); });
  process.stdin.on('end', () => { /* 等 stdout 自然 flush */ });
  process.stderr.write('[worldbrain-mcp] 已启动，内核载入: ' + K.WORLD.nodes.length + ' 节点 / ' + K.WORLD.edges.length + ' 边；工具 ' + TOOLS.length + ' 个\n');
}

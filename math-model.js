// 灵境 LingJing v3.0 — 能力④ 数学建模（把虚拟空间形式化为最优化模型并求最优分配）
// 在「发现错配/协调/分配」之上，让大脑先对空间做数学建模：
//   把资源调拨写成运输问题：变量 x_{i→j}^r、供给/需求约束、min 总转运代价。
//   用「全源最短路(Dijkstra) + 最小费用流(逐次最短路增广/SPFA)」求精确最优——
//   注：升序代价贪心对一般运输问题不保证最优（反例 c=[[1,2],[2,100]] 贪心101 vs 最优4），已弃用。
// 内核真源：lingjing.umd.js（UMD）。本模块仅用已验证签名 + 自实现可审计求解器（不依赖外部求解器）。
const { VirtualWorld } = require('./virtual-world.js');
const L = require('./lingjing.umd.js');
const G = L.GROUNDING || { KERNEL: 'KERNEL', PROOF: 'PROOF' };
const line = (s = '') => console.log(s);

// ---------- 图论：全源最短路（Dijkstra，w=转运代价） ----------
function allPairsShortest(world) {
  const adj = {};
  for (const n of world.graph.nodes) adj[n] = [];
  for (const e of world.graph.edges) adj[e.from].push([e.to, e.w]);
  const dist = {}, prev = {};
  for (const s of world.graph.nodes) {
    dist[s] = {}; prev[s] = {};
    const Q = new Set(world.graph.nodes), d = {};
    for (const n of Q) d[n] = Infinity; d[s] = 0;
    while (Q.size) {
      let u = null, best = Infinity;
      for (const n of Q) if (d[n] < best) { best = d[n]; u = n; }
      if (u === null) break; Q.delete(u);
      for (const [v, w] of adj[u]) { const nd = d[u] + w; if (nd < d[v]) { d[v] = nd; prev[s][v] = u; } }
    }
    dist[s] = d;
  }
  return { dist, prev };
}
function path(prev, s, t) {
  if (prev[s][t] === undefined && s !== t) return null;
  const p = [t]; let c = t;
  while (c !== s) { c = prev[s][c]; if (c === undefined) return null; p.unshift(c); }
  return p;
}

// ---------- 数学建模：把空间写成运输问题 ----------
function buildModel(world) {
  const aps = allPairsShortest(world);
  const resources = new Set();
  for (const e of world.entities) {
    for (const r of Object.keys(e.resources)) if (e.resources[r] > 0) resources.add(r);
    for (const r of Object.keys(e.needs)) if (e.needs[r] > 0) resources.add(r);
  }
  const commodities = [];
  for (const r of resources) {
    const supplies = {}, demands = {};
    for (const e of world.entities) {
      if ((e.resources[r] || 0) > 0) supplies[e.id] = e.resources[r];
      if ((e.needs[r] || 0) > 0) demands[e.id] = e.needs[r];
    }
    if (!Object.keys(supplies).length || !Object.keys(demands).length) continue;
    commodities.push({ resource: r, supplies, demands });
  }
  return { region: world.region, commodities, aps };
}

// 打印可读数学模型（让用户肉眼复核：变量 / 约束 / 目标）
function printModel(model) {
  line('  [数学模型] 把「' + model.region + '」写成运输问题（每类资源一个子模型）：');
  for (const c of model.commodities) {
    line('    资源 ' + c.resource + '：变量 x_{i→j} ≥ 0');
    const sup = Object.entries(c.supplies).map(([i, a]) => 'Σ_j x_{' + i + '→j} ≤ ' + a).join(' ; ');
    const dem = Object.entries(c.demands).map(([j, d]) => 'Σ_i x_{i→' + j + '} ≤ ' + d).join(' ; ');
    line('      供给约束  ' + sup);
    line('      需求约束  ' + dem);
    line('      目标      min Σ c_{ij}·x_{ij}  且尽量满足全部需求');
  }
}

// ---------- 求解：最小费用流（逐次最短路增广 / SPFA），运输问题精确最优 ----------
// 终止时残差网络无负费用圈 ⇒ LP 最优（确定性、可审计）。每条边流量可从反向边容量读回。
function solveTransportation(supplies, demands, costs) {
  const S = '__S__', T = '__T__';
  // 供需拆点：同一主体可既是供给方又是需求方（持有与缺口并存），必须拆成 i__out / i__in 两个节点，
  // 且不设 i__out→i__in 边——否则 S→i→T 会造出"自己满足自己"的零代价假流（本模块曾因此虚报满足率）。
  const out = i => i + '__out', inn = j => j + '__in';
  const nodes = [S].concat(Object.keys(supplies).map(out), Object.keys(demands).map(inn), [T]);
  const idx = {}; nodes.forEach((n, k) => { idx[n] = k; });
  const N = nodes.length;
  const graph = Array.from({ length: N }, () => []);
  const addEdge = (u, v, cap, cost) => {
    const e1 = { to: idx[v], cap, cost, rev: null }, e2 = { to: idx[u], cap: 0, cost: -cost, rev: null };
    e1.rev = e2; e2.rev = e1;
    graph[idx[u]].push(e1); graph[idx[v]].push(e2);
    return e1;
  };
  for (const i in supplies) addEdge(S, out(i), supplies[i], 0);
  for (const j in demands) addEdge(inn(j), T, demands[j], 0);
  const flowEdges = {};
  for (const i in supplies) for (const j in demands) {
    if (i === j) continue;                       // 禁止自环：资源只在主体之间流转
    const c = costs[i] && costs[i][j];
    if (c != null && c !== Infinity) flowEdges[i + '→' + j] = addEdge(out(i), inn(j), Infinity, c);
  }
  let flow = 0, cost = 0;
  const s = idx[S], t = idx[T];
  while (true) {
    const dist = new Array(N).fill(Infinity), inq = new Array(N).fill(false);
    const pe = new Array(N).fill(null), pv = new Array(N).fill(-1);
    dist[s] = 0; const q = [s]; inq[s] = true;
    while (q.length) {                            // SPFA 找残差网络最短费用路
      const u = q.shift(); inq[u] = false;
      for (const e of graph[u]) {
        if (e.cap > 1e-12 && dist[u] + e.cost < dist[e.to] - 1e-12) {
          dist[e.to] = dist[u] + e.cost; pe[e.to] = e; pv[e.to] = u;
          if (!inq[e.to]) { q.push(e.to); inq[e.to] = true; }
        }
      }
    }
    if (dist[t] === Infinity) break;              // 无增广路 ⇒ 已是最大流且费用最小
    let push = Infinity;
    for (let v = t; v !== s; v = pv[v]) push = Math.min(push, pe[v].cap);
    for (let v = t; v !== s; v = pv[v]) { pe[v].cap -= push; pe[v].rev.cap += push; }
    flow += push; cost += push * dist[t];
  }
  const assignments = [];
  for (const k in flowEdges) {
    const used = flowEdges[k].rev.cap;            // 反向边净容量 = 该边净流量
    if (used > 1e-12) { const p = k.split('→'); assignments.push({ i: p[0], j: p[1], amount: used }); }
  }
  return { flow, cost, assignments };
}

function solveModel(model) {
  const { dist, prev } = model.aps;
  const flows = [];
  let totalCost = 0, totalFlow = 0, unmet = 0;
  for (const c of model.commodities) {
    const costs = {};
    for (const i in c.supplies) {
      costs[i] = {};
      for (const j in c.demands) {
        if (i === j) continue;
        const d = dist[i] && dist[i][j];
        if (d != null && d !== Infinity) costs[i][j] = d;
      }
    }
    const r = solveTransportation(c.supplies, c.demands, costs);
    for (const a of r.assignments) {
      const rt = path(prev, a.i, a.j);
      if (!rt) throw new Error('求解内部错误：' + a.i + '→' + a.j + ' 距离有限但最短路缺失');
      flows.push({ resource: c.resource, from: a.i, to: a.j, amount: a.amount, cost: dist[a.i][a.j], route: rt });
      totalCost += dist[a.i][a.j] * a.amount; totalFlow += a.amount;
    }
    const totDem = Object.keys(c.demands).reduce((s, k) => s + c.demands[k], 0);
    unmet += totDem - r.flow;
  }
  return { flows, totalCost: Math.round(totalCost * 1000) / 1000, totalFlow, unmet: Math.round(unmet * 1000) / 1000, optimal: true };
}

// ---------- 大脑编排：感知 → 数学建模 → 求解 → 落账 → 审计 ----------
function runMathCycle(world) {
  world.tick++;
  const perceive = { grounding: G.KERNEL, note: '虚拟空间为精确仿真量，建模确定性' };
  L.setWorld(world.graph);   // 把空间注册为大脑世界模型，供霍尔验证器逐边核验路径
  const model = buildModel(world);
  const sol = solveModel(model);
  const allocations = [];
  for (const f of sol.flows) {
    const entry = world.applyTransfer(f.from, f.to, f.resource, f.amount, f.route, G.KERNEL);
    // EventBus 真方法为 publish；KB 签名为 (from,to,success,conf,source)
    try { if (L.EventBus && L.EventBus.publish) L.EventBus.publish('math-alloc', entry); } catch (e) { console.warn('[math-model] EventBus 投递失败:', e.message); }
    try { if (L.KB && L.KB.addExperience) L.KB.addExperience(entry.from, entry.to, true, 0.5, 'math-model'); } catch (e) { console.warn('[math-model] KB 记录失败:', e.message); }
    allocations.push({ ...f, tx: entry.id, status: 'ALLOCATED' });
  }
  // 审计：对每条流的真实路径逐条 generateAudit（fail-closed——异常=audit_failed，绝不自证 valid）
  const perRoute = sol.flows.map(f => {
    const steps = f.route.slice(1).map((node, i) => ({
      seq: i + 1, state: f.route[i], action: 'move→' + node, result: node,
      reason: '最小费用流增广路径边；单位转运代价 ' + f.cost, confidence: 1, evidenceIds: []
    }));
    try {
      const a = L.generateAudit({ status: 'optimal', path: f.route, cost: f.cost, steps, opts: { hard: [], soft: [] } });
      return { flow: f.from + '→' + f.to + '(' + f.resource + '×' + f.amount + ')', status: a.status, noHallucination: a.noHallucination, verified: a.proof.verified };
    } catch (e) { return { flow: f.from + '→' + f.to, status: 'audit_failed', noHallucination: false, note: e.message }; }
  });
  const audit = {
    status: (perRoute.length > 0 && perRoute.every(a => a.status === 'valid')) ? 'valid'
      : (perRoute.some(a => a.status === 'audit_failed') ? 'audit_failed' : 'unverified'),
    noHallucination: perRoute.length > 0 && perRoute.every(a => a.noHallucination === true),
    proofPassed: perRoute.filter(a => a.verified === true).length,
    proofTotal: perRoute.length, perRoute,
    optimality: '运输问题最小费用流精确最优（逐次最短路增广，终止时残差网络无负费用圈）'
  };
  return { tick: world.tick, model, sol, allocations, audit, perceive };
}

// ===================== 演示：真实机器人机队（复用公开资料简化建模） =====================
function demo() {
  const hr = (t) => { line('\n' + '═'.repeat(72)); line('  ' + t); line('═'.repeat(72)); };
  const fleet = {
    name: '真实机器人机队·智能作业区', hub: 'HUB',
    entities: [
      { id: 'KIVA', name: 'Kiva/Proteus 仓储(电量75%)', type: 'warehouse', resources: { 任务: 12, 算力: 8 }, needs: {}, pos: 0 },
      { id: 'TUG', name: 'Aethon TUG 医院配送(电量18%)', type: 'hospital', resources: { 任务: 5 }, needs: { 充电位: 1 }, pos: 2 },
      { id: 'STAR', name: 'Starship 校园配送(电量22%)', type: 'sidewalk', resources: { 任务: 2 }, needs: { 充电位: 1, 任务: 3 }, pos: 3 },
      { id: 'RESC', name: '废墟搜救机器人(电量9%·濒危)', type: 'rescue', resources: { 任务: 3 }, needs: { 充电位: 1, 任务: 2 }, pos: 4 },
      { id: 'HUB', name: '中央调度/充电中枢', type: 'hub', resources: { 充电位: 3 }, needs: {}, pos: 1 }
    ]
  };
  const world = new VirtualWorld(fleet).setAdjacency([['KIVA', 'STAR', 1.5]]);

  hr('灵境 · 能力④ 数学建模｜' + world.region);
  line('  机队初始：');
  for (const e of world.entities) line('    ' + e.name + '：持有 ' + JSON.stringify(e.resources) + '  缺口 ' + JSON.stringify(e.needs));

  const r = runMathCycle(world);
  printModel(r.model);
  line('  [求解] 总调拨 ' + r.sol.totalFlow + ' 单位，最小总转运代价 ' + r.sol.totalCost
    + (r.sol.unmet === 0 ? '，全部需求满足 ✔' : '，未满足 ' + r.sol.unmet));
  line('  [最优解] ');
  r.allocations.forEach(a => line('      ' + a.tx + ' x_{' + a.from + '→' + a.to + '}^' + a.resource + ' = ' + a.amount
    + '  (路径[' + a.route.join('→') + '] 单位代价 ' + a.cost + ')'));
  line('  [审计] ' + r.audit.status + (r.audit.status === 'valid' ? ' ✔' : ' ✘') + '  不幻觉：'
    + (r.audit.noHallucination ? '是 ✔' : '否 ✘') + '  霍尔证明通过：' + r.audit.proofPassed + '/' + r.audit.proofTotal + ' 条流');
  line('  [最优性] ' + r.audit.optimality);

  hr('调度后机队状态（守恒校验）');
  for (const e of world.entities) line('    ' + e.name + '：持有 ' + JSON.stringify(e.resources) + '  缺口 ' + JSON.stringify(e.needs));
  ['任务', '充电位'].forEach(res => {
    const before = fleet.entities.reduce((s, e) => s + (e.resources[res] || 0), 0);
    const after = world.totalResource(res);
    line('    ' + res + '：' + before + ' → ' + (Math.round(after * 100) / 100) + '  ' + (Math.abs(before - after) < 1e-9 ? '守恒 ✔' : '⚠'));
  });

  hr('结论');
  line('  大脑先对机队做数学建模（运输问题），再用最小费用流求精确最优解：低电机器人各得充电位、');
  line('  KIVA 过载任务以最小总转运代价均衡给 STAR/RESC。模型可读、解可审计、不幻觉。');

  // 回归锁（审查 P0-5）：贪心反例 c=[[1,2],[2,100]]、供需各 1 —— 升序贪心得 101，真最优 = 4
  const cex = solveTransportation({ A: 1, B: 1 }, { C: 1, D: 1 }, { A: { C: 1, D: 2 }, B: { C: 2, D: 100 } });
  const cexOK = Math.abs(cex.cost - 4) < 1e-9 && cex.flow === 2;
  line('  [回归] 贪心反例（c=[[1,2],[2,100]]）：本求解器总代价=' + cex.cost + '（旧贪心得 101）' + (cexOK ? ' ✔ 最优' : ' ✘'));
  // 回归锁（自满足假流）：A 持2缺3、B 持5 —— A 的自有库存不得经 S→A→T "自己满足自己"，须由 B 供 3
  const self = solveTransportation({ A: 2, B: 5 }, { A: 3 }, { B: { A: 1 } });
  const selfOK = self.flow === 3 && self.assignments.length === 1 && self.assignments[0].i === 'B' && Math.abs(self.cost - 3) < 1e-9;
  line('  [回归] 自满足假流（A持2缺3/B持5）：净流=' + self.flow + ' 供方=' + (self.assignments[0] && self.assignments[0].i) + ' 代价=' + self.cost + (selfOK ? ' ✔ 无假流' : ' ✘'));
  const ok = world.ledger.length > 0 && r.sol.unmet === 0 && cexOK && selfOK && r.audit.status === 'valid'
    && ['任务', '充电位'].every(res => Math.abs(fleet.entities.reduce((s, e) => s + (e.resources[res] || 0), 0) - world.totalResource(res)) < 1e-9);
  line('\n  [自测] ' + (ok ? 'PASS ✔ 数学建模→最优分配闭环可跑、最优（最小费用流）、守恒、可审计' : 'FAIL ✘'));
  return ok;
}
if (require.main === module) demo();
module.exports = { VirtualWorld, buildModel, solveModel, solveTransportation, runMathCycle, allPairsShortest, demo };

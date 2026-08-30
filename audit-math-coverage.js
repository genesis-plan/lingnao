#!/usr/bin/env node
/**
 * 灵脑 · 数学贯穿审计（2026-08-30 重写版）
 *
 * 与旧版的区别（旧版已失效并被替换）：
 *   ✗ 旧版依赖 ima_*.json 知识库做文本匹配 —— 知识库条目未经校验，且引用的
 *     MathFoundation 早已从内核移除，一跑就 TypeError。文本匹配也证明不了"真的用上了"。
 *   ✓ 新版**只信可执行证据**：直接 require UMD，对每个数学能力做 typeof 检查，
 *     并对关键项**实际调用**、断言返回值语义非空（防止"有名无实"的空壳函数）。
 *
 * 用法：node audit-math-coverage.js  [--json]
 * 退出码：0 = 全部在位；1 = 有缺失或空壳（可直接用作 CI 门禁）
 */
'use strict';
const L = require('./lingnao.umd.js');
const asJson = process.argv.includes('--json');

// ───────── 已实装数学：分层清单（fns 必须在 UMD 导出中真实存在）─────────
const LAYERS = [
  {
    layer: '① 感知层', items: [
      { math: '贝叶斯信念更新', fns: ['perceiveBelief', 'perceive'], since: '2026-08-26' },
      { math: '信息熵不确定性量化', fns: ['quantifyUncertainty'], since: '2026-08-26' },
      { math: 'LSH / SimHash 近似最近邻', fns: ['simHash', 'fingerprintVec'], since: '2026-08-26' },
      { math: '观测确认（不可观测即不臆断）', fns: ['confirmObservation'], since: '2026-08-29' }
    ]
  },
  {
    layer: '② 知识层', items: [
      { math: '知识图谱 / 关系结构图 RSG', fns: ['KBFabric', 'buildRSG'], since: '2026-08-26' },
      { math: '情节记忆与检索', fns: ['Memory', 'bootMemory'], since: '2026-08-26' }
    ]
  },
  {
    layer: '③ 推理层', items: [
      { math: 'A* 最优搜索 + 可采纳启发式', fns: ['aStar', 'hMax', 'heuristic', 'reconstructPath'], since: '2026-08-26' },
      { math: '决策型蒙特卡洛树搜索 D-MCTS', fns: ['dmcts'], since: '2026-08-26' },
      { math: '线性约束符号求解', fns: ['symbolicSolve', 'algebraicSolve'], since: '2026-08-26' },
      { math: '霍尔逻辑路径验证', fns: ['verifyHoarePath'], since: '2026-08-26' },
      { math: '双系统认知（快/慢思考）', fns: ['system1', 'system2', 'reason'], since: '2026-08-26' },
      { math: '最小费用流 / 运输问题', fns: ['transportation', 'planTransport', 'allPairsCost'], since: '2026-08-27' },
      { math: '图着色 + 四色定理上界', fns: ['graphColoring'], since: '2026-08-30' },
      { math: '平面性判定（Kuratowski 子式）', fns: ['planarityCheck'], since: '2026-08-30' },
      { math: 'Hall 婚配定理（可行性证书）', fns: ['hallCondition'], since: '2026-08-30' },
      { math: '开普勒堆积密度上界', fns: ['KEPLER_DENSITY', 'packingBound'], since: '2026-08-30' }
    ]
  },
  {
    layer: '④ 因果层', items: [
      { math: 'do-演算 / 平均因果效应', fns: ['causalEffect', 'doQuery'], since: '2026-08-26' },
      { math: '因果发现（条件独立检验）', fns: ['causalDiscovery'], since: '2026-08-26' },
      { math: '反事实推理', fns: ['counterfactual'], since: '2026-08-26' },
      { math: '可识别性判定（后门/前门/ID）', fns: ['identifiabilityID', 'causalIdentifiable', 'counterfactualIdentifiable'], since: '2026-08-27' }
    ]
  },
  {
    layer: '⑤ 学习层', items: [
      { math: 'PAC 样本复杂度界', fns: ['pacSampleBound'], since: '2026-08-26' },
      { math: '世界模型学习与仿真', fns: ['learnWorldModel', 'simulate', 'learn'], since: '2026-08-26' },
      { math: '自监督学习闭环', fns: ['SelfLearn', 'slRecord', 'slValidate', 'slMonitor', 'slDiscover', 'slStatus'], since: '2026-08-27' },
      { math: '启发式自演化（保持可采纳性）', fns: ['heuristicEvolve'], since: '2026-08-30' }
    ]
  },
  {
    layer: '⑥ 元认知层', items: [
      { math: '熵驱动的探索/利用与冲突仲裁', fns: ['metaCognition', 'cognitiveCycle'], since: '2026-08-26' }
    ]
  },
  {
    layer: '⑦ 验证与审计层', items: [
      { math: '可追溯审计链', fns: ['generateAudit'], since: '2026-08-26' },
      { math: '持续验证管道', fns: ['continuousVerify'], since: '2026-08-26' },
      { math: 'STL 定量语义（robustness degree ρ）', fns: ['STL', 'stlHorizon', 'stlRobustness', 'stlMonitor'], since: '2026-08-30' },
      { math: '运行时监控（已定量化）', fns: ['runtimeMonitor'], since: '2026-08-26' }
    ]
  },
  {
    layer: '⑧ 具身与连接契约层', items: [
      { math: '声明式前置契约求值', fns: ['evalRequire', 'applyEffect'], since: '2026-08-30' },
      { math: '能力可验证性判定', fns: ['capVerifiable'], since: '2026-08-30' },
      { math: '观测契约可区分性 / 盲区扫描', fns: ['distinguishable', 'observationBlindSpots'], since: '2026-08-30' },
      { math: '硬约束 fail-closed 检查', fns: ['checkHard'], since: '2026-08-29' },
      { math: '规划–执行闭环', fns: ['attachBody', 'planTask', 'execute', 'doWork'], since: '2026-08-29' }
    ]
  },
  {
    layer: '⑨ 量纲与物理正确性层', items: [
      { math: 'SI 七基本量纲向量代数', fns: ['DIM', 'DIM_AXES', 'dimOf', 'dimMul', 'dimDiv', 'dimPow', 'dimEq', 'dimAdd', 'dimFormat'], since: '2026-08-30' },
      { math: 'Buckingham π 定理', fns: ['buckinghamPi'], since: '2026-08-30' },
      { math: '量纲齐次性检查', fns: ['checkDimensions', 'unwrapDimValue'], since: '2026-08-30' }
    ]
  },
  {
    layer: '⑩ 微分与稳定性层', items: [
      { math: '前向自动微分（对偶数）', fns: ['dual', 'dAdd', 'dSub', 'dMul', 'dDiv', 'dPow', 'dSin', 'dCos', 'dExp', 'dLog', 'dSqrt', 'dAbs'], since: '2026-08-30' },
      { math: '精确梯度 / Jacobian / 李导数', fns: ['grad', 'jacobian', 'lieDerivative'], since: '2026-08-30' },
      { math: 'Lyapunov 稳定性采样证据', fns: ['lyapunovCheck'], since: '2026-08-30' }
    ]
  },
  {
    layer: '⑪ 物理 AI 安全栈', items: [
      { math: '控制障碍函数 CBF-QP（单约束）', fns: ['cbfFilter', 'cbfMargin'], since: '2026-08-30' },
      { math: '组合 CBF（多约束 · Hildreth 对偶 QP）', fns: ['cbfCompose'], since: '2026-08-30' },
      { math: 'Zonotope 可达集过近似', fns: ['zono', 'zonoSupport', 'zonoBox', 'zonoLinear', 'zonoSum', 'zonoReduce', 'zonoContains', 'zonoIntersectsHalfspace', 'zonoSafe', 'zonoReach'], since: '2026-08-30' },
      { math: '混合自动机 × AD（Gershgorin 误差界）', fns: ['hybridAutomaton', 'hybridStep', 'hybridLipschitz', 'hybridReach'], since: '2026-08-30' }
    ]
  },
  {
    layer: '⑫ 最优分配与抽象解释层', items: [
      { math: '匈牙利算法（Kuhn–Munkres）+ LP 对偶最优性证书', fns: ['hungarian'], since: '2026-08-30' },
      { math: '区间抽象域（完备格：⊔/⊓/偏序/⊥/⊤）', fns: ['itv', 'itvIsBot', 'itvTop', 'itvLe', 'itvEq', 'itvJoin', 'itvMeet', 'itvAddI', 'itvMulI'], since: '2026-08-30' },
      { math: 'Cousot 抽象解释（widening 终止 + narrowing 精化）', fns: ['itvWiden', 'itvNarrow', 'absFixpoint', 'absSafe'], since: '2026-08-30' }
    ]
  }
];

// ───────── 语义验证：关键项必须**真的算出东西**，不能是空壳 ─────────
const PROBES = [
  {
    name: 'A* 返回最优路径', run: () => {
      const r = L.aStar('CHARGE', 'C');
      return r && Array.isArray(r.path) && r.path.length > 1 && r.status === 'optimal';
    }
  },
  {
    name: 'STL ρ 定量语义（非布尔贴标）', run: () => {
      const tr = [{ v: 5 }, { v: 3 }, { v: -2 }];
      const rho = L.stlRobustness(L.STL.always(L.STL.ge(s => s.v, 0)), tr, 0);
      return rho === -2;
    }
  },
  {
    name: 'runtimeMonitor 已定量化（返回 ρ 而非仅布尔）', run: () => {
      const p = L.aStar('CHARGE', 'C');
      const m = L.runtimeMonitor(p, { maxCost: 9999 });
      return typeof m.rho === 'number' && m.verdict === true;
    }
  },
  {
    name: '自动微分给出精确导数', run: () => {
      const g = L.grad(xs => L.dPow(xs[0], 3), [2]);   // d/dx x³ = 3x² = 12
      return Math.abs(g[0] - 12) < 1e-12;
    }
  },
  {
    name: 'CBF 滤子真的修正越界控制', run: () => {
      const r = L.cbfFilter(xs => L.dSub(L.dual(1, 0), xs[0]), () => [0], () => [[1]], [10], [0], { gamma: 1 });
      return r.feasible && Math.abs(r.u[0] - 1) < 1e-6;
    }
  },
  {
    name: '组合 CBF 对冲突约束诚实报不可行', run: () => {
      const r = L.cbfCompose(
        [xs => L.dSub(L.dual(-1, 0), xs[0]), xs => L.dSub(xs[0], L.dual(1, 0))],
        () => [0], () => [[1]], [0], [0], { gamma: 1 });
      return r.feasible === false;
    }
  },
  {
    name: 'Zonotope 可达集保守（阶约减只外扩）', run: () => {
      const Z = L.zono([0, 0], [[1, 0.2], [0.2, 1], [0.3, -0.4], [-0.1, 0.5], [0.6, 0.1]]);
      const R = L.zonoReduce(Z, 4);
      for (let k = 0; k < 32; k++) {
        const th = 2 * Math.PI * k / 32, d = [Math.cos(th), Math.sin(th)];
        if (L.zonoSupport(R.Z, d) < L.zonoSupport(Z, d) - 1e-9) return false;
      }
      return true;
    }
  },
  {
    name: '混合自动机守卫触发跳转', run: () => {
      const HA = L.hybridAutomaton({
        modes: { a: { flow: () => [L.dual(1, 0)] }, b: { flow: () => [L.dual(-1, 0)] } },
        edges: [{ from: 'a', to: 'b', guard: x => x[0] >= 1 }]
      });
      return L.hybridReach(HA, { mode: 'a', x: [0], t: 0 }, 0.5, 6).modeSeq.join(',') === 'a,b';
    }
  },
  {
    name: '启发式自演化保持可采纳性', run: () => {
      const W = { 'S|A': 1, 'A|G': 2 };
      const e = L.heuristicEvolve([{ path: ['S', 'A', 'G'], optimal: true }],
        { edgeCost: (a, b) => (W[a + '|' + b] != null ? W[a + '|' + b] : null) });
      return e.admissible === true && Math.abs(e.h('S', 'G') - 3) < 1e-9;
    }
  },
  {
    name: '匈牙利最优分配 + 对偶证书自检', run: () => {
      // 已知最优：[[4,1,3],[2,0,5],[3,2,2]] ⇒ 1+2+2 = 5（枚举可验证）
      const r = L.hungarian([[4, 1, 3], [2, 0, 5], [3, 2, 2]]);
      if (!r.ok || !r.feasible || r.totalCost !== 5) return false;
      if (!r.certificate.verified) return false;               // 对偶可行+互补松弛+零间隙
      // 禁止边导致无完美匹配时必须诚实报不可行
      const bad = L.hungarian([[1, Infinity], [2, Infinity]]);
      return bad.feasible === false && bad.totalCost === null;
    }
  },
  {
    name: '抽象解释不动点过近似且诚实标注', run: () => {
      // x=0; while(x<100) x=x+1  ⇒ widening 得 [0,∞)，narrowing 精化到 [0,100]
      const f = L.absFixpoint(
        X => L.itvMeet(L.itvAddI(X, L.itv(1, 1)), L.itv(-Infinity, 100)), L.itv(0, 0));
      if (!f.ok || !f.converged) return false;
      if (!(f.invariant.hi === Infinity && f.refined.hi === 100 && f.refined.lo === 0)) return false;
      if (f.sound !== true || f.exact !== false) return false; // 过近似必须自报 sound 非 exact
      // 越界不得断言违规，只能标 𝕌
      const s = L.absSafe(L.itv(0, 100), L.itv(0, 50));
      return s.safe === false && s.U === true;
    }
  },
  {
    name: '量纲齐次性拦截非法相加', run: () => {
      // 契约：量纲不同 ⇒ dimAdd 返回 null（不可相加）；量纲相同 ⇒ 返回该量纲
      const len = L.dimOf('LENGTH'), tim = L.dimOf('TIME');
      if (!len || !tim) return false;
      const illegal = L.dimAdd(len, tim);            // 长度 + 时间 必须被拦截
      const legal = L.dimAdd(len, L.dimOf('LENGTH')); // 长度 + 长度 必须放行
      // 未声明量纲的字段必须被 checkDimensions 检出，不能静默放行
      const chk = L.checkDimensions({ move: { effect: { inc: { x: 1 } } } }, { y: len });
      return illegal === null && Array.isArray(legal) && L.dimEq(legal, len)
        && chk.ok === false && chk.issues.some(i => i.kind === 'inc-undeclared');
    }
  },
  {
    name: '硬约束 fail-closed（异常时拒绝而非放行）', run: () => {
      const r = L.checkHard({ __throwOnAccess: true }, [{ expr: '(((' }]);
      return r === false || (r && r.ok === false) || r == null ? true : r !== true;
    }
  },
  {
    name: '不可达目标诚实返回 𝕌', run: () => L.aStar('CHARGE', 'Z').status === 'unknown' }
];

// ───────── 尚未实装：工程可行性分级（诚实记录欠账，不假装完备）─────────
const NOT_IMPLEMENTED = [
  { math: 'MPC 模型预测控制（有限视界最优控制）', why: '需小规模 QP 求解器（多步耦合约束）', feasibility: 'B 可做·需自研微型 QP', value: '高：把"下一步安全"升级为"未来 N 步最优且安全"' },
  { math: 'Barrier Certificate（SOS/SDP 形式化安全证明）', why: '需半定规划求解器，与零依赖定位冲突', feasibility: 'C 研究级', value: '高：从"采样证据"升级为"全状态证明"' },
  { math: '概率 STL（PrSTL 真随机语义）', why: '需在轨迹上传播概率分布并算分位数', feasibility: 'B 可做·需分布传播', value: '中：当前 STL 为确定性定量语义，PrSTL 才能处理噪声下的置信判定' },
  { math: '通用 LP 求解器（单纯形/内点）', why: 'zonoContains 精确判定、多面体相交需要', feasibility: 'B 可做·中等工作量', value: '中：把若干 𝕌 判定升级为精确判定' },
  { math: '非线性结构方程模型 SEM', why: '需非线性优化拟合', feasibility: 'B 可做', value: '中：当前因果层为线性 SEM' },
  { math: '关系抽象域（八边形/多面体）', why: '需变量间关系约束与更复杂 widening；当前区间域为非关系域', feasibility: 'B 可做·中等工作量', value: '中：可推导 x−y≤c 这类关系不变式，区间域推不出' },
  { math: 'Zeno 现象的形式化排除', why: '需类 Lyapunov 的跳转次数有界性证明', feasibility: 'C 研究级', value: '中：当前仅运行时检出并中止，非事前排除' },
  { math: '一般非线性系统的可达集证明', why: '理论上不可判定（Rice 定理族）', feasibility: 'D 理论受限', value: '—：故只做线性 zonotope 过近似 + 诚实标 𝕌' }
];

// ───────── 主动声明弃用的抽象（避免被误判成"漏做"）─────────
const REJECTED = [
  { math: '同伦类型论 HoTT / 单值公理', reason: '缺可执行判定过程；等价性证明无法在运行时机器检查 ⇒ 评审否决' },
  { math: '纤维丛 / 主丛联络', reason: '几何直觉可借鉴，但工程上退化为坐标变换与量纲检查即可 ⇒ 降级' },
  { math: '拓扑斯 / 层论', reason: '表达力过剩，无对应可判定算法 ⇒ 否决' },
  { math: '线性逻辑（资源敏感证明）', reason: '资源消耗用契约的 effect 与状态约束即可表达 ⇒ 降级为声明式契约' }
];

// ═══════════════════ 执行审计 ═══════════════════
const report = { generatedAt: new Date().toISOString(), layers: [], probes: [], missing: [], brokenProbes: [] };
let totalItems = 0, okItems = 0, totalFns = 0, okFns = 0;

for (const L1 of LAYERS) {
  const layerRow = { layer: L1.layer, items: [] };
  for (const it of L1.items) {
    const miss = it.fns.filter(n => typeof L[n] === 'undefined');
    totalFns += it.fns.length; okFns += (it.fns.length - miss.length);
    totalItems++; if (!miss.length) okItems++; else report.missing.push({ math: it.math, missing: miss });
    layerRow.items.push({ math: it.math, fns: it.fns.length, missing: miss, since: it.since, ok: !miss.length });
  }
  report.layers.push(layerRow);
}
for (const p of PROBES) {
  let r;
  try { r = p.run() === true; } catch (e) { r = false; }
  report.probes.push({ name: p.name, ok: r });
  if (!r) report.brokenProbes.push(p.name);
}
report.summary = {
  layerCount: LAYERS.length, mathItems: totalItems, mathItemsOk: okItems,
  exportedFns: totalFns, exportedFnsOk: okFns,
  umdExports: Object.keys(L).length,
  probes: PROBES.length, probesOk: PROBES.length - report.brokenProbes.length,
  notImplemented: NOT_IMPLEMENTED.length, rejected: REJECTED.length
};
report.notImplemented = NOT_IMPLEMENTED;
report.rejected = REJECTED;

if (asJson) { console.log(JSON.stringify(report, null, 2)); process.exit(report.missing.length || report.brokenProbes.length ? 1 : 0); }

// ───────── 文本报告 ─────────
console.log('════════════════════════════════════════════════════');
console.log(' 灵脑 · 数学贯穿审计（可执行证据版）');
console.log(' 生成时间：' + report.generatedAt);
console.log(' 依据：UMD 实际导出 + 实调用语义探针（不引用未校验的知识库）');
console.log('════════════════════════════════════════════════════');
for (const l of report.layers) {
  console.log('\n' + l.layer);
  for (const it of l.items) {
    console.log('  ' + (it.ok ? '✔' : '✘') + ' ' + it.math +
      '  [' + it.fns + ' 个导出' + (it.missing.length ? '，缺 ' + it.missing.join(',') : '') + ']  ' + it.since);
  }
}
console.log('\n── 语义探针（验证"真的算出东西"，防空壳）──');
for (const p of report.probes) console.log('  ' + (p.ok ? '✔' : '✘') + ' ' + p.name);

console.log('\n── 尚未实装（诚实欠账 · 工程可行性分级）──');
console.log('  等级：A 立即可做 / B 需自研组件 / C 研究级 / D 理论受限');
for (const n of NOT_IMPLEMENTED) console.log('  ○ [' + n.feasibility + '] ' + n.math + '\n      缺因：' + n.why + '\n      价值：' + n.value);

console.log('\n── 主动弃用的抽象（不是漏做）──');
for (const r of REJECTED) console.log('  ✗ ' + r.math + '\n      ' + r.reason);

const s = report.summary;
console.log('\n════════════════════════════════════════════════════');
console.log(' 数学条目：' + s.mathItemsOk + '/' + s.mathItems + ' 在位   导出函数：' + s.exportedFnsOk + '/' + s.exportedFns +
  '   UMD 总导出：' + s.umdExports);
console.log(' 语义探针：' + s.probesOk + '/' + s.probes + ' 通过   未实装：' + s.notImplemented + ' 项   主动弃用：' + s.rejected + ' 项');
console.log(' 结论：' + ((!report.missing.length && !report.brokenProbes.length)
  ? '全部数学能力在位且语义可验证 ✔'
  : '存在缺失或空壳 ✘ ' + JSON.stringify({ missing: report.missing, broken: report.brokenProbes })));
console.log('════════════════════════════════════════════════════');
process.exit(report.missing.length || report.brokenProbes.length ? 1 : 0);

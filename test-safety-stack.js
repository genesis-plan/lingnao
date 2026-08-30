#!/usr/bin/env node
/**
 * 物理 AI 安全栈测试（2026-08-30 下午补齐）
 *   ① STL 定量语义 ρ（robustness degree）—— 含 𝕌 不可判定的诚实标注
 *   ② Zonotope 可达集过近似 —— 保守性（sound）与分离证书
 *   ③ 组合 CBF（多约束 QP · Hildreth 对偶）—— 含约束冲突诚实报不可行
 *   ④ 混合自动机 × 自动微分 —— 模式跳转、Gershgorin 可证明上界、Zeno 检测
 *   ⑤ 启发式自演化 —— 可采纳性保持与高估撤回
 *   ⑥ runtimeMonitor 的 STL 定量化改造（不破坏既有布尔输出）
 * 全部断言不依赖外部库。
 */
'use strict';
const L = require('./lingnao.umd.js');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  →  ' + JSON.stringify(extra) : '')); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-9 : eps); }
function section(t) { console.log('\n── ' + t + ' ──'); }

// ══════════════ ① STL 定量语义 ══════════════
section('① STL 定量语义 ρ（robustness degree）');
{
  const trace = [{ v: 5 }, { v: 3 }, { v: 1 }, { v: -2 }];
  const get = s => s.v;

  // □(v ≥ 0)：ρ = min(5,3,1,−2) = −2 ⇒ 违反，严重度 2
  const alwaysGe0 = L.STL.always(L.STL.ge(get, 0));
  ok(near(L.stlRobustness(alwaysGe0, trace, 0), -2), '□(v≥0) 的 ρ = min = −2（手算对照）',
    L.stlRobustness(alwaysGe0, trace, 0));
  const m1 = L.stlMonitor(alwaysGe0, trace);
  ok(m1.verdict === false && near(m1.severity, 2), '□(v≥0) 判违反且严重度 = 2', m1);

  // ◇(v ≥ 4)：ρ = max(1,−1,−3,−6) = 1 ⇒ 满足，余量 1
  const evGe4 = L.STL.eventually(L.STL.ge(get, 4));
  const m2 = L.stlMonitor(evGe4, trace);
  ok(m2.verdict === true && near(m2.rho, 1) && near(m2.margin, 1), '◇(v≥4) 满足且安全余量 = 1', m2);

  // 有界 always：□_[0,2](v≥0) = min(5,3,1) = 1 ⇒ 满足
  ok(near(L.stlRobustness(L.STL.always(L.STL.ge(get, 0), 0, 2), trace, 0), 1),
    '□_[0,2](v≥0) 的 ρ = 1（窗口裁剪正确）');

  // 视界检查：□_[0,2] 需 3 步，只给 2 步 ⇒ 𝕌（诚实不判）
  const short = L.stlMonitor(L.STL.always(L.STL.ge(get, 0), 0, 2), trace.slice(0, 2));
  ok(short.verdict === null && short.enough === false && short.horizon === 2,
    '轨迹短于公式视界 ⇒ verdict = null（𝕌），绝不冒充满足', short);

  // until 语义手算：(v≥0) U_[0,3] (v≤1) ⇒ ρ = 0 ⇒ 恰在边界 ⇒ 𝕌
  const untilPhi = L.STL.until(L.STL.ge(get, 0), L.STL.le(get, 1), 0, 3);
  ok(near(L.stlRobustness(untilPhi, trace, 0), 0), 'until 定量语义 ρ = 0（sup-inf 手算对照）',
    L.stlRobustness(untilPhi, trace, 0));
  const m3 = L.stlMonitor(untilPhi, trace);
  ok(m3.verdict === null, 'ρ ≈ 0 落在满足/违反边界 ⇒ 𝕌（不下结论）', m3);

  // 合取取 min、否定取负
  const conj = L.STL.and(L.STL.ge(get, 0), L.STL.le(get, 10));
  ok(near(L.stlRobustness(conj, trace, 0), 5), '∧ 取 min：min(5−0, 10−5) = 5');
  ok(near(L.stlRobustness(L.STL.not(L.STL.ge(get, 0)), trace, 0), -5), '¬ 取负：−(5) = −5');
  // φ→ψ ≡ ¬φ∨ψ
  ok(near(L.stlRobustness(L.STL.implies(L.STL.ge(get, 0), L.STL.ge(get, 3)), trace, 0), 2),
    '→ 语义 max(−ρφ, ρψ) = max(−5, 2) = 2');

  // 视界计算
  ok(L.stlHorizon(L.STL.always(L.STL.eventually(L.STL.ge(get, 0), 0, 3), 0, 2)) === 5,
    '嵌套时序算子视界相加：□_[0,2]◇_[0,3] ⇒ 5');
  // 未知算子必须报错，不能静默当满足
  let threw = false;
  try { L.stlRobustness({ op: 'wat' }, trace, 0); } catch (e) { threw = true; }
  ok(threw, '未知算子抛错（不静默返回"满足"）');
}

// ══════════════ ② Zonotope 可达集 ══════════════
section('② Zonotope 可达集过近似');
{
  const Z = L.zono([0, 0], [[1, 0], [0, 1]]);          // 原点单位方盒
  const box = L.zonoBox(Z);
  ok(box.lo[0] === -1 && box.hi[1] === 1, '包围盒 c ± Σ|gᵢ| 精确', box);
  ok(near(L.zonoSupport(Z, [1, 1]), 2), '支撑函数 h_Z([1,1]) = 0 + 1 + 1 = 2（闭式精确）');

  const AZ = L.zonoLinear([[2, 0], [0, 3]], Z);
  const bx2 = L.zonoBox(AZ);
  ok(bx2.hi[0] === 2 && bx2.hi[1] === 3, '线性映射 A·Z 精确（生成元同步变换）', bx2);

  const S = L.zonoSum(Z, L.zono([1, 1], [[0.5, 0]]));
  const bx3 = L.zonoBox(S);
  ok(near(bx3.lo[0], -0.5) && near(bx3.hi[0], 2.5) && near(bx3.hi[1], 2),
    'Minkowski 和 = 中心相加 + 生成元并集（精确）', bx3);

  const c1 = L.zonoContains(Z, [0.5, 0.5]);
  ok(c1.inside === true && near(c1.beta[0], 0.5), '含点判定精确（|βᵢ|≤1 显式系数）', c1);
  const c2 = L.zonoContains(Z, [2, 0]);
  ok(c2.inside === false, '包围盒外的点被精确排除', c2);
  const c3 = L.zonoContains(L.zono([0, 0], [[1, 0], [0, 1], [1, 1]]), [0.1, 0.1]);
  ok(c3.inside === null && c3.U === true, '生成元数 > 维数 ⇒ 精确判定需 LP ⇒ 𝕌（诚实不判）', c3);

  // 阶约减的保守性：凸集 Z ⊆ Z' ⟺ ∀d: h_Z(d) ≤ h_Z'(d)（此处抽样多方向做必要条件检验）
  const Zbig = L.zono([0, 0], [[1, 0.2], [0.2, 1], [0.3, -0.4], [-0.1, 0.5], [0.6, 0.1]]);
  const red = L.zonoReduce(Zbig, 4);
  let outerOk = true, worst = null;
  for (let k = 0; k < 64; k++) {
    const th = 2 * Math.PI * k / 64, d = [Math.cos(th), Math.sin(th)];
    const so = L.zonoSupport(Zbig, d), sr = L.zonoSupport(red.Z, d);
    if (sr < so - 1e-9) { outerOk = false; worst = { d, so, sr }; }
  }
  ok(outerOk, '阶约减只外扩不内缩（64 方向支撑函数检验 ⇒ 保守 sound）', worst);
  ok(red.Z.G.length <= 4, '阶约减后生成元数受控 ≤ 4', red.Z.G.length);

  // 分离超平面证书
  const safe = L.zonoSafe(Z, [{ a: [1, 0], b: -2 }]);   // 不安全区 x₀ ≤ −2
  ok(safe.safe === true && safe.separatingIndex === 0, '可达集与不安全集分离 ⇒ 给出分离证书', safe);
  const unk = L.zonoSafe(Z, [{ a: [1, 0], b: 0.5 }]);   // 不安全区与 Z 重叠
  ok(unk.safe === null && unk.U === true, '无分离证书 ⇒ 𝕌 并按保守原则视为不安全（不放行）', unk);

  const hs = L.zonoIntersectsHalfspace(Z, [1, 0], -0.5);
  ok(hs.intersects === true && near(hs.minValue, -1), '半空间相交判定用支撑函数精确', hs);

  // 收缩系统可达集：A = 0.5I ⇒ 2 步后半径 0.25
  const R = L.zonoReach([[0.5, 0], [0, 0.5]], null, null, Z, 2);
  const rb = L.zonoBox(R.final);
  ok(near(rb.hi[0], 0.25) && R.sound === true, '线性可达递推精确（0.5² = 0.25）', rb);
  ok(R.seq.length === 3 && R.boxes.length === 3, '可达序列含初始集共 steps+1 个');
}

// ══════════════ ③ 组合 CBF ══════════════
section('③ 组合 CBF（多约束 QP · Hildreth 对偶）');
{
  // 1D 双积分简化：ẋ = u（f = 0，g = 1）；安全区 −1 ≤ x ≤ 1
  const f = () => [0];
  const g = () => [[1]];
  const hUp = xs => L.dSub(L.dual(1, 0), xs[0]);        // h₁ = 1 − x  ⇒ x ≤ 1
  const hLo = xs => L.dAdd(xs[0], L.dual(1, 0));        // h₂ = x + 1  ⇒ x ≥ −1

  // 标称控制 u = 10 会冲出上界 ⇒ 应被压到 u = 1（约束 −u ≥ −1）
  const r1 = L.cbfCompose([hUp, hLo], f, g, [10], [0], { gamma: 1 });
  ok(r1.feasible === true && near(r1.u[0], 1, 1e-6), '双约束下越界控制被压到边界 u = 1', r1.u);
  ok(r1.active.length === 1 && r1.active[0] === 0, '仅上界约束起作用（active set 正确）', r1.active);

  // 反向：u = −10 应被压到 −1
  const r2 = L.cbfCompose([hUp, hLo], f, g, [-10], [0], { gamma: 1 });
  ok(r2.feasible === true && near(r2.u[0], -1, 1e-6), '反向越界被压到 u = −1', r2.u);

  // 标称控制本身安全 ⇒ 不修正
  const r3 = L.cbfCompose([hUp, hLo], f, g, [0.5], [0], { gamma: 1 });
  ok(r3.feasible === true && near(r3.u[0], 0.5) && r3.active.length === 0,
    '标称控制已满足全部约束 ⇒ 原样返回，无多余修正', r3.u);

  // 与单约束 cbfFilter 结果一致（退化一致性）
  const single = L.cbfFilter(hUp, f, g, [10], [0], { gamma: 1 });
  const comp1 = L.cbfCompose([hUp], f, g, [10], [0], { gamma: 1 });
  ok(near(single.u[0], comp1.u[0], 1e-6), '单约束时组合 CBF 与 cbfFilter 结果一致', [single.u[0], comp1.u[0]]);

  // 冲突约束：要求同时 x ≤ −1 且 x ≥ 1 ⇒ 无解，必须诚实报不可行
  const hA = xs => L.dSub(L.dual(-1, 0), xs[0]);        // −1 − x ≥ 0 ⇒ x ≤ −1
  const hB = xs => L.dSub(xs[0], L.dual(1, 0));         //  x − 1 ≥ 0 ⇒ x ≥ 1
  const r4 = L.cbfCompose([hA, hB], f, g, [0], [0], { gamma: 1 });
  ok(r4.feasible === false && r4.u === null, '约束互相冲突 ⇒ 诚实返回不可行且不给控制量', r4.reason);
  ok(Array.isArray(r4.violated) && r4.violated.length > 0, '冲突集被具体列出（可复验）', r4.violated);

  // 控制不可影响的约束（L_g h ≈ 0）且已违反 ⇒ 不可行
  const g0 = () => [[0]];
  const r5 = L.cbfCompose([hB], f, g0, [0], [0], { gamma: 1 });
  ok(r5.feasible === false && r5.uncontrollable.length === 1,
    'L_g h ≈ 0 且约束未满足 ⇒ 标出不可控约束，绝不谎称安全', r5.reason);

  // 滤后必须真的满足所有 CBF 约束
  const ver = [hUp, hLo].every(h => L.cbfMargin(h, f, g, r1.u, [0], { gamma: 1 }).margin >= -1e-6);
  ok(ver, '滤后控制经 cbfMargin 复验：所有约束裕度 ≥ 0');
}

// ══════════════ ④ 混合自动机 × AD ══════════════
section('④ 混合自动机 × 自动微分');
{
  // 温控双模式：heat 升温至 2 → cool 降温至 0 → heat …
  const HA = L.hybridAutomaton({
    name: 'thermostat',
    modes: {
      heat: { flow: xs => [L.dual(1, 0)], inv: x => x[0] <= 2.5 },
      cool: { flow: xs => [L.dual(-1, 0)], inv: x => x[0] >= -0.5 }
    },
    edges: [
      { from: 'heat', to: 'cool', guard: x => x[0] >= 2, label: 'overheat' },
      { from: 'cool', to: 'heat', guard: x => x[0] <= 0, label: 'chill' }
    ]
  });
  const R = L.hybridReach(HA, { mode: 'heat', x: [0], t: 0 }, 0.5, 24);
  ok(R.modeSeq.length >= 3 && R.modeSeq[0] === 'heat' && R.modeSeq[1] === 'cool',
    '守卫触发离散跳转，模式序列交替', R.modeSeq);
  ok(R.jumps.length >= 2 && R.zeno === false, '跳转被记录且未误报 Zeno', { jumps: R.jumps.length, zeno: R.zeno });
  const maxX = Math.max.apply(null, R.traj.map(s => s.x[0]));
  ok(maxX <= 2.5 + 1e-9, '温度被守卫约束在不变式内（max = ' + maxX.toFixed(3) + '）');
  ok(R.invViolations.length === 0, '不变式全程未被违反', R.invViolations.length);

  // Gershgorin 可证明上界：ẋ = 2x ⇒ J = [[2]] ⇒ ‖J‖_∞ = 2
  const HA2 = L.hybridAutomaton({ modes: { m: { flow: xs => [L.dMul(L.dual(2, 0), xs[0])] } }, edges: [] });
  const lip = L.hybridLipschitz(HA2, { mode: 'm', x: [1] });
  ok(near(lip.LinfNorm, 2) && near(lip.jacobian[0][0], 2),
    'AD Jacobian 精确 + Gershgorin 给出 ρ(J) ≤ 2（对照解析解）', lip.LinfNorm);
  ok(near(lip.errorAmplify(1), Math.exp(2)), '误差放大上界 e^{L·t} 可算（可证明，非估计）');

  // 常数流 ⇒ Jacobian 为零 ⇒ Lipschitz 0
  ok(near(L.hybridLipschitz(HA, { mode: 'heat', x: [1] }).LinfNorm, 0), '常数向量场的 Lipschitz 常数 = 0');

  // RK4 精度：ẋ = x, x(0)=1, t=1 ⇒ e ≈ 2.71828
  const HA3 = L.hybridAutomaton({ modes: { m: { flow: xs => [xs[0]] } }, edges: [] });
  const R3 = L.hybridReach(HA3, { mode: 'm', x: [1], t: 0 }, 0.05, 20);
  const xe = R3.traj[R3.traj.length - 1].x[0];
  ok(Math.abs(xe - Math.E) < 1e-6, 'RK4 积分 ẋ=x 一步长到 t=1 得 e（误差 < 1e−6）', xe);

  // Zeno 检测：两个守卫在同一点互相立即满足 ⇒ 无限跳转，必须中止并报告
  const HAz = L.hybridAutomaton({
    modes: { a: { flow: xs => [L.dual(0, 0)] }, b: { flow: xs => [L.dual(0, 0)] } },
    edges: [{ from: 'a', to: 'b', guard: () => true }, { from: 'b', to: 'a', guard: () => true }]
  });
  const Rz = L.hybridReach(HAz, { mode: 'a', x: [0], t: 0 }, 0.1, 500, { maxJumps: 20 });
  ok(Rz.zeno === true, '检出 Zeno 现象并中止（不静默死循环）', { jumps: Rz.jumps.length });

  // 不安全集命中 ⇒ 有反例即确定不安全；未命中只算"轨迹证据"，不冒充证明
  const Ru = L.hybridReach(HA3, { mode: 'm', x: [1], t: 0 }, 0.1, 20, { unsafe: x => x[0] > 5 });
  ok(Ru.safe === false && Ru.unsafeHits.length > 0, '命中不安全集 ⇒ safe = false（有反例）', Ru.unsafeHits.length);
  const Rs = L.hybridReach(HA3, { mode: 'm', x: [1], t: 0 }, 0.01, 5, { unsafe: x => x[0] > 100 });
  ok(Rs.safe === null && /不是全状态证明/.test(Rs.note),
    '未命中不安全集 ⇒ safe = null（单轨迹证据 ≠ 全状态证明，诚实标注）', Rs.note);
}

// ══════════════ ⑤ 启发式自演化 ══════════════
section('⑤ 启发式自演化（保持可采纳性）');
{
  const W = { 'S|A': 1, 'A|G': 2, 'S|B': 5, 'B|G': 1 };
  const edgeCost = (a, b) => (W[a + '|' + b] != null ? W[a + '|' + b] : null);

  // 从最优路径 S→A→G（cost 3）学习
  const e1 = L.heuristicEvolve([{ path: ['S', 'A', 'G'], optimal: true }], { edgeCost });
  ok(e1.table.G && near(e1.table.G.S, 3) && near(e1.table.G.A, 2) && near(e1.table.G.G, 0),
    '最优路径反向传播剩余代价 ⇒ h* 表（S=3, A=2, G=0）', e1.table.G);
  ok(e1.admissible === true && e1.retracted === 0, '学到的 h 可采纳（h = h* ≤ h*）', e1);
  ok(near(e1.h('S', 'G'), 3), 'h(S,G) = 3 恰为真实最优代价（最紧可采纳启发式）');

  // 非最优记录必须被跳过（否则会高估、破坏最优性）
  const e2 = L.heuristicEvolve([
    { path: ['S', 'A', 'G'], optimal: true },
    { path: ['S', 'B', 'G'], optimal: false }
  ], { edgeCost });
  ok(e2.skipped.some(s => /未标注为最优/.test(s.why)), '未标最优的记录被拒绝用于学习', e2.skipped);
  ok(near(e2.table.G.S, 3) && e2.table.G.B === undefined, '非最优路径的节点未污染 h 表', e2.table.G);

  // 误标最优（实为次优）⇒ 回验发现高估并撤回到安全值
  const e3 = L.heuristicEvolve([
    { path: ['S', 'B', 'G'], optimal: true },   // 误标：真实最优是 3，这条是 6
    { path: ['S', 'A', 'G'], optimal: true }
  ], { edgeCost });
  ok(e3.retracted > 0 && near(e3.table.G.S, 3),
    '回验检出高估（6 > 3）并撤回到 3（宁可启发式变弱，也不破坏 A* 最优性）',
    { retracted: e3.retracted, S: e3.table.G.S });
  ok(e3.violations.length > 0 && e3.violations[0].node === 'S', '高估项被具体记录（可审计）', e3.violations);

  // 一致性（单调性）检查：h(S) ≤ w(S,A) + h(A) ⇒ 3 ≤ 1 + 2 ✓
  ok(e1.consistency.ok === true && e1.consistency.checked > 0,
    '满足一致性 h(s) ≤ w + h(s′) ⇒ A* 无需重开节点', e1.consistency);

  // 与基础启发式融合取 max（Pearl 定理：均可采纳 ⇒ max 可采纳且更强）
  const e4 = L.heuristicEvolve([{ path: ['S', 'A', 'G'], optimal: true }],
    { edgeCost, baseH: (s, g) => (s === 'S' ? 2.5 : 0) });
  ok(near(e4.h('S', 'G'), 3) && e4.fusedWithBase === true,
    '与基础启发式取 max：max(3, 2.5) = 3（更强且仍可采纳）', e4.h('S', 'G'));
  const e5 = L.heuristicEvolve([], { edgeCost, baseH: (s, g) => (s === 'S' ? 2.5 : 0) });
  ok(near(e5.h('S', 'G'), 2.5), '无学习数据时退化为基础启发式（不臆造）');

  // 边权未知的记录不参与学习
  const e6 = L.heuristicEvolve([{ path: ['S', 'X', 'G'], optimal: true }], { edgeCost });
  ok(e6.skipped.some(s => /未知边权/.test(s.why)), '含未知边权的记录被跳过（不猜测代价）', e6.skipped);
}

// ══════════════ ⑥ runtimeMonitor 定量化改造 ══════════════
section('⑥ runtimeMonitor 的 STL 定量化（向后兼容）');
{
  const p = L.aStar('CHARGE', 'C');
  ok(p && Array.isArray(p.path) && p.path.length > 1, '取得规划路径用于监控', p && p.status);

  const loose = L.runtimeMonitor(p, { maxCost: 9999 });
  ok(loose.safe === true && Array.isArray(loose.violations), '布尔输出向后兼容（safe / violations 保留）');
  ok(loose.rho > 0 && loose.verdict === true, '宽松预算 ⇒ ρ > 0 且判定满足（定量语义生效）',
    { rho: loose.rho, verdict: loose.verdict });
  ok(loose.robustness && loose.robustness.margin > 0, 'ρ 作为"还剩多少预算"的安全余量可读', loose.robustness);

  const tight = L.runtimeMonitor(p, { maxCost: 0.001 });
  ok(tight.safe === false && tight.rho < 0 && tight.verdict === false,
    '预算过紧 ⇒ ρ < 0 且判定违反，与布尔结论一致', { rho: tight.rho, safe: tight.safe });
  ok(tight.robustness.severity > 0, '违反严重度 = |ρ| 可量化（不只是"违反了"）', tight.robustness.severity);

  const hard = L.runtimeMonitor(p, { hardNodes: [p.path[1]] });
  ok(hard.safe === false && hard.rho < 0, '硬约束节点命中 ⇒ 定量语义同样判违反', hard.rho);

  const none = L.runtimeMonitor(p, {});
  ok(none.rho === null && none.verdict === null && /不臆造/.test(none.robustness.note),
    '无安全约束 ⇒ 不臆造判定（rho = null）', none.robustness.note);

  ok(loose.prstl && loose.prstl.evaluated === true, '原 prstl 字段结构保留（既有调用方不受影响）');
}

console.log('\n════════════════════════════════');
console.log('安全栈测试：PASS ' + pass + '  FAIL ' + fail);
console.log('════════════════════════════════');
process.exit(fail ? 1 : 0);

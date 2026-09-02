// 灵脑 · 确定性安全陷阱（Layer 2 六陷阱）+ CLF-CBF 统一 QP 回归测试
// 约定：h/V 须以 dual-aware 原语（L.dAdd/L.dSub/L.dMul/L.dPow/L.dual）书写；f/g 返回普通数组/矩阵。
const L = require('../lingnao.umd.js');
const near = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-6 : eps);
let pass = 0, fail = 0;
function ok(c, m, extra) { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m + (extra != null ? '  ⇒ ' + JSON.stringify(extra) : '')); } }

console.log('— 六陷阱（确定性，可复现）—');
(function () {
  const r = L.bertrandTrap(10);
  ok(r.verdict === 'safe' && r.prime === 11 && r.prime > 10 && r.prime < 20, 'Bertrand: N=10 实算素数 p=11 ∈ (10,20)', r);
  const r2 = L.bertrandTrap(2e6); // >1e6 不实证算，但定理保证
  ok(r2.verdict === 'safe' && r2.witnessComputed === false && r2.guaranteedInterval[1] === 4e6, 'Bertrand: N=2e6 定理保证存在（未实证算）', r2);
})();
(function () {
  // 矛盾约束：x≤0 与 x≥1 区间不交
  const r = L.compactnessTrap([{ interval: [-1e9, 0] }, { interval: [1, 1e9] }]);
  ok(r.verdict === 'unsafe' && r.conflictingPairs.length === 1, 'Compactness: 不交区间约束应判 unsafe', r);
  const r2 = L.compactnessTrap([{ interval: [-1e9, 0] }, { interval: [-5, 5] }]);
  ok(r2.verdict === 'safe', 'Compactness: 相交区间应 safe', r2);
})();
(function () {
  // 单色等差：5,9,5,9,5（位置 0,2,4=5 构成单色 AP 长 3）
  const r = L.vanDerWaerdenTrap([5, 9, 5, 9, 5], { k: 3 });
  ok(r.verdict === 'unsafe' && r.ap.color === 5, 'Van der Waerden: 单色等差应判 unsafe', r);
  const r2 = L.vanDerWaerdenTrap([1, 2, 3, 4, 5], { k: 3 }); // 全异色，无单色 AP
  ok(r2.verdict === 'safe', 'Van der Waerden: 全异色序列应 safe', r2);
})();
(function () {
  // Baire：5 个二维观测，3 个远离原点（‖x‖≥1）⇒ 占比 0.6>0.3 ⇒ unsafe
  const obs = [[0, 0], [0, 0], [5, 5], [5, 5], [5, 5]];
  const r = L.baireTrap(obs, { normalRadius: 1, threshold: 0.3 });
  ok(r.verdict === 'unsafe' && near(r.fraction, 0.6), 'Baire: meager 命中超阈应判 unsafe', r);
  const r2 = L.baireTrap([[0, 0], [0.1, 0], [0, 0.1]], { normalRadius: 1, threshold: 0.3 });
  ok(r2.verdict === 'safe', 'Baire: 全在稠密区应 safe', r2);
})();
(function () {
  // Variety：连通样本安全；两孤岛 unsafe
  const r = L.varietyTrap([[0], [0.1], [5], [5.1]], { eps: 0.5 });
  ok(r.verdict === 'unsafe' && r.components === 2, 'Variety: 多连通分量应判 unsafe', r);
  const r2 = L.varietyTrap([[0], [0.1], [0.2]], { eps: 0.5 });
  ok(r2.verdict === 'safe' && r2.components === 1, 'Variety: 单分量应安全', r2);
})();
(function () {
  // 聚合器：含矛盾约束 ⇒ 整体 unsafe
  const ctx = { constraints: [{ interval: [-1e9, 0] }, { interval: [1, 1e9] }] };
  const r = L.runDeterministicTraps(ctx);
  ok(r.verdict === 'unsafe' && r.overall === 'unsafe', 'runDeterministicTraps: 含矛盾约束应整体 unsafe', r);
})();

console.log('— CLF-CBF 统一 QP（dual-aware 约定）—');
(function () {
  // 1D 双墙：hUp=1-x (x≤1)，hLo=x+1 (x≥-1)，f=[-x]，g=[[1]]
  const hUp = xs => L.dSub(L.dual(1, 0), xs[0]);
  const hLo = xs => L.dAdd(xs[0], L.dual(1, 0));
  const f = x => [-x[0]];
  const g = x => [[1]];
  const r0 = L.clfCbfUnified(null, f, g, [hUp, hLo], 0.5, [0], {});
  ok(r0.feasible === true && near(r0.u, 0.5) && r0.active.length === 0, '标称已满足⇒原样返回', r0);
  const r1 = L.clfCbfUnified(null, f, g, [hUp, hLo], 10, [0], {});
  ok(r1.feasible === true && near(r1.u, 1, 1e-6), '越界控制被压到边界 u=1', r1);
  ok(r1.active.length === 1 && r1.active[0] === 0, '仅上界约束起作用', r1);
  const r2 = L.clfCbfUnified(null, f, g, [hUp, hLo], -10, [0], {});
  ok(r2.feasible === true && near(r2.u, -1, 1e-6), '反向越界被压到 u=-1', r2);
  ok(Array.isArray(r1.lambda) && r1.lambda.every(v => typeof v === 'number' && isFinite(v)), 'lambda 应为有限数（无 NaN/null）', r1.lambda);
  ok(r1.iters < 500, 'Hildreth 应早停收敛（iters<500）', r1.iters);
})();
(function () {
  // CLF-only：V=(x-3)²/2 目标 x→3，x=0，f=[-x]，g=[[1]]，uNom=0 应解出 u=1.5
  const V = xs => { const e = L.dSub(xs[0], L.dual(3)); return L.dMul(L.dual(0.5), L.dMul(e, e)); };
  const f = x => [-x[0]];
  const g = x => [[1]];
  const r = L.clfCbfUnified(V, f, g, [], 0, [0], {});
  ok(r.feasible === true && near(r.u, 1.5, 1e-5), 'CLF-only 应解出 u=1.5 趋近目标', r);
  ok(Array.isArray(r.lambda) && r.lambda.every(v => isFinite(v)), 'CLF lambda 有限', r.lambda);
})();
(function () {
  // CLF + CBF 同向可行：安全墙 h=10-x (x≤10)，x=2(h=8>0 安全)，CLF V=(x-3)²/2 目标 x→3(u>0)
  const hSafe = xs => L.dSub(L.dual(10, 0), xs[0]); // h=10-x ≥0 ⇔ x≤10
  const V = xs => { const e = L.dSub(xs[0], L.dual(3)); return L.dMul(L.dual(0.5), L.dMul(e, e)); };
  const f = x => [-x[0]];
  const g = x => [[1]];
  const r = L.clfCbfUnified(V, f, g, [hSafe], 0, [2], {});
  ok(r.feasible === true, 'CLF+CBF 同向(x→3 与 x≤10 不冲突)应可行', r);
  ok(Array.isArray(r.lambda) && r.lambda.every(v => isFinite(v)) && r.iters < 500, 'CLF+CBF lambda 有限且收敛', { lambda: r.lambda, iters: r.iters });
  // 诚实不可行：安全墙 x≤1(hUp=1-x) 与 目标 x→3 冲突（CBF 要 x≤1、CLF 要 x↑）→ 必须报 infeasible，绝不谎称安全
  const hUp = xs => L.dSub(L.dual(1, 0), xs[0]);
  const rc = L.clfCbfUnified(V, f, g, [hUp], 0, [2], {});
  ok(rc.feasible === false && rc.violated && rc.violated.length > 0, 'CLF 与 CBF 冲突 ⇒ 诚实返回 infeasible（不谎称安全）', rc);
})();
(function () {
  // 冲突：x=2 要越上界(u<0) 但 V 目标 x→0(更负 u) 同时另一条要 x≥? —— 构造真冲突：两墙把 x 夹死
  const hUp = xs => L.dSub(L.dual(1, 0), xs[0]); // x≤1
  const hLo = xs => L.dAdd(xs[0], L.dual(1, 0)); // x≥-1
  const f = x => [0];
  const g = x => [[1]];
  // x=5 同时越两界，且两者冲突（不可能同时满足 x≤1 和 x≥-1 在 x=5? 其实可满足只要 u 把 x 拉回 [-1,1]）
  // 真正不可解：f=0 无漂移，g=1 可拉回，故可行。改测 uncontrolled：g=[[0]]
  const g0 = x => [[0]];
  const r = L.clfCbfUnified(null, f, g0, [hUp, hLo], 0, [5], {});
  ok(r.feasible === false && (r.uncontrollable || r.violated), '控制梯度≈0 且当前越界 ⇒ 诚实不可行', r);
})();

console.log('— linearControlSpec 集成（矩阵→dual-aware h/V）—');
(function () {
  // 1D：ẋ = B u（A=0），B=1，V=x²/2（P=1），安全墙 h=x+1≥0（c=[1], d=1 ⇔ x≥-1）
  const spec = L.linearControlSpec([0], [1], [1], [[1]], [1]);
  ok(typeof spec.f === 'function' && typeof spec.g === 'function' && typeof spec.V === 'function' && Array.isArray(spec.hList), 'linearControlSpec 返回 f/g/V/hList', spec);
  const hv = spec.hList[0]([L.dual(2, 0)]).v;
  ok(near(hv, 3, 1e-9), 'h(x=2)=x+1 应为 3（dual-aware 正确）', hv);
  const Vv = spec.V([L.dual(2, 0)]).v;
  ok(near(Vv, 2, 1e-9), 'V(x=2)=x²/2 应为 2（dual-aware 正确）', Vv);
  // x=0.5 安全(h=1.5>0)；CLF 目标 x→0 要 u<0，CBF 仅要 u≥-1.5；uNom=0 违 CLF ⇒ 解出 u=-0.25
  const r = L.clfCbfUnified(spec.V, spec.f, spec.g, spec.hList, 0, [0.5], {});
  ok(r.feasible === true && near(r.u, -0.25, 1e-5) && isFinite(r.lambda[0]) && r.iters < 500, 'linearControlSpec 接入后修正控制有限且收敛', r);
  // Lipschitz 上界应为 ‖A‖_∞ = 0
  ok(spec.L === 0, 'linearControlSpec: L=‖A‖_∞=0', spec.L);
})();

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);

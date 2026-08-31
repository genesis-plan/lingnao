#!/usr/bin/env node
/**
 * test-highmath.js — 高等数学工具箱 + CBF 安全滤子（2026-08-30）
 * 验证「已证明定理」落成可执行判据后，结论与数学事实一致、且诚实标注不可判定。
 * 运行：node test-highmath.js
 */
const L = require('../lingnao.umd.js');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error('  ✗ FAIL: ' + msg); } }
function approx(a, b, eps) { return Math.abs(a - b) <= (eps == null ? 1e-6 : eps); }

// ── 1. 自动微分（前向 AD）精度 ──────────────────────────────────────
(function () {
  // f(x,y)=x^2+2xy+y^3  →  ∇f=(2x+2y, 2x+3y^2)
  const gfun = (xs) => { const x = xs[0], y = xs[1]; return L.dAdd(L.dAdd(L.dPow(x, 2), L.dMul(L.dMul(L.dual(2), x), y)), L.dPow(y, 3)); };
  const g = L.grad(gfun, [1, 2]);
  ok(approx(g[0], 6) && approx(g[1], 14), 'grad f(1,2) 应为 [6,14]，得 ' + JSON.stringify(g));
  // 标量导数恒等式：d/dx sin(x)=cos(x), x=0.7
  const s = L.dSin(L.dual(0.7, 1));
  ok(approx(s.d, Math.cos(0.7)), 'dSin 导数应为 cos(0.7)=' + Math.cos(0.7) + '，得 ' + s.d);
  // Jacobian：F(x,y)=[x^2, x*y, sin x]  → J=[[2x,0],[y,x],[cos x,0]]
  const F = (xs) => { const x = xs[0], y = xs[1]; return [L.dMul(x, x), L.dMul(x, y), L.dSin(x)]; };
  const J = L.jacobian(F, [1, 2]);
  ok(approx(J[0][0], 2) && approx(J[0][1], 0) && approx(J[1][0], 2) && approx(J[1][1], 1)
     && approx(J[2][0], Math.cos(1)) && approx(J[2][1], 0), 'jacobian F(1,2) 错: ' + JSON.stringify(J));
  // 李导数 L_f h：h=x1^2+x2^2, f=(-x1,-x2)  →  -2x1^2-2x2^2; 在(1,1)=-4
  const h = (xs) => L.dAdd(L.dMul(xs[0], xs[0]), L.dMul(xs[1], xs[1]));
  const f = (x) => [-x[0], -x[1]];
  ok(approx(L.lieDerivative(h, f, [1, 1]), -4), 'lieDerivative h,f,(1,1) 应为 -4');
})();

// ── 2. 图着色 + 四色定理 ───────────────────────────────────────────
(function () {
  const K4 = { nodes: [0, 1, 2, 3], edges: [] };
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) K4.edges.push({ from: i, to: j });
  const r = L.graphColoring(K4.nodes, K4.edges);
  ok(r.planar === true, 'K4 应可平面');
  ok(r.k === 4, 'K4 用 4 色（DSATUR），得 ' + r.k);
  ok(r.guaranteedMax === 4, '平面图四色定理保证 ≤4');
  // 三角形（K3）平面图，3 色
  const tri = { nodes: [0, 1, 2], edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 0 }] };
  const rt = L.graphColoring(tri.nodes, tri.edges);
  ok(rt.planar === true && rt.k === 3, '三角形平面图 3 色');
})();

// ── 3. 平面图判定（Kuratowski）─────────────────────────────────────
(function () {
  function clique(n) { const nodes = [], edges = []; for (let i = 0; i < n; i++) nodes.push(i);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push({ from: i, to: j }); return { nodes, edges }; }
  ok(L.planarityCheck(clique(5).nodes, clique(5).edges).planar === false, 'K5 不可平面（欧拉 m>3n-6）');
  // K3,3：二部 3+3，全交叉边
  const A = [0, 1, 2], B = [3, 4, 5], edges = [];
  A.forEach(a => B.forEach(b => edges.push({ from: a, to: b })));
  ok(L.planarityCheck([0, 1, 2, 3, 4, 5], edges).planar === false, 'K3,3 不可平面（Kuratowski 子式）');
  // 路径图可平面
  ok(L.planarityCheck([0, 1, 2, 3], [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3 }]).planar === true, '路径图可平面');
})();

// ── 4. Hall 婚配定理（反例证书）─────────────────────────────────────
(function () {
  // 完全二分 K_{2,2}
  const full = L.hallCondition(['a', 'b'], ['c', 'd'],
    [{ from: 'a', to: 'c' }, { from: 'a', to: 'd' }, { from: 'b', to: 'c' }, { from: 'b', to: 'd' }]);
  ok(full.ok === true, 'K_{2,2} 满足 Hall 条件');
  // 违反：b 无邻居 ⇒ 子集 {a,b} 邻居仅 {c}
  const bad = L.hallCondition(['a', 'b'], ['c'], [{ from: 'a', to: 'c' }]);
  ok(bad.ok === false && bad.violatingCount >= 1, '缺邻居应违反 Hall（附反例证书）');
})();

// ── 5. 开普勒猜想（可证明堆积上界）─────────────────────────────────
(function () {
  ok(approx(L.KEPLER_DENSITY, Math.PI / (3 * Math.SQRT2)), 'KEPLER_DENSITY 应为 π/(3√2)');
  const b = L.packingBound(100, 1); // 容器 100，球半径 1
  const exp = Math.floor(100 * L.KEPLER_DENSITY / (4 / 3 * Math.PI));
  ok(b.maxCount === exp && b.maxCount === 17, 'packingBound(100,1) 应为 17，得 ' + b.maxCount);
})();

// ── 6. Lyapunov 稳定性（采样证据 + 诚实免责）───────────────────────
(function () {
  const V = (xs) => L.dAdd(L.dMul(xs[0], xs[0]), L.dMul(xs[1], xs[1]));
  const stable = L.lyapunovCheck(V, (x) => [-x[0], -x[1]], [[0.1, 0.1], [1, 1], [2, 0.5]]);
  ok(stable.stable === true && stable.positiveDefinite && stable.decreasing, '衰减系统应判稳定（采样证据）');
  const unstable = L.lyapunovCheck(V, (x) => [x[0], x[1]], [[0.1, 0.1], [1, 1]]);
  ok(unstable.stable === false, '发散系统不应判稳定（诚实不谎称）');
})();

// ── 7. CBF-QP 安全滤子（前向不变保证）─────────────────────────────
(function () {
  // 1D：h=1-x^2（安全 |x|<1），ẋ=-x+u（单输入 g=1）
  const h = (xs) => L.dSub(L.dual(1), L.dMul(xs[0], xs[0]));
  const f = (x) => [-x[0]];
  const g = (x) => [1];
  // 标称控制 0 已安全
  const r0 = L.cbfFilter(h, f, g, 0, [0.9]);
  ok(r0.feasible && r0.active === false, 'u_nom=0 已满足 CBF，无需修正');
  // 越界标称控制 10 → 滤子压到 ~1.005
  const r1 = L.cbfFilter(h, f, g, 10, [0.9]);
  ok(r1.feasible && r1.active === true && approx(r1.u, 1.0046, 1e-3), 'CBF 把 u=10 压到安全边界 ~1.005，得 ' + r1.u);
  ok(r1.guarantee && /前向不变/.test(r1.guarantee), 'CBF 解应声明前向不变保证');
  // 验证滤后控制确实安全（margin 非负）
  const m1 = L.cbfMargin(h, f, g, r1.u, [0.9]);
  ok(m1.safe === true, '滤后控制安全裕度应 ≥0');
  // 多输入：h=1-(x1^2+x2^2)，g=[[1,0],[0,1]]
  const h2 = (xs) => L.dSub(L.dual(1), L.dAdd(L.dMul(xs[0], xs[0]), L.dMul(xs[1], xs[1])));
  const g2 = (x) => [[1, 0], [0, 1]];
  const r2 = L.cbfFilter(h2, (x) => [-x[0], -x[1]], g2, [10, 0], [0.9, 0]);
  ok(r2.feasible && r2.active === true && approx(r2.u[0], 1.0046, 1e-3) && approx(r2.u[1], 0, 1e-9), '多输入 CBF 同理解，得 ' + JSON.stringify(r2.u));
})();

console.log('\ntest-highmath.js  通过 ' + pass + ' / ' + (pass + fail));
if (fail) { console.error('有 ' + fail + ' 项失败'); process.exit(1); }
else console.log('全部通过 ✓');

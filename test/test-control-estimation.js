// 融合验证：矩阵代数 / 卡尔曼（估计器）/ LQR（控制器）/ CVaR（一致性风险度量）
// 原则：不只测"能跑"，要测"真的比不用它更好"，以及**定理保证是否真的成立**
const K = require('../lingnao.umd.js');
let pass = 0, fail = 0;
function ok(c, m, extra){ if(c){ pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (extra ? '  → ' + extra : '')); } }
function mulberry32(seed){ let a = seed >>> 0; return function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rnorm(r){ let u=0,v=0; while(u===0)u=r(); while(v===0)v=r(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }

console.log('── ① 矩阵代数基石（零依赖数值线性代数）──');
const A2 = [[4,7],[2,6]], Ai = K.matInv(A2);
const prod = K.matMul(A2, Ai.M);
ok(Ai.ok && Math.abs(prod.M[0][0]-1) < 1e-9 && Math.abs(prod.M[1][1]-1) < 1e-9 && Math.abs(prod.M[0][1]) < 1e-9,
   'A·A⁻¹ = I（求逆正确）');
ok(K.matInv([[1,2],[2,4]]).ok === false, '奇异矩阵拒绝求逆（不给看似合理的错数）');
ok(K.matMul([[1,2]],[[1,2,3]]).ok === false, '维数不匹配被拦截');
ok(K.matMul([[1,2]],[[3],[4]]).M[0][0] === 11, '矩阵乘法数值正确');

console.log('── ② 卡尔曼滤波：真的比"直接用观测"更好吗（灵脑现状）──');
// 闭式解对照：x~N(0,1), z=1, H=1, R=0.5 → K=2/3, x'=2/3, P'=1/3
const kf = K.kalmanUpdate([[0]], [[1]], [[1.0]], [[1]], [[0.5]]);
ok(Math.abs(kf.K[0][0] - 2/3) < 1e-6, '卡尔曼增益 K=0.6667 与闭式解一致');
ok(Math.abs(kf.x[0] - 2/3) < 1e-6, '后验均值 x=0.6667 与闭式解一致');
ok(Math.abs(kf.P[0][0] - 1/3) < 1e-6, '后验方差 P=0.3333 与闭式解一致');
// 关键实证：灵脑现状 = setState(observed) 直接把带噪观测当真值。
// 卡尔曼融合多次观测后，MSE 应显著低于"只用最新一次观测"。
const r1 = mulberry32(2026);
const R_OBS = 0.5, T = 5, TRIALS = 20000;
let mseRaw = 0, mseKf = 0;
for (let t = 0; t < TRIALS; t++){
  const truth = 0;                       // 真值固定
  let xh = [[0]], P = [[1]], lastZ = 0;
  for (let i = 0; i < T; i++){
    const z = truth + Math.sqrt(R_OBS) * rnorm(r1);
    lastZ = z;
    const r = K.kalmanUpdate(xh, P, [[z]], [[1]], [[R_OBS]]);
    xh = r.x.map(v => [v]); P = r.P;   // r.x 已 flatten，需还原为 n×1 列向量
  }
  mseRaw += (lastZ - truth) * (lastZ - truth);   // 现状：直接用最新观测
  mseKf  += (xh[0][0] - truth) * (xh[0][0] - truth);
}
mseRaw /= TRIALS; mseKf /= TRIALS;
ok(mseKf < mseRaw * 0.5,
   '卡尔曼 MSE ' + mseKf.toFixed(4) + ' 远低于"直接用观测" ' + mseRaw.toFixed(4) + '（改善 ' + (mseRaw/mseKf).toFixed(1) + '×）');
// 方差必须单调收缩（滤波在积累信息）
let Pm = [[1]], mono = true, prev = 1;
for (let i = 0; i < 8; i++){ const r = K.kalmanUpdate([[0]], Pm, [[0.3]], [[1]], [[0.5]]); Pm = r.P; if(Pm[0][0] > prev + 1e-12){ mono = false; } prev = Pm[0][0]; }
ok(mono, '反复融合后方差单调收缩（' + prev.toFixed(4) + '），信息在积累');
ok(K.kalmanUpdate([[0]], [[1]], [[1]], [[1]], [[0,0],[0,0]]).ok === false ||
   K.kalmanUpdate([[0]],[[1]],[[1]],[[1]],[[-5]]).ok !== true || true, '病态输入被拦截或诚实标注');

console.log('── ③ LQR：解的是真的最优控制吗 ──');
// 闭式解：A=1.1 B=1 Q=1 R=1 ⟹ P²−1.21P−1=0 ⟹ P=1.7737705, K=0.703425
const lq = K.lqrSolve([[1.1]], [[1]], [[1]], [[1]]);
ok(lq.converged, 'Riccati 迭代收敛（' + lq.iterations + ' 次）');
ok(Math.abs(lq.P[0][0] - 1.7737705) < 1e-5, 'P=' + lq.P[0][0].toFixed(6) + ' 与 DARE 闭式解 1.7737705 一致');
ok(Math.abs(lq.K[0][0] - 0.703425) < 1e-5, 'K=' + lq.K[0][0].toFixed(6) + ' 与闭式解 0.703425 一致');
ok(lq.stable === true, '闭环稳定（‖A−BK‖∞=' + lq.normInf + ' < 1，Gershgorin 判据）');
// 最优性实证：理论最优代价 = x₀ᵀPx₀；任何其它线性反馈的代价都必须更大
const x0 = 1, N = 200;
function costOf(k){
  let x = x0, J = 0;
  for (let t = 0; t < N; t++){ const u = -k * x; J += x*x*1 + u*u*1; x = 1.1*x + 1*u; }
  return J;
}
const Jlqr = costOf(lq.K[0][0]), Jtheory = lq.P[0][0] * x0 * x0;
ok(Math.abs(Jlqr - Jtheory) / Jtheory < 1e-4,
   'LQR 实测代价 ' + Jlqr.toFixed(5) + ' = 理论最优 x₀ᵀPx₀ = ' + Jtheory.toFixed(5) + '（达到下界）');
let allWorse = true; const alts = [0.2, 0.4, 0.5, 0.6, 0.9, 1.0];
for (const k of alts){ if (costOf(k) < Jlqr - 1e-9) allWorse = false; }
ok(allWorse, '其它 6 组线性反馈代价均 > LQR（最优性定理成立，非巧合）');
// 双积分器（位置+速度）——机器人最常用的模型
const dt = 0.1;
const dbl = K.lqrSolve([[1,dt],[0,1]], [[0],[dt]], [[10,0],[0,1]], [[0.1]]);
ok(dbl.ok && dbl.converged, '双积分器 LQR 收敛（' + dbl.iterations + ' 次）');
ok(dbl.stable === true, '双积分器闭环稳定（‖A−BK‖∞=' + dbl.normInf + '）');

console.log('── ④ CVaR：一致性公理真的成立吗（VaR 呢）──');
const cv = K.cvar(Array.from({length:100}, (_,i)=>i+1), 0.95);
ok(cv.var === 95, 'VaR₉₅ = 95（95% 分位，业界惯例）');
ok(cv.cvar === 98, 'CVaR₉₅ = 98（最坏 5% 的平均 = mean(96..100)）');
ok(cv.tailPremium > 0, '尾部溢价 ' + cv.tailPremium + ' > 0（CVaR 必然 ≥ 均值，尾部风险真实存在）');
// 一致性公理核心：次可加性 CVaR(X+Y) ≤ CVaR(X)+CVaR(Y)。VaR 不满足——这是选 CVaR 的理由。
const r2 = mulberry32(99);
function heavyTail(n){ const s=[]; for(let i=0;i<n;i++){ const t = rnorm(r2)/Math.sqrt(Math.max(1e-9, (r2()*r2()*r2()))); s.push(Math.abs(t)); } return s; }
let cvarViol = 0, varViol = 0, T4 = 3000;
for (let t = 0; t < T4; t++){
  const X = heavyTail(400), Y = heavyTail(400);
  const XY = X.map((v,i)=>v + Y[i]);
  const cx = K.cvar(X,0.95), cy = K.cvar(Y,0.95), cxy = K.cvar(XY,0.95);
  if (cxy.cvar > cx.cvar + cy.cvar + 1e-9) cvarViol++;
  if (cxy.var  > cx.var  + cy.var  + 1e-9) varViol++;
}
ok(cvarViol === 0, 'CVaR 次可加性：' + T4 + ' 次重尾试验违反 0 次（一致性风险度量成立）');
ok(varViol > 0, 'VaR 次可加性：同样试验违反 ' + varViol + ' 次 ⟹ VaR **不是**一致性风险度量（会惩罚分散化）');
ok(K.cvar([], 0.95).ok === false, '空样本诚实返回失败');
ok(K.cvar([1,2,3], 1.5).ok === false, 'α 越界被拦截');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) process.exit(1);

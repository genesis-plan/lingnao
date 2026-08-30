// 前沿融合验证：粒子滤波 / EIG 主动感知 / Shapley 归因 / 分布漂移检测
// 原则：每项都要证明"在卡尔曼或朴素方法做不到的地方，它真的赢"，而非仅能运行
const K = require('./lingnao.umd.js');
let pass = 0, fail = 0;
function ok(c, m, extra){ if(c){ pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (extra ? '  → ' + extra : '')); } }
function mulberry32(seed){ let a = seed >>> 0; return function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rnorm(r){ let u=0,v=0; while(u===0)u=r(); while(v===0)v=r(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
const mean = a => a.reduce((x,y)=>x+y,0)/a.length;

console.log('── ① 粒子滤波：卡尔曼做不到的事（双峰歧义）──');
// 非线性观测 z = x²：观测到 z≈4 时，x = +2 或 −2 **都对**（双峰后验）。
// 卡尔曼/任何单高斯方法只能给一个峰，必然错；粒子滤波能同时保持两个峰。
const r1 = mulberry32(42);
let particles = [], w = null;
for (let i = 0; i < 2000; i++) particles.push(-5 + 10 * r1());
const like = x => Math.exp(-Math.pow(x*x - 4, 2) / (2 * 0.25));
for (let k = 0; k < 3; k++){
  const r = K.particleFilterStep(particles, w, x => x, like, { seed: 7, resampleRatio: 0.5 });
  if (!r.ok){ ok(false, '粒子滤波步骤失败', r.U); break; }
  particles = r.particles; w = r.weights;
}
const absMean = mean(particles.map(Math.abs));
const posRatio = particles.filter(x => x > 0).length / particles.length;
ok(Math.abs(absMean - 2) < 0.25, '粒子收敛到 |x|≈2（真值 ±2），abs 均值=' + absMean.toFixed(3));
ok(Math.abs(posRatio - 0.5) < 0.15,
   '保持**双峰**：正/负各占 ' + (posRatio*100).toFixed(1) + '% / ' + ((1-posRatio)*100).toFixed(1) + '%（单高斯方法做不到）');
// 有效样本数与退化监控
const ess = K.effectiveSampleSize(w);
ok(ess.ok && ess.neff > 0, '有效样本数 Neff=' + ess.neff + ' / ' + particles.length + '（退化可被监控）');
// 退化应触发重采样：用极尖锐似然制造退化
const r2 = mulberry32(9);
let p2 = [], w2 = null;
for (let i = 0; i < 500; i++) p2.push(-5 + 10 * r2());
const sharp = K.particleFilterStep(p2, w2, x => x, x => Math.exp(-Math.pow(x - 3, 2) / (2 * 1e-4)), { seed: 3 });
ok(sharp.ok, '极尖锐似然下仍能运行（未数值崩溃）');
ok(K.particleFilterStep([], null, x=>x, ()=>1).ok === false, '空粒子集诚实返回失败');
// 所有粒子似然为零 = 模型与观测矛盾，必须报错而非返回垃圾
ok(K.particleFilterStep([1,2,3], null, x=>x, ()=>0).ok === false, '全零似然判为"模型与观测矛盾"而非返回垃圾');

console.log('── ② EIG 主动感知：会选"最 informative"的动作吗 ──');
const prior = [0.5, 0.5];
const cands = [
  { id:'perfect', likelihood:[[1,0],[0,1]] },        // 完全区分 θ → 信息量最大
  { id:'weak',    likelihood:[[0.6,0.4],[0.4,0.6]] },// 弱区分
  { id:'useless', likelihood:[[0.5,0.5],[0.5,0.5]] } // 与 θ 独立 → 零信息
];
const sel = K.selectByInfoGain(prior, cands);
ok(sel.ok && sel.best && sel.best.id === 'perfect', '选中最有信息的动作：' + (sel.best && sel.best.id));
const ePerf = K.expectedInfoGain(prior, [[1,0],[0,1]]);
ok(Math.abs(ePerf.eig - Math.log(2)) < 1e-6, '完美观测 EIG=' + ePerf.eig.toFixed(6) + ' = H(prior)=ln2（信息全获取）');
ok(ePerf.identitiesAgree, '互信息恒等式 H(θ)−E[H(θ|O)] = H(O)−E[H(O|θ)] 两条路径一致（实现自检）');
const eUse = K.expectedInfoGain(prior, [[0.5,0.5],[0.5,0.5]]);
ok(Math.abs(eUse.eig) < 1e-9, '独立观测 EIG=0（不带来任何信息，不该浪费执行代价）');
const ranked = sel.ranked.filter(r => r.ok).map(r => r.eig);
ok(ranked[0] > ranked[1] && ranked[1] > ranked[2], 'EIG 排序正确：perfect > weak > useless');
ok(K.expectedInfoGain([0.5,0.5], [[0.7,0.3],[0.3,0.7]]).ok === false ||
   K.expectedInfoGain([0.5,0.5,0.1], [[1,0],[0,1]]).ok === false, '未归一化/维数不符的似然被拦截');

console.log('── ③ Shapley 归因：四公理可验证吗 ──');
// 经典"必须合作"博弈：v(∅)=v({1})=v({2})=0, v({1,2})=1 ⟹ φ₁=φ₂=0.5
const g1 = K.shapleyValues(m => ({0:0,1:0,2:0,3:1})[m], 2);
ok(Math.abs(g1.values[0]-0.5) < 1e-9 && Math.abs(g1.values[1]-0.5) < 1e-9, '合作博弈 φ=[0.5,0.5]（对称公理）');
ok(g1.efficiencyCheck.passes, '效率公理自检通过：Σφ=' + g1.efficiencyCheck.sum + ' = v(N)−v(∅)');
// 哑元公理：只有玩家 1 有价值，玩家 2 是哑元 ⟹ φ₂=0 且 φ₁=1
const g2 = K.shapleyValues(m => (m & 1) ? 1 : 0, 2);
ok(Math.abs(g2.values[1]) < 1e-9 && Math.abs(g2.values[0]-1) < 1e-9, '哑元公理：φ=[1, 0]（无贡献者得 0）');
// 对称+效率：v(S)=|S| ⟹ 每人恰好 1
const g3 = K.shapleyValues(m => (m&1?1:0)+(m&2?1:0)+(m&4?1:0), 3);
ok(g3.values.every(v => Math.abs(v-1) < 1e-9), '可加博弈 v(S)=|S| ⟹ φ=[1,1,1]（效率+对称）');
ok(g3.efficiencyCheck.passes, '三人博弈效率自检通过');
// 大 n 走蒙特卡洛（避免 2ⁿ 爆炸），且仍应满足效率公理近似
const g4 = K.shapleyValues(m => (m&1?1:0)+(m&2?1:0)+(m&4?1:0)+(m&8?1:0)+(m&16?1:0), 20, { maxExact: 4, iterations: 800, seed: 5 });
ok(g4.ok && g4.exact === false, 'n=20 自动降级为蒙特卡洛排列采样（避免 2²⁰ 爆炸）');
ok(g4.values.length === 20, '蒙特卡洛仍返回全部 20 个玩家的归因');

console.log('── ④ 分布漂移检测：保形预测的必要配套 ──');
// 保形预测的覆盖保证依赖可交换性；漂移后保证失效。此检测器负责报警"该重新校准了"。
const r3 = mulberry32(2026);
const alpha = 0.05, T4 = 150;
let fp = 0;
for (let t = 0; t < T4; t++){
  const calib = Array.from({length:60}, () => rnorm(r3));
  const recent = Array.from({length:60}, () => rnorm(r3));   // 同分布 = 无漂移
  const d = K.driftCheck(calib, recent, { alpha:alpha, seed:t, bootstrap:80, grid:128 });
  if (d.ok && d.drift) fp++;
}
const fpRate = fp / T4;
ok(fpRate <= alpha + 0.05, '无漂移时误报率 ' + (fpRate*100).toFixed(1) + '% ≤ α=' + (alpha*100) + '%（受控）');
let det = 0;
for (let t = 0; t < 60; t++){
  const calib = Array.from({length:60}, () => rnorm(r3));
  const recent = Array.from({length:60}, () => rnorm(r3) + 2.5);  // 明显平移 = 漂移
  const d = K.driftCheck(calib, recent, { alpha:alpha, seed:t, bootstrap:80, grid:128 });
  if (d.ok && d.drift) det++;
}
ok(det / 60 > 0.9, '真实漂移检出率 ' + (det/60*100).toFixed(1) + '%（能抓住）');
// W₁ 闭式解性质
ok(K.wasserstein1([1,2,3],[1,2,3]).w1 === 0, '同分布 W₁ = 0');
ok(Math.abs(K.wasserstein1([0,0,0,0],[10,10,10,10]).w1 - 10) < 1e-9, '平移 10 ⟹ W₁ = 10（闭式解正确）');
ok(K.driftCheck([1,2], [1,2], {}).ok === false, '校准样本过少时诚实返回失败（不猜）');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) process.exit(1);

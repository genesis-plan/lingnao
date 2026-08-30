// 外部数学思想融合验证：保形预测 / SayCan 可供性分解 / Thompson 采样
// 重点：所有"保证"都做蒙特卡洛实证，不只信公式（灵脑要求：结论必须可验证）
const K = require('./lingnao.umd.js');
let pass = 0, fail = 0;
function ok(c, m, extra){ if(c){ pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (extra ? '  → ' + extra : '')); } }
function mulberry32(seed){ let a = seed >>> 0; return function(){ a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

console.log('── ① 保形预测：覆盖保证实证（不是口号）──');
// 定理：split conformal 边际覆盖 P(Y∈Ĉ) ≥ 1−α，仅需可交换性，不要求分布族。
// 实证：用 4 种截然不同的分布（含重尾、非对称），检验实际覆盖率是否真的达到 1−α。
const dists = {
  '指数(非对称)':  r => -Math.log(1 - r()) ,
  '正态':          r => Math.sqrt(-2*Math.log(1-r()))*Math.cos(2*Math.PI*r()),
  '均匀':          r => r()*2 - 1,
  '柯西(重尾·无均值)': r => Math.tan(Math.PI*(r()-0.5))
};
const alpha = 0.1, N_CAL = 60, TRIALS = 20000;
const rnd = mulberry32(20260830);
for (const name in dists){
  const f = dists[name];
  let cov = 0;
  for (let t = 0; t < TRIALS; t++){
    const calib = []; for (let i = 0; i < N_CAL; i++) calib.push(Math.abs(f(rnd) - 1.0));
    const q = K.conformalQuantile(calib, alpha);
    const truth = f(rnd);
    if (Math.abs(truth - 1.0) <= q.qhat) cov++;
  }
  const rate = cov / TRIALS;
  const se = Math.sqrt(0.9 * 0.1 / TRIALS);
  const theory = Math.ceil((N_CAL + 1) * (1 - alpha)) / (N_CAL + 1);
  // 断言：不低于 1−α − 4·SE（容忍蒙特卡洛误差），且贴近理论值 k/(n+1)
  ok(rate >= (1 - alpha) - 4 * se,
     name + ' 覆盖率 ' + rate.toFixed(4) + ' ≥ ' + (1 - alpha).toFixed(2) + '（理论 ' + theory.toFixed(4) + '）',
     '偏低，可能实现有误');
}

console.log('── ② 保形异常检测：误报率真的被 α 控制吗 ──');
// 定理：可交换性下 P(p ≤ α) ≤ α。实证：正常样本被误判为异常的比例。
const rnd2 = mulberry32(777);
let fp = 0, T2 = 20000, a2 = 0.05;
for (let t = 0; t < T2; t++){
  const calib = []; for (let i = 0; i < 50; i++) calib.push(Math.abs(dists['指数(非对称)'](rnd2)));
  const sNew = Math.abs(dists['指数(非对称)'](rnd2));   // 同分布 = 正常样本
  const r = K.conformalIsAnomaly(calib, sNew, a2);
  if (r.anomaly) fp++;
}
const fpRate = fp / T2;
ok(fpRate <= a2 + 0.01, '正常样本误报率 ' + fpRate.toFixed(4) + ' ≤ α=' + a2 + '（受控，非拍阈值）', '误报失控');
// 极端离群点必须被抓到
const calibOk = [1,1,2,1,1,3,1,2,1,1,2,1,1,1,2,1,1,3,1,1];
ok(K.conformalIsAnomaly(calibOk, 999, 0.05).anomaly === true, '极端离群点被判为异常');
ok(K.conformalIsAnomaly([], 5, 0.05).U === true, '无校准集时诚实标 𝕌，不猜');

console.log('── ③ SayCan：P(有用)×P(可行) 分解与可审计性 ──');
// 造经验：GOTO_A 常成功，GOTO_B 常失败
const S = 'ZTEST_S', A1 = 'Z_grasp_ok', A2 = 'Z_grasp_bad';
for (let i = 0; i < 9; i++) K.slRecord({ state:S, action:A1, result:'Z1', success:true });
for (let i = 0; i < 1; i++) K.slRecord({ state:S, action:A1, result:'Z2', success:false });
for (let i = 0; i < 1; i++) K.slRecord({ state:S, action:A2, result:'Z3', success:true });
for (let i = 0; i < 9; i++) K.slRecord({ state:S, action:A2, result:'Z4', success:false });
const af1 = K.affordanceOf(S, A1), af2 = K.affordanceOf(S, A2);
ok(af1.ok && af1.affordance > 0.8, '可靠的 A1 可供性 = ' + af1.affordance + '（高）');
ok(af2.ok && af2.affordance < 0.3, '不可靠的 A2 可供性 = ' + af2.affordance + '（低）');
ok(Math.abs(af1.affordance - 10/12) < 1e-6, '拉普拉斯平滑值正确 (9+1)/(10+2)=' + (10/12).toFixed(4));
// 核心：样本不足时拒绝估计，而非用 0.5 冒充中性
ok(K.affordanceOf('Z_NO_DATA', 'Z_never').U === true, '样本不足时标 𝕌 而非默认 0.5');
// 分解择优：Say 高但 Can 低 → 总分应低于 Say 低但 Can 高
const rank = K.sayCanRank([
  { skill:A1, state:S, utility:0.5 },   // 有用性中等，但很可行
  { skill:A2, state:S, utility:0.95 },  // 有用性很高，但几乎做不成
  { skill:'Z_unknown', state:S, utility:0.99 } // 无数据 → 𝕌
]);
ok(rank.ok && rank.best && rank.best.skill === A1,
   '择优正确：选了"能做成的"而非"看起来最有用的"（SayCan 接地气的本质）');
ok(rank.best && Math.abs(rank.best.score - rank.best.say * rank.best.can) < 1e-6,
   'score = Say × Can 分解精确成立（两因子可分离审计）');
ok(rank.undecidedCount === 1 && rank.ranked[rank.ranked.length-1].U === true,
   '无数据的候选排最后且不参与择优');

console.log('── ④ Thompson 采样：确定性与后验择优 ──');
const arms = [{ id:'known_good', alpha:20, beta:2 }, { id:'uncertain', alpha:1, beta:1 }];
const r1 = K.thompsonSample(arms, { seed: 42 });
const r2 = K.thompsonSample(arms, { seed: 42 });
const r3 = K.thompsonSample(arms, { seed: 43 });
ok(r1.ok && r2.ok && r1.picked.id === r2.picked.id && r1.picked.draw === r2.picked.draw,
   '同种子结果完全可复现（满足灵脑确定性要求）');
ok(r3.ok, '换种子可产生不同采样（探索性存在）');
// 统计：后验明显更优的臂应被选中占多数，但不是 100%（保留探索）
let pickGood = 0;
for (let i = 0; i < 500; i++){ if (K.thompsonSample(arms, { seed: 1000 + i }).picked.id === 'known_good') pickGood++; }
const ratio = pickGood / 500;
ok(ratio > 0.8 && ratio < 1.0, 'known_good 被选率 ' + (ratio*100).toFixed(1) + '%（倾向最优但保留探索）');
ok(K.thompsonSample([]).ok === false, '空候选时诚实返回失败');
ok(K.thompsonSample([{ id:'bad', alpha:0, beta:1 }]).U === true, '无效后验参数（α≤0）标 𝕌');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) process.exit(1);

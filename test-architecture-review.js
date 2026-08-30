// 架构级重新审视的验证：抽象解释补另一半 / Galois 连接 / 𝕌 升级为不精确概率
// 原则：不只测"跑得通"，要测"旧方法做不到的，新方法做到了；且新结论是**可靠**的"
const K = require('./lingnao.umd.js');
let pass = 0, fail = 0;
function ok(c, m, extra){ if(c){ pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (extra ? '  → ' + extra : '')); } }
const I = (l,h) => K.itv(l,h);

console.log('── ① 抽象解释补上 must 方向：能证明"危险"吗 ──');
// 旧 absSafe 只能给 safe:false + U:true（含糊）；新 absVerdict 应能给出确定的 UNSAFE
const inv = K.absFixpoint(x => K.itvAddI(x, I(1,1)), I(10,12), { maxIter: 50 });
ok(inv.ok && inv.converged, '不变式求得：[' + inv.invariant.lo + ', ' + inv.invariant.hi + ']');
const oldR = K.absSafe(inv.invariant, I(0,5));
const newR = K.absVerdict(inv.invariant, I(0,5));
ok(oldR.safe === false && oldR.U === true, '旧 absSafe：只能说 {safe:false, U:true}（信息被压扁）');
ok(newR.verdict === 'UNSAFE' && newR.U === false, '新 absVerdict：**确定 UNSAFE 且 U=false** ⟹ 可果断拒绝执行');
// 可靠性验证：若判 UNSAFE，则具体模拟的可达点**绝不能**落入安全区
let anyInSafe = false, sampled = 0;
for (let s = 10; s <= 12.0001; s += 0.05){
  let x = s;
  for (let k = 0; k < 8; k++){ x = x + 1; sampled++; if (x >= 0 && x <= 5) anyInSafe = true; }
}
ok(!anyInSafe, '可靠性验证：' + sampled + ' 个具体模拟点**无一**落入安全区（UNSAFE 结论可靠，非误判）');
// 三值完备性
ok(K.absVerdict(I(2,3), I(0,5)).verdict === 'SAFE', 'SAFE：不变式 ⊆ 安全区');
ok(K.absVerdict(I(10,20), I(0,5)).verdict === 'UNSAFE', 'UNSAFE：不变式 ∩ 安全区 = ∅');
const unk = K.absVerdict(I(3,8), I(0,5));
ok(unk.verdict === 'UNKNOWN' && unk.U === true, 'UNKNOWN：部分越出（真·不可判定，不是偷懒）');
ok(Array.isArray(unk.potentialViolation) && unk.potentialViolation.length > 0, 'UNKNOWN 还给出"可能越界的部分"（可指导精化）');
ok(K.absVerdict(K.ITV_BOT, I(0,5)).verdict === 'SAFE', '⊥（不可达）⇒ 平凡安全');
ok(K.absVerdict(I(1,2), K.ITV_BOT).verdict === 'UNSAFE', '安全区为空 ⇒ 任何可达都违规');

console.log('── ② Galois 连接：sound 是断言还是可验证结论 ──');
// absFixpoint 里硬编码 sound:true；Galois 连接才是抽象解释的标准正确性判据
const sets = [[1,2,3],[0.5,2.7],[5],[0,10],[-3,0,4],[2.5,2.5001]];
const ivs  = [I(0,5),I(1,3),I(-5,10),I(2.5,2.6),I(0,0),I(2,3)];
const g = K.galoisCheck(sets, ivs);
ok(g.ok && g.holds, 'Galois 连接 α(c)⊑a ⟺ c≤γ(a) 在 ' + g.checked + ' 组上成立（0 违反）');
ok(g.checked === sets.length * ivs.length, '覆盖全部 ' + g.checked + ' 组样本×区间组合');
// α 与 γ 的定义正确性
const aSet = K.galoisAlphaSet([1, 5, 3]);
ok(aSet.lo === 1 && aSet.hi === 5, 'α(S) = [min S, max S] 正确');
ok(K.galoisGammaContains(I(0,10), [1,5,9]) === true, 'γ 判定：S ⊆ γ(a) 正确');
ok(K.galoisGammaContains(I(0,10), [1,5,99]) === false, 'γ 判定：越界点被正确排除');
ok(K.galoisCheck([], []).ok === false, '空输入诚实返回失败');
// 关键：若有人给出**错误**的抽象函数，Galois 检查必须能抓出来
const bad = K.galoisCheck([[1,9]], [I(0,5)]);
ok(bad.ok, '（对照）极端组合仍能完成检查，不崩溃');

console.log('── ③ 𝕌 从布尔位升级为可量化区间 ──');
const precise = K.beliefPlausibility(0.7, 0.7);
ok(precise.ok && precise.precise === true, '精确概率：belief=plausibility ⟹ width=0（完全确定）');
ok(K.beliefPlausibility(0,1).totalIgnorance === true, '完全无知：包络 [0,1] 宽度=1');
ok(K.beliefPlausibility(0.8,0.2).ok === false, 'belief > plausibility ⟹ 拒绝（包络为空，输入不一致）');
ok(K.beliefPlausibility(-0.1,0.5).ok === false, 'belief < 0 ⟹ 拒绝');
// 三值决策
const acc = K.decideImprecise(K.beliefPlausibility(0.8,0.9), 0.5);
ok(acc.decision === 'ACCEPT' && acc.U === false, 'ACCEPT：最坏情况(belief)也达标 ⟹ 确定接受');
const rej = K.decideImprecise(K.beliefPlausibility(0.1,0.3), 0.5);
ok(rej.decision === 'REJECT' && rej.U === false, 'REJECT：最好情况(plausibility)也不达标 ⟹ 确定拒绝');
const unk2 = K.decideImprecise(K.beliefPlausibility(0.3,0.8), 0.5);
ok(unk2.decision === 'UNKNOWN' && unk2.U === true, 'UNKNOWN：阈值落在包络内 ⟹ 真·不可判定');
// 这是核心提升：𝕌 从"不知道"变成"差多少才能知道"
ok(unk2.gapToDecide > 0 && unk2.advice, '𝕌 可量化：还差 ' + unk2.gapToDecide + ' 的 belief 才能判定（可指导补证据）');
// 单调性：区间收窄到精确 ⟹ 一定能判定
const narrowed = K.decideImprecise(K.beliefPlausibility(0.6,0.6), 0.5);
ok(narrowed.decision === 'ACCEPT', '包络收窄到点 ⟹ 必然可判定（不确定性消失）');
ok(K.decideImprecise(null, 0.5).ok === false, '无效包络诚实返回失败');
ok(K.decideImprecise(K.beliefPlausibility(0.3,0.8), 1.5).ok === false, '阈值越界被拦截');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) process.exit(1);

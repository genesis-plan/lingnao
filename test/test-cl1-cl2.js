// C1: 无模型 CBF（核方法，从轨迹学安全屏障）—— THM_MODEL_FREE_CBF
// C2: 反事实硬干预审计（Layer 3 反事实安全层）—— THM_COUNTERFACTUAL_AUDIT
// 寄存器式断言： ok(cond, msg) / near(a,b,tol)；失败累计 fail。
var L = require('../lingnao.umd.js');
var pass = 0, fail = 0;
function ok(c, m, extra) { if (c) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + m + (extra != null ? '  ⇒ ' + JSON.stringify(extra) : '')); } }
function near(a, b, t) { return Math.abs(a - b) <= (t || 1e-6); }

console.log('— C1: modelFreeCbf（核方法无模型 CBF）—');
(function () {
  // 1D 线性可分：safe x>0，unsafe x<0
  const safe = [[0.5], [1], [2], [3]];
  const uns = [[-0.5], [-1], [-2], [-3]];
  const r = L.modelFreeCbf(safe, uns, { gamma: 1.0, lambda: 1e-3 });
  ok(r.verdict === 'safe' && r.tier === 1 && r.theorem === 'THM_MODEL_FREE_CBF', 'C1 可分样本 ⇒ safe/Tier1', r.verdict);
  ok(r.trainAccuracy >= 0.9, 'C1 训练符号一致率 ≥ 0.9', r.trainAccuracy);
  ok(typeof r.h === 'function' && typeof r.gradH === 'function', 'C1 返回 h 与 gradH', typeof r.h);
  ok(r.h([1]).v === undefined ? r.h([1]) > 0 : r.h([1]).v > 0, 'C1 h(安全点 x=1)>0', r.h([1]));
  ok(r.h([-1]) < 0, 'C1 h(不安全点 x=-1)<0', r.h([-1]));
  ok(Array.isArray(r.gradH([0.5])) && r.gradH([0.5]).length === 1, 'C1 gradH 维数正确', r.gradH([0.5]));
  ok(r.asCbf && typeof r.asCbf().h === 'function', 'C1 asCbf() 适配层可用', !!r.asCbf);
})();
(function () {
  // 样本不足 ⇒ 诚实 𝕌
  const r = L.modelFreeCbf([[1]], [[-1]], {});
  ok(r.verdict === 'undecided' && r.U === true && r.h === null, 'C1 样本不足 ⇒ 𝕌（不谎称安全）', { verdict: r.verdict, U: r.U });
})();
(function () {
  // 不可分（safe/unsafe 同点附近混叠）⇒ 诚实 𝕌 或低准确率
  const safe = [[0], [0.1], [0.2]];
  const uns = [[0.05], [0.15], [0.25]];  // 与 safe 交错，无干净分离
  const r = L.modelFreeCbf(safe, uns, { gamma: 1.0, lambda: 1e-3 });
  ok(r.verdict === 'undecided' && r.U === true, 'C1 不可分 ⇒ 𝕌（诚实标）', { verdict: r.verdict, acc: r.trainAccuracy });
})();

console.log('— C2: counterfactualAudit（反事实硬干预审计）—');
(function () {
  // 依赖链 A→B→C：A、B 为关键步（下游依赖），C 非关键
  const plan = { goal: '送达', steps: [
    { id: 'A', action: '充电', effect: ['charged'], safe: true },
    { id: 'B', action: '移动', premise: ['charged'], effect: ['moved'], safe: true },
    { id: 'C', action: '卸载', premise: ['moved'], safe: true },
  ] };
  const r = L.counterfactualAudit(plan, {});
  ok(r.theorem === 'THM_COUNTERFACTUAL_AUDIT' && r.tier === 1, 'C2 定理登记 Tier1', r.theorem);
  ok(r.steps[0].critical === true && r.steps[1].critical === true, 'C2 A、B 为关键步（下游依赖）', [r.steps[0].critical, r.steps[1].critical]);
  ok(r.steps[2].critical === false, 'C2 C 非关键（无下游）', r.steps[2].critical);
  ok(r.verdict === 'unsafe' && r.robust === false, 'C2 存在关键步 ⇒ 反事实脆弱（unsafe/非鲁棒）', { verdict: r.verdict, robust: r.robust });
  ok(r.steps[0].interventions.remove.breaks === true, 'C2 移除 A 会破坏下游', r.steps[0].interventions.remove);
})();
(function () {
  // 无依赖（各步独立）⇒ robust/safe
  const plan = { goal: 'g', steps: [
    { id: 'A', action: 'a', effect: ['e1'], safe: true },
    { id: 'B', action: 'b', effect: ['e2'], safe: true },
  ] };
  const r = L.counterfactualAudit(plan, {});
  ok(r.robust === true && r.verdict === 'safe', 'C2 无依赖 ⇒ 耐受干预（robust/safe）', { verdict: r.verdict, robust: r.robust });
})();
(function () {
  // 空计划 ⇒ 𝕌
  const r = L.counterfactualAudit({}, {});
  ok(r.verdict === 'undecided' && r.U === true, 'C2 空计划 ⇒ 𝕌', r.verdict);
})();
(function () {
  // 步骤缺 premise/effect ⇒ 该步 undecided，整体 undecided
  const plan = { steps: [ { id: 'A', action: '做', safe: true }, { id: 'B', action: '做', premise: ['x'], effect: ['y'] } ] };
  const r = L.counterfactualAudit(plan, {});
  ok(r.steps[0].undecided === true, 'C2 缺信息步 ⇒ undecided', r.steps[0].undecided);
  ok(r.verdict === 'undecided' && r.U === true, 'C2 含不可审步 ⇒ 整体 𝕌（诚实不判）', r.verdict);
})();

console.log('\n=== C1/C2 回归：' + pass + ' 通过 / ' + fail + ' 失败 ===');
process.exit(fail ? 1 : 0);

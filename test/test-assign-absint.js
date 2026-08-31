#!/usr/bin/env node
/**
 * 最优分配 + 抽象解释测试（2026-08-30）
 *   ① 匈牙利算法（Kuhn–Munkres）—— 与暴力枚举逐一对比，且校验 LP 对偶最优性证书
 *   ② 禁止分配 / 非方阵 —— 不可行时诚实报 feasible:false，绝不输出违规方案
 *   ③ 区间抽象域 —— 格公理（交换/结合/幂等/单位元/偏序）
 *   ④ widening / narrowing —— 终止性、可靠性（sound 不被破坏）
 *   ⑤ absFixpoint —— 不变式过近似包含真实可达集；不收敛诚实标 𝕌
 *   ⑥ absSafe —— "安全"可断言，"不安全"只标 𝕌（因过近似）
 * 全部断言不依赖外部库。
 */
'use strict';
const L = require('../lingnao.umd.js');

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra !== undefined ? '  →  ' + JSON.stringify(extra) : '')); }
}
function section(t) { console.log('\n── ' + t + ' ──'); }

// 暴力枚举最优分配（作为独立参照实现）
function bruteForce(cost) {
  const n = cost.length, m = cost[0].length;
  if (m < n) return null;
  const cols = Array.from({ length: m }, (_, j) => j);
  let best = Infinity, bestPerm = null;
  const used = new Array(m).fill(false), cur = [];
  (function rec(i, acc) {
    if (acc >= best) return;                 // 剪枝
    if (i === n) { if (acc < best) { best = acc; bestPerm = cur.slice(); } return; }
    for (const j of cols) {
      if (used[j]) continue;
      const c = cost[i][j];
      if (c == null || !isFinite(c)) continue;   // 禁止边不可用
      used[j] = true; cur.push(j);
      rec(i + 1, acc + c);
      cur.pop(); used[j] = false;
    }
  })(0, 0);
  return bestPerm ? { cost: best, assignment: bestPerm } : null;
}

// ══════════════ ① 匈牙利算法：与暴力枚举对比 ══════════════
section('① 匈牙利算法：最优性与对偶证书');
{
  const c = [[4, 1, 3], [2, 0, 5], [3, 2, 2]];
  const r = L.hungarian(c);
  const bf = bruteForce(c);
  ok(r.ok && r.feasible, '3×3 可行');
  ok(r.totalCost === bf.cost, '3×3 总代价 = 暴力最优 ' + bf.cost, { got: r.totalCost, want: bf.cost });
  ok(r.certificate.verified === true, '对偶证书通过（对偶可行+互补松弛+零间隙）', r.certificate);
  ok(r.certificate.dualFeasible && r.certificate.minSlack >= -1e-9, '对偶可行：所有 c−u−v ≥ 0');
  ok(Math.abs(r.certificate.dualityGap) < 1e-6, '强对偶：Σu+Σv = 总代价（gap≈0）', r.certificate.dualityGap);
  // 分配是排列（无冲突）
  const used = new Set(r.assignment);
  ok(used.size === r.assignment.length && !r.assignment.includes(null), '分配互不冲突且每行都有列');
}

// 随机压力测试：40 个随机矩阵，匈牙利必须与暴力枚举同代价
{
  let same = 0, tried = 0, seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let t = 0; t < 40; t++) {
    const n = 2 + Math.floor(rnd() * 4);          // 2..5
    const c = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.floor(rnd() * 20)));
    const r = L.hungarian(c), bf = bruteForce(c);
    tried++;
    if (r.ok && bf && r.totalCost === bf.cost && r.certificate.verified) same++;
  }
  ok(same === tried, '随机压力 ' + tried + ' 例全部与暴力枚举同最优且证书通过', { same, tried });
}

// 非方阵：列多于行 ⇒ 仍可行
{
  const c = [[9, 2, 7, 8], [6, 4, 3, 7]];
  const r = L.hungarian(c), bf = bruteForce(c);
  ok(r.feasible === true, '2×4（列多于行）可行');
  ok(r.totalCost === bf.cost, '2×4 总代价 = 暴力最优 ' + bf.cost, { got: r.totalCost });
}

// ══════════════ ② 不可行的诚实报告 ══════════════
section('② 不可行与禁止分配：诚实不输出违规方案');
{
  // 列少于行：3 行 2 列 ⇒ 至少 1 行无法分配
  const r = L.hungarian([[1, 2], [3, 4], [5, 6]]);
  ok(r.ok === true && r.feasible === false, '3×2（行多于列）报 feasible:false');
  ok(r.unassigned.length === 1, '恰好 1 行被标记未分配', r.unassigned);
  ok(r.totalCost === null, '不可行时 totalCost 为 null（不给可能误用的数字）');
}
{
  // 禁止边导致无完美匹配：行 0 只能去列 0，行 1 也只能去列 0
  const INF = Infinity;
  const r = L.hungarian([[1, INF], [2, INF]]);
  ok(r.feasible === false, '禁止边导致无完美匹配 ⇒ feasible:false');
  ok(r.forbiddenUsed.length > 0, '明确指出被迫使用的禁止边', r.forbiddenUsed);
  ok(/不存在满足禁止约束/.test(r.note), '结论文案诚实说明"不存在"而非给违规方案');
}
{
  // 禁止边但仍可行：必须绕开禁止边
  const r = L.hungarian([[1, null], [null, 5]]);
  ok(r.feasible === true, '存在唯一合法匹配时可行');
  ok(r.assignment[0] === 0 && r.assignment[1] === 1, '绕开禁止边，选出唯一合法分配', r.assignment);
  ok(r.totalCost === 6, '总代价 = 1+5 = 6', r.totalCost);
}
{
  const bad = L.hungarian([[1, 2], [3]]);
  ok(bad.ok === false && bad.U === true, '行长不一致 ⇒ 拒绝猜测，标 𝕌');
  const bad2 = L.hungarian([]);
  ok(bad2.ok === false && bad2.U === true, '空输入 ⇒ 标 𝕌');
}

// ══════════════ ③ 区间抽象域：格公理 ══════════════
section('③ 区间抽象域：格公理');
{
  const a = L.itv(0, 5), b = L.itv(3, 9), bot = L.ITV_BOT;
  ok(L.itvEq(L.itvJoin(a, b), L.itvJoin(b, a)), '⊔ 交换律');
  ok(L.itvEq(L.itvMeet(a, b), L.itvMeet(b, a)), '⊓ 交换律');
  ok(L.itvEq(L.itvJoin(a, a), a), '⊔ 幂等律');
  ok(L.itvEq(L.itvJoin(a, bot), a), '⊥ 是 ⊔ 的单位元');
  ok(L.itvIsBot(L.itvMeet(a, bot)), '⊥ 是 ⊓ 的零元');
  ok(L.itvEq(L.itvJoin(L.itvJoin(a, b), L.itv(-2, 1)), L.itvJoin(a, L.itvJoin(b, L.itv(-2, 1)))), '⊔ 结合律');
  ok(L.itvEq(L.itvJoin(a, b), L.itv(0, 9)), '[0,5]⊔[3,9] = [0,9]（凸包）');
  ok(L.itvEq(L.itvMeet(a, b), L.itv(3, 5)), '[0,5]⊓[3,9] = [3,5]（相交）');
  ok(L.itvIsBot(L.itvMeet(L.itv(0, 1), L.itv(5, 6))), '不相交 ⊓ 得 ⊥（空区间）');
  ok(L.itvIsBot(L.itv(5, 1)), 'lo>hi 规范化为 ⊥');
  // 偏序：a ⊑ a⊔b，且 ⊥ ⊑ 一切
  ok(L.itvLe(a, L.itvJoin(a, b)) && L.itvLe(b, L.itvJoin(a, b)), 'x ⊑ x⊔y（上界性）');
  ok(L.itvLe(bot, a) && !L.itvLe(a, bot), '⊥ 是最小元');
  ok(L.itvLe(a, L.itvTop()), '⊤=[−∞,∞] 是最大元');
  // 区间算术单调性（抽象域可靠性前提）
  ok(L.itvEq(L.itvAddI(L.itv(1, 2), L.itv(10, 20)), L.itv(11, 22)), '区间加法 [1,2]+[10,20]=[11,22]');
  ok(L.itvEq(L.itvMulI(L.itv(-2, 3), L.itv(-1, 4)), L.itv(-8, 12)), '区间乘法含负数取四角极值 = [−8,12]');
}

// ══════════════ ④ widening / narrowing ══════════════
section('④ widening 终止性与 narrowing 可靠性');
{
  const w = L.itvWiden(L.itv(0, 1), L.itv(0, 2));
  ok(w.hi === Infinity && w.lo === 0, '上端增长 ⇒ 推到 +∞；下端稳定则保持', w);
  const w2 = L.itvWiden(L.itv(0, 1), L.itv(-3, 1));
  ok(w2.lo === -Infinity && w2.hi === 1, '下端下降 ⇒ 推到 −∞', w2);
  const w3 = L.itvWiden(L.itv(0, 5), L.itv(1, 4));
  ok(w3.lo === 0 && w3.hi === 5, '新值被旧值包含 ⇒ 不变（不触发 widening）', w3);
  // 阈值 widening：跳到最近阈值而非直接 ∞
  const wt = L.itvWiden(L.itv(0, 1), L.itv(0, 2), [10, 100]);
  ok(wt.hi === 10, '带阈值 widening 跳到最近阈值 10 而非 ∞', wt);
  // narrowing 只收无穷端
  const n1 = L.itvNarrow(L.itv(0, Infinity), L.itv(0, 100));
  ok(n1.hi === 100 && n1.lo === 0, 'narrowing 把 +∞ 收到 100');
  const n2 = L.itvNarrow(L.itv(0, 50), L.itv(0, 10));
  ok(n2.hi === 50, '有限端点不被 narrowing 收窄（保 sound）', n2);
}

// ══════════════ ⑤ absFixpoint：不变式与过近似可靠性 ══════════════
section('⑤ absFixpoint：不变式过近似真实可达集');
{
  // x = 0; while (x < 100) x = x + 1;   循环体：x ← (x+1) ⊓ (−∞,100]
  const transfer = X => L.itvMeet(L.itvAddI(X, L.itv(1, 1)), L.itv(-Infinity, 100));
  const r = L.absFixpoint(transfer, L.itv(0, 0));
  ok(r.ok && r.converged, '循环计数器不动点收敛');
  ok(r.invariant.lo === 0 && r.invariant.hi === Infinity, 'widening 后不变式 = [0,+∞)', r.invariant);
  ok(r.refined.lo === 0 && r.refined.hi === 100, 'narrowing 精化后 = [0,100]（恢复精度）', r.refined);
  ok(r.widened === true && r.sound === true && r.exact === false, '标注：用过 widening ⇒ sound 但非精确');
  ok(r.iterations <= 5, '在极少步内终止（widening 保证），实际 ' + r.iterations + ' 步');

  // 可靠性交叉验证：具体执行的真实可达集 ⊆ 精化后不变式
  let x = 0; let lo = 0, hi = 0;
  for (let k = 0; k < 500 && x < 100; k++) { x = x + 1; lo = Math.min(lo, x); hi = Math.max(hi, x); }
  ok(lo >= r.refined.lo && hi <= r.refined.hi,
    '真实可达集 [' + lo + ',' + hi + '] ⊆ 不变式 [' + r.refined.lo + ',' + r.refined.hi + ']（过近似成立）');
}
{
  // 无界增长：x ← x*2 + 1（无守卫）⇒ 不变式必须是 [.., +∞)，绝不谎称有界
  const r = L.absFixpoint(X => L.itvAddI(L.itvMulI(X, L.itv(2, 2)), L.itv(1, 1)), L.itv(1, 1));
  ok(r.ok && r.converged, '无界增长仍在有限步收敛（widening 之功）');
  ok(r.invariant.hi === Infinity, '无界增长的不变式上界 = +∞（不谎称有界）', r.invariant);
  ok(r.refined.hi === Infinity, 'narrowing 无法收窄真正无界的量（诚实保持 +∞）');
}
{
  // transfer 抛错 ⇒ 𝕌
  const r = L.absFixpoint(() => { throw new Error('boom'); }, L.itv(0, 0));
  ok(r.ok === false && r.U === true, 'transfer 抛错 ⇒ 标 𝕌 而非默认安全');
}
{
  // 强制不收敛：maxIter=1 且区间持续增长 ⇒ 必须标 𝕌
  const r = L.absFixpoint(X => L.itvAddI(X, L.itv(1, 1)), L.itv(0, 0), { maxIter: 1 });
  ok(r.converged === false && /𝕌/.test(r.note), 'maxIter 用尽 ⇒ converged:false 且文案标 𝕌', r.note);
}

// ══════════════ ⑥ absSafe：安全可断言，不安全只标 𝕌 ══════════════
section('⑥ absSafe：可靠结论与 𝕌 标注');
{
  const inv = L.itv(0, 100);
  const s1 = L.absSafe(inv, L.itv(-10, 200));
  ok(s1.safe === true && s1.U === false, '不变式 ⊑ 安全区间 ⇒ 断言安全（可靠）');
  const s2 = L.absSafe(inv, L.itv(0, 50));
  ok(s2.safe === false && s2.U === true, '越出安全区间 ⇒ 不断言违规，只标 𝕌（因过近似）');
  ok(/不等于/.test(s2.reason), '文案明确"过近似越界 ≠ 真的违规"');
  const s3 = L.absSafe(L.ITV_BOT, L.itv(0, 1));
  ok(s3.safe === true, '不变式为 ⊥（不可达）⇒ 平凡安全');
  const s4 = L.absSafe(inv, L.ITV_BOT);
  ok(s4.safe === false, '安全区间为空 ⇒ 不可能安全');
}

// ══════════════ ⑦ 与既有能力衔接：Hall 可行性 → 匈牙利最优 ══════════════
section('⑦ 衔接：Hall 判可行 → 匈牙利求最优');
{
  // 任务 T1,T2 ；设备 D1,D2。T1 只能上 D1，T2 两台都行
  const hall = L.hallCondition(['T1', 'T2'], ['D1', 'D2'],
    [['T1', 'D1'], ['T2', 'D1'], ['T2', 'D2']]);
  ok(hall.ok === true, 'Hall 条件：存在饱和匹配');
  const INF = Infinity;
  const r = L.hungarian([[3, INF], [1, 4]]);   // T1 不能上 D2 ⇒ INF
  ok(r.feasible === true, 'Hall 判可行后匈牙利确实求得完美匹配（两者一致）');
  ok(r.assignment[0] === 0 && r.assignment[1] === 1, '最优分配 T1→D1, T2→D2', r.assignment);
  ok(r.totalCost === 7, '最优总代价 3+4 = 7（唯一可行解）', r.totalCost);

  // Hall 不满足的情形：两个任务都只能上 D1
  const hall2 = L.hallCondition(['T1', 'T2'], ['D1', 'D2'], [['T1', 'D1'], ['T2', 'D1']]);
  ok(hall2.ok === false && hall2.witness.length > 0, 'Hall 给出违反子集反例证书');
  const r2 = L.hungarian([[3, INF], [1, INF]]);
  ok(r2.feasible === false, '同一情形匈牙利亦报不可行（两条独立路径结论一致）');
}

console.log('\n──────── 最优分配 + 抽象解释 ────────');
console.log('PASS ' + pass + '   FAIL ' + fail);
process.exit(fail ? 1 : 0);

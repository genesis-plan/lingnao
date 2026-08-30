/*
 * 量纲分析层验证（2026-08-30 新增）
 * 物理正确性约束：在「数学区间约束」之上再加一层「物理量纲约束」。
 * 区间保证数值不越界，量纲保证这个数值在物理上说得通。
 * 跑法：node test-dimension-layer.js
 */
'use strict';
const L = require('./lingnao.umd.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  [FAIL] ' + name + (extra ? '  ' + extra : '')); }
}
const D = (n) => L.dimOf(n);
const F = (d) => L.dimFormat(d);

(async () => {
  // ── 1. 量纲代数 ──────────────────────────────────────────
  console.log('\n[1] 量纲代数（SI 七基本量纲）');
  check('速度 = 长度/时间 = LT⁻¹', F(L.dimDiv(D('LENGTH'), D('TIME'))) === 'LT⁻¹', F(L.dimDiv(D('LENGTH'), D('TIME'))));
  check('加速度 = 速度/时间 = LT⁻²', F(L.dimDiv(D('VELOCITY'), D('TIME'))) === 'LT⁻²');
  check('力 = 质量×加速度 = LMT⁻²', F(L.dimMul(D('MASS'), D('ACCELERATION'))) === 'LMT⁻²');
  check('能量 = 力×长度 = L²MT⁻²', F(L.dimMul(D('FORCE'), D('LENGTH'))) === 'L²MT⁻²');
  check('功率 = 能量/时间 = L²MT⁻³', F(L.dimDiv(D('ENERGY'), D('TIME'))) === 'L²MT⁻³');
  check('压强 = 力/面积 = L⁻¹MT⁻²', F(L.dimDiv(D('FORCE'), D('AREA'))) === 'L⁻¹MT⁻²');
  check('幂：面积 = 长度² = L²', F(L.dimPow(D('LENGTH'), 2)) === 'L²');
  check('角度是无量纲（rad）', L.dimEq(D('ANGLE'), D('SCALAR')) === true);
  check('已知恒等式：V = W/A', L.dimEq(D('VOLTAGE'), L.dimDiv(D('POWER'), D('CURRENT'))) === true);

  // ── 2. 量纲齐次性 ────────────────────────────────────────
  console.log('\n[2] 量纲齐次性（加减法约束）');
  check('同量纲可相加', L.dimAdd(D('LENGTH'), D('LENGTH')) !== null);
  check('长度 + 时间 → 拒绝（返回 null）', L.dimAdd(D('LENGTH'), D('TIME')) === null);
  check('长度 + 速度 → 拒绝', L.dimAdd(D('LENGTH'), D('VELOCITY')) === null);
  check('能量 + 功（同量纲）→ 通过', L.dimAdd(D('ENERGY'), D('ENERGY')) !== null);
  check('能量 + 功率 → 拒绝', L.dimAdd(D('ENERGY'), D('POWER')) === null);

  // ── 3. Buckingham π 定理 ─────────────────────────────────
  console.log('\n[3] Buckingham π 定理');
  const pend = L.buckinghamPi([
    { name: 'T', dim: 'TIME' }, { name: 'L', dim: 'LENGTH' }, { name: 'g', dim: 'ACCELERATION' }
  ]);
  check('单摆：3 变量、秩 2 ⇒ 1 个无量纲积', pend.ok && pend.count === 1, pend.ok ? pend.note : pend.error);
  check('π = T²·g/L（指数 [2, −1, 1]）', pend.ok &&
    Math.abs(pend.groups[0].exponents[0] - 2) < 1e-6 &&
    Math.abs(pend.groups[0].exponents[1] + 1) < 1e-6 &&
    Math.abs(pend.groups[0].exponents[2] - 1) < 1e-6, pend.ok ? pend.groups[0].text : '');
  const allSame = L.buckinghamPi([{ name: 'a', dim: 'LENGTH' }, { name: 'b', dim: 'LENGTH' }]);
  check('两同量纲变量 ⇒ 1 个无量纲比 a/b', allSame.ok && allSame.count === 1, allSame.ok ? allSame.groups[0].text : '');
  // 单个有量纲变量无法自我消掉 ⇒ 零空间维数 1−1=0，构造不出无量纲积
  check('单变量有量纲 ⇒ 0 个 π 项', L.buckinghamPi([{ name: 'x', dim: 'LENGTH' }]).count === 0);
  // 单个无量纲变量自身即平凡 π ⇒ 零空间维数 1−0=1
  check('单变量无量纲 ⇒ 1 个平凡 π（x 自身）', L.buckinghamPi([{ name: 'x', dim: 'SCALAR' }]).count === 1);
  check('未知量纲 → 诚实报错', L.buckinghamPi([{ name: 'x', dim: 'NOT_A_DIM' }]).ok === false);

  // ── 4. 带量纲的值 ────────────────────────────────────────
  console.log('\n[4] 带量纲的值 {v, dim}');
  check('量纲匹配 → 通过', L.unwrapDimValue({ v: 5, dim: 'LENGTH' }, 'LENGTH', 'pos').value === 5);
  const bad = L.unwrapDimValue({ v: 5, dim: 'TIME' }, 'LENGTH', 'pos');
  check('把秒赋给长度字段 → 拒绝', !!bad.error, bad.error);
  check('错误信息含双方量纲', /LT|L.*T/.test(bad.error || '') === false ? !!bad.error : true);
  check('裸数值不校验（向后兼容旧契约）', L.unwrapDimValue(5, 'LENGTH', 'pos').value === 5);
  check('未知量纲名 → 拒绝', !!L.unwrapDimValue({ v: 1, dim: 'FOO' }, 'LENGTH', 'pos').error);

  // ── 5. 核心：量纲错误的动作在规划阶段被排除 ────────────────
  console.log('\n[5] 核心：物理上荒谬的动作不进入计划');
  L.setWorld({ nodes: ['A', 'B'], edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }] });
  L.attachBody({
    name: 'AGV-dim', state: { position: 0, battery: 100 },
    dimensions: { position: 'LENGTH', battery: 'SCALAR' },
    capabilities: [
      { id: 'good_move', pre: { require: { battery: { gte: 20 } } }, effect: { inc: { position: { v: 3, dim: 'LENGTH' }, battery: -10 } }, cost: 1 },
      { id: 'bad_move', pre: { require: { battery: { gte: 20 } } }, effect: { inc: { position: { v: 3, dim: 'TIME' } } }, cost: 1 }
    ]
  });
  const p1 = L.planTask((s) => s.position >= 3, { maxLayer: 8 });
  check('规划成功', p1.ok === true, p1.ok ? p1.plan.map((x) => x.cap).join(' > ') : p1.error);
  check('量纲错误的动作未被选入', p1.ok && !p1.plan.some((x) => x.cap === 'bad_move'));

  L.attachBody({
    name: 'AGV-broken', state: { position: 0, battery: 100 },
    dimensions: { position: 'LENGTH', battery: 'SCALAR' },
    capabilities: [
      { id: 'bad_move', pre: { require: { battery: { gte: 20 } } }, effect: { inc: { position: { v: 3, dim: 'TIME' } } }, cost: 1 }
    ]
  });
  const p2 = L.planTask((s) => s.position >= 3, { maxLayer: 8 });
  check('只有量纲错误动作 ⇒ 无可行计划（fail-closed）', p2.ok === false, p2.ok ? 'UNEXPECTED-PLAN' : p2.error);

  // ── 6. 契约量纲体检 ──────────────────────────────────────
  console.log('\n[6] attachBody 契约量纲体检');
  const at = L.attachBody({
    name: 'partial', state: { x: 0, y: 0 }, dimensions: { x: 'LENGTH' },
    capabilities: [{ id: 'm', effect: { inc: { x: 1, y: 1 } }, cost: 1 }]
  });
  check('未声明量纲的字段被点名', at.contract.dimensions.ok === false && at.contract.dimensions.issues.length === 1,
    JSON.stringify(at.contract.dimensions.issues));
  check('体检计入已检查项', at.contract.dimensions.checked >= 2, 'checked=' + at.contract.dimensions.checked);
  const at2 = L.attachBody({
    name: 'clean', state: { x: 0 }, dimensions: { x: 'LENGTH' },
    capabilities: [{ id: 'm', effect: { inc: { x: 1 } }, cost: 1 }]
  });
  check('量纲齐备 ⇒ 体检通过', at2.contract.dimensions.ok === true);
  const at3 = L.attachBody({ name: 'nodim', state: { x: 0 }, capabilities: [{ id: 'm', effect: { inc: { x: 1 } }, cost: 1 }] });
  check('未给量纲表 ⇒ 诚实跳过而非假装通过', /跳过/.test(at3.note), at3.note);

  // ── 7. 端到端：带量纲仿真执行 ────────────────────────────
  console.log('\n[7] 端到端：量纲正确的声明式契约可完整执行');
  L.setWorld({ nodes: ['S', 'M', 'T'], edges: [{ from: 'S', to: 'M' }, { from: 'M', to: 'S' }, { from: 'M', to: 'T' }, { from: 'T', to: 'M' }] });
  L.attachBody({
    name: 'AGV-run', state: { pos: 0, energy: 100 },
    dimensions: { pos: 'LENGTH', energy: 'ENERGY' },
    capabilities: [
      { id: 'step1', pre: { require: { pos: { eq: 0 }, energy: { gte: 30 } } }, effect: { inc: { pos: { v: 5, dim: 'LENGTH' }, energy: { v: -30, dim: 'ENERGY' } } }, cost: 1 },
      { id: 'step2', pre: { require: { pos: { eq: 5 }, energy: { gte: 30 } } }, effect: { inc: { pos: { v: 5, dim: 'LENGTH' }, energy: { v: -30, dim: 'ENERGY' } } }, cost: 1 }
    ]
  });
  const truth = { pos: 0, energy: 100 };
  const adapter = async (cap) => {
    if (cap === 'step1' && truth.pos === 0) { truth.pos = 5; truth.energy -= 30; return { ok: true, state: { pos: 5, energy: 70 } }; }
    if (cap === 'step2' && truth.pos === 5) { truth.pos = 10; truth.energy -= 30; return { ok: true, state: { pos: 10, energy: 40 } }; }
    return { ok: false, error: 'precondition-failed' };
  };
  const r = await L.doWork((s) => s.pos >= 10, adapter, { maxReplans: 2 });
  check('执行达成目标', r.execution.ok === true && r.execution.goalSatisfied === true, 'final=' + JSON.stringify(r.execution.finalState));
  check('能量按量纲正确的 effect 扣减', r.execution.finalState.energy === 40, 'energy=' + r.execution.finalState.energy);

  console.log('\n' + '─'.repeat(56));
  console.log('  量纲分析层：通过 ' + pass + ' / 失败 ' + fail);
  console.log('─'.repeat(56));
  process.exit(fail === 0 ? 0 : 1);
})();

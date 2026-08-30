/*
 * 连接契约层验证（2026-08-30 新增）
 * 覆盖：声明式契约求值 / 可验证性标注 / 硬约束 fail-closed /
 *       观测契约可区分性 / 不可逆动作拦截 / 端到端声明式规划
 * 跑法：node test-contract-layer.js
 */
'use strict';
const L = require('./lingnao.umd.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  [OK] ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  [FAIL] ' + name + (extra ? '  ' + extra : '')); }
}
const OBS = { sensors: { pos: { field: 'x', eps: 0.5 } } };

(async () => {
  // ── 1. 声明式前置条件求值 ────────────────────────────────
  console.log('\n[1] evalRequire 声明式前置条件');
  check('gte 满足', L.evalRequire({ battery: 80 }, { battery: { gte: 20 } }) === true);
  check('gte 不满足', L.evalRequire({ battery: 10 }, { battery: { gte: 20 } }) === false);
  check('lte 满足', L.evalRequire({ battery: 10 }, { battery: { lte: 20 } }) === true);
  check('区间 [20,90] 内', L.evalRequire({ battery: 50 }, { battery: { min: 20, max: 90 } }) === true);
  check('区间 [20,90] 外', L.evalRequire({ battery: 95 }, { battery: { min: 20, max: 90 } }) === false);
  check('eq 满足', L.evalRequire({ battery: 50 }, { battery: { eq: 50 } }) === true);
  check('离散值匹配', L.evalRequire({ location: 'A' }, { location: 'A' }) === true);
  check('离散值不匹配', L.evalRequire({ location: 'A' }, { location: 'B' }) === false);
  check('多条件合取满足', L.evalRequire({ battery: 50, location: 'A' }, { battery: { gte: 20 }, location: 'A' }) === true);
  check('多条件其一不满足', L.evalRequire({ battery: 50, location: 'B' }, { battery: { gte: 20 }, location: 'A' }) === false);
  check('字段缺失 → 不满足（非静默通过）', L.evalRequire({}, { battery: { gte: 20 } }) === false);

  // ── 2. 声明式效果 ────────────────────────────────────────
  console.log('\n[2] applyEffect 声明式效果');
  const e1 = L.applyEffect({ battery: 80, location: 'A' }, { set: { location: 'B' }, inc: { battery: -10 } });
  check('set 生效', e1.location === 'B', JSON.stringify(e1));
  check('inc 生效', e1.battery === 70);
  check('不修改入参（纯函数）', L.applyEffect({ x: 1 }, { inc: { x: 1 } }).x === 2);
  const src = { x: 1 }; L.applyEffect(src, { inc: { x: 100 } });
  check('原对象未被就地修改', src.x === 1);

  // ── 3. 可验证性标注 ──────────────────────────────────────
  console.log('\n[3] capVerifiable 能力可验证性');
  const capDecl = { id: 'move', pre: { require: { battery: { gte: 20 } } }, effect: { set: { location: 'B' } }, cost: 1 };
  const capOpaque = { id: 'move2', pre: (s) => s.battery >= 20, eff: (s) => { s.location = 'B'; }, cost: 1 };
  check('声明式 → 可验证', L.capVerifiable(capDecl) === true);
  check('黑盒函数式 → 不可验证', L.capVerifiable(capOpaque) === false);

  // ── 4. 硬约束 fail-closed（本次修复的安全 bug）────────────
  console.log('\n[4] checkHard fail-closed（谓词抛异常必须拒绝，绝不放行）');
  L.setWorld({ nodes: ['A', 'B'], edges: [{ from: 'A', to: 'B' }, { from: 'B', to: 'A' }] });
  L.attachBody({
    name: 'T-broken', state: { location: 'A' },
    hard: [{ desc: 'crash-predicate', predicate: () => { throw new Error('predicate crashed'); } }],
    capabilities: [{ id: 'go', pre: { require: { location: 'A' } }, effect: { set: { location: 'B' } }, cost: 1 }]
  });
  const hc = L.checkHard({ location: 'A' }, { cap: 'go', params: {} });
  check('谓词抛异常 → 拒绝执行', hc.ok === false, JSON.stringify(hc));

  L.attachBody({
    name: 'T-ok', state: { location: 'A' }, hard: [],
    capabilities: [{ id: 'go', pre: { require: { location: 'A' } }, effect: { set: { location: 'B' } }, cost: 1 }]
  });
  check('无硬约束 → 放行', L.checkHard({ location: 'A' }, { cap: 'go', params: {} }).ok === true);

  // ── 5. 观测契约可区分性 ──────────────────────────────────
  console.log('\n[5] distinguishable 区间可区分性');
  check('差距大于噪声 → 可区分', L.distinguishable({ x: 0 }, { x: 10 }, OBS) === true);
  check('差距在噪声内 → 不可区分', L.distinguishable({ x: 0 }, { x: 0.2 }, OBS) === false);
  check('恰好等于噪声边界 → 不可区分', L.distinguishable({ x: 0 }, { x: 1.0 }, OBS) === false);
  check('无观测契约 → 𝕌 不可判定', L.distinguishable({ x: 0 }, { x: 10 }, null) === null);
  const blind = L.observationBlindSpots([{ x: 0 }, { x: 0.2 }, { x: 10 }, { x: 10.1 }], OBS);
  check('盲区扫描找出 2 对不可区分', blind.length === 2, 'pairs=' + blind.length);

  // ── 6. 不可逆动作拦截 ────────────────────────────────────
  console.log('\n[6] 不可逆动作需显式授权');
  L.attachBody({
    name: 'ARM', state: { location: 'A' }, hard: [],
    capabilities: [{ id: 'pour', irreversible: true, pre: { require: { location: 'A' } }, effect: { set: { location: 'B' } }, cost: 1 }]
  });
  const okAdapter = async () => ({ ok: true, state: { location: 'B' } });
  const r1 = await L.doWork((s) => s.location === 'B', okAdapter, { maxReplans: 0 });
  check('未授权 → 拦截', r1.execution.halted === true && /IRREVERSIBLE/.test(r1.execution.haltReason || ''), r1.execution.haltReason);
  const r2 = await L.doWork((s) => s.location === 'B', okAdapter, { maxReplans: 0, allowIrreversible: true });
  check('显式授权 → 放行并达成', r2.execution.ok === true && r2.execution.goalSatisfied === true);

  // ── 7. 观测盲区拦截 ──────────────────────────────────────
  console.log('\n[7] 观测盲区：效果无法验证则拒绝下发');
  L.attachBody({
    name: 'BLIND', state: { x: 0 }, hard: [],
    observation: { sensors: { pos: { field: 'x', eps: 5 } } },
    capabilities: [{ id: 'nudge', pre: { require: { x: { gte: 0 } } }, effect: { inc: { x: 0.1 } }, cost: 1 }]
  });
  const r3 = await L.doWork((s) => s.x >= 1, async () => ({ ok: true, state: { x: 0.1 } }), { maxReplans: 0 });
  check('效果落在噪声内 → 拒绝下发', r3.execution.halted === true && /BLIND/.test(r3.execution.haltReason || ''), r3.execution.haltReason);

  // ── 8. 端到端：纯声明式契约 + A* ─────────────────────────
  console.log('\n[8] 端到端：全程声明式契约走通规划与执行');
  L.setWorld({ nodes: ['CHARGE', 'A', 'B', 'C'], edges: [
    { from: 'CHARGE', to: 'A' }, { from: 'A', to: 'CHARGE' },
    { from: 'A', to: 'B' }, { from: 'B', to: 'A' },
    { from: 'B', to: 'C' }, { from: 'C', to: 'B' }
  ] });
  const NODES = ['CHARGE', 'A', 'B', 'C'];
  const caps = [];
  NODES.forEach((n, i) => {
    if (i + 1 < NODES.length) {
      const to = NODES[i + 1];
      caps.push({ id: 'fwd_' + n + '_' + to, pre: { require: { location: n, battery: { gte: 20 } } },
        effect: { set: { location: to }, inc: { battery: -10 } }, cost: 1 });
    }
  });
  const attach = L.attachBody({ name: 'AGV-decl', state: { location: 'CHARGE', battery: 100 }, hard: [], capabilities: caps });
  check('契约体检：全部声明式', attach.contract.control.opaque === 0, JSON.stringify(attach.contract.control));
  const plan = L.planTask((s) => s.location === 'C', { maxLayer: 16 });
  check('A* 规划成功', plan.ok === true, plan.ok ? plan.plan.map((p) => p.cap).join(' > ') : plan.error);
  const truth = { location: 'CHARGE', battery: 100 };
  const bodyAdapter = async (cap) => {
    const m = /^fwd_(.+)_(.+)$/.exec(cap);
    if (!m || truth.location !== m[1]) return { ok: false, error: 'precondition-failed' };
    truth.location = m[2]; truth.battery -= 10;
    return { ok: true, state: { location: truth.location, battery: truth.battery } };
  };
  const r4 = await L.doWork((s) => s.location === 'C', bodyAdapter, { maxReplans: 2 });
  check('执行达成目标', r4.execution.ok === true && r4.execution.goalSatisfied === true, 'final=' + JSON.stringify(r4.execution.finalState));
  check('电量按声明式 effect 扣减', r4.execution.finalState.battery === 70, 'battery=' + r4.execution.finalState.battery);

  // ── 9. 电量不足触发声明式硬约束（MHS 静态阈值做不到的事）──
  console.log('\n[9] 声明式状态组合约束：电量不足则禁行');
  L.attachBody({ name: 'AGV-low', state: { location: 'CHARGE', battery: 10 }, hard: [], capabilities: caps });
  const plan2 = L.planTask((s) => s.location === 'C', { maxLayer: 16 });
  check('电量 10 < 20 → 无可行计划', plan2.ok === false, plan2.ok ? 'UNEXPECTED-PLAN' : plan2.error);

  console.log('\n' + '─'.repeat(56));
  console.log('  连接契约层：通过 ' + pass + ' / 失败 ' + fail);
  console.log('─'.repeat(56));
  process.exit(fail === 0 ? 0 : 1);
})();

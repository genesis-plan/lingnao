/*
 * 无头验证：真实身体接入桥端到端可跑
 * 起仿真服务端 → bridge 连接 → 大脑 attachBody(AGV) → doWork 走真 WS 身体
 * 覆盖：正常到达 / SAFE-STOP / 重规划护栏
 */
'use strict';
const L = require('../lingnao.umd.js');
const { start } = require('../lingnao-body-sim-server.js');
const { createBodyBridge } = require('../lingnao-body-bridge.js');

const CAPS_DEFAULT = [
  { id: 'step_CHARGE_A', pre: s => s.location === 'CHARGE', eff: s => { s.location = 'A'; }, cost: 1, ground: () => ({ target: 'A' }) },
  { id: 'step_A_CHARGE', pre: s => s.location === 'A', eff: s => { s.location = 'CHARGE'; }, cost: 1, ground: () => ({ target: 'CHARGE' }) },
  { id: 'step_A_B', pre: s => s.location === 'A', eff: s => { s.location = 'B'; }, cost: 1, ground: () => ({ target: 'B' }) },
  { id: 'step_B_A', pre: s => s.location === 'B', eff: s => { s.location = 'A'; }, cost: 1, ground: () => ({ target: 'A' }) },
  { id: 'step_B_C', pre: s => s.location === 'B', eff: s => { s.location = 'C'; }, cost: 1, ground: () => ({ target: 'C' }) },
  { id: 'step_C_B', pre: s => s.location === 'C', eff: s => { s.location = 'B'; }, cost: 1, ground: () => ({ target: 'B' }) },
  { id: 'step_C_D', pre: s => s.location === 'C', eff: s => { s.location = 'D'; }, cost: 1, ground: () => ({ target: 'D' }) },
  { id: 'step_D_C', pre: s => s.location === 'D', eff: s => { s.location = 'C'; }, cost: 1, ground: () => ({ target: 'C' }) }
];
const WORLD = { nodes: ['CHARGE', 'A', 'B', 'C', 'D'], edges: [
  { from: 'CHARGE', to: 'A' }, { from: 'A', to: 'CHARGE' }, { from: 'A', to: 'B' }, { from: 'B', to: 'A' },
  { from: 'B', to: 'C' }, { from: 'C', to: 'B' }, { from: 'C', to: 'D' }, { from: 'D', to: 'C' }
] };

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  ' + extra : '')); }
}

(async () => {
  const server = start(8799);
  await new Promise(r => setTimeout(r, 300));

  L.setWorld(WORLD);

  // ① 正常：真实身体把货物送到 C
  L.attachBody({ name: 'AGV-01', state: { location: 'CHARGE' }, hard: [], capabilities: CAPS_DEFAULT });
  const bridge = createBodyBridge('ws://localhost:8799', { timeout: 4000 });
  await bridge.connect();
  const goalFn = s => (s && s.location) === 'C';
  const plan = L.planTask(goalFn, { maxLayer: 32 });
  const dw = await L.doWork(goalFn, bridge.adapter, { maxReplans: 3, deviationTolerance: 1, goalFn });
  const ex = dw.execution;
  console.log('\n[1] 真实身体 · 正常送达 C');
  check('plan.ok', plan.ok, plan.plan.map(p => p.cap).join('>'));
  check('dw.ok (真实身体达成)', ex.ok, 'final=' + JSON.stringify(ex.finalState));
  check('goalSatisfied', ex.goalSatisfied === true);
  check('replans=0', ex.replans === 0);

  // ② SAFE-STOP：硬约束禁区 C，目标却要 C → 规划必含 step_BC(target=C) 被大脑拦停
  console.log('\n[2] 真实身体 · SAFE-STOP（禁区 C）');
  L.attachBody({ name: 'AGV-01', state: { location: 'CHARGE' }, hard: ['C'], capabilities: CAPS_DEFAULT });
  await bridge.send({ type: 'reset', state: { location: 'CHARGE' } });
  const plan2 = L.planTask(goalFn, { maxLayer: 32 });
  const dw2 = await L.doWork(goalFn, bridge.adapter, { maxReplans: 3, deviationTolerance: 1, goalFn });
  const ex2 = dw2.execution;
  check('plan.ok (仍可规划出含 target=C 的动作)', plan2.ok, plan2.plan.map(p => p.cap).join('>'));
  check('halted by SAFE-STOP', ex2.halted === true && String(ex2.haltReason).indexOf('SAFE-STOP') === 0, ex2.haltReason);

  // ③ 重规划护栏：让真实身体对 step_CHARGE_A 持续失败 → 无路可走 → max-replans-exceeded
  console.log('\n[3] 真实身体 · 重规划护栏（持续故障 step_CHARGE_A）');
  L.attachBody({ name: 'AGV-01', state: { location: 'CHARGE' }, hard: [], capabilities: CAPS_DEFAULT });
  await bridge.send({ type: 'reset', state: { location: 'CHARGE' } });
  await bridge.send({ type: 'fail', mode: 'next', cap: 'step_CHARGE_A' });
  const plan3 = L.planTask(goalFn, { maxLayer: 32 });
  const dw3 = await L.doWork(goalFn, bridge.adapter, { maxReplans: 3, deviationTolerance: 1, goalFn });
  const ex3 = dw3.execution;
  check('plan.ok', plan3.ok, plan3.plan.map(p => p.cap).join('>'));
  check('halted (max-replans-exceeded)', ex3.halted === true && String(ex3.haltReason).indexOf('max-replans') === 0, ex3.haltReason);
  check('replans=3 (护栏生效，未死循环)', ex3.replans === 3, 'replans=' + ex3.replans);

  bridge.disconnect();
  server.close();
  console.log('\n==== 真实桥验证 ' + pass + '/' + (pass + fail) + ' 通过 ====');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });

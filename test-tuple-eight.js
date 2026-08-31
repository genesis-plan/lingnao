#!/usr/bin/env node
// test-tuple-eight.js — 验证八元组 𝔹=(X,h,b,f,U,V,Inv,M) 已落地可运行（2026-08-31）
// 来源：docs/TUPLE-REEXAMINATION.md 不可约性推导中"4/8 缺位"的落地验收。
// 运行：node test-tuple-eight.js
const L = require('./lingnao.umd.js');
let pass = 0, fail = 0;
const ck = (name, cond, extra) => {
  if (cond) { pass++; console.log('✓ ' + name); }
  else { fail++; console.log('✗ ' + name + (extra ? '  ' + JSON.stringify(extra).slice(0, 200) : '')); }
};

const BT = L.BrainTuple;
ck('BrainTuple 已导出（UMD 可访问）', !!BT && typeof BT === 'object');

// 未声明观测契约时 h 诚实退化（attachBody 之前 BODY.observation 尚未设置）
const hDegenerate = BT.h({});
ck('h 观测通道：未声明观测契约时诚实退化（ok:false，不编造）', hDegenerate.ok === false, hDegenerate);

// 接一个带观测契约 + 不可逆能力的物理身体
const r = L.attachBody({
  name: 'oct-body',
  state: { x: 0, y: 0, battery: 100, temp: 20 },
  hard: ['ZONE_DANGER'],
  observation: { sensors: { odom: { field: 'x', eps: 0.1 }, batt: { field: 'battery', eps: 1 } } },
  capabilities: [
    { id: 'move', pre: { require: {} }, effect: { set: {} } },
    { id: 'shutdown', irreversible: true, pre: {}, effect: {} }
  ]
});
ck('attachBody 成功接入身体', r && r.ok === true, r);

// —— X 状态空间 ——
const X = BT.X();
ck('X 状态空间：返回 world ⊕ body 且基数合法', X.ok && Array.isArray(X.world) && Array.isArray(X.body) && X.cardinality >= 0, X);

// —— h 观测通道 h: X → O ——
const h = BT.h({ x: 3, y: 1, battery: 80, temp: 22 });
ck('h 观测通道：按传感器契约投影状态', h.ok && h.O && h.O.odom === 3 && h.O.batt === 80 && h.sensorCount === 2, h);

// —— f 动力学 f: X × U → X ——
const f1 = BT.f('CHARGE', 'C');
ck('f 动力学：世界图边可解析 / 未建模时诚实返回 𝕌', f1.ok && (f1.kind === 'graph-edge' || f1.kind === 'unknown'), f1);

// —— U 执行通道 U ⊆ actions（安全门过滤）——
const U0 = BT.U({});
ck('U 执行通道：默认不含不可逆动作 shutdown', U0.ok && U0.actions.indexOf('move') >= 0 && U0.actions.indexOf('shutdown') < 0, U0);
const U1 = BT.U({ allowIrreversible: true });
ck('U 执行通道：显式授权后含 shutdown', U1.ok && U1.actions.indexOf('shutdown') >= 0, U1);

// —— V 价值 V: X → [0,1]（值迭代固定点）——
const V = BT.V('C');
ck('V 价值：返回到达价值表且 startValue ∈ [0,1]', V.ok && V.V && typeof V.V === 'object' && V.startValue >= 0 && V.startValue <= 1, V && (V.startValue));

// —— Inv 不变量 ——
const Inv = BT.Inv();
ck('Inv 不变量：含硬约束禁集', Inv.ok && Inv.hardConstraints >= 1, Inv);

// —— M 他心：信念级建模 + 诚实边界 ——
const m1 = BT.M.registerAgent('robot2', { intent: 'patrol' });
ck('M 他心：注册 agent', m1.ok && m1.count >= 1, m1);
BT.M.observeAgent('robot2', { x: 5 });
const mb = BT.M.beliefAbout('robot2');
ck('M 他心：信念可读 + 诚实标注 BELIEF-LEVEL', mb.ok && typeof mb.honesty === 'string' && mb.honesty.indexOf('BELIEF-LEVEL') >= 0, mb);
const db = BT.M.deceptionBound('robot2', { x: 5 }, { x: 5.05 });
ck('M 他心：可被伪装性可评估（观测不可分时 deceptionPossible=true）', db.ok && typeof db.deceptionPossible === 'boolean' && db.deceptionPossible === true, db);
const db2 = BT.M.deceptionBound('robot2', { x: 5 }, { x: 50 });
ck('M 他心：观测可区分时 deceptionPossible=false', db2.ok && db2.deceptionPossible === false, db2);

// —— LCF：八元组定理链闭合 ——
const kv = L.kernelVerify();
ck('LCF 内核全链闭合（含八元组定理 AX_TUPLE_FORMAL / THM_*）', kv.ok === true, { theorems: kv.theorems, axioms: kv.axioms, conjectures: kv.conjectures });
const ta = L.theoremOf('tuple');
ck('八元组能力可追溯到定理支撑', ta.ok === true, ta.verdict);

console.log('\n八元组落地验收：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail === 0 ? 0 : 1);

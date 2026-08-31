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

// —— B 信念态（第九元扩展）：部分可观测下维持 Δ(X) 分布 ——
const b0 = BT.B([{ key: 's1', weight: 2 }, { key: 's2', weight: 1 }]);
ck('B 信念态：初始化 Δ(X) 加权分布且归一', b0.ok && b0.belief && Math.abs(b0.belief.s1 + b0.belief.s2 - 1) < 1e-6, b0);
const b1 = BT.B();
ck('B 信念态：熵可算且诚实标注 BELIEF-LEVEL（conjecture 级，不进证明链）', b1.ok && typeof b1.entropy === 'number' && b1.honesty.indexOf('BELIEF-LEVEL') >= 0, b1);
const bUpd = BT.B_update({ belief: 0.5, fact: 0.8 });
ck('B 信念态：B_update 刷新后验不抛', bUpd.ok === true, bUpd);

// —— f 学习的 f + 诚实分层（A 项）——
const setL = BT.setLearnedDynamics({ method: 'linear-SEM-lite', error: null, nextVars: ['x'], eqs: { x: { bias: 0, coef: [1], features: ['x'] } } });
ck('f 学习的 f：可注入 learned 模型', setL.ok === true, setL);
const fL = BT.f({ x: 1 }, { x: 1 });
ck('f 学习的 f：返回 kind:"learned" 且 grounding=PERCEPTION（mayHallucinate，不进证明链）', fL.kind === 'learned' && fL.grounding && fL.grounding.tier === 'UNVERIFIED_LLM' && fL.usableInProof === false, fL);
BT._learned = null; // 复位，避免影响其余测试
const fU = BT.f('NOWHERE', 'NOSTEP');
ck('f 动力学：无模型时诚实返回 𝕌（不编造）', fU.kind === 'unknown', fU);

// —— D 自主等级 + 人机协同（分级闸门，默认不启用，保留 IRREVERSIBLE-HALT）——
const au = L.AUTONOMY;
ck('D 自主等级：AUTONOMY 配置导出且含 6 级（L0–L5）', au && au.levels && Object.keys(au.levels).length === 6 && typeof au.riskTierOf === 'function', au && au.levels);

// —— P0 不确定性端到端传播（f 候选 → B 包络 → V 稳健可达 → 守恒律）——
const fc = BT.f.candidates('CHARGE', 'C');
ck('P0 f.candidates：返回候选集且含 nondeterministic 标志', fc.ok && Array.isArray(fc.items) && typeof fc.nondeterministic === 'boolean', fc);
const be = BT.B_envelope();
const beOk = be.ok && be.envelope && Object.keys(be.envelope).every(k => be.envelope[k].belief <= be.envelope[k].plausibility + 1e-9);
ck('P0 B_envelope：膨胀为 D-S 包络且 belief≤plausibility', beOk, be && be.envelope);
BT.B_update({ belief: 0.5, fact: 0.8 });
const be2 = BT.B_envelope();
ck('P0 B_envelope：观测后 evidence>0 且置信度∈[0,1]', be2.ok && be2.evidence >= 1 && be2.confidence >= 0 && be2.confidence <= 1, be2);
const vr = BT.V_robust('C');
ck('P0 V_robust：返回 [low,high] 包络且分类∈{robust,risky,unreachable}', vr.ok && vr.envelope && ['robust','risky','unreachable'].indexOf(vr.classification) >= 0, vr && (vr.classification));
const lrOk = vr.ok && Object.keys(vr.envelope).every(k => vr.envelope[k].low <= vr.envelope[k].high + 1e-9);
ck('P0 V_robust：每态 V_low≤V_high', lrOk, vr && vr.envelope);
// 守恒律/Noether：旋转流守恒线性量 → SAFE；加阻尼 → 非 SAFE
const ccSafe = L.conservationCheck((x) => [x[1], -x[0], 0], (x) => x[2], [1, 0, 5], 0.01, 200);
ck('P0 守恒律：旋转流守恒线性量 ⇒ SAFE', ccSafe.ok && ccSafe.verdict === 'SAFE', ccSafe);
const ccDiss = L.conservationCheck((x) => [x[1], -x[0] - 0.3 * x[1], 0], (x) => x[0] * x[0] + x[1] * x[1], [1, 0, 0], 0.01, 200);
ck('P0 守恒律：含阻尼流能量不守恒 ⇒ 非 SAFE', ccDiss.ok && ccDiss.verdict !== 'SAFE', ccDiss);
const pi = BT.physicsInvariant({ flow: (x) => [x[1], -x[0], 0], energy: (x) => x[2], x0: [1, 0, 5] });
ck('P0 physicsInvariant：接守恒律检查且返回 verdict', pi.ok && typeof pi.verdict === 'string', pi);

// —— P2 他心嵌套信念 KD45（心智理论模态逻辑：我信 j 信 k 信 p）——
const nb = BT.M.assertNested('SELF', ['j', 'k'], 'p');
ck('P2 嵌套信念：存 B_SELF(B_j(B_k(p))) 且标 BELIEF-LEVEL', nb.ok && /B_SELF\(B_j\(B_k\(p\)\)\)/.test(nb.formula) && nb.grounding === 'BELIEF-LEVEL', nb);
const nbq = BT.M.nestedBelief('SELF', ['j', 'k'], 'p');
ck('P2 嵌套信念：查询已知嵌套信念返回 belief=true', nbq.ok && nbq.known === true && nbq.belief === true, nbq);
const nbUnk = BT.M.nestedBelief('SELF', ['j', 'k'], 'q');
ck('P2 嵌套信念：未存命题诚实返回 UNKNOWN（不编造他心信念）', nbUnk.ok && nbUnk.known === false && nbUnk.belief === null, nbUnk);
BT.M.assertNested('SELF', ['j'], 'contra', {});
BT.M.assertNested('SELF', ['j'], 'contra', { negated: true });
const kd = BT.M.checkKd45('SELF');
ck('P2 KD45：checkKd45 机验 D 一致性并捕获 p 与 ¬p 矛盾', kd.ok && kd.dCheck === 'FAIL' && kd.violations.length >= 1, kd);

// —— LCF：八元组定理链闭合 ——
const kv = L.kernelVerify();
ck('LCF 内核全链闭合（含八元组定理 AX_TUPLE_FORMAL / THM_*）', kv.ok === true, { theorems: kv.theorems, axioms: kv.axioms, conjectures: kv.conjectures });
const ta = L.theoremOf('tuple');
ck('八元组能力可追溯到定理支撑', ta.ok === true, ta.verdict);

// —— G1 多智能体对抗 minimax 层 ——
const adv = BT.adversarialValue('C', { horizon: 2 });
ck('G1 adversarialValue：复用 V_robust 终值给出对手最坏情形到达度', adv.ok && adv.value >= 0 && adv.value <= 1 && ['robust','risky','unreachable'].includes(adv.classification), adv);
const adv2 = BT.adversarialValue('C', { horizon: 1 });
ck('G1 adversarialValue：视野=1 仍返回合法分类', adv2.ok && typeof adv2.classification === 'string', adv2);

// —— 备用数学思想：应对真实世界不可预测的工具箱 ——
// f-散度族（KL/TV/JS/Hellinger）
const kl = L.fDivergence([0.5,0.5],[0.5,0.5],'KL');
ck('备用 fDivergence KL：相同分布 ⇒ 0', kl.ok && kl.value === 0, kl);
const tv = L.fDivergence([1,0],[0,1],'TV');
ck('备用 fDivergence TV：互斥分布 ⇒ 1', tv.ok && Math.abs(tv.value - 1) < 1e-9, tv);
const js = L.fDivergence([0.5,0.5],[0.9,0.1],'JS');
ck('备用 fDivergence JS：不同分布 ⇒ >0', js.ok && js.value > 0, js);

// 粗糙集上下近似（部分信息）
const rs = L.roughSetApprox([['a','b'],['c'],['d','e']], ['a','c']);
ck('备用 roughSet：部分覆盖触发边界（下近似仅 c / 上近似含 a,b / certainty≈1/3）', rs.ok && rs.lower.length === 1 && rs.upper.length === 2 && rs.boundary.length === 1 && Math.abs(rs.certainty - 1/3) < 1e-3, rs);

// 可计算性/不可判定登记（诚实 UNKNOWN）
const decHalt = L.decidabilityCheck('halting');
ck('备用 decidability：停机问题不可判定 ⇒ 须诚实 UNKNOWN', decHalt.ok && decHalt.decidable === false && /UNKNOWN/.test(decHalt.directive), decHalt);
const decUnk = L.decidabilityCheck('some-unregistered-class');
ck('备用 decidability：未登记类也诚实 UNKNOWN（不猜）', decUnk.ok === false && decUnk.U === true, decUnk);

// Lyapunov 最大指数（混沌/敏感）
const lyap = L.lyapunovExponent((x) => [-0.5 * x[0], -0.5 * x[1]], [1, 1], 0.01, 300);
ck('备用 lyapunovExponent：收缩流 λ<0 ⇒ CONTRACTIVE 可信', lyap.ok && lyap.lambda < 0 && lyap.sensitive === false, lyap);
const lyapC = L.lyapunovExponent((x) => [x[0] * 0.1, x[1] * 2.0], [1, 1], 0.005, 300);
ck('备用 lyapunovExponent：扩张流 λ>0 ⇒ CHAOTIC 敏感', lyapC.ok && lyapC.lambda > 0 && lyapC.sensitive === true, lyapC);

// —— 能力证明链：新增备用数学能力可追溯 ——
const taAdv = L.theoremOf('adversarial');
ck('G1 对抗能力可追溯到 THM_MINIMAX_ADVERSARIAL', taAdv.ok === true, taAdv.verdict);
const taMeta = L.theoremOf('metareason');
ck('元推理能力可追溯到 THM_DECIDABILITY_AWARE', taMeta.ok === true, taMeta.verdict);

console.log('\n八元组落地验收：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail === 0 ? 0 : 1);

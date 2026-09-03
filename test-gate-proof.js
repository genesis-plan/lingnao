// M1 能力/意图门控证明（Gate Chain Proof）验证
// 加载真内核 灵脑.html（截断 UI 段，无需 DOM）。本测试不依赖灵数桥（M1 是静态门控，与数值无关）。
//
// 核心是两组【机器检验】，不是断言口号：
//   (a) 定理 M1.1 一致性：proveGateChain 预测的 releasedPredicted === execute() 实际释放的指令数
//       （在 opts.gateProof:false 关闭前置守卫时比对，即校验预检器与执行器同构）。
//   (b) 零释放：默认开启前置守卫后，同一计划 execute() 释放指令数恒为 0。
//       这直接堵掉「授权步先执行、事后才停、不回滚」（部署陷阱⑦）。
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '灵脑.html'), 'utf8');
let body = html.match(/<script>([\s\S]*)<\/script>/)[1];
const cut = body.indexOf('// ===================== UI 编排');
if (cut >= 0) body = body.slice(0, cut);
fs.writeFileSync(path.join(__dirname, '_kernel_load.js'), body);

globalThis.__LINGNAO_AUDIT_SECRET = 'gate-proof-test-secret';
require('./_kernel_load.js');
const WB = globalThis.__WB;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + msg); }
}

console.log('=== test-gate-proof ===');
if (!WB || !WB.proveGateChain || !WB.execute || !WB.attachBody) {
  console.log('KERNEL_NOT_LOADED 或 proveGateChain/execute/attachBody 未导出'); process.exit(1);
}

// ── 身体：三类能力覆盖 G3(不可逆) / G4(风险等级) / 正常放行 ──────────────
WB.attachBody({
  name: 'gate-proof-test-body',
  state: { x: 0 },
  capabilities: [
    { id: 'move',       riskTier: 1, irreversible: false, pre: null, effect: { x: 1 } },
    { id: 'weld',       riskTier: 3, irreversible: false, pre: null, effect: { x: 2 } },
    { id: 'paint',      riskTier: 4, irreversible: false, pre: null, effect: { x: 3 } },
    { id: 'send_email', riskTier: 4, irreversible: true,  pre: null, effect: { x: 4 } }
  ]
});

// ── 1. 门控规格表结构 ────────────────────────────────────────────────
ok(Array.isArray(WB.GATE_SPEC) && WB.GATE_SPEC.length === 8, 'G1 GATE_SPEC 共 8 条守卫谓词');
const statics = (WB.GATE_SPEC || []).filter(g => g.static === true).map(g => g.id);
ok(statics.length === 4, 'G2 其中 4 条为静态可判定：' + statics.join(', '));
ok((WB.GATE_SPEC || []).filter(g => !g.static).length === 4, 'G3 另 4 条诚实标 runtime-dependent（G5..G8）');

// ── 2. 静态裁决（纯函数，零副作用）────────────────────────────────────
const e0 = WB.proveGateChain([], {});
ok(e0.verdict === 'provably-blocked:zero-release', 'S1 空计划 → zero-release，实得 ' + e0.verdict);
ok(e0.proof === 'M1.2', 'S2 空计划依据定理 M1.2');

const b0 = WB.proveGateChain([{ cap: 'nope' }], {});
ok(b0.verdict === 'provably-blocked:zero-release' && b0.proof === 'M1.2',
  'S3 未注册能力在 step_0 → zero-release(M1.2)，实得 ' + b0.verdict);
ok(b0.blockingGate === 'G1.registered', 'S4 blockingGate=G1.registered，实得 ' + b0.blockingGate);
ok(b0.releasedPredicted === 0, 'S5 预测释放 0 条指令');

// G1 已被 execute() 的前置守卫覆盖 ⇒ 哪怕命中在 step_1 也是零释放（测试 E1 实测校准）
const b1 = WB.proveGateChain([{ cap: 'move' }, { cap: 'nope' }], {});
ok(b1.verdict === 'provably-blocked:zero-release' && b1.proof === 'M1.2',
  'S6 未注册能力在 step_1 → 仍判 zero-release(M1.2)（G1 已被前置守卫覆盖），实得 ' + b1.verdict);
ok(b1.releasedPredicted === 0, 'S7 预测释放 0 条，与真实执行器一致（实测校准）');
// M1.1 真实适用对象是 G3/G4（仍在循环内逐条判定）
const b1b = WB.proveGateChain([{ cap: 'move' }, { cap: 'send_email' }], {});
ok(b1b.verdict === 'provably-blocked:after-1' && b1b.proof === 'M1.1',
  'S7b 不可逆步在 step_1 → after-1(M1.1)，实得 ' + b1b.verdict);
ok(b1b.releasedPredicted === 1, 'S7c 预测释放 1 条（这正是「先执行再拦」的副作用数）');

const b2 = WB.proveGateChain([{ cap: 'send_email' }], {});
ok(b2.blockingGate === 'G3.irreversible', 'S8 不可逆且未授权 → G3 拦截，实得 ' + b2.blockingGate);
ok(b2.releasedPredicted === 0, 'S9 不可逆在 step_0 → 预测零释放');

const b3 = WB.proveGateChain([{ cap: 'paint' }], {});
ok(b3.blockingGate === 'G4.autonomy', 'S10 riskTier4 > 默认自主等级3 → G4 拦截，实得 ' + b3.blockingGate);
const b3b = WB.proveGateChain([{ cap: 'paint' }], { humanApproved: true });
ok(b3b.verdict === 'conditional', 'S11 humanApproved:true → 静态放行（conditional），实得 ' + b3b.verdict);
const b3c = WB.proveGateChain([{ cap: 'paint' }], { autonomyLevel: 'full' });
ok(b3c.verdict === 'conditional', 'S12 autonomyLevel:full 显式开闸 → conditional（不再 NaN 静默关闸）');

const c1 = WB.proveGateChain([{ cap: 'move' }, { cap: 'weld' }], {});
ok(c1.verdict === 'conditional' && c1.proof === 'M1.3',
  'S13 静态全通过 → conditional 而【非】provably-admitted（M1.3 诚实边界），实得 ' + c1.verdict);
ok(c1.gates[0].row.filter(g => g.decidability === 'runtime-dependent').length === 4,
  'S14 每步 4 条 runtime-dependent 守卫被诚实标注为 evaluated:false');

// ── 3. 意图绑定 G0（对应文档 T1 意图-行为不可分）────────────────────────
const i1 = WB.proveGateChain([{ cap: 'move' }], { requireIntent: true, intent: { id: 'I-1' } });
ok(i1.blockingGate === 'G0.intentBound', 'S15 未绑意图 → G0 拦截，实得 ' + i1.blockingGate);
const i2 = WB.proveGateChain([{ cap: 'move', intentId: 'I-2' }], { requireIntent: true, intent: { id: 'I-1' } });
ok(i2.blockingGate === 'G0.intentBound', 'S16 意图 ID 不一致 → G0 拦截');
const i3 = WB.proveGateChain([{ cap: 'move', intentId: 'I-1' }], { requireIntent: true, intent: { id: 'I-1' } });
ok(i3.verdict === 'conditional' && i3.intentBound === true,
  'S17 意图一致 → 放行且 intentBound=true，实得 ' + i3.verdict);

// ── 4. 端到端机器检验：预检预测 vs 实际释放（定理 M1.1）───────────────
let released = 0;
const adapter = (cap, params) => { released++; return Promise.resolve({ ok: true, state: {} }); };

(async function () {
  // (a-1) 关闭前置守卫 → 实际释放数应等于预检预测（校验预检器与执行器同构）
  const planA = [{ cap: 'move' }, { cap: 'send_email' }];
  const predA = WB.proveGateChain(planA, {});
  released = 0;
  const runA = await WB.execute(planA, adapter, { gateProof: false });
  ok(predA.releasedPredicted === released,
    'E1 定理M1.1 一致性：预测 ' + predA.releasedPredicted + ' 条 === 实际 ' + released + ' 条');
  ok(runA.halted === true && String(runA.haltReason).indexOf('IRREVERSIBLE-HALT') === 0,
    'E2 关闭前置时确实先执行了 1 步才停（复现部署陷阱⑦），haltReason=' + runA.haltReason);
  // G1 对照：未注册能力即便在 step_1，因前置守卫覆盖仍为 0 条
  const predA2 = WB.proveGateChain([{ cap: 'move' }, { cap: 'nope' }], {});
  released = 0;
  await WB.execute([{ cap: 'move' }, { cap: 'nope' }], adapter, { gateProof: false });
  ok(predA2.releasedPredicted === 0 && released === 0,
    'E2b G1 零释放一致性：预测 0 === 实际 ' + released + '（前置守卫覆盖，非循环内拦）');

  // (a-2) 未注册在 step_0：预测 0，实际 0
  const planB = [{ cap: 'nope' }];
  const predB = WB.proveGateChain(planB, {});
  released = 0;
  await WB.execute(planB, adapter, { gateProof: false });
  ok(predB.releasedPredicted === released,
    'E3 定理M1.2：预测 0 === 实际 ' + released + '（零释放不可绕过）');

  // (b) 默认开启前置守卫 → 同一计划释放数恒为 0（陷阱⑦被堵）
  released = 0;
  const runC = await WB.execute(planA, adapter, {});
  ok(released === 0, 'E4 前置守卫默认开：同一计划释放 ' + released + ' 条（原为 1 条）— 零副作用停机');
  ok(String(runC.haltReason).indexOf('GATE-PROOF-PREEMPT') === 0,
    'E5 haltReason 前缀 GATE-PROOF-PREEMPT 并保留原原因，实得 ' + runC.haltReason);
  ok(runC.steps === 0 && runC.trace.length === 0, 'E6 steps=0 且 trace 为空（确无任何执行痕迹）');
  ok(runC.gateProof && runC.gateProof.blockingGate === 'G3.irreversible' &&
     runC.gateProof.releasedPredicted === 1 && runC.gateProof.proof === 'M1.1',
    'E7 返回值附完整门控证明（G3/M1.1/预测1条），实得 ' + (runC.gateProof && runC.gateProof.blockingGate));

  // (b-2) 不可逆动作默认零释放（原本 blockIndex=0 也是 0，但高风险组合需验证）
  const planD = [{ cap: 'move' }, { cap: 'send_email' }];
  const predD = WB.proveGateChain(planD, {});
  ok(predD.blockIndex === 1 && predD.releasedPredicted === 1,
    'E8 [move, send_email] 预测在 step_1 拦（先执行 move）');
  released = 0;
  const runD = await WB.execute(planD, adapter, {});
  ok(released === 0, 'E9 前置守卫：不可逆步的计划整体零释放（move 也不再先跑）');
  // 关闭前置时应重现 1 条释放，证明 E9 的差异真实存在而非测试假象
  released = 0;
  await WB.execute(planD, adapter, { gateProof: false });
  ok(released === 1, 'E10 对照：关闭前置守卫则释放 ' + released + ' 条（差异实据，非假象）');

  // (c) conditional 计划照常执行（不误拦）
  released = 0;
  const runE = await WB.execute([{ cap: 'move' }, { cap: 'weld' }], adapter, {});
  ok(released === 2 && runE.ok === true, 'E11 静态全通过的计划照常执行 ' + released + ' 步，ok=true');
  ok(runE.gateProof && runE.gateProof.verdict === 'conditional', 'E12 执行结果附 conditional 门控证明');

  // (d) 感知步骤仍按原行为抛错（行为不变，铁律③）
  let threw = null;
  released = 0;
  try { await WB.execute([{ cap: 'move', mayHallucinate: true }], adapter, {}); }
  catch (err) { threw = String(err && err.message); }
  ok(threw && threw.indexOf('FIREWALL_VIOLATION') === 0,
    'E13 感知步骤 → 仍抛 FIREWALL_VIOLATION（行为不变），实得 ' + threw);
  ok(released === 0, 'E14 感知步骤零释放');
  const predF = WB.proveGateChain([{ cap: 'move', mayHallucinate: true }], {});
  ok(predF.blockingGate === 'G2.notPerception' && predF.blockingMode === 'throw',
    'E15 G2 标为 throw 模式（与 execute 实际抛错行为一致）');

  // ── 5. 审计入链 + 账本完整性 ────────────────────────────────────────
  const audit = (WB.MathKernel && WB.MathKernel.auditLedger) ? WB.MathKernel.auditLedger : null;
  ok(!!audit, 'A1 审计账本已挂载');
  if (audit && typeof audit.verify === 'function') {
    ok(audit.verify().ok === true, 'A2 门控证明事件入链后账本完整性校验通过');
  }
  ok(typeof WB.proveGateChain === 'function' && WB.proveGateChain.length >= 1, 'A3 proveGateChain 可导出复用');

  console.log('\n通过 ' + pass + ' / 失败 ' + fail);
  process.exit(fail === 0 ? 0 : 1);
})();

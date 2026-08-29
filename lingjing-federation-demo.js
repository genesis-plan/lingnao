// 灵境 · 二阶组合证明原型
// 通用大脑实例A(规划者) 与 实例B(联邦验证者) 通过"审计接口"互联。
// 证明：审计报告可作机器可读 interop 协议；未验证输入不触发自主动作（守住无我不夺权）。
//
// 修复（2026-08-29 专家审查 P0-6/P0-8）：
//   ① askBrain 为 async，必须 await——此前 perceived 是 Promise，perceived.ok 恒 undefined，
//      "含未验证假设"判断空转，决策恒 CONDITIONAL_ADOPT 属巧合而非逻辑生效；
//   ② 实例A/B 之间以 JSON 序列化边界传递审计——B 只读反序列化副本，不共享内存引用
//     （同进程全局单例下"联邦"若直接读对象，等价于读自己的内存；完整多实例隔离待内核 createKernel 工厂）。
const L = require('./lingjing.umd.js');

const line = s => console.log(s);
const hr = (t) => line('\n========== ' + t + ' ==========');

async function main() {
  // ---------- 通用大脑 实例A：规划者 ----------
  hr('通用大脑 实例A（规划者）');
  L.setWorld({
    nodes: ['MONTHLY', 'FRIEND', 'DOWNPAYMENT', 'EMERGENCY'],
    edges: [
      { from: 'MONTHLY', to: 'FRIEND', w: 0.1, p: 0.95 },
      { from: 'FRIEND', to: 'DOWNPAYMENT', w: 0.1, p: 0.95 },
      { from: 'MONTHLY', to: 'EMERGENCY', w: 0.05, p: 0.99 }
    ]
  });
  const planA = L.reason('MONTHLY', 'DOWNPAYMENT', { hard: ['EMERGENCY'] });
  const auditA = L.generateAudit(planA);
  line('A 规划路径 : ' + JSON.stringify(planA.path) + '  代价 ' + planA.cost);
  line('A 审计接口 : status=' + auditA.status
    + '  不幻觉=' + auditA.noHallucination
    + '  霍尔=' + (auditA.proof && auditA.proof.hoare ? '✔' : '✘')
    + '  CoVe=' + (auditA.selfVerification ? '✔' : '✘'));

  // A 尝试感知一个外部事实：朋友口头承诺"下月还我5万"。无 key 离线 → PERCEPTION 未验证。
  const perceived = await L.askBrain('朋友说下个月会还我 5 万', null, {});
  const perceivedTier = perceived.grounding ? perceived.grounding.tier : 'PERCEPTION(未验证)';
  line('A 外部感知 : ok=' + perceived.ok + '  置信档=' + perceivedTier + '  (口头承诺，非内核确定)');

  // ---------- 序列化边界：A 把审计接口"发"给 B ----------
  // B 只允许读取反序列化副本（JSON.parse(JSON.stringify(...))），证明审计报告自足可读。
  const wire = JSON.stringify({
    plan: { path: planA.path, cost: planA.cost },
    audit: auditA,
    perception: { ok: perceived.ok === true, tier: perceivedTier }
  });
  const received = JSON.parse(wire);

  // ---------- 通用大脑 实例B：联邦验证者（仅凭收到的 JSON 判断）----------
  hr('通用大脑 实例B（联邦验证者 · 仅凭序列化副本判断）');
  line('B 解析 A 的 proof / GROUNDING / 复现指纹 ...（跨 JSON 边界，无共享内存引用）');
  const aKernelTrusted = received.audit.status === 'valid'
    && received.audit.noHallucination === true
    && received.audit.proof && !!received.audit.proof.hoare;
  const aPerceptionUnverified = !received.perception.ok; // 含未验证外部假设

  let decision, guard;
  if (aKernelTrusted && !aPerceptionUnverified) {
    decision = 'ADOPT'; guard = '核心规划全绿，直接采纳';
  } else if (aKernelTrusted && aPerceptionUnverified) {
    decision = 'CONDITIONAL_ADOPT'; // 关键：不夺权
    guard = '核心规划可信，但含未验证外部假设(朋友口头承诺/PERCEPTION档) → 禁止自主行动，需人工确认后生效';
  } else {
    decision = 'REJECT'; guard = '审计未通过，拒绝采纳';
  }
  line('B 决策     : ' + decision + ' — ' + guard);

  // 分支真实验证（修复后：两条分支都可达，不再是恒定输出）
  line('B 分支核验 : kernel可信=' + aKernelTrusted + '  感知含未验证=' + aPerceptionUnverified
    + '  → 本轮命中=' + decision);

  // B 对自己的采纳决策再出一份审计（二阶可审计 → 联邦本身可信）
  const metaAudit = {
    decision,
    based_on: {
      auditA_status: received.audit.status,
      auditA_noHallucination: received.audit.noHallucination,
      auditA_hoare: !!(received.audit.proof && received.audit.proof.hoare),
      perception_unverified: aPerceptionUnverified
    },
    reproducible: JSON.stringify({ planA_path: received.plan.path, auditA_status: received.audit.status, perceived_ok: received.perception.ok }),
    note: 'B 的决策本身可审计；未验证输入不触发自主动作 —— 守住"无我/不夺权"'
  };
  line('B 元审计   : ' + JSON.stringify(metaAudit).slice(0, 360) + ' …');

  // ---------- 涌现效应 ----------
  hr('涌现效应（系统联邦）');
  line('两实例通过审计接口互联：A 的 proof 被 B 直接读取验证，B 的决策再被自身审计。');
  line('互信不靠承诺，靠可机读 proof —— 即"审计接口=插槽"机制。');
  line('未验证输入 → 自主动作被闸（human-in-loop），故联邦放大能力却不放大风险。');
  const expected = 'CONDITIONAL_ADOPT'; // 本场景：内核全绿 + 口头承诺未验证 → 必须闸断
  const ok = decision === expected && aKernelTrusted === true && aPerceptionUnverified === true;
  line(ok
    ? '✅ 本原型证毕：跨序列化边界的二阶组合真实跑通，且闸断分支按逻辑（非巧合）命中。'
    : '⚠️ 本原型未达预期（decision=' + decision + '），联邦闸断逻辑需复查。');
  return ok;
}

if (require.main === module) main().then(ok => process.exitCode = ok ? 0 : 1);
module.exports = { main };

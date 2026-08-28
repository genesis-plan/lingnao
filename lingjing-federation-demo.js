// 灵境 · 二阶组合证明原型
// 通用大脑实例A(规划者) 与 实例B(联邦验证者) 通过"审计接口"互联。
// 证明：审计报告可作机器可读 interop 协议；未验证输入不触发自主动作（守住无我不夺权）。
const L = require('./lingjing.umd.js');

const line = s => console.log(s);
const hr = (t) => line('\n========== ' + t + ' ==========');

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
const perceived = L.askBrain('朋友说下个月会还我 5 万', null, {});
const perceivedTier = perceived.grounding ? perceived.grounding.tier : 'PERCEPTION(未验证)';
line('A 外部感知 : ok=' + perceived.ok + '  置信档=' + perceivedTier + '  (口头承诺，非内核确定)');

// ---------- 通用大脑 实例B：联邦验证者（读取 A 的审计接口）----------
hr('通用大脑 实例B（联邦验证者 · 读取 A 的审计接口）');
line('B 解析 A 的 proof / GROUNDING / 复现指纹 ...');
const aKernelTrusted = auditA.status === 'valid'
  && auditA.noHallucination === true
  && auditA.proof && auditA.proof.hoare;
const aPerceptionUnverified = !perceived.ok; // 含未验证外部假设

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

// B 对自己的采纳决策再出一份审计（二阶可审计 → 联邦本身可信）
const metaAudit = {
  decision,
  based_on: {
    auditA_status: auditA.status,
    auditA_noHallucination: auditA.noHallucination,
    auditA_hoare: !!(auditA.proof && auditA.proof.hoare),
    perception_unverified: aPerceptionUnverified
  },
  reproducible: JSON.stringify({ planA_path: planA.path, auditA_status: auditA.status, perceived_ok: perceived.ok }),
  note: 'B 的决策本身可审计；未验证输入不触发自主动作 —— 守住"无我/不夺权"'
};
line('B 元审计   : ' + JSON.stringify(metaAudit).slice(0, 360) + ' …');

// ---------- 涌现效应 ----------
hr('涌现效应（系统联邦）');
line('两实例通过审计接口互联：A 的 proof 被 B 直接读取验证，B 的决策再被自身审计。');
line('互信不靠承诺，靠可机读 proof —— 即"审计接口=插槽"机制。');
line('未验证输入 → 自主动作被闸（human-in-loop），故联邦放大能力却不放大风险。');
line(aKernelTrusted
  ? '✅ 本原型证毕：二阶组合可在现有内核上真实跑通。'
  : '⚠️ 本原型未达 ADOPT（审计未全绿）。');

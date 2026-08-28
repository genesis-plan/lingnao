// 灵境 LingJing v3.0 — 常用指令实测（真实内核签名）
const L = require('./lingjing.umd.js');
const line = (s = '') => console.log(s);
const hr = (t) => { line('\n' + '═'.repeat(64)); line('  ' + t); line('═'.repeat(64)); };
const g = (r) => (r && r.grounding ? r.grounding.tier : '（由 askBrain/audit 分层）');

const WORLD = {
  nodes: ['CHARGE', 'A', 'B', 'C', 'D'],
  edges: [
    { from: 'CHARGE', to: 'A', w: 1, p: 0.99 },
    { from: 'A', to: 'B', w: 2, p: 0.95 },
    { from: 'B', to: 'C', w: 3, p: 0.92 },
    { from: 'A', to: 'D', w: 4, p: 0.90 },
    { from: 'D', to: 'C', w: 1, p: 0.88 }
  ],
  coord: { CHARGE: [0, 0], A: [1, 0], B: [2, 0], C: [3, 0], D: [1, 1] }
};

// 指令 1：规划 CHARGE→C
hr('指令 1 · 规划：从充电座去 C 点');
L.setWorld(WORLD);
let r = L.reason('CHARGE', 'C');
line('  输入：reason(\'CHARGE\', \'C\')');
line('  路径：' + JSON.stringify(r.path) + '  代价：' + r.cost + '  状态：' + r.status);
line('  采用系统：' + (r.usedSystem || r.system) + '  落地档：' + g(r));

// 指令 2：硬约束禁 B → 必改道
hr('指令 2 · 硬约束：禁止经过 B');
r = L.reason('CHARGE', 'C', { hard: ['B'] });
line('  输入：reason(\'CHARGE\', \'C\', {hard:["B"]})');
line('  改道路径：' + JSON.stringify(r.path) + '  代价：' + r.cost);
line('  仍避开 B：' + (!r.path.includes('B') ? '是 ✔' : '否 ✘') + '  落地档：' + g(r));

// 指令 3：前门准则因果
hr('指令 3 · 因果：X 经中介 M 影响 Y（前门准则，含未观测混杂）');
const ce = L.causalEffect(
  { eqs: {} }, 'X', 'Y',
  [
    { state: { X: 1, M: 0.5 }, next: { Y: 0.9 } },
    { state: { X: 0, M: 0.2 }, next: { Y: 0.4 } },
    { state: { X: 1, M: 0.6 }, next: { Y: 1.0 } },
    { state: { X: 0, M: 0.1 }, next: { Y: 0.3 } }
  ],
  { mediator: 'M' }
);
line('  输入：causalEffect(model,"X","Y",samples,{mediator:"M"})');
line('  识别方法：' + ce.method + '  ACE=' + ce.ace + '  落地档：' + ce.grounding.tier);

// 指令 4：七段审计
hr('指令 4 · 审计：导出规划证据链');
const audit = L.generateAudit(r);
line('  status=' + audit.status + '  proof.hoare=' + (audit.proof && audit.proof.hoare ? '存在 ✔' : '—'));
line('  selfVerification(CoVe)=' + (audit.selfVerification ? '含 ✔' : '—') + '  reflection(Reflexion)=' + (audit.reflection ? '含 ✔' : '—'));
line('  reproducible=' + JSON.stringify(audit.reproducible));

// 指令 5：不幻觉 — 离线无 key 诚实降级
hr('指令 5 · 不幻觉边界：离线无 Key 让 LLM 理解自然语言');
(async () => {
  const ab = await L.askBrain('从充电座去 C 点');
  line('  输入：askBrain("从充电座去 C 点")  [未配 OpenRouter Key]');
  line('  返回 ok=' + ab.ok + '  stage=' + ab.stage);
  line('  行为：' + (ab.ok ? '已感知' : '诚实拒绝伪造 ✔ —— 不幻觉，宁可说"不知道"也不编'));
  line('  落地档：' + (ab.grounding ? ab.grounding.tier : 'PERCEPTION(UNVERIFIED_LLM，未验证)'));

  hr('指令 6 · 不幻觉三档对照');
  line('  PERCEPTION 档：LLM 自然语言理解 → 可能幻觉，绝不进证明链');
  line('  KERNEL    档：A* 规划 / 因果 ACE / 审计 → 确定性、可复现');
  line('  PROOF     档：霍尔机器验证的规划路径 → 可形式化验证、可审计');
  line('\n  一句话：灵境对每条结论显式标「落在哪一档、证据在哪、能否复现」');
  line('          别的 LLM 只说"我可能错"，灵境说"错在哪一层"。');
  line('\n═══ 常用指令实测完毕 · 单一真源 genesis-plan/lingjing ═══');
})();

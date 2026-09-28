// rpa-finance.js — 场景 B3：税务 / payroll / 法定报表自动计算的校验层
// RPA 算完数，交给灵数独立复算并认证；只有 certified 才自动落账，否则转人工复核。
// （算错 = 法律责任；认证+可审计留痕是合规证据。）
const { solve } = require('./lingshu-client');

// label：业务名（如 "增值税应缴额"）；equations：把「应缴额 = 基数 × 率」写成方程数组
async function validateComputation(label, equations) {
  const r = await solve(equations, { honorPaid: true });
  if (r.isError) return { label, trusted: false, reason: '求解失败', detail: r.data };
  const d = r.data;
  return {
    label,
    trusted: d.certified === true,                 // 只有认证通过才可信
    answer: d.recommended ? d.recommended.values : null,
    provenCount: (d.diagnostics || {}).provenCount,
    action: d.certified ? 'AUTO_POST' : 'MANUAL_REVIEW', // 未认证 → 转人工
    summary: d.summary,
  };
}

module.exports = { validateComputation };

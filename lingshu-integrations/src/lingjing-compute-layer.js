// lingjing-compute-layer.js — 场景 C1：灵境 / 灵脑的认证计算层
// 任何数值推理 import 本层，结果带证明 → 整个大脑「可审计、不幻觉」的卖点落地。
// 零商务成本、自托管可离线，是最稳的「让灵数发挥作用」路径。
const { solve } = require('./lingshu-client');

async function computeTrusted(problem) {
  const r = await solve(problem, { honorPaid: true });
  if (r.isError) {
    return { ok: false, certified: false, error: r.data };
  }
  const d = r.data;
  const first = d.solutions && d.solutions[0];
  return {
    ok: true,
    certified: d.certified,
    answer: d.recommended ? d.recommended.values : null,
    solutions: d.solutions,
    proof: {
      certified: d.certified,
      provenCount: (d.diagnostics || {}).provenCount,
      solverVersion: (d.diagnostics || {}).solverVersion,
      residual: first && first.internals ? first.internals.residual : null,
      certifiedRadius: first && first.internals ? first.internals.certifiedRadius : null,
      summary: d.summary,
    },
  };
}

module.exports = { computeTrusted };

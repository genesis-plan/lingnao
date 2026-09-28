// agent-offload.js — 场景 A1：LLM Agent 的数学 offload 层
// 任何跑数学的 Agent 把「最终数」offload 给灵数，避免 LLM 幻觉
// （ORCA Benchmark：LLM 日常数学 40% 错；业界共识 "never let LLM compute the final number"）。
const { solve } = require('./lingshu-client');

// 入参 problem：单表达式字符串，或方程数组（多方程务必每项独立，如 ['3x+5y=7','2x-y=1']）
// 返回 { ok, certified, answer, text, solutions, proof }
async function routeMathToLingshu(problem, opts = {}) {
  const r = await solve(problem, { honorPaid: true, ...opts });
  if (r.isError) return { ok: false, certified: false, error: r.data };
  const d = r.data;
  return {
    ok: true,
    certified: d.certified,
    answer: d.recommended ? d.recommended.values : null,
    text: d.summary,
    solutions: d.solutions,
    proof: certProof(d),
  };
}

// 给日志/下游用的精简认证凭证（可复现、不幻觉的证据）
function certProof(d) {
  const diag = d.diagnostics || {};
  return {
    certified: d.certified,
    provenCount: diag.provenCount,
    solverVersion: diag.solverVersion,
    summary: d.summary,
  };
}

module.exports = { routeMathToLingshu, certProof };

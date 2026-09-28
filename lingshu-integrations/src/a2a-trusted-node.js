// a2a-trusted-node.js — 场景 A2：多 Agent 协作（A2A）的可信计算节点
// 一个 agent 求出的数，附上灵数证书；下游 agent 用 verifyCertificate 校验后才采用，
// 避免「一个幻觉 agent 污染整条协作链」。
const { solve } = require('./lingshu-client');

async function trustedSolve(problem, meta = {}) {
  const r = await solve(problem, { honorPaid: true });
  if (r.isError) throw new Error('trustedSolve 失败: ' + JSON.stringify(r.data));
  const d = r.data;
  const first = d.solutions && d.solutions[0];
  const certificate = {
    fromAgent: meta.fromAgent || 'unknown',
    certified: d.certified,
    provenCount: (d.diagnostics || {}).provenCount,
    solverVersion: (d.diagnostics || {}).solverVersion,
    certifiedRadius: first && first.internals ? first.internals.certifiedRadius : null,
    summary: d.summary,
    issuedAt: new Date().toISOString(),
  };
  return {
    result: d.recommended ? d.recommended.values : d.solutions,
    certificate,
  };
}

// 下游 agent 校验：只有 certified=true 且 provenCount>0 才采信
function verifyCertificate(cert) {
  return !!(cert && cert.certified === true && cert.provenCount > 0);
}

module.exports = { trustedSolve, verifyCertificate };

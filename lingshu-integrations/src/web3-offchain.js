// web3-offchain.js — 场景 C2：智能合约 / 链下计算认证
// 链上不能跑重计算；off-chain 用灵数算出带 Krawczyk 证书的结果，上链后可独立验证。
const { solve } = require('./lingshu-client');

async function offchainVerifiedCompute(problem) {
  const r = await solve(problem, { honorPaid: true });
  if (r.isError) throw new Error('offchain 计算失败: ' + JSON.stringify(r.data));
  const d = r.data;
  const first = d.solutions && d.solutions[0];
  // 紧凑证书：可序列化为 bytes/string 上链；验证方用 verifyOffchain 复核
  const certificate = {
    certified: d.certified,
    provenCount: (d.diagnostics || {}).provenCount,
    solverVersion: (d.diagnostics || {}).solverVersion,
    residual: first && first.internals ? first.internals.residual : null,
    certifiedRadius: first && first.internals ? first.internals.certifiedRadius : null,
    answer: d.recommended ? d.recommended.values : null,
    summary: d.summary,
  };
  return { answer: certificate.answer, certificate };
}

// 链上/链下验证方：certified 且 provenCount>0 且半径已知 → 采信
function verifyOffchain(cert) {
  return !!(cert && cert.certified === true && cert.provenCount > 0 && cert.certifiedRadius != null);
}

module.exports = { offchainVerifiedCompute, verifyOffchain };

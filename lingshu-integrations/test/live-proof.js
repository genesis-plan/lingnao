// live-proof.js — 逐场景实测线上灵数，证明它在每个场景真能「发挥作用」
// 跑法：node test/live-proof.js  （输出同时写 test/live-proof.out）
const { routeMathToLingshu } = require('../src/agent-offload');
const { trustedSolve, verifyCertificate } = require('../src/a2a-trusted-node');
const { offchainVerifiedCompute, verifyOffchain } = require('../src/web3-offchain');
const { validateComputation } = require('../src/rpa-finance');
const { computeTrusted } = require('../src/lingjing-compute-layer');

const lines = [];
function ok(name, cond, extra) { lines.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); return cond; }

(async () => {
  let allPass = true;

  // 场景 A1：LLM Agent 数学 offload
  try {
    const r = await routeMathToLingshu('x^2 - 2 = 0');
    const p = ok('A1 agent-offload certified', r.ok && r.certified === true, JSON.stringify(r.proof));
    allPass = allPass && p;
  } catch (e) { allPass = false; lines.push('FAIL A1 ' + e.message); }

  // 场景 A2：A2A 可信计算节点（含下游校验）
  try {
    const { result, certificate } = await trustedSolve(['3*x + 5*y = 7', '2*x - y = 1'], { fromAgent: 'planner' });
    const verified = verifyCertificate(certificate);
    const p = ok('A2 a2a trusted+verify', certificate.certified === true && verified === true,
      'x,y=' + JSON.stringify(result));
    allPass = allPass && p;
  } catch (e) { allPass = false; lines.push('FAIL A2 ' + e.message); }

  // 场景 C2：链下计算认证（含验证方复核）
  try {
    const { answer, certificate } = await offchainVerifiedCompute('exp(x) - 3 = 0');
    const v = verifyOffchain(certificate);
    const p = ok('C2 web3 offchain verified', certificate.certified === true && v === true, 'x=' + JSON.stringify(answer));
    allPass = allPass && p;
  } catch (e) { allPass = false; lines.push('FAIL C2 ' + e.message); }

  // 场景 B3：RPA/财税 校验层（增值税应缴额 = 113 × 0.13）
  try {
    const r = await validateComputation('增值税应缴额', ['y = 113 * 0.13']);
    const p = ok('B3 rpa-finance AUTO_POST', r.trusted === true && r.action === 'AUTO_POST', 'y=' + JSON.stringify(r.answer));
    allPass = allPass && p;
  } catch (e) { allPass = false; lines.push('FAIL B3 ' + e.message); }

  // 场景 C1：灵境/灵脑 认证计算层
  try {
    const r = await computeTrusted('sin(x) - 0.5 = 0');
    const p = ok('C1 lingjing compute-layer', r.ok && r.certified === true, 'proven=' + r.proof.provenCount);
    allPass = allPass && p;
  } catch (e) { allPass = false; lines.push('FAIL C1 ' + e.message); }

  const summary = '\n=== ' + (allPass ? 'ALL PASS ✅ 灵数已在 5 个场景实测发挥作用' : 'SOME FAIL ❌') + ' ===';
  const out = lines.join('\n') + summary + '\n';
  require('fs').writeFileSync(__dirname + '/live-proof.out', out);
  console.log(out);
})();

'use strict';
/* A 选项验证：灵脑内部代数验证委派灵数求解器（Krawczyk 认证） */
const fs = require('fs'), path = require('path');
const SECRET = 'CERT-A-SECRET-' + Date.now();
const html = fs.readFileSync(path.join(__dirname, '灵脑.html'), 'utf8');
let body = html.match(/<script>([\s\S]*)<\/script>/)[1];
const cut = body.indexOf('// ===================== UI 编排'); if (cut >= 0) body = body.slice(0, cut);
globalThis.__LINGNAO_AUDIT_SECRET = SECRET;
const tmp = path.join(__dirname, '_cert_a_kernel_load.js');
fs.writeFileSync(tmp, body); require(tmp);
const WB = globalThis.__WB, MathK = WB.MathKernel;
const findings = [];
function F(id, ok, claim, evidence){ findings.push({id, ok, claim, evidence}); console.log('  [%s] %s :: %s', ok?'PASS':'FAIL', id, claim); }

console.log('[boot] auditLedger.ok=%s', MathK.auditLedger && MathK.auditLedger.ok);

(async () => {
  console.log('=== A) 无桥（灵数未接入）：诚实降级 ===');
  const noBridge = WB.certifiedNumeric({ equations: ['x^2=4'], variables: ['x'] });
  F('NO-BRIDGE-DEGRADE', noBridge.available === false && noBridge.tier === 'lite-unverified' && noBridge.certified === false,
    '灵数未接入时 certifiedNumeric 诚实降级（available:false，不假装认证）', noBridge);

  console.log('=== B) 注入桥（灵数可用）：Krawczyk 认证 ===');
  globalThis.__LINGSHU__ = require('./lingshu-bridge.js');   // 解析到桌面真源 solver-core
  const r1 = WB.certifiedNumeric({ equations: ['x^2+y^2=25', 'x+y=7'], variables: ['x', 'y'] });
  const rec = r1.recommended && r1.recommended.values;
  const validRoot = rec && ((Math.abs(rec[0]-4)<1e-3 && Math.abs(rec[1]-3)<1e-3) || (Math.abs(rec[0]-3)<1e-3 && Math.abs(rec[1]-4)<1e-3));
  F('BRIDGE-CERTIFIED', r1.available === true && r1.certified === true && r1.tier === 'certified-krawczyk' && validRoot,
    '委派灵数解出 x²+y²=25, x+y=7 → (4,3) 或 (3,4)，Krawczyk certified（推荐根之一）', { engine: r1.engine, recommended: r1.recommended && r1.recommended.text, certifiedRadius: r1.certifiedRadius, residual: r1.residual });

  console.log('-- B2: 真升级——证明无实数解（lite 浮点永不能证）--');
  const r2 = WB.certifiedNumeric({ equations: ['x^2+1=0'], variables: ['x'] });
  F('PROVE-NO-SOLUTION', r2.available === true && r2.provenNoSolution === true && r2.resultTypeName === 'empty',
    '灵数证明 x²+1=0 在实数域严格无解（provenNoSolution=true，比 lite 浮点强的真升级）', { resultTypeName: r2.resultTypeName, certified: r2.certified });

  console.log('=== C) generateAudit 安全层接入 certifiedAlgebraic 切片 ===');
  const pathObj = WB.aStar('CHARGE', 'C');
  const rep = WB.generateAudit(pathObj, { algebraic: { equations: ['x^2+1=0'], variables: ['x'] } });
  const layer = (rep.safetyLayers && rep.safetyLayers.layers || []).find(l => l.layer === 'safety.certifiedAlgebraic');
  F('AUDIT-SLICE', !!layer && layer.verdict === 'safe' && layer.theorem.indexOf('THM_KRAWCZYK_CERTIFY') >= 0,
    'generateAudit 暴露 safety.certifiedAlgebraic 切片（provenNoSolution→safe，引用已注册定理）',
    { verdict: layer && layer.verdict, hasCertField: !!rep.certifiedAlgebraic });

  console.log('=== D) safetyLayersReport 接入 ===');
  const slr = WB.safetyLayersReport({ algebraic: { equations: ['x^2+y^2=25', 'x+y=7'], variables: ['x', 'y'] } });
  const sl = slr.layers.find(l => l.layer === 'safety.certifiedAlgebraic');
  F('SAFETY-REPORT-SLICE', !!sl && sl.available !== false && sl.theorem === 'THM_KRAWCZYK_CERTIFY',
    'safetyLayersReport 暴露 certifiedAlgebraic 层（灵数可用）', { verdict: sl && sl.verdict });

  console.log('=== E) continuousVerify 自测（含新「代数认证层」检查）===');
  const cv = WB.continuousVerify();
  F('CONTINUOUS-VERIFY', cv.all === true, '仓库级持续验证全过（含代数认证层路径被锻炼，不抛错、格式良构）',
    { all: cv.all, failed: cv.checks.filter(c => !c.pass).map(c => c.name) });

  console.log('=== F) 定理注册诚实 ===');
  const apiOk = typeof MathK.theorem === 'function';
  const usedInLayer = !!(layer && layer.theorem && layer.theorem.indexOf('THM_KRAWCZYK_CERTIFY') >= 0);
  F('THEOREM-REGISTERED', apiOk && usedInLayer,
    'THM_KRAWCZYK_CERTIFY 注册 API 存在（by:DELEGATE 诚实标注证明权外委灵数），且运行内核的安全层已实际引用该定理',
    { apiOk, usedInLayer, layerTheorem: layer && layer.theorem });

  fs.unlinkSync(tmp);
  const out = { generated: new Date().toISOString(), pass: findings.filter(f => f.ok).length, total: findings.length, findings };
  fs.writeFileSync(path.join(__dirname, '_cert_a_verify_results.json'), JSON.stringify(out, null, 2));
  console.log('\n=== 汇总 %d/%d ===', out.pass, out.total);
  if (out.pass !== out.total) process.exitCode = 1;
})();

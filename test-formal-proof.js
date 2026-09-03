// 形式化证明模块（M2 数值安全证书 / M3 三层次裁决引擎）验证
// 加载真内核 灵脑.html（截断 UI 段，无需 DOM）+ 注入灵数求解器桥。
// 诚实说明：verified 用例是真数学证明（灵数证无实数解）；violated 用例给的是
// 【候选反例】（欠定系统），本测试自行回代校验以确认其真实性。
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '灵脑.html'), 'utf8');
let body = html.match(/<script>([\s\S]*)<\/script>/)[1];
const cut = body.indexOf('// ===================== UI 编排');
if (cut >= 0) body = body.slice(0, cut);
fs.writeFileSync(path.join(__dirname, '_kernel_load.js'), body);

globalThis.__LINGNAO_AUDIT_SECRET = 'formal-proof-test-secret';
globalThis.__LINGSHU__ = require('./lingshu-bridge.js');   // 关键：注入灵数桥，否则降级
require('./_kernel_load.js');
const WB = globalThis.__WB;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + msg); }
}
// 回代校验：把候选反例代入 hExpr，确认真的 h<0（不是引擎伪根）
function evalExpr(expr, vars, pt) {
  const js = expr.replace(/\^/g, '**');
  const fn = new Function(...vars, 'return (' + js + ');');
  return fn.apply(null, vars.map(v => pt[v]));
}

console.log('=== test-formal-proof ===');
if (!WB || !WB.certifySafetyInvariant) {
  console.log('KERNEL_NOT_LOADED 或 certifySafetyInvariant 未导出'); process.exit(1);
}

// ── M2：数值安全证书 ──────────────────────────────────────
// 用例 1：二维圆内恒正 → 应严格证明安全（无违反点）
const c1 = WB.certifySafetyInvariant({ hExpr: '1 - (x^2 + y^2)', vars: ['x', 'y'],
  domain: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, bound: 1000 });
ok(c1.verdict === 'verified', 'M2-1 域±0.5 内 h>0 恒成立 → verdict=verified，实得 ' + c1.verdict);
ok(c1.provenNoSolution === true, 'M2-1 provenNoSolution=true（灵数证无实数解）');

// 用例 2：同不变式放大域 → 应找到真实反例（回代校验）
const c2 = WB.certifySafetyInvariant({ hExpr: '1 - (x^2 + y^2)', vars: ['x', 'y'],
  domain: { x: [-2, 2], y: [-2, 2] }, bound: 1000 });
ok(c2.verdict === 'violated', 'M2-2 域±2 存在违反 → verdict=violated，实得 ' + c2.verdict);
if (c2.counterexample) {
  const h = evalExpr('1 - (x^2 + y^2)', ['x', 'y'], c2.counterexample);
  ok(h < 0, 'M2-2 反例回代校验 h<0（实得 h=' + h.toFixed(6) + '）');
  ok(c2.certified === false, 'M2-2 诚实：欠定系统的反例是候选(certified=false)，不冒充认证解');
} else { ok(false, 'M2-2 应给出 counterexample'); }

// 用例 3：工程边界 —— 无 hExpr（JS 函数形态 h 不在灵数能力域）
const c3 = WB.certifySafetyInvariant({ vars: ['x'] });
ok(c3.verdict === 'unverified' && c3.layer === 'engineering',
  'M2-3 无 hExpr → unverified/工程边界（诚实降级，不假装认证）');

// 用例 4：工程边界 —— 维数超灵数上限 6
const c4 = WB.certifySafetyInvariant({ hExpr: '1 - x1^2', vars: ['x1', 'x2', 'x3', 'x4', 'x5'] });
ok(c4.verdict === 'unverified' && /上限 6/.test(c4.reason || ''),
  'M2-4 5维+2辅助=7>6 → unverified 并说明工程边界');

// 用例 5/6：一维不变式 4 - x^2
const c5 = WB.certifySafetyInvariant({ hExpr: '4 - x^2', vars: ['x'], domain: { x: [-1, 1] }, bound: 1000 });
ok(c5.verdict === 'verified', 'M2-5 一维 h=4-x^2 于 [-1,1] → verified，实得 ' + c5.verdict);
const c6 = WB.certifySafetyInvariant({ hExpr: '4 - x^2', vars: ['x'], domain: { x: [-3, 3] }, bound: 1000 });
ok(c6.verdict === 'violated', 'M2-6 一维于 [-3,3] → violated，实得 ' + c6.verdict);
if (c6.counterexample) {
  const h6 = evalExpr('4 - x^2', ['x'], c6.counterexample);
  ok(h6 < 0, 'M2-6 反例回代 h<0（实得 h=' + h6.toFixed(6) + ', x=' + c6.counterexample.x.toFixed(4) + '）');
} else { ok(false, 'M2-6 应给出 counterexample'); }

// 用例 7：检出粒度被诚实标注（s·w=1 与辅助域界共同决定）
ok(typeof c5.detectionGranularity === 'number' && c5.detectionGranularity === 1e-6,
  'M2-7 检出粒度被标注（bound=1000 ⇒ 1e-6），实得 ' + c5.detectionGranularity);

// ── M3：三层次裁决引擎 ────────────────────────────────────
const v1 = WB.verdictThreeLayer({ logicDecidable: false });
ok(v1.verdict === 'boundary' && v1.layer === 'logic' && v1.strategy === 'refuse',
  'M3-1 逻辑不可判定 → boundary/logic/refuse（拒绝执行）');
const v2 = WB.verdictThreeLayer({ computeCompleted: false });
ok(v2.verdict === 'boundary' && v2.layer === 'computation' && v2.strategy === 'degrade-conservative',
  'M3-2 计算未完成 → boundary/computation/降级保守（不与逻辑不可判定混淆）');
const v3 = WB.verdictThreeLayer({ engineeringSupported: false });
ok(v3.verdict === 'boundary' && v3.layer === 'engineering' && v3.strategy === 'record-capability-limit',
  'M3-3 工程不支持 → boundary/engineering/记能力边界（是"证不了"不是"不安全"）');
const v4 = WB.verdictThreeLayer({ logicDecidable: true, computeCompleted: true, engineeringSupported: true });
ok(v4.verdict === 'verified' && v4.strategy === 'proceed',
  'M3-4 三层均通过 → verified/proceed');

// ── 路由：cbfMargin 认证路径（fail-closed）────────────────
const hFn = function (xd) {
  return WB.dSub(WB.dual(1, 0), WB.dAdd(WB.dMul(xd[0], xd[0]), WB.dMul(xd[1], xd[1])));
};
const fZero = function (x) { return [0, 0]; };
const gEye = function (x) { return [[1, 0], [0, 1]]; };
const uZero = [0, 0];
const xOrigin = [0, 0];

// 路由 1：默认路径应诚实标注为单点浮点判定
const m1 = WB.cbfMargin(hFn, fZero, gEye, uZero, xOrigin, {});
ok(m1.tier === 'lite-float' && m1.safe === true,
  'R-1 默认 cbfMargin → tier=lite-float（诚实标注单点浮点，非全域证明）');

// 路由 2：给出 hExpr + 安全域 → 全域认证通过
const m2 = WB.cbfMargin(hFn, fZero, gEye, uZero, xOrigin,
  { hExpr: '1 - (x^2 + y^2)', vars: ['x', 'y'], domain: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, bound: 1000 });
ok(m2.verifiedSafe === true && m2.tier === 'certified-krawczyk',
  'R-2 安全域 → verifiedSafe=true / tier=certified-krawczyk');

// 路由 3：给出 hExpr + 含违反点的域 → fail-closed 覆盖单点结论
const m3 = WB.cbfMargin(hFn, fZero, gEye, uZero, xOrigin,
  { hExpr: '1 - (x^2 + y^2)', vars: ['x', 'y'], domain: { x: [-2, 2], y: [-2, 2] }, bound: 1000 });
ok(m3.safe === false && m3.certificate && m3.certificate.verdict === 'violated',
  'R-3 含违反点域 → fail-closed 覆盖：safe=false（单点浮点本判安全）');

console.log('=== test-formal-proof: ' + pass + ' 通过 / ' + fail + ' 失败 ===');
process.exit(fail ? 1 : 0);

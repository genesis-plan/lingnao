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

// ══ M2 假证明回归组（2026-09-03 实测抓到的真缺陷，逐条钉死防复发）════════════
// 缺陷本体：domain 传数组形态 [[-2,2],[-2,2]] 时，深拷贝后仍是数组，挂 _sv/_wv 属性后
// 交给引擎 ⇒ 引擎解析不出变量域 ⇒ 在退化域上返回 empty(无解) ⇒ 上层判 verified。
// 于是「安全不变式已被数学证明」凭空产生。安全模块的假阳性是最危险的一类缺陷。
console.log('-- M2 假证明回归组 --');

// F-1 缺陷复现用例：h=x^2+y^2-1 在域±2 内明显有 h(0,0)=-1<0，绝不允许判 verified
const f1 = WB.certifySafetyInvariant({ hExpr: 'x^2+y^2-1', vars: ['x', 'y'], domain: [[-2, 2], [-2, 2]] });
ok(f1.verdict !== 'verified', 'F-1 数组域不得产出 verified（假证明），实得 ' + f1.verdict);
ok(f1.verdict === 'unverified' && f1.tier === 'lite-unverified',
  'F-1b 数组域 → fail-closed unverified，实得 ' + f1.verdict + '/' + f1.tier);
ok(/形态非法/.test(String(f1.reason)), 'F-1c 拒判理由须点明域形态非法');

// F-2 同一 h 用合法对象域 → 必须找到反例（说明缺陷只在形态校验，不在数学转换）
const f2 = WB.certifySafetyInvariant({ hExpr: 'x^2+y^2-1', vars: ['x', 'y'], domain: { x: [-2, 2], y: [-2, 2] } });
ok(f2.verdict === 'violated', 'F-2 合法域同一 h → violated，实得 ' + f2.verdict);
ok(f2.counterexample && evalExpr('x^2+y^2-1', ['x', 'y'], f2.counterexample) < 1e-6,
  'F-2b 反例回代确认 h<0（真反例，非伪根）');

// F-3 域各类非法形态一律 fail-closed，不猜不修正
[['lo>=hi', { x: [2, -2], y: [-1, 1] }],
 ['端点非数值', { x: ['a', 2], y: [-1, 1] }],
 ['未知变量键', { zz: [-1, 1] }],
 ['区间长度非2', { x: [-1, 0, 1] }],
 ['无穷端点', { x: [-Infinity, 1] }],
 ['域为字符串', 'x:[-1,1]']].forEach(function (t) {
  const r = WB.certifySafetyInvariant({ hExpr: 'x^2+y^2+1', vars: ['x', 'y'], domain: t[1] });
  ok(r.verdict === 'unverified', 'F-3 非法域「' + t[0] + '」→ unverified，实得 ' + r.verdict);
});

// F-4 独立回代防线：verified 结论必须附带独立复核结果（证明器不许只信自己）
const f4 = WB.certifySafetyInvariant({ hExpr: 'x^2+y^2+1', vars: ['x', 'y'],
  domain: { x: [-2, 2], y: [-2, 2] }, bound: 1000 });
ok(f4.verdict === 'verified', 'F-4 恒正 h → verified，实得 ' + f4.verdict);
ok(f4.independentRecheck && f4.independentRecheck.done === true && f4.independentRecheck.refuted === false,
  'F-4b verified 须附独立抽样复核（done=true, refuted=false）');
ok(f4.independentRecheck.sampled > 0 && f4.independentRecheck.minValue >= 0,
  'F-4c 复核须报采样数与域内最小值，且最小值 ≥ 0');
ok(f4.domainUsed && f4.domainUsed._sv && f4.domainUsed._wv,
  'F-4d verified 须回报实际交给引擎的域（可审计）');

// F-5 未给域时必须显式回报"用了默认 ±bound"，不能让调用方误以为证的是自己想的域
const f5 = WB.certifySafetyInvariant({ hExpr: 'x^2+y^2+1', vars: ['x', 'y'], bound: 10 });
ok(Array.isArray(f5.defaultedDomains) && f5.defaultedDomains.length === 2,
  'F-5 未给域 → defaultedDomains 列出 x,y，实得 ' + JSON.stringify(f5.defaultedDomains));

// F-6 表达式语义歧义（-a^b）：引擎按 (-a)^b、数学惯例按 -(a^b) ⇒ 结论不可比 ⇒ 拒判
const f6 = WB.certifySafetyInvariant({ hExpr: '-x^2+1', vars: ['x'], domain: { x: [-2, 2] } });
ok(f6.verdict === 'unverified' && f6.tier === 'ambiguous-expression',
  'F-6 歧义表达式 -x^2+1 → unverified/ambiguous-expression，实得 ' + f6.verdict + '/' + f6.tier);
ok(/括号/.test(String(f6.fix)), 'F-6b 须给出加括号的消歧建议');
const f6c = WB.certifySafetyInvariant({ hExpr: '-(x^2)+1', vars: ['x'], domain: { x: [-0.5, 0.5] } });
ok(f6c.verdict === 'verified', 'F-6c 消歧后 -(x^2)+1 域±0.5 → verified，实得 ' + f6c.verdict);
const f6d = WB.certifySafetyInvariant({ hExpr: '-(x^2)+1', vars: ['x'], domain: { x: [-2, 2] } });
ok(f6d.verdict === 'violated', 'F-6d 消歧后 -(x^2)+1 域±2 → violated，实得 ' + f6d.verdict);

// F-6e 歧义判据的边界：只拦【一元】位置的正负号，不许错杀二元减号
//      （首版判据把 "4 - x^2" 也拦了 —— 那是二元减号，两种解析一致，无歧义）
[['-x^2+1', 1], ['2*-x^2', 1], ['1+-x^2', 1], ['sin(-x^2)', 1],
 ['4 - x^2', 0], ['1 - (x^2 + y^2)', 0], ['x^2+y^2-1', 0], ['-(x^2)+1', 0],
 ['(-x)^2', 0], ['1-x^2-y^2', 0], ['x^2 - 1', 0]].forEach(function (t) {
  const vs = /[y]/.test(t[0]) ? ['x', 'y'] : ['x'];
  const dm = vs.length === 2 ? { x: [-0.5, 0.5], y: [-0.5, 0.5] } : { x: [-0.5, 0.5] };
  const r = WB.certifySafetyInvariant({ hExpr: t[0], vars: vs, domain: dm });
  const blocked = (r.tier === 'ambiguous-expression') ? 1 : 0;
  ok(blocked === t[1], 'F-6e 歧义判据对「' + t[0] + '」应' + (t[1] ? '拦' : '放') +
    '，实得' + (blocked ? '拦' : '放'));
});

// F-7 内置求值器正确性（它是独立防线的地基；错了防线就失效）
//     优先级硬约束：一元负号 < 幂，即 -3^2 = -9；且不得使用动态求值（EVAL 是 deny 硬轨）
if (typeof WB._m2Eval === 'function') {
  [['-3^2', -9], ['2^-3', 0.125], ['2^3^2', 512], ['2*3^2', 18], ['1/2^2', 0.25],
   ['(-x)^2', 0.25, { x: 0.5 }], ['-(x^2)+1', 0.75, { x: 0.5 }],
   ['sqrt(abs(-16))', 4], ['3*(2+x)/2', 6, { x: 2 }]].forEach(function (t) {
    let got; try { got = WB._m2Eval(t[0], t[2] || {}); } catch (e) { got = NaN; }
    ok(Math.abs(got - t[1]) < 1e-9, 'F-7 求值 ' + t[0] + ' 应为 ' + t[1] + '，实得 ' + got);
  });
  [['x+1', {}], ['foo(2)', {}], ['2+*3', {}], ['1/0', {}]].forEach(function (t) {
    let threw = false; try { WB._m2Eval(t[0], t[1]); } catch (e) { threw = true; }
    ok(threw, 'F-7b 非法表达式「' + t[0] + '」须抛错而非静默取值');
  });
} else {
  ok(false, 'F-7 _m2Eval 未导出，独立防线无法被测试');
}

console.log('=== test-formal-proof: ' + pass + ' 通过 / ' + fail + ' 失败 ===');
process.exit(fail ? 1 : 0);

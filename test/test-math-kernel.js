// 数学内核（LCF 可信内核）验证
// 原则：内核本身也必须经得起它自己要求的检验——篡改能被发现，循环能被发现，猜想不能混进来
const K = require('../lingnao.umd.js');
let pass = 0, fail = 0;
function ok(c, m, extra){ if(c){ pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m + (extra ? '  → ' + extra : '')); } }
const MK = K.MathKernel;

console.log('── ① 内核结构：公理 / 定理 / 猜想三权分立 ──');
const st = K.kernelStatus();
ok(st.architecture.indexOf('LCF') >= 0, '架构：' + st.architecture);
ok(st.axioms >= 8, '公理 ' + st.axioms + ' 条（显式声明来源，不偷加）');
ok(st.theorems >= 15, '定理 ' + st.theorems + ' 条（全部由规则派生）');
ok(st.conjectures >= 3, '猜想 ' + st.conjectures + ' 条（明确标记未证明）');
ok(st.rules >= 5, '推理规则 ' + st.rules + ' 条（数量极小 ⟹ 内核可信）');
// 公理必须声明来源
const noSource = Object.values(MK._axioms).filter(a => !a.source || a.source === '未注明来源');
ok(noSource.length === 0, '所有公理都声明了来源（可审计）');

console.log('── ② 铁律③：猜想防火墙（未证明的东西绝不能进证明链）──');
const cj = K.kernelConjectures();
ok(cj.length >= 3 && cj.every(c => c.usable === false), '所有猜想均标记 usable:false');
const tryBad = MK.theorem('THM_TEST_BAD', '试图用猜想当前提', { by: 'MP', from: ['CONJ_POMDP_APPROX'] });
ok(tryBad.ok === false, '用猜想当前提 ⟹ **被拒绝**：' + (tryBad.error || ''));
ok(!MK._theorems['THM_TEST_BAD'], '被拒绝的定理未进入内核');
const tryUnknown = MK.theorem('THM_TEST_GHOST', '前提不存在', { by: 'MP', from: ['AX_NOT_EXIST'] });
ok(tryUnknown.ok === false, '用不存在的前提 ⟹ 被拒绝：' + (tryUnknown.error || ''));
const tryBadRule = MK.theorem('THM_TEST_RULE', '规则不存在', { by: 'NO_SUCH_RULE', from: [] });
ok(tryBadRule.ok === false, '用未知推理规则 ⟹ 被拒绝');

console.log('── ③ 证明链：每条定理都要能回溯到公理 ──');
const v = K.kernelVerify();
ok(v.ok, v.verdict);
ok(v.invalid.length === 0, '无效定理 0 条');
ok(v.maxDepth >= 3, '最大证明深度 ' + v.maxDepth + '（存在真正的多层派生，非全部平铺）');
// 最深的一条：LQG = 卡尔曼 + LQR（分离原理）
const lqg = K.theoremOf('lqg');
ok(lqg.ok, 'LQG 证明链闭合：' + lqg.verdict);
ok(lqg.foundationAxioms.length >= 4, 'LQG 建立在 ' + lqg.foundationAxioms.length + ' 条公理上');
// 单条定理的根基
const kal = K.kernelFoundation('THM_KALMAN_MINVAR');
ok(kal.ok && kal.axioms.includes('AX_GAUSS'), '卡尔曼定理的根基含 AX_GAUSS（高斯封闭性）');
// 公理自己就是根基
ok(K.kernelFoundation('AX_PROB').axioms[0] === 'AX_PROB', '公理的证明链即其自身（深度 1）');
// 猜想没有证明链
ok(K.kernelFoundation('CONJ_POMDP_APPROX').ok === false, '猜想**没有**证明链（正确拒绝）');

console.log('── ④ 能力追溯：产品的每个能力凭什么可靠 ──');
const audit = K.proofAudit();
ok(audit.ok, audit.verdict);
ok(audit.proven === audit.capabilities, '全部 ' + audit.capabilities + ' 个能力都有闭合证明链');
// 抽查若干能力的根基是否正确
const cases = { 'kalman': 'AX_GAUSS', 'astar': 'AX_MEASURE_OPT', 'conformal': 'AX_EXCH',
                'cbf': 'AX_REAL', 'shapley': 'AX_SET', 'lqr': 'AX_LINEAR' };
let allRight = true;
for (const cap in cases){
  const r = K.theoremOf(cap);
  if (!r.ok || !r.foundationAxioms.includes(cases[cap])) { allRight = false; console.log('      ↳ ' + cap + ' 根基不符'); }
}
ok(allRight, '抽查 6 个能力的数学根基均正确（卡尔曼←高斯、A*←最优性原理、保形←可交换性…）');
ok(Object.keys(audit.axiomUsage).length >= 8, '共 ' + Object.keys(audit.axiomUsage).length + ' 条公理真正支撑了产品');
ok(K.theoremOf('不存在的手臂').ok === false, '未登记能力诚实返回失败（而非假装可靠）');

console.log('── ⑤ 篡改检测：内核可信吗（De Bruijn 准则）──');
// 绕过 theorem() 直接注入一条依赖缺失的假定理 —— verify 必须能发现
MK._theorems['THM_FORGED'] = { id: 'THM_FORGED', kind: 'theorem', statement: '伪造的',
  by: 'MP', from: ['AX_DOES_NOT_EXIST'], field: '测试', proof: '', refuted: false, at: 9999 };
const forgedV = MK.verify('THM_FORGED');
ok(forgedV.ok === false, '绕过接口注入的假定理 ⟹ **被 verify 抓出**：' + (forgedV.error || ''));
delete MK._theorems['THM_FORGED'];
// 注入循环依赖（A 依赖 B，B 依赖 A）
MK._theorems['THM_CYC_A'] = { id:'THM_CYC_A', kind:'theorem', statement:'A', by:'CONJ', from:['THM_CYC_B'], field:'测试', proof:'', at:9997 };
MK._theorems['THM_CYC_B'] = { id:'THM_CYC_B', kind:'theorem', statement:'B', by:'CONJ', from:['THM_CYC_A'], field:'测试', proof:'', at:9998 };
const cycV = MK.verify('THM_CYC_A');
ok(cycV.ok === false && /循环/.test(cycV.error || ''), '循环依赖 ⟹ **被检出**：' + (cycV.error || ''));
delete MK._theorems['THM_CYC_A']; delete MK._theorems['THM_CYC_B'];
// 篡改后全内核验证必须失败（证明验证不是走过场）
MK._theorems['THM_FORGED2'] = { id:'THM_FORGED2', kind:'theorem', statement:'伪造2', by:'MP', from:['AX_NOPE'], field:'测试', proof:'', at:9996 };
ok(MK.verifyAll().ok === false, '内核被污染 ⟹ verifyAll() 立即失败（验证真实有效）');
delete MK._theorems['THM_FORGED2'];
ok(MK.verifyAll().ok === true, '清除污染后恢复通过（验证可重复）');
// De Bruijn：重复验证结果一致（确定性）
const v1 = MK.verifyAll(), v2 = MK.verifyAll();
ok(v1.ok === v2.ok && v1.theorems === v2.theorems, '重复验证结果一致（可独立复核）');

console.log('── ⑥ 猜想升格：唯一让它进入证明链的合法途径 ──');
const before = K.kernelStatus().conjectures;
const promo = MK.promoteConjecture('CONJ_NONLINEAR_REACH', 'THM_NONLINEAR_REACH_PROVEN',
  '（测试用）非线性可达性在受限系统类上可逼近', { by: 'DERIVE', from: ['AX_REAL'], field: '可达性分析', proof: '假定已获证明' });
ok(promo.ok, '猜想可被证明后升格为定理');
ok(K.kernelStatus().conjectures === before - 1, '升格后猜想数减 1');
ok(K.kernelFoundation('THM_NONLINEAR_REACH_PROVEN').ok === true, '升格后拥有合法证明链');
// 还原（保持内核洁净）
delete MK._theorems['THM_NONLINEAR_REACH_PROVEN'];
MK.conjecture('CONJ_NONLINEAR_REACH', '一般非线性系统的可达集可由有限步过近似任意逼近',
  { field: '可达性分析', evidence: '理论上一般非线性可达性不可判定；仅在受限系统类上成立' });
ok(K.kernelVerify().ok, '还原后内核仍全绿');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) process.exit(1);

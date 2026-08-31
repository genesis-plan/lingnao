// demo-mathbase.js —— 数学基岩统一框架端到端演示
// 展示：集合论 ZFC 为底层 + 范畴论胶水 + L1 分支公理 + L2 未决公理 + 每个判断的完整公理链
const L = require('../lingnao.umd.js');

console.log('=== ① 大脑数学基岩 MathAxioms 全框架 ===');
const rep = L.MathAxioms.report();
console.log('底层公理:', rep.foundation);
console.log('范畴论统一胶水(对象类):', rep.categories.join(', '));
console.log('已注册分支:', rep.branches.join(', '));
console.log('自由⊣遗忘 伴随(分支统一于 Set/ZFC):', rep.adjunctions.join(', '));
console.log('L2 未决公理(诚实边界):', JSON.stringify(rep.openAxioms));

console.log('\n=== ② 每个算法的判断 = 完整公理链 ZFC → 分支公理 → IMA ===');
const pb = L.perceiveBelief({ A: 1, B: 0 }, { likelihood: { A: 1, B: 0.5 } }, { A: { A: 0.9, B: 0.1 }, B: { A: 0.1, B: 0.9 } });
console.log('perceiveBelief 公理链:', pb.math.axiomChain.join(' → '));
console.log('  范畴=', pb.math.category, '  grounding=', pb.math.ground.grounding);
const a = L.aStar('CHARGE', 'C');
console.log('aStar 公理链:', a.math.axiomChain.join(' → '));
console.log('  范畴=', a.math.category, '  grounding=', a.math.ground.grounding);

console.log('\n=== ③ 诚实边界：groundClaim 三档判定 ===');
console.log('依赖可选公理 AC :', JSON.stringify(L.MathAxioms.groundClaim(['zfc.ac', 'kolm.1']).grounding));
console.log('依赖不可判定 CH:', JSON.stringify(L.MathAxioms.groundClaim(['open.ch']).grounding), '(→ UNKNOWN，不虚构)');
console.log('纯 ZFC+分支+IMA :', JSON.stringify(L.MathAxioms.groundClaim(['zfc.ext', 'met.1', 'ima_140']).grounding));

console.log('\n=== ④ 审计报告 mathFoundation 含统一基岩 ===');
const au = L.generateAudit(a);
console.log('zfc=', au.mathFoundation.zfc, '| openAxioms=', au.mathFoundation.openAxioms.length,
  '| 聚合 axiomChain 长度=', au.mathFoundation.axiomChain.length,
  '| 含 zfc.pair=', au.mathFoundation.axiomChain.includes('zfc.pair'));
console.log('\n✔ 集合论 ZFC 为底层、范畴论统一各分支、所有判断可 cite 完整公理链。');

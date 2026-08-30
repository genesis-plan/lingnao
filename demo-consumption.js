// demo-consumption.js —— 证明灵脑「消费数学」：判断由定理派生，非魔法阈值
const L = require('./lingnao.umd.js');

console.log('══════════════════════════════════════════════════════════');
console.log('① perceiveBelief 消费 Banach 不动点定理');
console.log('══════════════════════════════════════════════════════════');
// 混合马尔可夫链：压缩映射 → Banach 保证唯一不动点
const pb1 = L.perceiveBelief({A:1,B:0}, {likelihood:{A:1,B:1}},
  {A:{A:0.7,B:0.3}, B:{A:0.3,B:0.7}}, 200, 1e-6);
console.log('  混合链 L=' + pb1.contractionL + ' <1 →', pb1.verdict);
console.log('  唯一不动点保证:', pb1.uniquenessGuaranteed, '| 定理误差界:', pb1.banachErrorBound);
// 置换映射：非压缩 → 不保证唯一，诚实降级
const pb2 = L.perceiveBelief({A:1,B:0}, {likelihood:{A:1,B:1}},
  {A:{A:0,B:1}, B:{A:1,B:0}}, 50, 1e-6);
console.log('  置换链 L=' + pb2.contractionL + ' ≥1 →', pb2.verdict);

console.log('\n══════════════════════════════════════════════════════════');
console.log('② aStar 消费一致性(三角不等式) ⇒ 最优性由定理派生');
console.log('══════════════════════════════════════════════════════════');
L.setWorld({ nodes:['CHARGE','A','B','C'],
  edges:[{from:'CHARGE',to:'A',w:1},{from:'A',to:'B',w:2},{from:'B',to:'C',w:3},{from:'CHARGE',to:'C',w:7}],
  coord:{CHARGE:[0,0],A:[1,0],B:[2,0],C:[3,0]} });
const a1 = L.aStar('CHARGE','C');
console.log('  一致(边权≥欧氏): optimalGuaranteed=' + a1.optimalGuaranteed +
  ' | 状态=' + a1.status + ' | 路径=' + a1.path.join('→'));
L.setWorld({ nodes:['CHARGE','A','B','C'],
  edges:[{from:'CHARGE',to:'A',w:0.5},{from:'A',to:'B',w:2},{from:'B',to:'C',w:3}],
  coord:{CHARGE:[0,0],A:[1,0],B:[2,0],C:[3,0]} });
const a2 = L.aStar('CHARGE','C');
console.log('  不一致(边权<欧氏, 三角不等式破): optimalGuaranteed=' + a2.optimalGuaranteed +
  ' | 状态=' + a2.status + ' | 诚实不谎称最优');

console.log('\n══════════════════════════════════════════════════════════');
console.log('③ metaCognition 消费 Shannon 信息论：H/Hmax 驱动探索-利用');
console.log('══════════════════════════════════════════════════════════');
const mc = L.metaCognition({});
console.log('  香农熵 H=' + mc.uncertainty.entropyH + ' / 最大熵 Hmax=' + mc.uncertainty.maxEntropyHmax +
  ' → 不确定性分数=' + mc.decision.uncertaintyFraction);
console.log('  决策(由信息论分数派生): ' + mc.decision.exploreExploit + ' — ' + mc.decision.reason);

console.log('\n══════════════════════════════════════════════════════════');
console.log('④ MathDesign 消费清单（可审计：哪些算法真消费定理）');
console.log('══════════════════════════════════════════════════════════');
const md = L.MathDesign.summary();
console.log('  embodied=' + md.embodied + '/' + md.total + ' →', md.embodiedList.join(', '));

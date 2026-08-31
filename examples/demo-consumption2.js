// demo-consumption2.js — 证明三个判断算法"消费定理"（判断由数学思想派生，非魔法阈值）
const L = require('../lingnao.umd.js');

console.log('=== 灵脑 · 数学思想消费演示（第二批）===\n');

// ① quantifyUncertainty 消费 Shannon：认知不确定度 = 1 - C(K)（香农熵派生）
const path = L.aStar('CHARGE', 'C');
const qU = L.quantifyUncertainty(path);
const Ckb = L.KB.consistency();
console.log('① quantifyUncertainty（消费 Shannon 信息论）');
console.log('   认知不确定度 cognitive =', qU.cognitive, ' = 1 - 一致性C(K) =', (1 - Ckb).toFixed(3));
console.log('   → 无硬编码覆盖阈值 20/0.6/0.3，由香农熵 H(K) 派生\n');

// ② runtimeMonitor 消费 PrSTL：G(φ) 真值评估
const rmOk = L.runtimeMonitor(path, { maxCost: 999, hardNodes: [] });
const rmBad = L.runtimeMonitor(path, { maxCost: 0.0001, hardNodes: [] });
console.log('② runtimeMonitor（消费 PrSTL 时态语义 G(φ)=轨迹全步满足φ）');
console.log('   合规轨迹: safe =', rmOk.safe, '| prstl.op =', rmOk.prstl.op, '| evaluated =', rmOk.prstl.evaluated);
console.log('   超界轨迹: safe =', rmBad.safe, '| violations =', JSON.stringify(rmBad.violations), '→ 触发 SAFETY_STOP');
console.log('   → 安全约束编译为时态公式真值评估，非标量贴标\n');

// ③ detectConflicts 消费布尔补律：同键互补事件共存 → 违反 a∧¬a=⊥
L.KB._exp.push({ id:'EC1', transition:{from:'CF_A',action:'move→CF_B',to:'CF_B'}, success:true, confidence:0.9, source:'test', kind:'positive', createdAt:Date.now() });
L.KB._exp.push({ id:'EC2', transition:{from:'CF_A',action:'move→CF_B',to:'CF_B'}, success:false, confidence:0.9, source:'test', kind:'negative', createdAt:Date.now() });
const dcs = L.KB.detectConflicts();
console.log('③ detectConflicts（消费布尔代数补律 a∧¬a=⊥）');
console.log('   同键 CF_A→CF_B 上 success=true 与 success=false 共存 →');
console.log('   冲突 evidence =', JSON.stringify(dcs.find(c=>c.key==='CF_A→CF_B') && dcs.find(c=>c.key==='CF_A→CF_B').evidence));
console.log('   → 互补事件共存 = 违反补律 = 知识冲突（由布尔代数派生）\n');

// MathDesign 清单汇总
const md = L.MathDesign.summary();
console.log('=== MathDesign 消费清单 ===');
console.log('   真消费定理(embodied)算法数:', md.embodied, '/', md.total);
console.log('   清单:', md.embodiedList.join(', '));

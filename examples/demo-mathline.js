#!/usr/bin/env node
/**
 * demo-mathline.js — 端到端演示「数学主线贯穿」：
 * 每个核心算法的判断都追溯到 七元组 𝔹 分量 + 具体 IMA 公理，
 * 审计报告输出可机器检查的数学依据链（灵脑相对黑箱 LLM 的世界前沿差异化）。
 */
const L = require('../lingnao.umd.js');

function line(s){ console.log('\n' + '─'.repeat(64) + '\n' + s); }
function showMath(tag, r){
  console.log(tag);
  console.log('  七元组分量 :', r.math.septuple, '(' + r.math.septId + ')');
  console.log('  支撑 IMA   :', r.math.ima.map(x => x.id + ' ' + x.t).join('  |  '));
  console.log('  数学依据   :', r.math.basis);
}

// 1) 因果识别：前门准则（含未观测混杂 X↔Y）
line('① 因果可识别性 identifiabilityID（前门含未观测混杂）');
const fdDag = { nodes:['X','M','Y'], edges:[{from:'X',to:'M'},{from:'M',to:'Y'}], bidirected:[{from:'X',to:'Y'}] };
const idR = L.identifiabilityID(fdDag, 'X', 'Y');
console.log('  结论:', idR.identifiable ? '可识别 / ' + idR.method + ' / 中介=' + idR.mediator : '不可识别');
showMath('  数学依据链:', idR);

// 2) 反事实识别：ID* / 孪生网络
line('② 反事实可识别性 counterfactualIdentifiable（ID* / 孪生网络）');
const cfR = L.counterfactualIdentifiable(fdDag, 'X', 'Y', { finding: { X: 1, M: 1 } });
console.log('  结论:', cfR.identifiable ? '可识别 / ' + cfR.method + ' / formula=' + cfR.formula : '不可识别');
showMath('  数学依据链:', cfR);

// 3) 感知信念收敛：贝叶斯滤波 = Banach 压缩映射
line('③ 感知信念收敛 perceiveBelief（贝叶斯滤波迭代）');
const pbR = L.perceiveBelief({ A: 1, B: 0 }, { likelihood: { A: 1, B: 0.5 } },
  { A: { A: 0.9, B: 0.1 }, B: { A: 0.1, B: 0.9 } });
console.log('  结论: 收敛=' + pbR.converged + ' / 迭代=' + pbR.iterations + ' / L=' + pbR.contractionL);
showMath('  数学依据链:', pbR);

// 4) 推理最优：A* 可采纳启发式完备最优
line('④ 推理最优 aStar（可采纳启发式 → 有限图完备最优）');
L.setWorld({ nodes:['CHARGE','A','B','C'], edges:[
  {from:'CHARGE',to:'A',w:1},{from:'A',to:'B',w:1},{from:'B',to:'C',w:1},{from:'CHARGE',to:'C',w:5} ] });
const aR = L.aStar('CHARGE', 'C');
console.log('  结论: status=' + aR.status + ' / 路径=' + aR.path.join('→') + ' / cost=' + aR.cost);
showMath('  数学依据链:', aR);

// 5) 审计：把本次决策涉及的算法数学依据链统一收引
line('⑤ 审计报告 generateAudit → 数学依据链(mathFoundation.cited)');
const au = L.generateAudit(aR);
console.log('  状态:', au.status);
console.log('  收引分量:', au.mathFoundation.cited.map(c => c.septId + '(' + c.septuple + ')').join('  |  '));
console.log('  收引公理:', [...new Set(au.mathFoundation.cited.flatMap(c => c.ima.map(x => x.id)))].join(' '));

line('结论：灵脑每个算法的判断均可追溯到 七元组 𝔹 分量 + 具体 IMA 公理，审计可输出数学依据链。');

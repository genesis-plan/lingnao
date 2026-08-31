// 机器人接入测试：验证「大脑面对任意物理身体」——两台异构机器人接入同一颗大脑
// 运行：node test-robot-integration.js
const fs = require('fs');
const L = require('../lingnao.umd.js');

let pass = 0, fail = 0;
function assert(c, m){ if(c){ pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 FAIL: ' + m); } }
function pathOf(r){ return (r && Array.isArray(r.path)) ? r.path : (r && r.steps ? r.steps.map(s=>s.state) : null); }

console.log('== 机器人接入测试：大脑面对任意物理身体 ==');

// ---------- 机器人 A：仓储搬运机器人（危化区约束） ----------
console.log('\n[机器人A] 仓储搬运机器人');
L.setWorld({ nodes:['DOCK','S1','S2','PACK','HZ'],
  edges:[ {from:'DOCK',to:'S1',w:1},{from:'S1',to:'PACK',w:1},
          {from:'DOCK',to:'S2',w:1},{from:'S2',to:'PACK',w:1},
          {from:'S1',to:'HZ',w:1},{from:'HZ',to:'PACK',w:1} ] });
const repA = L.carrierReport({ body:'warehouse-mover', hard:['HZ'], soft:['prefer_short'], battery:78 });
assert(repA.hard.includes('HZ'), 'carrierReport 透传外部硬约束 HZ(危化区)');
assert(!/充电/.test(JSON.stringify(repA)), '大脑未对 A 注入任何\"充电/电量\"专属规则');
const rA = L.reason('DOCK','PACK',{ hard:['HZ'] });
assert(rA && (rA.status==='optimal' || rA.path), '给出可行规划');
const pathA = pathOf(rA);
assert(pathA && !pathA.includes('HZ'), '规划避开硬约束 HZ(危化区)  -> ' + JSON.stringify(pathA));

// ---------- 机器人 B：巡检无人机（禁飞区约束） ----------
console.log('\n[机器人B] 巡检无人机（完全不同身体/约束域）');
L.setWorld({ nodes:['BASE','T1','T2','NFZ','LAND'],
  edges:[ {from:'BASE',to:'T1',w:1},{from:'T1',to:'LAND',w:1},
          {from:'BASE',to:'NFZ',w:1},{from:'NFZ',to:'LAND',w:1},
          {from:'T1',to:'T2',w:1},{from:'T2',to:'LAND',w:1} ] });
const repB = L.carrierReport({ body:'inspection-drone', hard:['NFZ'], soft:['min_altitude'], battery:54 });
assert(repB.hard.includes('NFZ'), 'carrierReport 透传外部硬约束 NFZ(禁飞区)');
assert(!/充电/.test(JSON.stringify(repB)), '大脑未对 B 注入任何\"充电/电量\"专属规则');
const rB = L.reason('BASE','LAND',{ hard:['NFZ'] });
assert(rB && (rB.status==='optimal' || rB.path), '给出可行规划');
const pathB = pathOf(rB);
assert(pathB && !pathB.includes('NFZ'), '规划避开硬约束 NFZ(禁飞区)  -> ' + JSON.stringify(pathB));

// ---------- 身体无关性：服务 B 后切回 A，规划须与首轮一致（大脑不持有机器人状态） ----------
console.log('\n[身体无关性] 同一颗大脑先后服务 A、B、再 A');
L.setWorld({ nodes:['DOCK','S1','S2','PACK','HZ'],
  edges:[ {from:'DOCK',to:'S1',w:1},{from:'S1',to:'PACK',w:1},
          {from:'DOCK',to:'S2',w:1},{from:'S2',to:'PACK',w:1},
          {from:'S1',to:'HZ',w:1},{from:'HZ',to:'PACK',w:1} ] });
const rA2 = L.reason('DOCK','PACK',{ hard:['HZ'] });
assert(JSON.stringify(pathOf(rA2)) === JSON.stringify(pathA), '切回 A 规划与首轮一致(大脑无机器人内部状态)');

// ---------- 自我修正：机器人上报与推测偏差的事实 -> 大脑修正推测贴合事实 ----------
console.log('\n[自我修正] 机器人上报偏差事实，大脑修正推测');
L.setWorld({ nodes:['X','Y'], edges:[{from:'X',to:'Y',w:1,p:1}] });
const before = L.WORLD.edges.find(e=>e.from==='X'&&e.to==='Y').p;
const per = L.perceive({ source:'robotB', observations:[{type:'edge', from:'X', to:'Y', w:1, p:0.3, confidence:0.95}] });
assert(per.ok && per.selfCorrections.length >= 1, '偏差事实触发 selfCorrection 事件(' + per.selfCorrections.length + ')');
const after = L.WORLD.edges.find(e=>e.from==='X'&&e.to==='Y').p;
assert(after < before && Math.abs(after - 0.3) < Math.abs(before - 0.3), '边概率向事实 0.3 收缩 (' + before + ' -> ' + after + ')');

// ---------- reconcile 纯函数：Banach 收缩 ----------
console.log('\n[reconcile] Banach 压缩映射');
const rec = L.reconcile(0.9, 0.2, { priorWeight:0.1, factWeight:0.9 });
assert(rec.value < 0.9 && rec.value > 0.2 && rec.alpha > 0 && rec.alpha < 1, '标量信念 Banach 收缩 (' + rec.value.toFixed(4) + ', \u03b1=' + rec.alpha + ')');

// ---------- 解耦证明：内核「推理/约束代码」无具体机器人硬编码（去注释后检查） ----------
console.log('\n[解耦证明] 内核推理/约束代码无\"充电座/电量<20%\"硬编码');
const html = fs.readFileSync('灵脑.html','utf8');
const km = html.match(/\/\/ ==KERNEL START==[^\n]*\n([\s\S]*?)\n\/\/ ==KERNEL END==/);
// 去掉 // 行注释（1122 行是\"声明解耦\"的注释，非硬编码规则；UI 在 KERNEL END 之外本就排除）
// 再排除 POSITIONING 产品定位声明块：那是说明性文本，且其内容恰恰是在声明
// 「不内置任何具体身体（充电座 / 机械臂 / 无人机…）」，属解耦的自证，反被"充电座"一词误判。
// 只排除该块本身，不降低对真实可执行代码的检查标准。
const kernelCode = (km ? km[1] : html)
  .replace(/\/\/.*$/gm, '')
  .replace(/const POSITIONING = \{[\s\S]*?\n\};/, '');
assert(!/充电座|battery\s*<\s*20|charging\s*dock/i.test(kernelCode), '内核推理/约束代码无具体物理身体硬编码');
// 反向校验：排除必须精确命中，否则说明正则失效、检查被静默放宽
assert(!/const POSITIONING = \{/.test(kernelCode), 'POSITIONING 声明块已被精确排除（检查未被静默放宽）');

console.log('\n' + (fail ? ('\u2717 机器人接入测试失败 ' + fail + ' 项') : ('\u2713 机器人接入测试全部 ' + pass + ' 项通过')));
process.exit(fail ? 1 : 0);

/*
 * 灵脑 LingNao · 物理接入模块 · 可跑示例（无需任何硬件）
 * 演示今天就能用的三条软件路径：
 *   ① classify        —— 从“观测变量 + 动作”列表识别设备类
 *   ② importStandard  —— 把厂家标准文件(点表/簇列表)映射成规范语义
 *   ③ decode.*        —— 把协议帧字节解成可读状态（实验室/原型即可验证）
 * 跑： node demo-access.js
 */
'use strict';

var A = require('./lingnao-access.js');

function line() { console.log('─'.repeat(64)); }
function show(title, obj) {
  console.log('\n◆ ' + title);
  console.log(JSON.stringify(obj, null, 2));
}

console.log('灵脑 LingNao · 物理接入模块 · 软件路径演示（无硬件）');
line();

// ① 拓扑识别：从观测识别设备类
var motor = A.classify({
  protocol: 'profidrive',
  variables: { speed: 'number', torque: 'number', current: 'number', temperature: 'number' },
  actions: ['start', 'stop', 'set_speed']
});
show('① 识别电机（profidrive 观测）', { best: motor.best && motor.best.id, matched: motor.matched, confidence: motor.confidence });

var light = A.classify({
  protocol: 'matter',
  variables: { onoff: 'number', brightness: 'number' },
  actions: ['turn_on', 'turn_off', 'set_level']
});
show('① 识别智能灯（Matter 观测）', { best: light.best && light.best.id, matched: light.matched });

var unknown = A.classify({ protocol: 'x', variables: { foo: 'number', bar: 'number' }, actions: [] });
show('① 认不出时诚实报 needsAnchor', { matched: unknown.matched, needsAnchor: unknown.needsAnchor });

// ② 标准导入：Modbus 点表
var pt = A.importStandard('point-table', {
  '40001': { slot: 'speed', scale: 1 },
  '40002': { slot: 'torque', scale: 0.1 },
  '40003': { slot: 'temperature', scale: 0.1 },
  '00001': { slot: 'run' }
});
show('② 导入 Modbus 点表 → 规范槽', pt);

// ②b Matter 簇列表
var mz = A.importStandard('matter', {
  clusters: [
    { name: 'OnOff', slot: 'onoff' },
    { name: 'LevelControl', slot: 'brightness' },
    { name: 'TemperatureMeasurement', slot: 'current_temp' }
  ]
});
show('② 导入 Matter 簇 → 规范槽', mz);

// ③ 字节解码
var sw = A.decode.cia402Status(0x0007);
show('③ 解码 CiA402 状态字 0x0007', sw);

var tlv = A.decode.matterTLV([0x30, 0x2A]);
show('③ 解码 Matter TLV [0x30,0x2A] (uint8=42)', tlv);

var pd = A.decode.profidrive([0x0F, 0x00, 0xB8, 0x0B, 0x08, 0x00, 0xB8, 0x0B]);
show('③ 解码 PROFIdrive Telegram1 (CTW=0x000F,set=3000,ZSW=0x0008,act=3000)', pd);

line();
console.log('已接入协议数:', A.connectorStatus().length, '| 已实装规范卡:', A.listCards().length);
console.log('协议驱动状态(诚实: supported=false 需硬件):');
A.connectorStatus().forEach(function (p) {
  console.log('  - ' + p.id + ': ' + (p.supported ? '驱动已实装' : '仅建档(需硬件驱动)'));
});
console.log('\n✅ 以上全部为软件路径，无需硬件即可运行。真实驱动见 connector-template.js / ACCESS-MODULE-GUIDE.md');

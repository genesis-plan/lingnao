/*
 * 通用工业协议/标准(PLC / 电机 / 传感器) 接入实测
 *   —— 与 test-cn-standards.js 对称：真实字节解码 + 标准文件导入 + 自动识类 + 登记表存在性。
 * 不依赖真实硬件：用真实帧格式构造字节，验证解码/导入/识类逻辑正确。
 */
const E = require('./lingnao-access-engine.js');
const LIB = require('./lingnao-body-library.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra != null ? JSON.stringify(extra) : ''); }
}

console.log('\n── ① CiA 402 状态字 / 控制字（伺服/变频行规）──');
const s1 = E.decodeCia402Status(0x0007);
check('CiA 402 状态字 0x0007 → operation_enabled', s1.state === 'operation_enabled' && s1.operationEnabled, s1);
const s2 = E.decodeCia402Status(0x0001);
check('CiA 402 状态字 0x0001 → ready_to_switch_on', s2.state === 'ready_to_switch_on', s2);
const s3 = E.decodeCia402Status(0x0008);
check('CiA 402 状态字 0x0008 → fault', s3.state === 'fault' && s3.fault, s3);
const s4 = E.decodeCia402Status(0x0040);
check('CiA 402 状态字 0x0040 → switch_on_disabled', s4.state === 'switch_on_disabled', s4);
check('encodeCia402Control enable_operation = 0x000F', E.encodeCia402Control('enable_operation') === 0x000F, E.encodeCia402Control('enable_operation'));
check('encodeCia402Control shutdown = 0x0006', E.encodeCia402Control('shutdown') === 0x0006, E.encodeCia402Control('shutdown'));
check('encodeCia402Control switch_on = 0x0007', E.encodeCia402Control('switch_on') === 0x0007, E.encodeCia402Control('switch_on'));
check('encodeCia402Control quick_stop = 0x0002', E.encodeCia402Control('quick_stop') === 0x0002, E.encodeCia402Control('quick_stop'));
check('encodeCia402Control disable_voltage = 0x0000', E.encodeCia402Control('disable_voltage') === 0x0000, E.encodeCia402Control('disable_voltage'));
check('encodeCia402Control fault_reset = 0x0080', E.encodeCia402Control('fault_reset') === 0x0080, E.encodeCia402Control('fault_reset'));

console.log('\n── ② PROFIdrive 标准报文（Telegram 1，PZD 4 字小端）──');
// 字序：CTW / HSW(设定,3000rpm) / ZSW / HIW(实际,3000rpm)，每字 2 字节小端
const tg = Buffer.from([0x0F, 0x00, 0xB8, 0x0B, 0x07, 0x00, 0xB8, 0x0B]);
const dp = E.decodeProfidrive(tg, { type: 1 });
check('PROFIdrive 控制字 = 0x000F', dp.controlWord === 0x000F, dp.controlWord);
check('PROFIdrive 设定值 = 3000 rpm', dp.setpoint === 3000, dp.setpoint);
check('PROFIdrive 状态字解 → operation_enabled', dp.state === 'operation_enabled', dp.state);
check('PROFIdrive 实际值 = 3000 rpm', dp.actualValue === 3000, dp.actualValue);
const dps = E.decodeProfidriveStatus(0x0008);
check('PROFIdrive 状态字 0x0008 → fault', dps.state === 'fault', dps);

console.log('\n── ③ IO-Link 过程数据映射（IODD 布局 → 命名通道）──');
// temp: 2 字节有符号 ×0.1 (原始 250 → 25.0°C)；pressure: 2 字节 ×0.01 (原始 1234 → 12.34)
// 原始字节小端：250=0x00FA → FA 00；1234=0x04D2 → D2 04
const pdBuf = Buffer.from([0xFA, 0x00, 0xD2, 0x04]);
const pd = E.decodeIOLinkPD(pdBuf, [
  { name: 'temp', bytes: 2, signed: true, scale: 0.1 },
  { name: 'pressure', bytes: 2, scale: 0.01 }
]);
check('IO-Link temp = 25.0 °C', Math.abs(pd.temp - 25.0) < 1e-9, pd.temp);
check('IO-Link pressure = 12.34', Math.abs(pd.pressure - 12.34) < 1e-9, pd.pressure);

console.log('\n── ④ 通用标准文件导入（标准优先通道）──');
const r1 = E.importStandard('profidrive', { pzdMap: { setpoint: 'speed', actual: 'actual_speed', statusWord: 'status' } });
check('PROFIdrive 导入 nameMap 3 项（PZD→槽）', Object.keys(r1.nameMap).length === 3 && r1.nameMap.setpoint === 'speed', r1.nameMap);
const r2 = E.importStandard('cia402', { target_velocity: 'speed', velocity_actual: 'actual_speed' });
check('CiA 402 导入 nameMap 2 项（对象→槽）', r2.nameMap.target_velocity === 'speed' && r2.nameMap.velocity_actual === 'actual_speed', r2.nameMap);
const r3 = E.importStandard('iolink', { processData: { temp: 'temperature', press: 'pressure' } });
check('IO-Link 导入 nameMap 2 项（通道→槽）', r3.nameMap.temp === 'temperature' && r3.nameMap.press === 'pressure', r3.nameMap);
const r4 = E.importStandard('pa-dim', { nodes: [{ browseName: 'Temperature', semanticSlot: 'temperature' }, { browseName: 'Pressure', semanticSlot: 'pressure' }] });
check('PA-DIM 导入 nameMap 2 项（语义→槽）', r4.nameMap.Temperature === 'temperature' && r4.nameMap.Pressure === 'pressure', r4.nameMap);

console.log('\n── ⑤ 通用设备自动识类（规范库新增/富化卡）──');
const m1 = LIB.classify({ variables: { speed: 'number', torque: 'number', current: 'number', temperature: 'number' }, actions: ['start', 'stop', 'set_speed'] });
check('识类 = 电机/驱动 drive.motor', m1.matched && m1.best.id === 'drive.motor', { best: m1.best && m1.best.id, score: m1.best && m1.best.score });
const m2 = LIB.classify({ variables: { freq: 'number', voltage: 'number', current: 'number' } });
check('识类 = 变频器 drive.motor（freq 专属）', m2.matched && m2.best.id === 'drive.motor', { best: m2.best && m2.best.id });
const m3 = LIB.classify({ variables: { temp: 'number', pressure: 'number' } });
check('识类 = 传感器 sensor.iot（未回归）', m3.matched && m3.best.id === 'sensor.iot', { best: m3.best && m3.best.id });
const m4 = LIB.classify({ variables: { di: 'boolean', do: 'boolean', ai: 'number' } });
check('识类 = PLC plc（未回归）', m4.matched && m4.best.id === 'plc', { best: m4.best && m4.best.id });

console.log('\n── ⑥ 通用协议登记表已建档（诚实标注驱动待补）──');
['profinet', 'ethercat', 'ethernet-ip', 'profibus', 'canopen', 'iolink',
 'profidrive', 'cia402', 'pa-dim', 'opc-ua-motion', 'iec61131', 'iec61499', 'codesys'
].forEach(function (k) {
  check('协议表含 ' + k, !!LIB.PROTOCOLS[k], k);
});
check('规范库含 drive.motor 卡', !!LIB.CANONICAL_MODELS.find(c => c.id === 'drive.motor'), 'drive.motor');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);

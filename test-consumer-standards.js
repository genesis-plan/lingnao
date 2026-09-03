/*
 * 消费智能设备标准(Matter / Zigbee / Thread / Z-Wave / HomeKit) 接入实测
 *   —— 与 test-cn-standards.js / test-general-standards.js 对称：真实字节解码 + 标准导入 + 自动识类 + 登记表存在性。
 * 不依赖真实硬件：用真实帧格式构造字节，验证解码/导入/识类逻辑正确。
 */
const E = require('./lingnao-access-engine.js');
const LIB = require('./lingnao-body-library.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra != null ? JSON.stringify(extra) : ''); }
}

console.log('\n── ① ZCL 簇名映射（Matter 与 Zigbee 共 ZCL 编号，CSA 核实）──');
check('matterClusterName(0x0006) → OnOff', E.matterClusterName(0x0006) === 'OnOff', E.matterClusterName(0x0006));
check("matterClusterName('0x0008') → LevelControl", E.matterClusterName('0x0008') === 'LevelControl', E.matterClusterName('0x0008'));
check('zigbeeClusterName(0x0300) → ColorControl', E.zigbeeClusterName(0x0300) === 'ColorControl', E.zigbeeClusterName(0x0300));
check('zigbeeClusterName(0x0201) → Thermostat', E.zigbeeClusterName(0x0201) === 'Thermostat', E.zigbeeClusterName(0x0201));
check('zigbeeClusterName(0xFFFF) → null（未知簇）', E.zigbeeClusterName(0xFFFF) === null, E.zigbeeClusterName(0xFFFF));

console.log('\n── ② Matter TLV 解码（CSA Core Ch.10，element type 高 4 位编码类型/长度）──');
const t1 = E.decodeMatterTLV([0x30, 0x2A]);   // 匿名 tag(控制字节高4位=元素类型→0x30=uint8), uint8=42
check('匿名 uint8=42', t1.length === 1 && t1[0].type === 'uint' && t1[0].value === 42, t1);
const t2 = E.decodeMatterTLV([0x20]);          // bool true（0x20）
check('bool true', t2[0].type === 'bool' && t2[0].value === true, t2);
const t3 = E.decodeMatterTLV([0x10]);          // bool false（0x10）
check('bool false', t3[0].type === 'bool' && t3[0].value === false, t3);
const t4 = E.decodeMatterTLV([0x31, 0x01, 0x07]); // 上下文 tag#1, uint8=7
check('上下文 tag#1 uint8=7', t4[0].tag.kind === 'context' && t4[0].tag.num === 1 && t4[0].value === 7, t4);
const t5 = E.decodeMatterTLV([0xD0, 0x02, 0x68, 0x69]); // utf8 'hi'（0xD0=匿名utf8 1B长）
check("utf8 'hi'", t5[0].type === 'utf8' && t5[0].value === 'hi', t5);
const t6 = E.decodeMatterTLV([0x70, 0xFF]);    // int8 = -1（0x70=int8, 符号扩展）
check('int8=-1（符号扩展）', t6[0].type === 'int' && t6[0].value === -1, t6);
const t7 = E.decodeMatterTLV('302a');          // hex 字符串输入（0x30 uint8, 0x2A=42）
check('hex 字符串输入 uint8=42', t7[0].type === 'uint' && t7[0].value === 42, t7);

console.log('\n── ③ ZCL 命令帧解码（FrameControl + Seq + Cmd + Payload）──');
const z1 = E.decodeZclFrame([0x00, 0x05, 0x00, 0x00]); // global, ReadAttributes
check('global 帧 / client→server / cmd=0x00', z1.frameType === 'global' && z1.direction === 'client→server' && z1.command === 0x00, z1);
const z2 = E.decodeZclFrame([0x01, 0x09, 0x40]); // cluster-specific
check('cluster-specific / seq=9 / cmd=0x40', z2.frameType === 'cluster-specific' && z2.seq === 9 && z2.command === 0x40, z2);
const z3 = E.decodeZclFrame([0x09, 0x01, 0x00]); // 方向位(bit3)=server→client
check('方向 server→client', z3.direction === 'server→client', z3);
const z4 = E.decodeZclFrame([0x05, 0x02, 0x00]); // 厂商位(bit2)
check('manufacturerSpecific=true', z4.manufacturerSpecific === true, z4);

console.log('\n── ④ importStandard 消费标准导入（matter / zigbee）──');
const m1 = E.importStandard('matter', { OnOff: 'onoff', LevelControl: 'brightness' });
check('matter 显式簇→槽', m1.nameMap.OnOff === 'onoff' && m1.nameMap.LevelControl === 'brightness', m1.nameMap);
const m2 = E.importStandard('matter', { TemperatureMeasurement: '' });   // 空 slot → 自动翻译
check('matter 自动翻译 TemperatureMeasurement→temp', m2.nameMap.TemperatureMeasurement === 'temp', m2.nameMap);
const m3 = E.importStandard('matter', { OccupancySensing: '' });          // → 落 sensor.iot.occupancy
check('matter 自动翻译 OccupancySensing→occupancy', m3.nameMap.OccupancySensing === 'occupancy', m3.nameMap);
const zz = E.importStandard('zigbee', { RelativeHumidityMeasurement: '' }); // → humi
check('zigbee 自动翻译 RelativeHumidityMeasurement→humi', zz.nameMap.RelativeHumidityMeasurement === 'humi', zz.nameMap);

console.log('\n── ⑤ 自动识类（消费设备）──');
const c1 = LIB.classify({ variables: { onoff: 'boolean', brightness: 'number', color_temp: 'number' }, actions: ['turn_on', 'turn_off', 'set_brightness'] });
check('智能灯 → consumer.light', c1.matched && c1.best.id === 'consumer.light', c1.best);
const c2 = LIB.classify({ variables: { onoff: 'boolean', power: 'number', energy: 'number' }, actions: ['turn_on', 'turn_off'] });
check('智能插座 → consumer.plug', c2.matched && c2.best.id === 'consumer.plug', c2.best);
const c3 = LIB.classify({ variables: { lock_state: 'string', lock_action: 'string' }, actions: ['lock', 'unlock'] });
check('智能门锁 → consumer.lock', c3.matched && c3.best.id === 'consumer.lock', c3.best);
const c4 = LIB.classify({ variables: { current_temp: 'number', target_temp: 'number', mode: 'string', humidity: 'number' }, actions: ['set_temp', 'set_mode'] });
check('智能温控 → consumer.thermostat', c4.matched && c4.best.id === 'consumer.thermostat', c4.best);
const c5 = LIB.classify({ variables: { occupancy: 'number', illuminance: 'number' } });   // Matter/Zigbee 占用+照度传感
check('占用/照度传感 → sensor.iot（富化生效）', c5.matched && c5.best.id === 'sensor.iot', c5.best);

console.log('\n── ⑥ 登记表 / 规范卡存在性 ──');
['matter', 'zigbee', 'thread', 'zwave', 'homekit'].forEach(function (k) {
  check('协议表含 ' + k, !!LIB.PROTOCOLS[k], k);
});
['consumer.light', 'consumer.plug', 'consumer.lock', 'consumer.thermostat'].forEach(function (id) {
  check('规范库含 ' + id + ' 卡', !!LIB.CANONICAL_MODELS.find(function (c) { return c.id === id; }), id);
});

console.log('\n──────── 消费智能设备标准测试：' + pass + ' 通过 / ' + fail + ' 失败 ────────');
process.exit(fail ? 1 : 0);

/*
 * 国内通用协议/标准 接入实测（真实帧字节 + 标准文件导入 + 自动识类）
 * 不依赖真实硬件：用真实帧格式构造字节，验证解码/导入/识类逻辑正确。
 */
const E = require('./lingnao-access-engine.js');
const LIB = require('./lingnao-body-library.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra != null ? JSON.stringify(extra) : ''); }
}

console.log('\n── ① 国内标准帧解码（真实字节）──');
// DL/T 645-2007 读电压应答帧：68 + addr(6,低位在前) + 68 + C(0x91) + L + DATA(+33H) + CS + 16
function build645(addrHex, diHex) {
  const addrB = Buffer.from(addrHex, 'hex');           // 6 字节
  const data33 = Buffer.from(addrB.length && Buffer.from(diHex, 'hex').map(b => (b + 0x33) & 0xFF));
  let frame = Buffer.concat([Buffer.from([0x68]), addrB, Buffer.from([0x68, 0x91]), Buffer.from([data33.length]), data33]);
  let cs = 0; for (const x of frame) cs = (cs + x) & 0xFF;
  return Buffer.concat([frame, Buffer.from([cs, 0x16])]);
}
const f645 = build645('123456789012', '02010100');
const d645 = E.decodeDL645(f645);
check('DL645 帧头/帧尾合法 → 地址还原', d645.addr === '123456789012', d645);
check('DL645 控制码=0x91', d645.control === 0x91, d645.control);
check('DL645 数据域 -33H 还原 = DI(02010100)', d645.dataHex === '02010100', d645.dataHex);

// CJ/T 188-2018 冷水表读应答：68 + 表类型(0x10) + addr(5) + C(0x81) + L + DATA + CS + 16
function build188(addr5Hex, volBCD4Hex) {
  const addrB = Buffer.from(addr5Hex, 'hex');          // 5 字节
  const data = Buffer.from(volBCD4Hex, 'hex');         // 4 字节 BCD
  let frame = Buffer.concat([Buffer.from([0x68, 0x10]), addrB, Buffer.from([0x81, data.length]), data]);
  let cs = 0; for (const x of frame) cs = (cs + x) & 0xFF;
  return Buffer.concat([frame, Buffer.from([cs, 0x16])]);
}
const f188 = build188('0123456789', '00001234');        // 累计量 1234 × 0.001 = 1.234 m³
const d188 = E.decodeCJT188(f188);
check('CJ/T188 表类型=冷水表(0x10)', d188.meterType === 0x10, d188.meterType);
check('CJ/T188 累计用量 = 1.234 m³', Math.abs(d188.volume - 1.234) < 1e-9, d188.volume);

console.log('\n── ② 国内标准文件导入（标准优先通道）──');
const r1 = E.importStandard('dl645', { '02010100': { slot: 'voltage' }, '02020100': { slot: 'current' }, '02030000': { slot: 'energy' } });
check('DL645 导入 nameMap 3 项（DI→槽）', Object.keys(r1.nameMap).length === 3 && r1.nameMap['02010100'] === 'voltage', r1.nameMap);
const r2 = E.importStandard('cjt188', { volume: { slot: 'volume' }, meter_no: { slot: 'meter_no' } });
check('CJ/T188 导入 nameMap 2 项（字段→槽）', r2.nameMap.volume === 'volume' && r2.nameMap.meter_no === 'meter_no', r2.nameMap);
const r3 = E.importStandard('ecode', { code: 'urn:ecode:V1NSI12345MD67890' });
check('Ecode 标识对象登记', r3.nameMap.ecode === 'entity_id' && r3.note.indexOf('Ecode') >= 0, r3.note);

console.log('\n── ③ 国内设备自动识类（规范库新增卡）──');
const c1 = LIB.classify({ variables: { voltage: 'number', current: 'number', energy: 'number' } });
check('识类 = 智能电表 meter.electric', c1.matched && c1.best.id === 'meter.electric', { best: c1.best && c1.best.id });
const c2 = LIB.classify({ variables: { meter_no: 'string', volume: 'number' } });
check('识类 = 水气热表 meter.utility', c2.matched && c2.best.id === 'meter.utility', { best: c2.best && c2.best.id });
const c3 = LIB.classify({ variables: { charge_voltage: 'number', charge_current: 'number', bms_soc: 'number' } });
check('识类 = 充电桩 ev.charger', c3.matched && c3.best.id === 'ev.charger', { best: c3.best && c3.best.id });

console.log('\n── ④ 国内协议登记表已建档（诚实标注驱动待补）──');
['epa', 'ncuc', 'wia-pa', 'dl645', 'cjt188', 'mbus', 'gb-charge', 'can'].forEach(function (k) {
  check('协议表含 ' + k, !!LIB.PROTOCOLS[k], k);
});

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);

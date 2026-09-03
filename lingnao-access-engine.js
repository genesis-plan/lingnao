/*
 * 灵脑 LingNao · 物理接入统一引擎（最好的方法，零依赖 Node）
 * ────────────────────────────────────────────────────────────
 * 方法（用户拍板 2026-09-02/03）：连世界上任意机器，不逆向、不复制对方系统，
 * 而是用【标准语义优先 + 拓扑结构识别 + 最小锚定兜底】统一接入，产出一层
 * "翻译壳（canonical adapter）"——灵脑只懂规范语义，对方内部实现不碰。
 *
 * 优先级（决定"最好"）：
 *   ① 标准语义优先：对方暴露/导入标准文件（Modbus 点表 / OPC-UA Companion /
 *     AAS / MTConnect）→ 显式 nameMap → 零歧义识别 + 零歧义翻译。这是工业界
 *     vendor-independent 集成的正路（导入 Companion Spec 即可），不靠逆向。
 *   ② 拓扑结构识别：无标准文件 → 摄入原始信息模型 → 对有限规范库比结构签名
 *     （状态空间群 + 语义图同构）→ 最佳匹配 = 类；输出模糊 nameMap（尽力而为）。
 *   ③ 最小锚定兜底：匹配不上（封闭私有无文档）→ 诚实报 needsAnchor，请人锚
 *     1 个语义槽（或导厂家标准文件）→ 重建 nameMap 重识别。绝不硬套、不谎称。
 *
 * 诚实边界：
 *   ⚠ 读"语义"靠标准文件/点表/锚定，不靠从字节反推含义。
 *   ⚠ 封闭私有无驱动/无文档/加密无凭证 → 驱动连通也识别不了，走锚定，不复制。
 *   ⚠ 输出是翻译壳，不是对方系统的克隆；拓扑管语义几何，不管字节/线缆/内部。
 *
 * 用法：
 *   const E = require('./lingnao-access-engine.js');
 *   const a = await E.connect({ url:'ws://localhost:8787' });
 *   const a2 = await E.connect({ url:'plc:502', standardFile:{kind:'point-table', data:{...}} });
 *   const a3 = await E.connect({ url:'plc:502', anchor:{ '40001':'x' } });  // 封闭私有锚定
 */
(function (root) {
  'use strict';

  var LL = (typeof require === 'function') ? require('./lingnao-link-layer.js') : root.LingNaoLinkLayer;
  var LIB = (typeof require === 'function') ? require('./lingnao-body-library.js') : root.LingNaoBodyLibrary;

  // ── 变量名 ↔ 语义槽 匹配（与 library.matchName 一致：下划线切分整词命中）──
  function matchName(observedName, hints) {
    var o = String(observedName).toLowerCase();
    var toks = o.split('_');
    return (hints || []).some(function (h) {
      var hh = String(h).toLowerCase();
      if (o === hh) return true;
      if (toks.indexOf(hh) >= 0) return true;
      if (hh.length >= 3 && o.indexOf(hh) === 0) return true;
      if (hh.length >= 3 && hh.length <= o.length && o.lastIndexOf(hh) === o.length - hh.length) return true;
      return false;
    });
  }

  // ── 国内标准帧解码（真实字节→结构化，供真实驱动复用；本机可自测）──
  // DL/T 645-2007：帧 = 68H + 地址6 + 68H + C + L + DATA(L, 每字节+33H) + CS + 16H
  function decodeDL645(frame) {
    var b = (typeof frame === 'string') ? hexToBuf(frame) : frame;
    if (!b || b.length < 12) throw new Error('decodeDL645: 帧过短');
    if (b[0] !== 0x68 || b[7] !== 0x68 || b[b.length - 1] !== 0x16) throw new Error('decodeDL645: 帧头/帧尾非法(应 68..68..16)');
    var cs = 0; for (var i = 0; i < b.length - 2; i++) cs = (cs + b[i]) & 0xFF;
    if (cs !== b[b.length - 2]) throw new Error('decodeDL645: 校验和错(计算 ' + cs.toString(16) + ' ≠ 帧 ' + b[b.length - 2].toString(16) + ')');
    var addr = []; for (var a = 1; a <= 6; a++) addr.push(b[a]);
    var control = b[8], L = b[9];
    var data = []; for (var d = 10; d < 10 + L; d++) data.push((b[d] - 0x33) & 0xFF);  // 数据域 -33H 还原
    return { protocol: 'dl645', addr: bufToHex(addr), control: control, length: L, data: data, dataHex: bufToHex(data), raw: b };
  }

  // CJ/T 188-2018：帧 = 68H + 表类型1 + 地址5 + C + L + DATA(L) + CS + 16H（水/气/热表，地址 5 字节）
  function decodeCJT188(frame) {
    var b = (typeof frame === 'string') ? hexToBuf(frame) : frame;
    if (!b || b.length < 11) throw new Error('decodeCJT188: 帧过短');
    if (b[0] !== 0x68 || b[b.length - 1] !== 0x16) throw new Error('decodeCJT188: 帧头/帧尾非法(应 68..16)');
    var cs = 0; for (var i = 0; i < b.length - 2; i++) cs = (cs + b[i]) & 0xFF;
    if (cs !== b[b.length - 2]) throw new Error('decodeCJT188: 校验和错');
    var meterType = b[1];
    var addrLen = 5;
    var addr = []; for (var a = 2; a < 2 + addrLen; a++) addr.push(b[a]);
    var control = b[2 + addrLen], L = b[2 + addrLen + 1];
    var cumStart = 2 + addrLen + 2;
    var bcd = []; for (var c = cumStart; c < cumStart + 4; c++) bcd.push(b[c]);
    var vol = bcdToNum(bcd) / 1000;   // 4 字节 BCD(小端) × 0.001 m³
    return { protocol: 'cjt188', meterType: meterType, addr: bufToHex(addr), control: control, length: L,
      volume: vol, volumeUnit: 'm³', raw: b };
  }

  function hexToBuf(h) {
    h = String(h).replace(/[^0-9A-Fa-f]/g, '');
    if (h.length % 2) h = '0' + h;
    var out = Buffer.alloc(h.length / 2);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  function bufToHex(b) { return Buffer.from(b).toString('hex').toUpperCase(); }
  function bcdToNum(bcd) {
    var s = ''; for (var i = 0; i < bcd.length; i++) { s += ((bcd[i] >> 4) & 0xF).toString() + (bcd[i] & 0xF).toString(); }
    return parseInt(s, 10) || 0;
  }

  // ── 通用驱动行规帧解码（真实字节→结构化，供真实驱动复用；本机可自测）──
  // 来源：PROFIdrive profile v4.2 / CiA 402（CAN in Automation）/ 多源厂商手册核对一致。

  // CiA 402 状态字 0x6041 位定义（伺服/变频行规，跑在 CANopen/EtherCAT）
  function decodeCia402Status(sw) {
    sw = (sw | 0) & 0xFFFF;
    var f = {
      readyToSwitchOn:  !!(sw & 0x0001),
      switchedOn:       !!(sw & 0x0002),
      operationEnabled: !!(sw & 0x0004),
      fault:            !!(sw & 0x0008),
      voltageEnabled:   !!(sw & 0x0010),
      quickStop:        !!(sw & 0x0020),
      switchOnDisabled: !!(sw & 0x0040),
      warning:          !!(sw & 0x0080),
      remote:           !!(sw & 0x0200),
      targetReached:    !!(sw & 0x0400),
      internalLimit:    !!(sw & 0x0800)
    };
    var state;
    if (f.fault) state = 'fault';
    else if (f.switchOnDisabled) state = 'switch_on_disabled';
    else if (f.quickStop && !f.operationEnabled) state = 'quick_stop_active';
    else if (f.readyToSwitchOn && f.switchedOn && f.operationEnabled) state = 'operation_enabled';
    else if (f.readyToSwitchOn && f.switchedOn) state = 'switched_on';
    else if (f.readyToSwitchOn && !f.switchedOn && !f.operationEnabled) state = 'ready_to_switch_on';
    else state = 'not_ready';
    return Object.assign({ statusWord: sw, state: state }, f);
  }

  // CiA 402 控制字命令值（已核实：Shutdown=0x0006/SwitchOn=0x0007/EnableOp=0x000F/QuickStop=0x0002/DisableV=0x0000/FaultReset=0x0080）
  function encodeCia402Control(target) {
    var map = {
      'disable_voltage': 0x0000, 'disable_operation': 0x0007,
      'shutdown': 0x0006, 'switch_on': 0x0007,
      'enable_operation': 0x000F, 'quick_stop': 0x0002, 'fault_reset': 0x0080
    };
    var v = map[String(target || '').toLowerCase()];
    if (v == null) throw new Error('encodeCia402Control: 未知命令 ' + target);
    return v;
  }

  // PROFIdrive 状态字 ZSW1 位定义（PI，变频/伺服；与 CiA 402 同态机，命名略异）
  function decodeProfidriveStatus(sw) {
    sw = (sw | 0) & 0xFFFF;
    var f = {
      readyToSwitchOn:   !!(sw & 0x0001),
      readyToOperate:    !!(sw & 0x0002),
      operationEnabled:  !!(sw & 0x0004),
      fault:             !!(sw & 0x0008),
      coastStopActive:   !!(sw & 0x0010),  // bit4=0 → OFF2（自由停车）激活
      quickStopActive:   !!(sw & 0x0020),  // bit5=0 → OFF3（快速停车）激活
      switchOnInhibited: !!(sw & 0x0040),
      warning:           !!(sw & 0x0080)
    };
    var state;
    if (f.fault) state = 'fault';
    else if (f.switchOnInhibited) state = 'switch_on_inhibited';
    else if (f.readyToSwitchOn && f.readyToOperate && f.operationEnabled) state = 'operation_enabled';
    else if (f.readyToSwitchOn && f.readyToOperate) state = 'switched_on';
    else if (f.readyToSwitchOn) state = 'ready_to_switch_on';
    else state = 'not_ready';
    return Object.assign({ statusWord: sw, state: state }, f);
  }

  // PROFIdrive 标准报文（Standard Telegram 1/352）：PZD 4 字 = CTW/HSW/ZSW/HIW（小端 2 字节/字）
  //   type=1 速度控制（NSOLL_A 设定 / NIST_A 实际，16bit rpm）；真实驱动按此字节序喂入即可复用
  function decodeProfidrive(telegram, opts) {
    opts = opts || {};
    var b = (typeof telegram === 'string') ? hexToBuf(telegram) : telegram;
    if (!b || b.length < 8) throw new Error('decodeProfidrive: 报文过短(至少 4 PZD 字=8 字节)');
    function rd(i) { return (b[i] | 0) | ((b[i + 1] | 0) << 8); }   // 小端 2 字节字
    var controlWord = rd(0), setpoint = rd(2), statusWord = rd(4), actualValue = rd(6);
    var st = decodeProfidriveStatus(statusWord);
    return {
      protocol: 'profidrive', telegram: (opts.type || 1),
      controlWord: controlWord, setpoint: setpoint, statusWord: statusWord, actualValue: actualValue,
      state: st.state, statusFlags: st, raw: b
    };
  }

  // IO-Link 过程数据映射（IODD 给的布局 → 命名通道；物理 UART 帧由 IO-Link 收发器解，这里处理解出的 PD 字节）
  //   layout: [{ name, bytes, signed?, scale?, unit? }]
  function decodeIOLinkPD(buf, layout) {
    var b = (typeof buf === 'string') ? hexToBuf(buf) : buf;
    if (!b || !layout) throw new Error('decodeIOLinkPD: 需 buf + layout');
    var out = {}; var off = 0;
    layout.forEach(function (L) {
      var n = L.bytes || 2, raw = 0;
      for (var i = 0; i < n; i++) raw |= (b[off + i] | 0) << (8 * i);   // 小端
      if (L.signed && (raw & (1 << (8 * n - 1)))) raw -= (1 << (8 * n));  // 符号扩展
      out[L.name] = (L.scale != null) ? raw * L.scale : raw;
      off += n;
    });
    return out;
  }

  // 把原始变量 + nameMap 归一到"含规范槽名"的变量集（raw 与 canonical 并存，便于识类）
  function canonicalizeVariables(rawVars, nameMap) {
    var out = {};
    Object.keys(rawVars || {}).forEach(function (n) { out[n] = rawVars[n]; });
    if (nameMap) Object.keys(nameMap).forEach(function (raw) {
      var slot = nameMap[raw];
      if (slot) out[slot] = (rawVars && rawVars[raw]) || 'number';
    });
    return out;
  }

  // 从原始变量对规范卡反推模糊 nameMap（raw 变量名 → 规范槽）
  function buildNameMap(rawVars, card) {
    var out = {};
    var slots = (card && card.stateSpace && card.stateSpace.slots) || {};
    Object.keys(rawVars || {}).forEach(function (n) {
      for (var k in slots) { if (matchName(n, slots[k].hints)) { out[n] = k; break; } }
    });
    return out;
  }

  // ── 消费智能设备解码（Matter TLV / Zigbee(ZCL) 帧，真实字节，越狱无关）──
  // ZCL 簇 ID → 名称（Matter 与 Zigbee 共 ZCL 编号，CSA 核实：0x0006 OnOff 等）
  var ZCL_CLUSTERS = {
    0x0000: 'Basic', 0x0001: 'PowerConfiguration', 0x0003: 'Identify', 0x0004: 'Groups',
    0x0005: 'Scenes', 0x0006: 'OnOff', 0x0008: 'LevelControl', 0x0101: 'DoorLock',
    0x0102: 'WindowCovering', 0x0201: 'Thermostat', 0x0300: 'ColorControl',
    0x0400: 'IlluminanceMeasurement', 0x0402: 'TemperatureMeasurement',
    0x0403: 'PressureMeasurement', 0x0405: 'RelativeHumidityMeasurement',
    0x0406: 'OccupancySensing', 0x0702: 'Metering'
  };
  // 簇/属性名 → 规范槽（供 importStandard('matter'/'zigbee') 自动翻译）
  var ZCL_SLOT = {
    OnOff: 'onoff', LevelControl: 'brightness', ColorControl: 'color_temp',
    TemperatureMeasurement: 'temp', RelativeHumidityMeasurement: 'humi',
    OccupancySensing: 'occupancy', IlluminanceMeasurement: 'illuminance',
    Thermostat: 'thermostat', DoorLock: 'lock_state', Metering: 'energy',
    PowerConfiguration: 'power'
  };
  function zclClusterName(id) {
    if (id == null) return null;
    var key = (typeof id === 'string') ? parseInt(String(id).replace(/0x/i, ''), 16) : id;
    return ZCL_CLUSTERS[key] || null;
  }
  function matterClusterName(id) { return zclClusterName(id); }  // Matter 与 Zigbee 共 ZCL 簇号

  // Matter TLV 解码（CSA Matter Core Ch.10 交互编码；element type 高 4 位编码类型与整数长度）
  // 支持：匿名/上下文(1B)标签；Null/Bool/uint(1,2,4,8 LE)/int(1,2,4,8)/float(4)/double(8)/utf8(1B,2B 长)/END(0x18)
  function decodeMatterTLV(buf) {
    var b = (typeof buf === 'string') ? hexToBuf(buf) : buf;
    if (!b || !b.length) throw new Error('decodeMatterTLV: 空缓冲');
    var i = 0, out = [];
    function rd() { return b[i++]; }
    function rdLE(n) { var v = 0; for (var k = 0; k < n; k++) v += (b[i + k] | 0) * Math.pow(2, 8 * k); i += n; return v; }
    while (i < b.length) {
      var ctrl = rd(), et = ctrl >> 4, tc = ctrl & 0x0f, tag = null;
      if (tc === 0x0) tag = { kind: 'anonymous' };
      else if (tc >= 0x1 && tc <= 0x3) {
        var tl = (tc === 0x1) ? 1 : (tc === 0x2 ? 2 : 4);
        var tv = 0; for (var t = 0; t < tl; t++) tv += (b[i + t] | 0) * Math.pow(2, 8 * t); i += tl;
        tag = { kind: 'context', num: tv };
      } else { tag = { kind: 'profile', control: tc }; }   // Common/Implicit/Fully-Qualified 暂记 control
      var elem = { tag: tag };
      if (et === 0x00) elem.type = 'null';
      else if (et === 0x01) { elem.type = 'bool'; elem.value = false; }
      else if (et === 0x02) { elem.type = 'bool'; elem.value = true; }
      else if (et >= 0x03 && et <= 0x06) { var bl = 1 << (et - 0x03); elem.type = 'uint'; elem.value = rdLE(bl); }
      else if (et >= 0x07 && et <= 0x0a) {
        var sbl = 1 << (et - 0x07); var sv = rdLE(sbl);
        if (sv & (1 << (8 * sbl - 1))) sv -= (1 << (8 * sbl)); elem.type = 'int'; elem.value = sv;
      }
      else if (et === 0x0b) { elem.type = 'float'; elem.value = rdLE(4); }   // 单精（仅取原始位，未转 float32）
      else if (et === 0x0c) { elem.type = 'double'; elem.value = rdLE(8); }
      else if (et === 0x0d) { var l1 = rd(); var s1 = ''; for (var p = 0; p < l1; p++) s1 += String.fromCharCode(b[i + p]); i += l1; elem.type = 'utf8'; elem.value = s1; }
      else if (et === 0x0e) { var l2 = rdLE(2); var s2 = ''; for (var q = 0; q < l2; q++) s2 += String.fromCharCode(b[i + q]); i += l2; elem.type = 'utf8'; elem.value = s2; }
      else if (et === 0x18) { elem.type = 'end'; }   // 结构结束标记（仅标注，不深解容器）
      else { elem.type = 'unsupported'; elem.elementType = et; }
      out.push(elem);
      if (elem.type === 'end') break;
    }
    return out;
  }

  // ZCL 命令帧解码（Zigbee / Matter 交互层；FrameControl 1B + Seq 1B + Cmd 1B + Payload）
  function decodeZclFrame(buf) {
    var b = (typeof buf === 'string') ? hexToBuf(buf) : buf;
    if (!b || b.length < 3) throw new Error('decodeZclFrame: 帧至少 3 字节');
    var fcr = b[0];
    return {
      frameType: (fcr & 0x03) === 0x01 ? 'cluster-specific' : 'global',
      manufacturerSpecific: !!(fcr & 0x04),
      direction: (fcr & 0x08) ? 'server→client' : 'client→server',
      disableDefaultResponse: !!(fcr & 0x10),
      seq: b[1],
      command: b[2],
      payload: Array.prototype.slice.call(b, 3)
    };
  }

  // Matter / Zigbee 标准导入（簇/属性名 → 规范槽；用户可显式给 slot，否则按 ZCL_SLOT 翻译）
  function importMatterZcl(kind, data) {
    var nameMap = {}, rows;
    if (data && data.clusters) rows = data.clusters;
    else if (Array.isArray(data)) rows = data;
    else rows = Object.keys(data || {}).map(function (k) {
      var v = data[k]; return (typeof v === 'string') ? { name: k, slot: v } : Object.assign({ name: k }, v);
    });
    rows.forEach(function (r) {
      var name = (r.name != null) ? String(r.name) : (r.id != null ? String(r.id) : null);
      if (!name) return;
      var slot = r.slot || ZCL_SLOT[name] || (ZCL_SLOT[zclClusterName(name)] || null);
      if (slot) nameMap[name] = slot;
    });
    return { nameMap: nameMap, writeMap: {}, note: '已导入 ' + (kind === 'zigbee' ? 'Zigbee' : 'Matter') + ' ZCL 簇映射（' + Object.keys(nameMap).length + ' 个→规范槽）' };
  }

  // ── 标准文件导入（核心：显式 nameMap，零歧义）──────────────────────
  // 返回 { nameMap:{raw->slot}, writeMap:{slot->addr|topic}, note }
  function importStandard(kind, data) {
    kind = String(kind || '').toLowerCase();
    var nameMap = {}, writeMap = {}, note = '';
    if (kind === 'point-table' || kind === 'modbus-point') {
      // data: { "40001": {slot:"x", scale:0.01}, ... } 或 [{addr, slot, scale}]
      var rows = Array.isArray(data) ? data : Object.keys(data || {}).map(function (a) {
        return Object.assign({ addr: a }, data[a]);
      });
      rows.forEach(function (r) {
        if (!r.slot) return;
        var key = String(r.addr);
        nameMap[key] = r.slot;
        if (r.addr != null) {
          var a = parseInt(String(r.addr).replace(/\D/g, ''), 10);
          if (a >= 40001) a -= 40001; else if (a >= 30001) a -= 30001;  // 4xxxx/3xxxx → 0 基寄存器地址
          writeMap[r.slot] = { kind: 'modbus', addr: a, scale: (r.scale != null ? r.scale : 1) };
        }
      });
      note = '已导入 Modbus 点表（' + Object.keys(nameMap).length + ' 个寄存器→规范槽）';
    } else if (kind === 'companion' || kind === 'opc-ua' || kind === 'companion-spec') {
      // data: { nodes:[{browseName, dataType, semanticSlot}] }
      (data.nodes || []).forEach(function (nd) {
        if (nd.semanticSlot) nameMap[nd.browseName] = nd.semanticSlot;
      });
      note = '已导入 OPC-UA Companion Spec 节点（' + Object.keys(nameMap).length + ' 个语义槽）';
    } else if (kind === 'aas' || kind === 'admin-shell') {
      // data: { submodels:[{idShort, elements:[{idShort, semanticId}]}] }
      // semanticId → 规范槽（用 library 各卡 hints 反查；找不到则保留 idShort）
      var slotHints = collectSlotHints();
      (data.submodels || []).forEach(function (sm) {
        (sm.elements || []).forEach(function (el) {
          var slot = slotFromSemantic(el.semanticId, slotHints) || slotFromName(el.idShort, slotHints);
          if (slot) nameMap[el.idShort] = slot;
        });
      });
      note = '已导入 AAS 子模型元素（' + Object.keys(nameMap).length + ' 个语义槽）';
    } else if (kind === 'mtconnect') {
      // data: { devices:[{id, dataItems:[{id, type}]}] }  type → 规范槽
      var slotHints2 = collectSlotHints();
      (data.devices || []).forEach(function (dv) {
        (dv.dataItems || []).forEach(function (di) {
          var slot = slotFromName(di.type, slotHints2);
          if (slot) nameMap[di.id] = slot;
        });
      });
      note = '已导入 MTConnect 数据项（' + Object.keys(nameMap).length + ' 个语义槽）';
    } else if (kind === 'dl645' || kind === 'dlt645') {
      // data: { "02010100": {slot:'voltage', scale:0.1}, ... }  DI(小端 hex) → 规范槽
      var rows6 = Array.isArray(data) ? data : Object.keys(data || {}).map(function (a) { return Object.assign({ di: a }, data[a]); });
      rows6.forEach(function (r) { if (r.slot) nameMap[String(r.di).toLowerCase()] = r.slot; });
      note = '已导入 DL/T 645 数据标识映射（' + Object.keys(nameMap).length + ' 个 DI→规范槽）';
    } else if (kind === 'cjt188') {
      // data: { "volume": {slot:'volume'}, "meter_no": {slot:'meter_no'} }  字段名 → 规范槽
      Object.keys(data || {}).forEach(function (f) { if (data[f] && data[f].slot) nameMap[f] = data[f].slot; });
      note = '已导入 CJ/T 188 字段映射（' + Object.keys(nameMap).length + ' 个字段→规范槽）';
    } else if (kind === 'ecode') {
      // data: { code: 'Ecode字符串', nsi: '...' } → 登记为标识对象（不翻译语义，仅标识）
      if (data && data.code) nameMap['ecode'] = 'entity_id';
      note = '已登记 Ecode 物联网标识对象（GB/T 31866）' + (data && data.code ? '：' + data.code : '');
    } else if (kind === 'profidrive') {
      // data: { telegram:1, pzdMap:{ setpoint:'speed', actual:'actual_speed', statusWord:'status' } }
      //   或直接 { 'speed':'speed', 'actual_speed':'actual_speed' }（字段名→规范槽）
      var pd = (data && data.pzdMap) || data;
      Object.keys(pd || {}).forEach(function (k) { if (pd[k]) nameMap[k] = pd[k]; });
      note = '已导入 PROFIdrive 报文映射（' + Object.keys(nameMap).length + ' 个 PZD→规范槽）';
    } else if (kind === 'cia402') {
      // data: { 'target_velocity':'speed', 'velocity_actual':'actual_speed', 'statusword':'status' }
      Object.keys(data || {}).forEach(function (k) { if (data[k]) nameMap[k] = data[k]; });
      note = '已导入 CiA 402 对象字典映射（' + Object.keys(nameMap).length + ' 个对象→规范槽）';
    } else if (kind === 'iolink') {
      // data: { processData:{ 'temp':'temperature', 'press':'pressure' }, isdu:{...} }
      //   或简写 { 'temp':'temperature', 'press':'pressure' }
      var io = (data && data.processData) || data;
      Object.keys(io || {}).forEach(function (k) { if (io[k]) nameMap[k] = io[k]; });
      note = '已导入 IO-Link 设备描述(IODD)过程数据映射（' + Object.keys(nameMap).length + ' 个通道→规范槽）';
    } else if (kind === 'pa-dim') {
      // data: { nodes:[{browseName, semanticSlot}] } 或 { 'Temperature':'temperature', 'Pressure':'pressure' }
      if (data && data.nodes) {
        (data.nodes || []).forEach(function (nd) { if (nd.semanticSlot) nameMap[nd.browseName] = nd.semanticSlot; });
      } else {
        Object.keys(data || {}).forEach(function (k) { if (data[k]) nameMap[k] = data[k]; });
      }
      note = '已导入 PA-DIM 过程设备信息模型映射（' + Object.keys(nameMap).length + ' 个语义→规范槽）';
    } else if (kind === 'matter' || kind === 'zigbee') {
      var mz = importMatterZcl(kind, data);
      nameMap = mz.nameMap; writeMap = mz.writeMap; note = mz.note;
    } else {
      throw new Error('importStandard: 不支持的 kind=' + kind);
    }
    return { nameMap: nameMap, writeMap: writeMap, note: note };
  }

  // 收集所有规范卡 hints → {slot: [hints...]}（供 AAS/MTConnect 语义反查）
  function collectSlotHints() {
    var m = {};
    (LIB.CANONICAL_MODELS || []).forEach(function (card) {
      var slots = (card.stateSpace && card.stateSpace.slots) || {};
      Object.keys(slots).forEach(function (k) {
        m[k] = (m[k] || []).concat(slots[k].hints || []);
      });
    });
    return m;
  }
  function slotFromSemantic(semId, slotHints) {
    if (!semId) return null;
    var s = String(semId).toLowerCase();
    for (var slot in slotHints) { if (s.indexOf(slot.toLowerCase()) >= 0) return slot; }
    return null;
  }
  function slotFromName(name, slotHints) {
    if (!name) return null;
    for (var slot in slotHints) { if (matchName(name, slotHints[slot])) return slot; }
    return null;
  }

  // 锚定：{ "40001":"x" } → nameMap + 简单 writeMap（addr=数字部分）
  function anchorToMap(anchor) {
    var nm = {}, wm = {};
    Object.keys(anchor || {}).forEach(function (raw) {
      var slot = anchor[raw];
      nm[raw] = slot;
      var addr = parseInt(String(raw).replace(/\D/g, ''), 10);
      if (!isNaN(addr)) { if (addr >= 40001) addr -= 40001; else if (addr >= 30001) addr -= 30001; wm[slot] = { kind: 'modbus', addr: addr, scale: 1 }; }
    });
    return { nameMap: nm, writeMap: wm };
  }

  // ── 探测 + 摄入（用 link-layer 真实驱动）──────────────────────────
  function detect(url) { return LL.classifyLink(url); }

  function ingest(link, opts) {
    opts = opts || {};
    if (link.protocol === 'ws') return ingestWs(link, opts);
    if (link.protocol === 'modbus-tcp') return ingestModbus(link, opts);
    if (link.protocol === 'mqtt') return ingestMqtt(link, opts);
    return Promise.reject(new Error('ingest: 协议 ' + link.protocol + ' 真实驱动待补'));
  }

  function ingestWs(link, opts) {
    return new Promise(function (resolve, reject) {
      var WS = (typeof WebSocket !== 'undefined') ? WebSocket : (root && root.WebSocket);
      if (!WS) return reject(new Error('WebSocket 不可用（浏览器直连；Node 需桥）'));
      var ws; try { ws = new WS(link.url); } catch (e) { return reject(e); }
      var got = false;
      var to = setTimeout(function () { try { ws.close(); } catch (e) {} if (!got) reject(new Error('ws ingest timeout')); }, opts.timeout || 4000);
      ws.onopen = function () { ws.send(JSON.stringify({ type: 'hello', id: 'eng', proto: '1.0' })); };
      ws.onmessage = function (ev) {
        var m = safeParse(ev.data); if (!m) return;
        if (m.type === 'hello-ack') { ws.send(JSON.stringify({ type: 'reset' })); return; }
        if (m.type === 'state' || m.type === 'observation') {
          got = true; clearTimeout(to);
          var st = (m.state && typeof m.state === 'object') ? m.state : {};
          var variables = {};
          Object.keys(st).forEach(function (k) { variables[k] = typeof st[k]; });
          resolve({ variables: variables, actions: opts.actions || [], sample: st, client: ws, kind: 'ws' });
        }
      };
      ws.onerror = function (e) { clearTimeout(to); reject(e || new Error('ws error')); };
    });
  }

  function ingestModbus(link, opts) {
    var c = new LL.ModbusTcpClient({ host: link.host, port: link.port, unit: (opts.unit != null ? opts.unit : 1), timeoutMs: opts.timeout || 4000 });
    return c.connect().then(function () {
      return c.readHoldingRegisters(0, opts.regs || 16);
    }).then(function (regs) {
      var variables = {};
      regs.forEach(function (v, i) { variables[String(40001 + i)] = 'number'; });  // 以 Modbus 保持寄存器地址命名
      var quality = new LL.LinkQuality({ timeoutMs: opts.timeout || 5000 });
      quality.markSeen();
      return { variables: variables, actions: opts.actions || [], sample: { regs: regs }, client: c, kind: 'modbus', quality: quality };
    });
  }

  function ingestMqtt(link, opts) {
    var id = ++mqttSid;
    var c = new LL.MqttClient({ host: link.host, port: link.port, clientId: 'lingnao-eng-' + id });
    var stateTopic = opts.stateTopic || 'plant/' + (opts.deviceId || 'device') + '/state';
    var cmdTopic = opts.cmdTopic || 'plant/' + (opts.deviceId || 'device') + '/cmd';
    var sess = { sample: null, quality: new LL.LinkQuality({ timeoutMs: opts.timeout || 5000 }) };
    return c.connect().then(function () {
      c.on('message', function (t, p) {
        if (t === stateTopic) {
          try { sess.sample = JSON.parse(p.toString()); } catch (e) { sess.sample = { raw: p.toString() }; }
          sess.quality.markSeen();
        }
      });
      return c.subscribe(stateTopic);
    }).then(function () {
      var waited = new Promise(function (res) {
        var to = setTimeout(function () { res(false); }, opts.wait || 2500);
        var iv = setInterval(function () { if (sess.sample) { clearTimeout(to); clearInterval(iv); res(true); } }, 100);
      });
      return waited;
    }).then(function (waited) {
      var sample = sess.sample || {};
      var variables = {};
      Object.keys(sample).forEach(function (k) { if (k !== 'raw') variables[k] = typeof sample[k]; });
      return { variables: variables, actions: opts.actions || [], sample: sample, client: c, kind: 'mqtt', stateTopic: stateTopic, cmdTopic: cmdTopic, quality: sess.quality, waited: waited };
    });
  }
  var mqttSid = 0;

  function safeParse(x) { try { return typeof x === 'string' ? JSON.parse(x) : JSON.parse(String(x)); } catch (e) { return null; } }

  // ── 翻译壳（适配器）：灵脑 ↔ 设备 的语义翻译层 ───────────────────
  function makeAdapter(ctx) {
    var link = ctx.link, ing = ctx.ing, cls = ctx.cls, card = ctx.card, nameMap = ctx.nameMap || {}, writeMap = ctx.writeMap || {};
    var quality = ing.quality || new LL.LinkQuality({ timeoutMs: 5000 });
    if (ing.sample) quality.markSeen();

    // 物理包络标定 φ（复用"从观测学"哲学：min/max/rate per 规范槽）
    var calibration = { slots: {}, samples: 0 };
    function calibrate(sample) {
      if (!sample) return calibration;
      calibration.samples++;
      Object.keys(nameMap).forEach(function (raw) {
        var slot = nameMap[raw];
        var v = (sample[raw] != null) ? sample[raw] : (sample[slot] != null ? sample[slot] : null);
        if (typeof v !== 'number') return;
        var s = calibration.slots[slot] || { min: v, max: v, last: v, n: 0 };
        s.min = Math.min(s.min, v); s.max = Math.max(s.max, v);
        s.rate = (s.n > 0) ? Math.abs(v - s.last) : 0; s.last = v; s.n++;
        calibration.slots[slot] = s;
      });
      return calibration;
    }
    calibrate(ing.sample);

    function toCanonical(rawState) {
      var out = {};
      Object.keys(nameMap).forEach(function (raw) {
        var slot = nameMap[raw];
        var v = (rawState && rawState[raw] != null) ? rawState[raw] : (rawState && rawState[slot] != null ? rawState[slot] : null);
        if (v == null) return;
        var wm = writeMap[slot];
        out[slot] = (wm && wm.scale && wm.scale !== 1) ? v * wm.scale : v;
      });
      return out;
    }

    // 规范命令 → 设备写（透明翻译；缺 writeMap 时诚实报缺）
    function send(cmd) {
      var slot = cmd && cmd.slot;
      var wm = slot ? writeMap[slot] : null;
      if (link.protocol === 'mqtt' && ing.client) {
        var payload = {}; payload[slot || 'cmd'] = cmd.value;
        return ing.client.publish(ing.cmdTopic, Buffer.from(JSON.stringify(payload))).then(function () {
          return { ok: true, kind: 'mqtt', topic: ing.cmdTopic, payload: payload };
        });
      }
      if (link.protocol === 'ws' && ing.client) {
        ing.client.send(JSON.stringify({ type: 'command', cap: cmd.cap || slot, params: cmd.params || { [slot]: cmd.value } }));
        return Promise.resolve({ ok: true, kind: 'ws', sent: { cap: cmd.cap || slot } });
      }
      if (link.protocol === 'modbus-tcp' && ing.client) {
        if (!wm || wm.kind !== 'modbus') return Promise.resolve({ ok: false, kind: 'modbus', note: '缺写寄存器映射（请导入点表/锚定提供 ' + slot + ' 的寄存器地址）' });
        var raw = (cmd.value != null && wm.scale && wm.scale !== 1) ? Math.round(cmd.value / wm.scale) : (cmd.value || 0);
        return ing.client.writeSingleRegister(wm.addr, raw).then(function () {
          return { ok: true, kind: 'modbus', wrote: { addr: wm.addr, value: raw } };
        });
      }
      return Promise.resolve({ ok: false, note: '该协议不可驱动发送' });
    }

    return {
      class: cls.best.id, label: cls.best.label, group: cls.best.group,
      protocol: link.protocol, mediumHint: link.mediumHint,
      confidence: cls.confidence,
      nameMap: nameMap, writeMap: writeMap,
      toCanonical: toCanonical, send: send, calibrate: calibrate,
      quality: quality,
      close: function () { if (ing.client && ing.client.close) try { ing.client.close(); } catch (e) {} }
    };
  }

  // ── 统一入口 ────────────────────────────────────────────────────
  async function connect(opts) {
    opts = opts || {};
    var link = opts.link || detect(opts.url || '');
    if (!link.protocol) return { ok: false, error: '无法从地址识别协议', needsProtocol: true };

    // ① 标准文件优先
    var stdNameMap = null, stdWriteMap = {};
    if (opts.standardFile) {
      var r = importStandard(opts.standardFile.kind, opts.standardFile.data);
      stdNameMap = r.nameMap; stdWriteMap = r.writeMap || {};
    }

    // ② 摄入原始信息模型
    var ing;
    try { ing = await ingest(link, opts); }
    catch (e) { return { ok: false, detected: link, error: '摄入失败: ' + e.message, needsDriver: true }; }

    // ③ 识类（先套标准 nameMap/锚定；再看模糊匹配）
    var observed = { protocol: link.protocol, variables: canonicalizeVariables(ing.variables, stdNameMap), actions: ing.actions || [] };
    var cls = LIB.classify(observed, {});

    var finalNameMap = stdNameMap || {};
    var finalWriteMap = stdWriteMap;

    if (!cls.matched && opts.anchor) {
      var am = anchorToMap(opts.anchor);
      finalNameMap = Object.assign({}, stdNameMap || {}, am.nameMap);
      finalWriteMap = Object.assign({}, stdWriteMap || {}, am.writeMap);
      observed = { protocol: link.protocol, variables: canonicalizeVariables(ing.variables, finalNameMap), actions: ing.actions || [] };
      cls = LIB.classify(observed, {});
    }

    if (!cls.matched) {
      return {
        ok: false, detected: link, ingested: { variables: ing.variables, sample: ing.sample },
        classification: cls, needsAnchor: true,
        note: '驱动已连通并读到原始变量，但缺标准语义/锚定→识别不了；请导入厂家标准文件或锚定 1 语义槽（如 {"40001":"x"}）'
      };
    }

    // 模糊补 nameMap（标准/锚定没覆盖到的裸变量，靠拓扑结构提示补）
    var card = LIB.CANONICAL_MODELS.find(function (c) { return c.id === cls.best.id; }) || null;
    var fuzzy = buildNameMap(ing.variables, card);
    finalNameMap = Object.assign({}, finalNameMap, fuzzy);

    var adapter = makeAdapter({ link: link, ing: ing, cls: cls, card: card, nameMap: finalNameMap, writeMap: finalWriteMap });
    return { ok: true, adapter: adapter, detected: link, classification: cls,
      note: stdNameMap ? '经标准文件导入（零歧义）' : (opts.anchor ? '经锚定 1 语义槽' : '经拓扑结构模糊识别（尽力而为）') };
  }

  var api = {
    connect: connect,
    detect: detect,
    ingest: ingest,
    importStandard: importStandard,
    buildNameMap: buildNameMap,
    canonicalizeVariables: canonicalizeVariables,
    matchName: matchName,
    decodeDL645: decodeDL645,
    decodeCJT188: decodeCJT188,
    decodeCia402Status: decodeCia402Status,
    encodeCia402Control: encodeCia402Control,
    decodeProfidriveStatus: decodeProfidriveStatus,
    decodeProfidrive: decodeProfidrive,
    decodeIOLinkPD: decodeIOLinkPD,
    decodeMatterTLV: decodeMatterTLV,
    decodeZclFrame: decodeZclFrame,
    matterClusterName: matterClusterName,
    zigbeeClusterName: zclClusterName
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LingNaoAccessEngine = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));

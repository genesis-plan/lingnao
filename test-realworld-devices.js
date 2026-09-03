/*
 * 现实世界常见设备接入测试：电子元件 / 机械 / 机器 / 无人器
 * ─────────────────────────────────────────────────────────
 * 真实地经协议驱动连"设备"并自动识类，验证灵脑接入模块"主动适应厂家协议 + 自动识类"：
 *   · 电子元件 / 机械（Modbus-TCP 多为有线）：内嵌仿真 PLC，寄存器值由厂家寄存器映射
 *     还原成语义变量（现实中厂家提供 Modbus 点表 → 一次性映射，非写适配器）。
 *   · 无人器（MQTT 多为无线）：内嵌仿真 broker，发布 JSON 遥测（带语义字段名）。
 *   · 机械 / 机器（OPC-UA / ROS，标准语义模型）：直接对其标准信息模型结构识类。
 *   · AGV：连真实仿真身体（ws，无线/有线皆可）。
 *   · 边界：裸寄存器无点表私有 PLC → 诚实"识别不了"，走另分析。
 * 不依赖真实硬件；内嵌仿真 PLC / broker 均 net 零依赖。
 */
const net = require('net');
const LIB = require('./lingnao-body-library.js');
const LL = require('./lingnao-link-layer.js');

let pass = 0, fail = 0, rows = [];
function ok(name, cond, got) { (cond ? pass++ : fail++); rows.push((cond ? '  ✓ ' : '  ✗ ') + name + (got ? '  → ' + got : '')); }
function typ(v) { return v === true || v === false ? 'boolean' : (typeof v); }

// ── 内嵌仿真 Modbus PLC：按给定寄存器数组服务（读保持寄存器）──
function startFakePlc(regs, port) {
  const srv = net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 7) {
        const len = buf.readUInt16BE(4), total = 6 + len;
        if (buf.length < total) break;
        const mbap = buf.slice(0, 7), pdu = buf.slice(7, total);
        buf = buf.slice(total);
        const tid = mbap.readUInt16BE(0), unit = mbap[6], fc = pdu[0];
        let resp;
        if (fc === 0x03) {
          const addr = pdu.readUInt16BE(1), qty = pdu.readUInt16BE(3);
          const body = Buffer.alloc(1 + qty * 2); body[0] = qty * 2;
          for (let i = 0; i < qty; i++) body.writeUInt16BE(regs[addr + i] | 0, 1 + i * 2);
          resp = Buffer.concat([Buffer.from([0x03]), body]);
        } else { resp = Buffer.from([fc | 0x80, 0x01]); }
        const out = Buffer.alloc(7); out.writeUInt16BE(tid, 0); out.writeUInt16BE(0, 2); out.writeUInt16BE(resp.length + 1, 4); out.writeUInt8(unit, 6);
        sock.write(Buffer.concat([out, resp]));
      }
    });
  });
  return new Promise((res) => srv.listen(port, () => res(srv)));
}

// ── 内嵌仿真 MQTT broker（connect/subscribe/publish 环回）──
function startFakeBroker(port) {
  const clients = new Map();
  const srv = net.createServer((sock) => {
    let buf = Buffer.alloc(0); clients.set(sock, new Set());
    const send = (fixed, body) => sock.write(Buffer.concat([Buffer.from([fixed]), mqttLen(body.length), body]));
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      let p;
      while ((p = parseFrame(buf))) {
        buf = buf.slice(p.total); const t = p.fixed >> 4;
        if (t === 1) send(0x20, Buffer.from([0x00, 0x00]));
        else if (t === 8) { const pid = p.payload.readUInt16BE(0); const tl = p.payload.readUInt16BE(2); const topic = p.payload.slice(4, 4 + tl).toString('utf8'); clients.get(sock).add(topic); send(0x90, Buffer.concat([u16(pid), Buffer.from([0x00])])); }
        else if (t === 3) { const tl = p.payload.readUInt16BE(0); const topic = p.payload.slice(2, 2 + tl).toString('utf8'); const data = p.payload.slice(2 + tl); clients.forEach((topics, cs) => { if (topics.has(topic)) { const b = Buffer.concat([u16(topic.length), Buffer.from(topic), data]); cs.write(Buffer.concat([Buffer.from([0x30]), mqttLen(b.length), b])); } }); }
      }
    });
    sock.on('close', () => clients.delete(sock));
  });
  function mqttLen(n) { const a = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; a.push(b); } while (n > 0); return Buffer.from(a); }
  function u16(n) { const x = Buffer.alloc(2); x.writeUInt16BE(n, 0); return x; }
  function parseFrame(buf) { if (buf.length < 2) return null; const fixed = buf[0]; let mul = 1, val = 0, i = 1, b; do { if (i >= buf.length) return null; b = buf[i++]; val += (b & 127) * mul; mul *= 128; } while (b & 128); if (buf.length < i + val) return null; return { fixed, payload: buf.slice(i, i + val), total: i + val }; }
  return new Promise((res) => srv.listen(port, () => res(srv)));
}

// 设备清单（现实世界常见，按用户四类）
// regMap: 厂家 Modbus 点表（寄存器号 → 语义名）；vals 对应值
const DEVICES = [
  { cat: '电子元件', name: '工业温湿度传感器', via: 'Modbus-TCP(有线)', regMap: { 0: 'temp', 1: 'humi', 2: 'pressure', 3: 'status' }, vals: [254, 60, 1013, 0], expect: 'sensor.iot' },
  { cat: '电子元件', name: 'PLC 远程 I/O', via: 'Modbus-TCP(有线)', regMap: { 0: 'di', 1: 'do', 2: 'ai', 3: 'ao' }, vals: [1, 0, 512, 256], expect: 'plc' },
  { cat: '机械', name: '输送线', via: 'Modbus-TCP(有线)', regMap: { 0: 'speed', 1: 'running', 2: 'fault' }, vals: [120, 1, 0], expect: 'machine.conveyor' },
  { cat: '机械', name: '包装机 PackML', via: 'OPC-UA(标准语义)', vars: { state: 'string', cmd: 'string', count: 'number' }, actions: ['start', 'stop', 'reset'], expect: 'machine.packml' },
  { cat: '机械', name: '数控机床 CNC', via: 'OPC-UA / MTConnect', vars: { x: 'number', y: 'number', z: 'number', spindle: 'number', feed: 'number', mode: 'string' }, actions: ['gcode_run', 'jog'], expect: 'machine.cnc' },
  { cat: '机器', name: '六轴机械臂', via: 'OPC-UA Robotics', vars: { j1: 'number', j2: 'number', j3: 'number', j4: 'number', j5: 'number', j6: 'number' }, actions: ['move_joint', 'move_cart'], expect: 'arm.6dof' },
  { cat: '机器', name: 'SCARA 臂', via: 'OPC-UA Robotics', vars: { theta1: 'number', theta2: 'number', z: 'number' }, actions: ['move_joint'], expect: 'arm.scara' },
  // ── 国内通用标准（用户要求"把国内标准用到这里"）──
  { cat: '电子元件', name: '智能电表(DL/T 645 点表)', via: 'Modbus-TCP(有线)', regMap: { 0: 'voltage', 1: 'current', 2: 'energy' }, vals: [220, 5, 1234], expect: 'meter.electric' },
  { cat: '机器', name: '充电桩(GB/T 27930)', via: 'CAN(国标)', vars: { charge_voltage: 'number', charge_current: 'number', bms_soc: 'number' }, actions: ['start_charge', 'stop_charge'], expect: 'ev.charger' },
  { cat: '无人器', name: 'AMR 自主移动机器人', via: 'MQTT(无线)', topic: 'plant/amr1/state', payload: { pose_x: 1.2, pose_y: 3.4, theta: 0.5, battery: 88 }, actions: ['navTo'], expect: 'agv.planar.se2' },
  { cat: '无人器', name: '多旋翼无人机', via: 'MQTT(无线)', topic: 'uav/d1/tele', payload: { lat: 23.1, lon: 113.2, alt: 50, battery: 76, armed: 1 }, actions: ['takeoff', 'land', 'goto'], expect: 'uav.multirotor' },
  { cat: '无人器', name: 'AGV 仿真身体', via: 'ws', expect: 'agv.planar.se2' },
  // 诚实边界
  { cat: '边界', name: '裸寄存器无点表私有 PLC', via: 'Modbus-TCP(有线)', bare: true, expect: null }
];

function buildVarsFromRegs(regMap, regs) {
  const v = {};
  Object.keys(regMap).forEach((idx) => { v[regMap[idx]] = typ(regs[idx | 0]); });
  return v;
}

(async () => {
  console.log('== 现实世界常见设备 · 灵脑接入模块实测 ==\n');

  // 共享仿真 broker（无线）
  const brk = await startFakeBroker(1884);

  let modbusPort = 1602;
  for (const dev of DEVICES) {
    if (dev.bare) {
      // 边界：无点表，原始寄存器名 → 诚实识别不了
      const srv = await startFakePlc([10, 20, 30, 40, 50], modbusPort++);
      const c = new LL.ModbusTcpClient({ host: '127.0.0.1', port: srv.address().port, unit: 1 });
      await c.connect();
      const regs = await c.readHoldingRegisters(0, 5);
      const rawVars = {}; regs.forEach((val, i) => rawVars['reg' + i] = 'number');
      c.close(); srv.close();
      const r = LIB.classify({ protocol: 'modbus-tcp', variables: rawVars, actions: [] }, {});
      ok('[' + dev.cat + '] ' + dev.name + '（' + dev.via + '）驱动连通 + 识类', !r.matched && r.needsAnchor, 'needsAnchor=诚实另分析');
      continue;
    }

    if (dev.regMap) {
      // 电子元件 / 机械：Modbus 有线，厂家点表还原语义变量
      const regs = new Array(64).fill(0);
      Object.keys(dev.regMap).forEach((idx) => { regs[idx | 0] = dev.vals[Object.keys(dev.regMap).indexOf(idx)]; });
      const srv = await startFakePlc(regs, modbusPort);
      const c = new LL.ModbusTcpClient({ host: '127.0.0.1', port: modbusPort, unit: 1 });
      await c.connect();
      const read = await c.readHoldingRegisters(0, Math.max.apply(null, Object.keys(dev.regMap).map((i) => i | 0)) + 1);
      c.close(); srv.close(); modbusPort++;
      const vars = buildVarsFromRegs(dev.regMap, read);
      const r = LIB.classify({ protocol: 'modbus-tcp', variables: vars, actions: dev.actions || [] }, {});
      const good = r.matched && r.best.id === dev.expect;
      ok('[' + dev.cat + '] ' + dev.name + '（' + dev.via + '）驱动连通 + 自动识类', good,
        (good ? r.best.label + ' conf=' + r.confidence : 'got ' + (r.best && r.best.id)));
      continue;
    }

    if (dev.topic) {
      // 无人器：MQTT 无线，发布 JSON 遥测 → 订阅端自动识类
      const c = new LL.MqttClient({ host: '127.0.0.1', port: 1884, clientId: 'ln-rw-' + dev.name });
      await c.connect();
      await c.subscribe(dev.topic);
      const got = await new Promise((resolve) => {
        c.on('message', (topic, payload) => { if (topic === dev.topic) resolve(JSON.parse(payload.toString())); });
        c.publish(dev.topic, Buffer.from(JSON.stringify(dev.payload)));
        setTimeout(() => resolve(null), 300);
      });
      c.close();
      if (!got) { ok('[' + dev.cat + '] ' + dev.name + '（' + dev.via + '）遥测接收', false, 'broker 无回传'); continue; }
      const vars = {}; Object.keys(got).forEach((k) => vars[k] = typ(got[k]));
      const r = LIB.classify({ protocol: 'mqtt', variables: vars, actions: dev.actions || [] }, {});
      const good = r.matched && r.best.id === dev.expect;
      ok('[' + dev.cat + '] ' + dev.name + '（' + dev.via + '）遥测接入 + 自动识类', good,
        (good ? r.best.label + ' conf=' + r.confidence : 'got ' + (r.best && r.best.id)));
      continue;
    }

    if (dev.vars) {
      // 机械 / 机器：OPC-UA / ROS 标准语义模型，直接识类（真实驱动待补，结构已标准）
      const r = LIB.classify({ protocol: 'opc-ua', variables: dev.vars, actions: dev.actions || [] }, {});
      const good = r.matched && r.best.id === dev.expect;
      ok('[' + dev.cat + '] ' + dev.name + '（' + dev.via + '）自动识类', good,
        (good ? r.best.label + ' conf=' + r.confidence : 'got ' + (r.best && r.best.id)));
      continue;
    }

    if (dev.via === 'ws') {
      // AGV 仿真身体（ws，无线/有线皆可）
      try {
        const obs = await LIB.discoverWs('ws://localhost:8787', { timeout: 5000, actions: [] });
        const r = LIB.classify({ protocol: 'ws', variables: obs.variables, actions: [] }, {});
        const good = r.matched && r.best.id === dev.expect;
        ok('[' + dev.cat + '] ' + dev.name + '（' + dev.via + '）自动识类', good,
          (good ? r.best.label + ' conf=' + r.confidence : 'got ' + (r.best && r.best.id)));
      } catch (e) { ok('[' + dev.cat + '] ' + dev.name + '（ws）', false, e.message + '（先起 sim server？）'); }
      continue;
    }
  }

  brk.close();
  console.log('\n' + rows.join('\n'));
  console.log('\n== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ==');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('测试异常:', e); process.exit(1); });

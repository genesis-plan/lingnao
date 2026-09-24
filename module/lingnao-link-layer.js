/*
 * 灵脑 LingNao · 物理接入链路层（无线 + 有线，零依赖 Node 驱动）
 * ────────────────────────────────────────────────────────────
 * 设计目标（用户拍板 2026-09-02）：灵脑接入通道"面对世界上任意机器"，
 * 用【无线】和【有线】两种方式都能把真实机器连上。
 *
 * 关键认识：连真实机器只有两条路——【无线】与【插机器本来的各类接口】。
 *   ① 无线：空中链路（WiFi/4G-5G/LoRa/BLE），协议层跑 MQTT / ws / OPC-UA-over-IP。
 *   ② 插机器接口：每台机器暴露【有限、可枚举】的标配接口（端口/协议），即
 *      lingnao-body-library.js 规范卡上的 interfaces 字段（Modbus/OPC-UA/CANopen/
 *      EtherCAT/ROS/串口…）。这正是用户说的"有限/有线 = 机器的各类接口"。
 *   "有线/无线物理层"只是这些接口的副属性：Modbus 多为有线以太网/串口，但 MQTT
 *   也可走有线以太网。真轴是【无线 vs 机器接口】，不是【无线 vs 有线】。
 *   介质只影响时延/丢包——而时延丢包正喂给已有的【新鲜度/SAFE-STOP】安全逻辑。
 *
 * 本文件实装（可在本机直连真实设备，无需灵脑内核）：
 *   ✅ 有线：ModbusTcpClient（以太网 TCP/502，读/写保持寄存器 + 线圈，零依赖）
 *   ✅ 无线：MqttClient（MQTT 3.1.1 over TCP/1883，connect/subscribe/publish，零依赖）
 *   🟡 介质分类：LINK_MEDIA 目录 + classifyLink(url) 推断协议与介质提示
 *   🟡 链路质量：LinkQuality 测 RTT + 心跳新鲜度 → 接入 SAFE-STOP 的集成点已标注
 *
 * 诚实边界：
 *   ⚠ 浏览器无法直接建裸 TCP（Modbus/MQTT）——这些驱动在 Node 侧跑，浏览器经
 *     Node 桥调用（与 lingnao-console.html ③ 卡的"需 Node 驱动桥"一致）。
 *   ⚠ 仿真 PLC / 仿真 broker 仅用于自测驱动正确性；连真实设备时替换地址即可。
 */
(function (root) {
  'use strict';

  // ── 链路介质目录（无线 / 有线，可枚举）────────────────────────────
  var LINK_MEDIA = {
    'wired': {
      label: '有线',
      items: {
        'ethernet':  { label: '工业以太网', protocols: ['modbus-tcp', 'opc-ua', 'ethercat', 'profinet', 'ethernet-ip'], note: '工厂主干，低时延确定性' },
        'serial-rs485': { label: 'RS-485 串口', protocols: ['modbus-rtu', 'canopen'], note: '现场层，抗干扰，距离远' },
        'serial-rs232': { label: 'RS-232 串口', protocols: ['modbus-rtu'], note: '点对点，短距' },
        'can': { label: 'CAN / CANopen', protocols: ['canopen'], note: '车载/移动机器人总线' },
        'fieldbus': { label: '现场总线', protocols: ['profibus', 'cc-link'], note: '传统过程控制' }
      }
    },
    'wireless': {
      label: '无线',
      items: {
        'wifi':     { label: 'WiFi (802.11)', protocols: ['ws', 'mqtt', 'opc-ua'], note: '厂内柔性部署，常见' },
        'cellular': { label: '4G / 5G 蜂窝', protocols: ['mqtt', 'opc-ua', 'lwm2m'], note: '跨厂区/远程设备，按需心跳' },
        'lora':     { label: 'LoRaWAN', protocols: ['mqtt'], note: '低功耗广域，小包' },
        'ble':      { label: '蓝牙 BLE', protocols: ['gatt'], note: '近场随身设备' },
        'zigbee':   { label: 'Zigbee', protocols: ['zigbee3'], note: '传感网，自组网' }
      }
    }
  };

  // 协议 → 典型介质提示（仅为提示；真实介质由设备所在网络决定，正交）
  var PROTOCOL_MEDIA_HINT = {
    'modbus-tcp': 'wired', 'opc-ua': 'wired', 'modbus-rtu': 'wired',
    'canopen': 'wired', 'profinet': 'wired', 'profibus': 'wired', 'ethercat': 'wired',
    'mqtt': 'wireless', 'lwm2m': 'wireless', 'zigbee3': 'wireless', 'gatt': 'wireless',
    'ws': 'agnostic'  // ws 既可有线以太网也可无线 WiFi，对大脑透明
  };

  function classifyLink(url) {
    var u = String(url || '').trim();
    var protocol, port, mediumHint = 'agnostic', host = u;
    var m = u.match(/^([a-z0-9+\-.]+):\/\/(.+)$/i);
    if (m) {
      var scheme = m[1].toLowerCase();
      host = m[2].replace(/\/.*$/, '').replace(/:.*$/, '');
      if (scheme === 'ws' || scheme === 'wss') protocol = 'ws';
      else if (scheme === 'mqtt' || scheme === 'mqtts') protocol = 'mqtt';
      else if (scheme === 'modbus' || scheme === 'modbus-tcp') protocol = 'modbus-tcp';
      else if (scheme === 'opc.tcp' || scheme === 'opc-ua') protocol = 'opc-ua';
      else if (scheme === 'serial' || scheme === 'modbus-rtu') protocol = 'modbus-rtu';
      else protocol = scheme;
    } else {
      // 无 scheme：按端口推断
      host = u.replace(/:\d+$/, '');   // 剥离端口，host 仅留主机名
      var p = parseInt((u.match(/:(\d+)/) || [])[1], 10);
      if (p === 502) protocol = 'modbus-tcp';
      else if (p === 1883 || p === 8883) protocol = 'mqtt';
      else if (p === 4840) protocol = 'opc-ua';
      else if (p === 8787) protocol = 'ws';
      else protocol = 'unknown';
    }
    var pm = u.match(/:(\d+)/); port = pm ? parseInt(pm[1], 10) : null;
    mediumHint = PROTOCOL_MEDIA_HINT[protocol] || (port === 502 ? 'wired' : port === 1883 ? 'wireless' : 'agnostic');
    return { url: u, protocol: protocol, host: host, port: port, mediumHint: mediumHint };
  }

  // ── 链路质量（RTT + 心跳新鲜度）→ 接入 SAFE-STOP 的集成点 ────────
  // 真实集成：灵脑 attachBody 时把 quality.stale 喂给物理身体能力契约的
  // checkHard(SAFE-STOP)——链路过期即停（"契约即身体"的安全语义）。
  function LinkQuality(opts) {
    opts = opts || {};
    this.rttSamples = [];
    this.lastSeen = 0;
    this.timeoutMs = opts.timeoutMs || 5000;
  }
  LinkQuality.prototype.markRoundTrip = function (ms) {
    this.rttSamples.push(ms);
    if (this.rttSamples.length > 8) this.rttSamples.shift();
  };
  LinkQuality.prototype.markSeen = function () { this.lastSeen = Date.now(); };
  LinkQuality.prototype.rttAvg = function () {
    if (!this.rttSamples.length) return null;
    return Math.round(this.rttSamples.reduce(function (a, b) { return a + b; }, 0) / this.rttSamples.length);
  };
  LinkQuality.prototype.stale = function (now) {
    now = now || Date.now();
    return (now - this.lastSeen) > this.timeoutMs;
  };
  LinkQuality.prototype.report = function () {
    return { rttMs: this.rttAvg(), lastSeen: this.lastSeen, stale: this.stale(), timeoutMs: this.timeoutMs };
  };

  // ── 真实驱动：Modbus-TCP 客户端（有线以太网，零依赖）──────────────
  // 用法：
  //   var c = new ModbusTcpClient({host:'192.168.1.10', port:502, unit:1});
  //   await c.connect();
  //   var regs = await c.readHoldingRegisters(0, 4);   // 读 4 个保持寄存器
  //   await c.writeSingleRegister(0, 1234);
  function ModbusTcpClient(opts) {
    if (!opts || !opts.host) throw new Error('ModbusTcpClient: 缺 host');
    this.host = opts.host;
    this.port = opts.port || 502;
    this.unit = (opts.unit != null) ? opts.unit : 1;
    this.timeoutMs = opts.timeoutMs || 4000;
    this._sock = null;
    this._buf = Buffer.alloc(0);
    this._tid = 0;
    this._pending = null;   // {tid, resolve, reject, expect}
    this._net = requireNet();
  }
  ModbusTcpClient.prototype.connect = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      var sock = self._net.connect({ host: self.host, port: self.port }, function () { resolve(); });
      sock.on('data', function (d) { self._onData(d); });
      sock.on('error', function (e) { if (self._pending) self._pending.reject(e); reject(e); });
      sock.setTimeout(self.timeoutMs, function () { sock.destroy(); });
      self._sock = sock;
    });
  };
  ModbusTcpClient.prototype.close = function () {
    if (this._sock) try { this._sock.end(); } catch (e) {}
  };
  ModbusTcpClient.prototype._request = function (pdu, expectTotal) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!self._sock) return reject(new Error('not connected'));
      var tid = (self._tid = (self._tid + 1) & 0xffff);
      var mbap = Buffer.alloc(7);
      mbap.writeUInt16BE(tid, 0); mbap.writeUInt16BE(0, 2);
      mbap.writeUInt16BE(pdu.length + 1, 4); mbap.writeUInt8(self.unit, 6);
      var t = setTimeout(function () {
        if (self._pending) { self._pending = null; reject(new Error('modbus timeout')); }
      }, self.timeoutMs);
      self._pending = {
        tid: tid, resolve: resolve, reject: reject, expectTotal: expectTotal, timer: t
      };
      self._sock.write(Buffer.concat([mbap, pdu]));
    });
  };
  ModbusTcpClient.prototype._onData = function (d) {
    this._buf = Buffer.concat([this._buf, d]);
    while (this._buf.length >= 7) {
      var len = this._buf.readUInt16BE(4);
      var total = 6 + len;
      if (this._buf.length < total) break;
      var frame = this._buf.slice(0, total);
      this._buf = this._buf.slice(total);
      if (this._pending && frame.readUInt16BE(0) === this._pending.tid) {
        var p = this._pending; this._pending = null; clearTimeout(p.timer);
        var fc = frame[7];
        if (fc & 0x80) { p.reject(new Error('modbus exception ' + (fc & 0x7f))); }
        else p.resolve(frame);
      }
    }
  };
  ModbusTcpClient.prototype.readHoldingRegisters = function (addr, qty) {
    var pdu = Buffer.alloc(5);
    pdu[0] = 0x03; pdu.writeUInt16BE(addr, 1); pdu.writeUInt16BE(qty, 3);
    return this._request(pdu).then(function (frame) {
      var bc = frame[8]; var regs = [];
      for (var i = 0; i < bc; i += 2) regs.push(frame.readUInt16BE(9 + i));
      return regs;
    });
  };
  ModbusTcpClient.prototype.writeSingleRegister = function (addr, val) {
    var pdu = Buffer.alloc(5);
    pdu[0] = 0x06; pdu.writeUInt16BE(addr, 1); pdu.writeUInt16BE(val & 0xffff, 3);
    return this._request(pdu).then(function () { return true; });
  };
  ModbusTcpClient.prototype.writeMultipleRegisters = function (addr, vals) {
    var pdu = Buffer.alloc(5 + 1 + vals.length * 2);
    pdu[0] = 0x10; pdu.writeUInt16BE(addr, 1); pdu.writeUInt16BE(vals.length, 3);
    pdu[5] = vals.length * 2;
    vals.forEach(function (v, i) { pdu.writeUInt16BE(v & 0xffff, 6 + i * 2); });
    return this._request(pdu).then(function () { return true; });
  };
  ModbusTcpClient.prototype.readCoils = function (addr, qty) {
    var pdu = Buffer.alloc(5);
    pdu[0] = 0x01; pdu.writeUInt16BE(addr, 1); pdu.writeUInt16BE(qty, 3);
    return this._request(pdu).then(function (frame) {
      var bc = frame[8]; var bits = [];
      for (var i = 0; i < bc; i++) for (var b = 0; b < 8 && bits.length < qty; b++) bits.push((frame[9 + i] >> b) & 1);
      return bits;
    });
  };
  ModbusTcpClient.prototype.writeCoil = function (addr, val) {
    var pdu = Buffer.alloc(5);
    pdu[0] = 0x05; pdu.writeUInt16BE(addr, 1); pdu.writeUInt16BE(val ? 0xff00 : 0, 3);
    return this._request(pdu).then(function () { return true; });
  };

  // ── 真实驱动：MQTT 3.1.1 客户端（无线 IoT，零依赖 over TCP）──────
  // 用法：
  //   var c = new MqttClient({host:'broker.hivemq.com', port:1883, clientId:'ln1'});
  //   await c.connect();
  //   await c.subscribe('plant/agv1/cmd');
  //   c.on('message', (topic,payload)=>{...});
  //   await c.publish('plant/agv1/state', Buffer.from(JSON.stringify({x:1})));
  function MqttClient(opts) {
    if (!opts || !opts.host) throw new Error('MqttClient: 缺 host');
    this.host = opts.host; this.port = opts.port || 1883;
    this.clientId = opts.clientId || ('lingnao-' + Date.now());
    this.keepalive = opts.keepalive || 60;
    this.timeoutMs = opts.timeoutMs || 5000;
    this._sock = null; this._buf = Buffer.alloc(0);
    this._pid = 0; this._handlers = {}; this._subs = {};
    this._listeners = { message: [] };
    this._net = requireNet();
  }
  MqttClient.prototype.on = function (ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); return this; };
  MqttClient.prototype._emit = function (ev, a, b) { (this._listeners[ev] || []).forEach(function (f) { f(a, b); }); };
  MqttClient.prototype.connect = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      var sock = self._net.connect({ host: self.host, port: self.port }, function () {
        var payload = str(self.clientId);
        var body = Buffer.concat([
          u16(4), Buffer.from('MQTT'), Buffer.from([4, 0x02]), u16(self.keepalive), payload
        ]);
        sock.write(pack(0x10, body));
      });
      sock.on('data', function (d) { self._onData(d, resolve, reject); });
      sock.on('error', function (e) { reject(e); });
      self._sock = sock;
      setTimeout(function () { reject(new Error('mqtt connect timeout')); }, self.timeoutMs);
    });
  };
  MqttClient.prototype._onData = function (d, resolve, reject) {
    var self = this; this._buf = Buffer.concat([this._buf, d]);
    var p;
    while ((p = parseFrame(this._buf))) {
      this._buf = this._buf.slice(p.total);
      var t = p.fixed >> 4;
      if (t === 2) { if (p.payload[1] !== 0) reject(new Error('CONNACK rc=' + p.payload[1])); else resolve(); }
      else if (t === 9) { /* SUBACK */ var pid = p.payload.readUInt16BE(0); if (self._handlers[pid]) { self._handlers[pid](); delete self._handlers[pid]; } }
      else if (t === 3) { // PUBLISH (qos0)
        var tl = p.payload.readUInt16BE(0); var topic = p.payload.slice(2, 2 + tl).toString('utf8');
        var data = p.payload.slice(2 + tl);
        self._emit('message', topic, data);
      }
    }
  };
  MqttClient.prototype.subscribe = function (topic, qos) {
    var self = this; qos = qos || 0;
    return new Promise(function (resolve, reject) {
      var pid = ++self._pid & 0xffff; self._handlers[pid] = resolve;
      var body = Buffer.concat([u16(pid), u16(topic.length), Buffer.from(topic), Buffer.from([qos])]);
      self._sock.write(pack(0x82, body));
      setTimeout(function () { if (self._handlers[pid]) { delete self._handlers[pid]; reject(new Error('subscribe timeout')); } }, self.timeoutMs);
    });
  };
  MqttClient.prototype.publish = function (topic, payload, qos) {
    qos = qos || 0;
    var body = Buffer.concat([u16(topic.length), Buffer.from(topic),
      (qos ? u16(++this._pid & 0xffff) : Buffer.alloc(0)), Buffer.from(payload)]);
    this._sock.write(pack(0x30 | (qos << 1), body));
    return Promise.resolve(true);
  };
  MqttClient.prototype.close = function () { if (this._sock) try { this._sock.end(); } catch (e) {} };

  // ── MQTT 编解码助手（零依赖）─────────────────────────────────────
  function pack(fixed, body) {
    return Buffer.concat([Buffer.from([fixed]), mqttLen(body.length), body]);
  }
  function mqttLen(n) {
    var arr = []; do { var b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; arr.push(b); } while (n > 0);
    return Buffer.from(arr);
  }
  function parseFrame(buf) {
    if (buf.length < 2) return null;
    var fixed = buf[0];
    var mul = 1, val = 0, i = 1, b;
    do { if (i >= buf.length) return null; b = buf[i++]; val += (b & 127) * mul; mul *= 128; } while (b & 128);
    var total = i + val;
    if (buf.length < total) return null;
    return { fixed: fixed, payload: buf.slice(i, total), total: total };
  }
  function u16(n) { var x = Buffer.alloc(2); x.writeUInt16BE(n, 0); return x; }
  function str(s) { var x = Buffer.from(s, 'utf8'); var y = Buffer.alloc(2); y.writeUInt16BE(x.length, 0); return Buffer.concat([y, x]); }

  function requireNet() {
    if (typeof require === 'function') { try { return require('net'); } catch (e) {} }
    throw new Error('link-layer: net 不可用（浏览器需经 Node 桥）');
  }

  var api = {
    LINK_MEDIA: LINK_MEDIA,
    PROTOCOL_MEDIA_HINT: PROTOCOL_MEDIA_HINT,
    classifyLink: classifyLink,
    LinkQuality: LinkQuality,
    ModbusTcpClient: ModbusTcpClient,
    MqttClient: MqttClient
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LingNaoLinkLayer = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));

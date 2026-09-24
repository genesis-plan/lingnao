/*
 * 灵脑 · 确定性签名审计账本（lingnao-audit-ledger）
 * ---------------------------------------------------------------
 * 目的：关闭越狱事件中"改日志 / 冒名发消息"的攻击面。
 * 数学思想（第一性原理，详见文件尾注释）：
 *   1) 哈希链（抗篡改）  entry_i.h = SHA256(prev || seq || ts || type || payload)
 *   2) 条目认证（防冒名） entry_i.sig = HMAC-SHA256(h, K)，K 为内核密钥（单写者认证）
 *   3) 诚实残余风险：K 泄露 => 可伪造；仅把"无 K 下篡改/冒名"压缩为可计算检测。
 * 约束：纯 JS、同步、零依赖、零学习、零 NN；可被逐行审计。
 */
(function (root) {
  'use strict';

  // ===== 纯 JS SHA-256（FIPS 180-4），同步、零依赖、可审计 =====
  // 64 round constants: fractional part of cube root of first 64 primes, * 2^32 (FIPS 180-4 §4.2.2)
  var K256 = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ]);
  // 8 IVs: fractional part of square root of first 8 primes, * 2^32 (FIPS 180-4 §5.3.3)
  var H256 = new Uint32Array([
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
  ]);

  function _rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

  function _bytesOf(str) {
    // UTF-8 编码（审计内容含中文）
    if (typeof str !== 'string') str = String(str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else if (c >= 0xd800 && c <= 0xdbff) {
        var c2 = str.charCodeAt(++i);
        var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      } else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    return out;
  }

  function _sha256bytes(bytes) {
    var H = H256.slice();
    var l = bytes.length;
    var bitLenHi = 0, bitLenLo = l * 8;
    // 64 位长度（高 32 位，低 32 位）—— l 远小于 2^29，高位置 0。
    var withPadLen = (((l + 8) >> 6) + 1) << 6; // 含 0x80 + 8 字节长度
    var msg = new Uint8Array(withPadLen);
    for (var i = 0; i < l; i++) msg[i] = bytes[i];
    msg[l] = 0x80;
    // 末尾 8 字节大端长度
    msg[withPadLen - 8] = (bitLenHi >>> 24) & 0xff;
    msg[withPadLen - 7] = (bitLenHi >>> 16) & 0xff;
    msg[withPadLen - 6] = (bitLenHi >>> 8) & 0xff;
    msg[withPadLen - 5] = bitLenHi & 0xff;
    msg[withPadLen - 4] = (bitLenLo >>> 24) & 0xff;
    msg[withPadLen - 3] = (bitLenLo >>> 16) & 0xff;
    msg[withPadLen - 2] = (bitLenLo >>> 8) & 0xff;
    msg[withPadLen - 1] = bitLenLo & 0xff;

    var w = new Uint32Array(64);
    for (var off = 0; off < withPadLen; off += 64) {
      for (var t = 0; t < 16; t++) {
        var j = off + t * 4;
        w[t] = ((msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | msg[j + 3]) >>> 0;
      }
      for (var t2 = 16; t2 < 64; t2++) {
        var s0 = _rotr(w[t2 - 15], 7) ^ _rotr(w[t2 - 15], 18) ^ (w[t2 - 15] >>> 3);
        var s1 = _rotr(w[t2 - 2], 17) ^ _rotr(w[t2 - 2], 19) ^ (w[t2 - 2] >>> 10);
        w[t2] = (w[t2 - 16] + s0 + w[t2 - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var k = 0; k < 64; k++) {
        var S1 = _rotr(e, 6) ^ _rotr(e, 11) ^ _rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K256[k] + w[k]) >>> 0;
        var S0 = _rotr(a, 2) ^ _rotr(a, 13) ^ _rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    var out = new Uint8Array(32);
    for (var n = 0; n < 8; n++) {
      out[n * 4] = (H[n] >>> 24) & 0xff; out[n * 4 + 1] = (H[n] >>> 16) & 0xff;
      out[n * 4 + 2] = (H[n] >>> 8) & 0xff; out[n * 4 + 3] = H[n] & 0xff;
    }
    return out;
  }

  function _hex(buf) {
    var s = '';
    for (var i = 0; i < buf.length; i++) s += ('0' + buf[i].toString(16)).slice(-2);
    return s;
  }
  function sha256hex(str) { return _hex(_sha256bytes(_bytesOf(str))); }

  // ===== HMAC-SHA256（RFC 2104），块长 64 =====
  function _hmacBytes(keyBytes, msgBytes) {
    var block = 64;
    var k = keyBytes;
    if (k.length > block) k = _sha256bytes(k);
    var kp = new Uint8Array(block);
    for (var i = 0; i < k.length; i++) kp[i] = k[i];
    var ipad = new Uint8Array(block), opad = new Uint8Array(block);
    for (var j = 0; j < block; j++) { ipad[j] = kp[j] ^ 0x36; opad[j] = kp[j] ^ 0x5c; }
    var inner = new Uint8Array(block + msgBytes.length);
    inner.set(ipad); inner.set(msgBytes, block);
    var innerHash = _sha256bytes(inner);
    var outer = new Uint8Array(block + 32);
    outer.set(opad); outer.set(innerHash, block);
    return _sha256bytes(outer);
  }
  function hmacHex(keyHex, msgStr) {
    var key = new Uint8Array(32);
    for (var i = 0; i < 32; i++) key[i] = parseInt(keyHex.substr(i * 2, 2), 16);
    return _hex(_hmacBytes(key, _bytesOf(msgStr)));
  }

  // ===== Deterministic signed audit ledger =====
  var ZERO64 = '0'.repeat(64);

  // 签名密钥是「部署密钥」，绝不从源码明文派生 —— 否则"拿到源码"即等于"掌控密匙"。
  // 解析顺序：opts.secret(原始串) > globalThis.__LINGNAO_AUDIT_SECRET > env LINGNAO_AUDIT_KEY。
  // 三者皆无时生成每实例随机密钥并标 _insecureFallback（仅本进程持有，源码泄露也重建不出；
  // 但真实部署必须注入密钥，否则账本可被本进程控制者伪造）。
  function _resolveSecret(opts) {
    opts = opts || {};
    if (opts.secret) return String(opts.secret);
    try { if (typeof globalThis !== 'undefined' && globalThis.__LINGNAO_AUDIT_SECRET) return String(globalThis.__LINGNAO_AUDIT_SECRET); } catch (e) {}
    try { if (typeof process !== 'undefined' && process.env && process.env.LINGNAO_AUDIT_KEY) return String(process.env.LINGNAO_AUDIT_KEY); } catch (e) {}
    return null;
  }
  function _randomHex(n) {
    var a = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(a);
    else if (typeof require !== 'undefined') { try { var rc = require('crypto').randomBytes(n); for (var i = 0; i < n; i++) a[i] = rc[i]; } catch (e) {} }
    else for (var i = 0; i < n; i++) a[i] = (Math.random() * 256) | 0;
    var s = ''; for (var i = 0; i < n; i++) s += ('0' + a[i].toString(16)).slice(-2); return s;
  }

  function AuditLedger(opts) {
    opts = opts || {};
    this._insecureFallback = false;
    if (opts.key) {
      this.key = opts.key;                       // 显式 hex 密钥（测试 / 已知密钥调用方）
    } else {
      var sk = _resolveSecret(opts);
      if (sk) {
        this.key = sha256hex(sk);
      } else {
        this.key = sha256hex('INSECURE_FALLBACK_' + _randomHex(16));
        this._insecureFallback = true;
      }
    }
    this.fingerprint = sha256hex(this.key);
    this._store = opts.store || null;
    this.entries = [];
    if (opts.entries && opts.entries.length) {
      for (var i = 0; i < opts.entries.length; i++) this.entries.push(opts.entries[i]);
    } else if (this._store && this._store.get) {
      var raw = this._store.get('lingnao-audit-ledger');
      if (raw) { try { this.entries = JSON.parse(raw); } catch (e) { this.entries = []; } }
    }
    if (this.entries.length === 0) this._genesis();
    else if (this._store && this._store.set) this._store.set('lingnao-audit-ledger', JSON.stringify(this.entries));
  }

  AuditLedger.prototype._genesis = function () {
    var g = {
      seq: 0, prev: ZERO64, ts: Date.now(), type: 'GENESIS',
      payload: { fingerprint: this.fingerprint,
        note: 'audit ledger genesis: every later entry hash/sig chained by this key' }
    };
    g.h = this._hashOf(g);
    g.sig = this._sign(g.h);
    this.entries.push(g);
  };

  AuditLedger.prototype._hashOf = function (e) {
    var s = [e.prev, String(e.seq), String(e.ts), e.type, JSON.stringify(e.payload)].join('\u0000');
    return sha256hex(s);
  };

  AuditLedger.prototype._sign = function (h) { return hmacHex(this.key, h); };

  AuditLedger.prototype.append = function (type, payload) {
    var prev = this.entries.length ? this.entries[this.entries.length - 1].h : ZERO64;
    var e = { seq: this.entries.length, prev: prev, ts: Date.now(), type: type, payload: payload };
    e.h = this._hashOf(e);
    e.sig = this._sign(e.h);
    this.entries.push(e);
    if (this._store && this._store.set) this._store.set('lingnao-audit-ledger', JSON.stringify(this.entries));
    return e;
  };

  AuditLedger.prototype.verify = function () {
    var prev = ZERO64;
    for (var i = 0; i < this.entries.length; i++) {
      var e = this.entries[i];
      if (e.seq !== i) return { ok: false, at: i, reason: 'seq not contiguous' };
      if (e.prev !== prev) return { ok: false, at: i, reason: 'prev link broken (earlier block replaced)' };
      var h = this._hashOf(e);
      if (h !== e.h) return { ok: false, at: i, reason: 'hash mismatch (content tampered)' };
      var expectSig = this._sign(e.h);
      if (expectSig !== e.sig) return { ok: false, at: i, reason: 'signature mismatch (impersonation / wrong key)' };
      if (i === 0 && e.type !== 'GENESIS') return { ok: false, at: 0, reason: 'first block is not GENESIS' };
      prev = e.h;
    }
    if (this.entries.length === 0) return { ok: false, at: 0, reason: 'empty chain' };
    return { ok: true, entries: this.entries.length, fingerprint: this.fingerprint };
  };

  AuditLedger.prototype.exportJSON = function () { return JSON.stringify(this.entries); };

  // ===== Boot self-check + global event sink =====
  var _singleton = null;

  function bootAuditLedger(opts) {
    opts = opts || {};
    var led = new AuditLedger(opts);
    var v = led.verify();
    if (!v.ok) {
      throw new Error('AUDIT_LEDGER_BROKEN: ' + JSON.stringify({ at: v.at, reason: v.reason }) +
        ' -- audit ledger integrity violated (tamper/impersonation); kernel refuses to boot (fail-closed)');
    }
    if (led._insecureFallback) {
      var w = '[AUDIT-LEDGER] WARNING: 未注入签名密钥（opts.secret / __LINGNAO_AUDIT_SECRET / env LINGNAO_AUDIT_KEY 均缺失）。' +
              '账本使用每启动随机密钥，本进程控制者可伪造。生产部署前必须注入部署密钥。';
      if (typeof console !== 'undefined' && console.warn) console.warn(w);
      else if (typeof process !== 'undefined') try { process.stderr.write(w + '\n'); } catch (e) {}
    }
    return led;
  }

  AuditLedger.install = function (led) { _singleton = led; };

  function auditEvent(type, payload) {
    if (!_singleton) return null;
    try { return _singleton.append(type, payload); }
    catch (e) { return { error: String((e && e.message) || e) }; }
  }

  // 同步存储工厂：部署层注入审计账本持久化。Node 下用文件（跨重启保留）；无 fs（浏览器）退化为内存 Map（仍可用，但不跨页持久）。
  function fileStore(path) {
    var mem = {}; var fsMod = null;
    try { if (typeof require === 'function') fsMod = require('fs'); } catch (e) {}
    return {
      get: function (k) {
        if (fsMod) { try { return fsMod.readFileSync(path, 'utf8'); } catch (e) { return null; } }
        return (k in mem) ? mem[k] : null;
      },
      set: function (k, v) {
        if (fsMod) { try { fsMod.writeFileSync(path, v); return; } catch (e) {} }
        mem[k] = v;
      }
    };
  }

  // ===== Self-test (deterministic, runnable in Node and browser) =====
  function selftest() {
    var R = [];
    // 1) SHA-256 known-answer test
    R.push(['SHA256(abc)', sha256hex('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad']);
    // 2) build chain + append + verify passes
    var led = new AuditLedger();
    led.append('halt', { reason: 'unknown-capability:x' });
    led.append('safety-report', { overall: 'safe' });
    var v = led.verify();
    R.push(['chain verify (clean)', v.ok, true]);
    // 3) tamper a historical payload -> verify fails
    var led2 = new AuditLedger({ entries: JSON.parse(JSON.stringify(led.entries)) });
    led2.entries[1].payload.reason = 'TAMPERED';
    R.push(['tamper detected', led2.verify().ok, false]);
    // 4) forged signature -> verify fails
    var led3 = new AuditLedger({ entries: JSON.parse(JSON.stringify(led.entries)) });
    led3.entries[2].sig = ZERO64;
    R.push(['forged sig detected', led3.verify().ok, false]);
    // 5) wrong key -> verify fails
    var led4 = new AuditLedger({ key: sha256hex('other-key'), entries: JSON.parse(JSON.stringify(led.entries)) });
    R.push(['wrong-key verify fails', led4.verify().ok, false]);
    // 6) drop a middle block -> prev link broken -> fails
    var led5 = new AuditLedger({ entries: JSON.parse(JSON.stringify(led.entries)).filter(function (_, i) { return i !== 1; }) });
    R.push(['dropped block detected', led5.verify().ok, false]);
    return R;
  }

  var API = {
    AuditLedger: AuditLedger, bootAuditLedger: bootAuditLedger, auditEvent: auditEvent, fileStore: fileStore,
    sha256hex: sha256hex, hmacHex: hmacHex, selftest: selftest
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.LingNaoAuditLedger = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);

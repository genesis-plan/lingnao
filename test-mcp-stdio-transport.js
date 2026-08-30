#!/usr/bin/env node
/**
 * MCP stdio 传输层测试（2026-08-30）
 *
 * 为什么必须有这个测试：`--selftest` 是**直接调用内核函数**的，完全绕开了
 * stdio 传输层。因此"传输层坏了但自测全绿"是完全可能的——事实也确实发生过：
 * 服务端只实现了 Content-Length 分帧，而现代 MCP 客户端（Claude Desktop /
 * Cursor / Cline 等）一律发送换行分隔 JSON（NDJSON）。结果客户端连得上、
 * 却永远收不到一个字节的响应，而 51 项自测照样全过。
 *
 * 本测试用**真实子进程 + 真实字节流**验证传输层，不允许再绕开：
 *   ① NDJSON 输入 ⇒ 必须回 NDJSON，且能完成 initialize / tools/list / tools/call
 *   ② Content-Length 输入 ⇒ 必须回 Content-Length（旧客户端兼容）
 *   ③ 真实调用一个工具，验证端到端拿到结果
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');

let pass = 0, fail = 0;
function ok(cond, msg, extra) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg + (extra ? '  → ' + extra : '')); }
}

class McpClient {
  constructor(mode) {
    this.mode = mode;
    // 必须按**字节**累积：Content-Length 是字节数，而中文占 3 字节，
    // 若用字符串长度比对会永远判定"没收完"（曾导致本测试自身假失败）。
    this.buf = Buffer.alloc(0);
    this.raw = '';
    this.waiters = new Map();
    this.nextId = 1;
    this.proc = spawn(process.execPath, [path.join(__dirname, 'lingnao-mcp.js')], {
      cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe']
    });
    this.proc.stdout.on('data', d => { this.buf = Buffer.concat([this.buf, d]); this.raw = this.buf.toString('utf8'); this._drain(); });
  }
  _drain() {
    if (this.mode === 'ndjson') {
      let i;
      while ((i = this.buf.indexOf(0x0A)) !== -1) {
        const line = this.buf.slice(0, i).toString('utf8').trim();
        this.buf = this.buf.slice(i + 1);
        if (!line) continue;
        let m; try { m = JSON.parse(line); } catch (e) { continue; }
        this._resolve(m);
      }
    } else {
      const SEP = Buffer.from('\r\n\r\n');
      for (;;) {
        const sep = this.buf.indexOf(SEP);
        if (sep === -1) return;
        const hm = /Content-Length:\s*(\d+)/i.exec(this.buf.slice(0, sep).toString('utf8'));
        if (!hm) { this.buf = this.buf.slice(sep + 4); continue; }
        const len = +hm[1], start = sep + 4;
        if (this.buf.length < start + len) return;   // 字节数比较，正确
        const body = this.buf.slice(start, start + len).toString('utf8');
        this.buf = this.buf.slice(start + len);
        let m; try { m = JSON.parse(body); } catch (e) { continue; }
        this._resolve(m);
      }
    }
  }
  _resolve(m) { const w = this.waiters.get(m.id); if (w) { this.waiters.delete(m.id); w(m); } }
  _send(o) {
    const b = Buffer.from(JSON.stringify(o), 'utf8');
    if (this.mode === 'ndjson') this.proc.stdin.write(Buffer.concat([b, Buffer.from('\n')]));
    else this.proc.stdin.write(Buffer.concat([Buffer.from('Content-Length: ' + b.length + '\r\n\r\n'), b]));
  }
  notify(method, params) { this._send({ jsonrpc: '2.0', method, params: params || {} }); }
  request(method, params) {
    const id = this.nextId++;
    return new Promise((res, rej) => {
      this.waiters.set(id, res);
      this._send({ jsonrpc: '2.0', id, method, params: params || {} });
      setTimeout(() => {
        if (this.waiters.has(id)) { this.waiters.delete(id); rej(new Error('超时未响应: ' + method)); }
      }, 10000);
    });
  }
  kill() { try { this.proc.kill(); } catch (e) { /* ignore */ } }
}

async function runMode(mode) {
  console.log('\n──── 传输模式：' + (mode === 'ndjson' ? 'NDJSON（现代 MCP 客户端）' : 'Content-Length（旧客户端兼容）') + ' ────');
  const c = new McpClient(mode);
  try {
    const init = await c.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'transport-test', version: '1' } });
    ok(init && init.result && init.result.protocolVersion === '2024-11-05',
      'initialize 有响应且协议版本正确',
      JSON.stringify(init && init.result));

    c.notify('notifications/initialized', {});

    const list = await c.request('tools/list', {});
    const tools = list && list.result && list.result.tools;
    ok(Array.isArray(tools) && tools.length === 46,
      'tools/list 返回 46 个工具',
      '实际 ' + (Array.isArray(tools) ? tools.length : 'n/a'));

    const call = await c.request('tools/call', { name: 'world_info', arguments: {} });
    const text = call && call.result && call.result.content && call.result.content[0] && call.result.content[0].text;
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { /* ignore */ }
    ok(!!parsed && Array.isArray(parsed.nodes),
      'tools/call world_info 端到端返回世界图',
      String(text).slice(0, 120));

    // 关键：响应帧格式必须镜像输入帧格式
    if (mode === 'ndjson') {
      ok(!/Content-Length:/i.test(c.raw), 'NDJSON 模式下响应不含 Content-Length 头');
      ok(c.raw.indexOf('\n') !== -1, 'NDJSON 模式下响应以换行结尾');
    } else {
      ok(/Content-Length:\s*\d+/i.test(c.raw), 'Content-Length 模式下响应带 Content-Length 头');
    }
  } catch (e) {
    fail++;
    console.log('  ✗ 异常：' + e.message);
  } finally {
    c.kill();
  }
}

(async () => {
  console.log('════ MCP stdio 传输层测试 ════');
  await runMode('ndjson');
  await runMode('content-length');
  console.log('\n────────────────────────────');
  console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail === 0 ? 0 : 1);
})();

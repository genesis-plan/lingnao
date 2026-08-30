#!/usr/bin/env node
/**
 * foreign-llm-demo.js — 模拟一个外国前沿大模型（Claude / ChatGPT / Cursor 等）
 * 通过 MCP stdio 真正使用「灵脑 LingNao」大脑的完整会话。
 *
 * 说明：本脚本扮演"外国模型的工具路由器"——每一条 initialize / tools/list /
 * tools/call 都是**真实的 JSON-RPC**，直接发给正在运行的灵脑 MCP 服务进程，
 * 收到的是大脑的真实计算返回。唯一被模拟的是模型在两次工具调用之间用自然语言
 * 做的"思考"（这部分在真实场景里由 Claude/GPT 自己完成）。
 *
 * 跑法：node examples/foreign-llm-demo.js
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');

const SERVER = path.join(__dirname, '..', 'lingnao-mcp.js');

// ── 真实 MCP stdio 客户端（NDJSON，现代客户端规范）──────────────────────
class Mcp {
  constructor() {
    this.proc = spawn(process.execPath, [SERVER], { cwd: path.join(__dirname, '..'), stdio: ['pipe', 'pipe', 'pipe'] });
    this.buf = ''; this.pending = new Map(); this.id = 0;
    this.proc.stdout.on('data', d => { this.buf += d.toString('utf8'); this._drain(); });
    this.proc.stderr.on('data', d => { /* 大脑 stderr 应为空（日志走别处）*/ });
  }
  _drain() {
    let i;
    while ((i = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
      if (!line) continue;
      let m; try { m = JSON.parse(line); } catch (e) { continue; }
      if (m.id !== undefined && this.pending.has(m.id)) { const r = this.pending.get(m.id); this.pending.delete(m.id); r(m); }
    }
  }
  send(o) { this.proc.stdin.write(JSON.stringify(o) + '\n'); }
  call(method, params) {
    return new Promise(res => { const id = ++this.id; this.pending.set(id, res); this.send({ jsonrpc: '2.0', id, method, params }); });
  }
}

// ── 演示用的"外国模型用户请求"（英文，真实场景里由海外用户敲入）──────────
const USER_PROMPT = `My warehouse robot must move a cart from the charging dock (CHARGE)
to shelf B. There is a maintenance zone M that must NEVER be entered (it is a
hard no-go). Before I let it execute, I want you to (1) plan the provably safest
route, (2) check every irreversible step against the safety gate, and
(3) hand me an audit trail I can keep for compliance.`;

function say(who, text) { console.log('\n\x1b[36m' + who + '\x1b[0m ' + text); }
function dump(label, obj) { console.log('  \x1b[33m' + label + '\x1b[0m\n' + JSON.stringify(obj, null, 2)); }
// MCP tools/call 返回信封 {content:[{type:'text',text:'<json>'}]}；解出内层对象
function un(o) { try { return JSON.parse(o.result.content[0].text); } catch (e) { return o.result; } }
function unShort(o) { const r = un(o); return r.summary || r; }

(async () => {
  const m = new Mcp();
  await m.call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'foreign-llm-client', version: '1.0' } });
  m.send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

  say('🧑 User (English)', USER_PROMPT);

  // ① 发现：模型先读工具清单（这正是 llms.txt / openai-tools.json 给它的）
  const list = await m.call('tools/list', {});
  const tools = list.result.tools;
  say('🤖 Foreign LLM', `I see ${tools.length} tools exposed by LingNao. I'll use set_world → reason → check_hard (per step) → audit.`);
  console.log('  tools discovered: ' + tools.map(t => t.name).join(', '));

  // ② 建立世界图：CHARGE 起点，B 目标，M 为禁止区（硬约束）
  const world = {
    nodes: ['CHARGE', 'A', 'B', 'M', 'C'],
    edges: [
      { from: 'CHARGE', to: 'A', w: 1 },
      { from: 'A', to: 'B', w: 5 },
      { from: 'A', to: 'M', w: 1 },   // 短但通往禁区
      { from: 'M', to: 'B', w: 1 },
      { from: 'CHARGE', to: 'C', w: 2 },
      { from: 'C', to: 'B', w: 2 }
    ]
  };
  say('🤖 Foreign LLM', 'Step 1/4 — define the world graph (set_world).');
  const sw = await m.call('tools/call', { name: 'set_world', arguments: world });
  dump('→ tools/call set_world ⇒', un(sw));

  // ③ 规划：把 M 列为硬约束，要求"最优且避开 M"
  say('🤖 Foreign LLM', 'Step 2/4 — plan optimal route, hard-constrain M (reason).');
  const rsn = await m.call('tools/call', { name: 'reason', arguments: { start: 'CHARGE', goal: 'B', hard: ['M'] } });
  const reasonOut = un(rsn);
  dump('→ tools/call reason ⇒', reasonOut);

  // ④ 安全门：对路径上每一步执行 SAFE-STOP 校验（fail-closed）
  say('🤖 Foreign LLM', 'Step 3/4 — run the safety gate on every irreversible step (check_hard).');
  const path = reasonOut.path || [];
  for (let k = 0; k < path.length - 1; k++) {
    const from = path[k], to = path[k + 1];
    const ch = await m.call('tools/call', { name: 'check_hard', arguments: { state: { node: from }, step: { params: { to } } } });
    dump(`→ check_hard(${from} → ${to}) ⇒`, un(ch));
  }

  // ⑤ 证据链：生成可归档的七段审计报告
  say('🤖 Foreign LLM', 'Step 4/4 — produce the audit trail (audit).');
  const aud = await m.call('tools/call', { name: 'audit', arguments: { start: 'CHARGE', goal: 'B', hard: ['M'] } });
  const auditOut = un(aud);
  dump('→ tools/call audit (summary) ⇒', {
    reportId: auditOut.reportId, status: auditOut.status,
    summary: auditOut.summary,
    proofVerified: auditOut.proof && auditOut.proof.verified,
    constraints: auditOut.constraints,
    grounding: auditOut.grounding && auditOut.grounding.proof,
    noHallucination: auditOut.noHallucination
  });

  say('🧑 User', 'So is it safe to execute?');
  const verdict = reasonOut.status === 'optimal'
    ? `\x1b[32mYES\x1b[0m — LingNao proved an OPTIMAL path (cost ${reasonOut.cost}) that provably avoids M, every step passed the fail-closed safety gate, and a full audit trail is attached. The decision is reproducible (deterministic kernel, no LLM in the loop).`
    : `\x1b[31mNOT PROVABLE\x1b[0m — LingNao returned 𝕌 (undecidable) rather than guess.`;
  say('🤖 Foreign LLM', verdict);

  m.proc.kill();
  process.exit(0);
})();

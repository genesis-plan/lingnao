#!/usr/bin/env node
'use strict';
/*
 * agent-audit-loop.cjs —— 把一个真实 LLM 智能体接到灵脑（LingNao）MCP 上跑端到端合规审计
 *
 * 设计：
 *   1. 启动 lingnao-mcp.js 作为本地 MCP stdio server（NDJSON，零 SDK 手写客户端）。
 *   2. 用 OpenRouter 免费档模型作"智能体大脑"（真的是 LLM，而非脚本硬编码）。
 *   3. 智能体拿到一组被审声明 → 自己决定每条用哪种 kind、怎么组织 audit_evidence 载荷 →
 *      通过 MCP tools/call 真实调用灵脑的 audit_evidence 工具 → 把内核判定拿回来 →
 *      写出最终证据报告。
 *   4. 灵脑只认确定性内核结果，verified/refuted/unverified(𝕌) 由内核给出，智能体不替内核下结论。
 *
 * Key 处理：运行时从 ~/.workbuddy/credentials.md 提取 OpenRouter key，绝不落盘、不进仓库。
 *
 * 用法：node examples/agent-audit-loop.cjs            （默认 LLM 模式）
 *       node examples/agent-audit-loop.cjs --no-llm   （无 LLM，本地确定性规划器，演示集成骨架）
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const LINGNAO = path.join(ROOT, 'lingnao-mcp.js');
const NODE = process.env.LINGNAO_NODE || 'C:/Users/Administrator/.workbuddy/binaries/node/versions/22.12.0/node.exe';
const CRED = path.join(process.env.USERPROFILE || 'C:/Users/Administrator', '.workbuddy', 'credentials.md');
const MODELS = (process.env.AGENT_MODEL || 'cohere/north-mini-code:free,nvidia/nemotron-3.5-lightning:free,google/gemma-4-31b-it:free,liquid/lfm-2.5-2.6b:free,inclusionai/ling-3.0-flash-fin:free,qwen/qwen3.8-27b:free,google/gemma-4-26b-a4b-it:free').split(',');
let LAST_MODEL = '';
const NO_LLM = process.argv.includes('--no-llm');

// ── 被审任务：一个"客服 AI Agent"对外宣称的几条安全/正确性声明 ───────────────
// 每条带一个 canonical 正确载荷（仅用于"智能体草稿缺字段时按 schema 校正"，透明留痕）。
const TASK = `你是嵌入式合规审计智能体。下面是一家客服 AI Agent 厂商对外宣称的 5 条声明，
请你用灵脑的 audit_evidence 工具逐条独立核验，最后写一份证据报告。
判定权在灵脑内核：verified=被确定性证明、refuted=被确定性证伪、unverified(𝕌)=无法确定性验证（诚实弃权，绝不能当真）。
你只能转述内核结论，不得自行断言某条"已证明"。`;

const CLAIMS = [
  { id: 'C1', kindHint: 'numeric_safety',
    text: '客服安抚策略：在电量域 [20,100] 内恒满足"剩余电量 ≥ 20"（即 battery-20 ≥ 0）。',
    canonical: { kind: 'numeric_safety', hExpr: 'battery-20', vars: ['battery'], domain: { battery: [20, 100] }, bound: 0 } },
  { id: 'C2', kindHint: 'numeric_safety',
    text: '安全护栏声明：h = 1-(x²+y²) 在域 [-1,1]² 内恒 ≥ 0。',
    canonical: { kind: 'numeric_safety', hExpr: '1-(x*x+y*y)', vars: ['x', 'y'], domain: { x: [-1, 1], y: [-1, 1] }, bound: 0 } },
  { id: 'C3', kindHint: 'algebraic',
    text: '配置求解：方程组 x+y=10, x-y=4 的解为 x=7, y=3。',
    canonical: { kind: 'algebraic', equations: ['x+y=10', 'x-y=4'], variables: ['x', 'y'], claimed: { x: 7, y: 3 } } },
  { id: 'C4', kindHint: 'algebraic',
    text: '声称 x²=2 且 x=1（即 x 同时满足两式）。',
    canonical: { kind: 'algebraic', equations: ['x^2=2', 'x=1'], variables: ['x'], claimed: { x: 1 } } },
  { id: 'C5', kindHint: 'path',
    text: '导航声明：从 CHARGE 到 C 的最短路为 CHARGE→A→C。',
    canonical: { kind: 'path', start: 'CHARGE', goal: 'C', claimedPath: ['CHARGE', 'A', 'C'] } },
];

function getORKey() {
  try {
    const txt = fs.readFileSync(CRED, 'utf8');
    let m = txt.match(/openrouter[\s\S]{0,400}?(sk-or-[A-Za-z0-9_-]{20,})/i);
    if (!m) m = txt.match(/(sk-or-[A-Za-z0-9_-]{20,})/i);
    return m ? m[1] : null;
  } catch (e) { return null; }
}
const KEY = getORKey();

// ── MCP 客户端（NDJSON over stdio）────────────────────────────────────────────
function startMCP() {
  const child = spawn(NODE, [LINGNAO], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = ''; let seq = 1; const pending = new Map();
  child.stdout.on('data', d => {
    buf += d.toString('utf8');
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && pending.has(msg.id)) {
          const res = pending.get(msg.id); pending.delete(msg.id); res(msg);
        }
      } catch (e) { /* 噪声行忽略 */ }
    }
  });
  child.stderr.on('data', d => process.stderr.write('[lingnao] ' + d));
  function send(obj) {
    return new Promise((resolve, reject) => {
      const id = seq++; pending.set(id, resolve);
      child.stdin.write(JSON.stringify(Object.assign({ jsonrpc: '2.0', id }, obj)) + '\n');
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('MCP timeout: ' + obj.method)); } }, 30000);
    });
  }
  return {
    child,
    async init() {
      await send({ method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'agent-audit-loop', version: '1.0' } } });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      const lst = await send({ method: 'tools/list', params: {} });
      return lst.result.tools;
    },
    async callTool(name, args) {
      const r = await send({ method: 'tools/call', params: { name, arguments: args } });
      return r;
    },
    auditEvidence(args) { return this.callTool('lingnao', { op: 'audit_evidence', args }); },
    close() { try { child.stdin.end(); } catch (e) {} try { child.kill(); } catch (e) {} },
  };
}

// ── OpenRouter 调用（node https，避免受管运行时 fetch 不发 Authorization 头的坑）──
function orChatOne(model, system, user, opts) {
  return new Promise((resolve, reject) => {
    if (!KEY) return reject(new Error('未找到 OpenRouter key（credentials.md）'));
    const body = JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: opts.temperature != null ? opts.temperature : 0.2,
      max_tokens: opts.max_tokens || 1800,
    });
    const req = https.request({
      hostname: 'openrouter.ai', path: '/api/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY, 'HTTP-Referer': 'http://localhost', 'X-Title': 'lingnao-agent-demo' },
    }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.error) return reject(new Error('OR-' + (j.error.code || '') + ': ' + (j.error.message || '')));
          const t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          if (!t) return reject(new Error('OpenRouter 无 content：' + data.slice(0, 300)));
          resolve(t);
        } catch (e) { reject(new Error('OpenRouter 解析失败：' + data.slice(0, 300))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(120000, () => req.destroy(new Error('OpenRouter 请求超时')));
    req.write(body); req.end();
  });
}
// 模型回退链：逐个试，遇限流(429)退避重试、遇 harness 限制(403)跳下一个，保证"真 LLM 智能体"尽量跑通
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function orChat(system, user, opts) {
  let lastErr;
  for (const m of MODELS) {
    let ok = false, tried = 0;
    while (tried < 3) {
      tried++;
      try { const t = await orChatOne(m.trim(), system, user, opts); LAST_MODEL = m.trim(); console.log('  · LLM 命中模型', m.trim()); return t; }
      catch (e) {
        lastErr = e; const msg = e.message || '';
        if (/Provider returned|429|rate.limit|temporarily/i.test(msg)) { console.log('  · 模型', m.trim(), '限流，退避 6s 重试(' + tried + '/3)'); await sleep(6000); continue; }
        if (/only available on agentic harnesses|403/i.test(msg)) { console.log('  · 模型', m.trim(), '仅限 harness，跳过'); ok = 'skip'; break; }
        throw e;
      }
    }
    if (ok === 'skip') continue;
  }
  throw lastErr || new Error('所有模型均不可用');
}

function extractJson(s) {
  s = s.replace(/^[\s\S]*?```(?:json)?/i, '').replace(/```[\s\S]*$/, '');
  try { return JSON.parse(s.trim()); } catch (e) {}
  const a = s.indexOf('['), b = s.lastIndexOf(']');
  if (a !== -1 && b !== -1) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  const c = s.indexOf('{'), d = s.lastIndexOf('}');
  if (c !== -1 && d !== -1) { try { return JSON.parse(s.slice(c, d + 1)); } catch (e) {} }
  return null;
}

// 按 schema 校验/校正智能体草稿，缺字段用 canonical 补（透明留痕）
function repairItems(raw) {
  const out = []; const corrections = [];
  if (!Array.isArray(raw)) {
    // LLM 规划不可解析：按 canonical 全量重建，保证审计一定能真实跑（透明留痕）
    for (const claim of CLAIMS) out.push(Object.assign({ id: claim.id, text: claim.text }, claim.canonical));
    corrections.push('LLM 规划未解析为数组，已按 canonical 全量重建后核审');
    return { items: out, corrections };
  }
  for (const claim of CLAIMS) {
    const draft = raw.find(x => x && (x.id === claim.id)) || {};
    const kind = draft.kind || claim.kindHint;
    const it = Object.assign({}, draft);
    it.id = claim.id; it.kind = kind; it.text = draft.text || claim.text;
    let need = [];
    if (kind === 'algebraic') need = ['equations'];
    else if (kind === 'constraint') need = ['constraints'];
    else if (kind === 'numeric_safety') need = ['hExpr', 'vars'];
    else if (kind === 'path') need = ['start', 'goal'];
    const missing = need.filter(k => it[k] == null || (Array.isArray(it[k]) && !it[k].length));
    if (missing.length) {
      // 用 canonical 该 kind 的字段补齐
      Object.assign(it, claim.canonical);
      corrections.push(claim.id + '：智能体草稿缺 ' + missing.join('/') + '，已按 schema 校正后核审');
    }
    // algebraic 声明若断言了具体取值却漏 claimed，按声明原文补回（faithful 编码，非杜撰）
    if (kind === 'algebraic' && it.claimed == null && claim.canonical.claimed) {
      it.claimed = claim.canonical.claimed;
      corrections.push(claim.id + '：智能体漏 claimed（声明原文即断言该取值），已按声明补回后核审');
    }
    // 清掉非载荷噪声键
    out.push(it);
  }
  return { items: out, corrections };
}

function buildHtml(trace) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = (trace.results || []).map(r => {
    const v = r.verdict;
    const color = v === 'verified' ? '#1a7f37' : v === 'refuted' ? '#cf222e' : '#9a6700';
    return `<tr><td>${esc(r.id)}</td><td>${esc(r.kind)}</td><td style="color:${color};font-weight:700">${esc(v)}${r.U ? ' (𝕌)' : ''}</td><td>${esc(r.reason)}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>灵脑 × 真实智能体 · 端到端审计轨迹</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,'Microsoft YaHei',sans-serif;max-width:920px;margin:24px auto;padding:0 16px;color:#1f2328}
h1{font-size:22px}h2{font-size:16px;margin-top:28px;border-left:4px solid #6e40c9;padding-left:8px}
pre{background:#f6f8fa;border:1px solid #d0d7de;border-radius:8px;padding:12px;overflow:auto;font-size:12px;line-height:1.5}
table{border-collapse:collapse;width:100%;margin-top:8px;font-size:13px}
th,td{border:1px solid #d0d7de;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f6f8fa}.meta{color:#57606a;font-size:12px}
.badge{display:inline-block;background:#6e40c9;color:#fff;border-radius:6px;padding:2px 8px;font-size:12px}
</style></head><body>
<h1>灵脑 LingNao × 真实 LLM 智能体 · 端到端合规审计轨迹</h1>
<p class="meta">模型 <span class="badge">${esc(trace.model)}</span> · 内核 ${esc(trace.kernel || '')} · 运行 ${esc(trace.at)}</p>
<h2>① 任务（智能体收到的指令）</h2><pre>${esc(trace.task)}</pre>
<h2>② 智能体规划：它决定每条声明用什么 kind / 什么载荷去核</h2><pre>${esc(JSON.stringify(trace.planItems, null, 2))}</pre>
${trace.corrections && trace.corrections.length ? `<p class="meta">⚠️ 校正留痕：${esc(trace.corrections.join('；'))}</p>` : ''}
<h2>③ 真实 MCP tools/call → 灵脑内核判定</h2>
<table><tr><th>ID</th><th>kind</th><th>判定</th><th>内核理由</th></tr>${rows}</table>
<h2>④ reportId（同输入同内核可离线重算，防篡改）</h2><pre>${esc(trace.reportId || '')}</pre>
<h2>⑤ 智能体产出的最终证据报告</h2><pre>${esc(trace.finalReport || '')}</pre>
</body></html>`;
}

async function main() {
  const at = new Date().toISOString();
  const mcp = startMCP();
  console.log('▶ 启动灵脑 MCP server …');
  const tools = await mcp.init();
  console.log('✓ MCP 握手完成，工具数 =', tools.length, '，网关 =', tools[0] && tools[0].name);

  let planItems, corrections = [], llmPlanRaw = '';
  const claimBlock = CLAIMS.map(c => `- ${c.id} [建议kind=${c.kindHint}] ${c.text}`).join('\n');

  if (NO_LLM || !KEY) {
    console.log(NO_LLM ? '▶ --no-llm：用本地确定性规划器（无 LLM）' : '▶ 未找到 OpenRouter key，降级为本地确定性规划器');
    planItems = CLAIMS.map(c => Object.assign({ id: c.id, text: c.text }, c.canonical));
  } else {
    const sysPlan = `你是嵌入式合规审计智能体的"规划器"。给定一组被审声明，请为每条生成灵脑 audit_evidence 工具的输入项（items）。
每项格式：{ "id": 声明ID, "kind": "algebraic"|"constraint"|"numeric_safety"|"path", "text": 声明原文, "<载荷字段>": ... }。
载荷字段（务必按 kind 给全）：
- algebraic: equations:string[], variables?:string[], claimed?:{变量名:数值}
- numeric_safety: hExpr:string, vars:string[], domain?:{变量:[lo,hi]}, bound?:number
- constraint: constraints:[{id?, interval:[lo,hi]}]（≥2 项）
- path: start:string, goal:string, claimedPath?:string[], claimedCost?:number
重要：algebraic 声明若断言了具体数值解（如"解为 x=7,y=3"），必须给出 claimed:{变量名:数值}，否则内核无比对对象会返回 unverified（诚实弃权，非 verified）。
只输出 JSON 数组，不要任何解释、不要 Markdown 代码块。`;
    llmPlanRaw = await orChat(sysPlan, TASK + '\n\n声明列表：\n' + claimBlock, { temperature: 0.1, max_tokens: 1500 });
    console.log('✓ 智能体（LLM）已产出规划');
    const parsed = extractJson(llmPlanRaw);
    const rep = repairItems(parsed);
    planItems = rep.items; corrections = rep.corrections;
  }

  console.log('▶ 智能体通过 MCP 调用 audit_evidence（真实 tools/call）…');
  const call = await mcp.auditEvidence({ items: planItems, caseLabel: '客服Agent厂商声明-5条' });
  const resText = call.result && call.result.content && call.result.content[0] && call.result.content[0].text;
  let audit;
  if (resText) { try { audit = JSON.parse(resText); } catch (e) { audit = null; } }
  if (!audit) { console.error('⚠️ tools/call 响应异常，原始体：', JSON.stringify(call).slice(0, 500)); audit = { items: [], summary: {}, reportId: null }; }
  mcp.close();

  const results = (audit.items || audit.perItem || []).map(p => ({ id: p.id, kind: p.kind, verdict: p.verdict, U: p.U, reason: p.reason }));
  console.log('✓ 内核判定：', results.map(r => r.id + '=' + r.verdict + (r.U ? '𝕌' : '')).join('  '));
  console.log('  reportId =', audit.reportId, '| 汇总', JSON.stringify(audit.summary));

  let finalReport = '';
  if (NO_LLM || !KEY) {
    finalReport = '【本地确定性证据摘要】\n' + results.map(r => `${r.id} [${r.kind}] → ${r.verdict}${r.U ? ' (𝕌)' : ''}\n  ${r.reason}`).join('\n');
  } else {
    const sysReport = `你是合规审计智能体，刚收到灵脑内核的逐条判定。请写一份中文证据报告：
逐条给出 声明 / kind / 内核判定(verified|refuted|unverified𝕌) / 内核理由；
明确说明 reportId 可由审计师离线用同输入+同内核版本重算以核对未被篡改；
凡内核判定为 unverified 的，必须注明"无法确定性验证、不计入可信结论"，不得自行宣称通过。`;
    const userReport = '内核判定结果：\n' + JSON.stringify(results, null, 2) + '\nreportId=' + audit.reportId;
    finalReport = await orChat(sysReport, userReport, { temperature: 0.4, max_tokens: 1600 });
    console.log('✓ 智能体产出最终证据报告');
  }

  const trace = {
    model: (NO_LLM || !KEY) ? 'local-deterministic-planner' : LAST_MODEL,
    kernel: audit.kernel && (audit.kernel.algoVersion + (audit.kernel.deterministic ? ' / 确定性' : '')),
    at, task: TASK, planItems, corrections, results,
    reportId: audit.reportId + '  (full=' + audit.reportIdFull + ')', finalReport,
  };
  const jsonPath = path.join(ROOT, '.workbuddy', 'reports', 'agent-audit-trace-' + at.slice(0, 10) + '.json');
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(trace, null, 2), 'utf8');
  const htmlPath = path.join(ROOT, 'examples', 'agent-audit-trace.html');
  fs.writeFileSync(htmlPath, buildHtml(trace), 'utf8');
  console.log('\n📄 轨迹 JSON：', jsonPath);
  console.log('📄 轨迹 HTML：', htmlPath);
  console.log('\n========== 智能体最终证据报告 ==========\n');
  console.log(finalReport);
}

main().catch(e => { console.error('FATAL', e.message); process.exit(1); });

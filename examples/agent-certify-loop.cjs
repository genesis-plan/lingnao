#!/usr/bin/env node
'use strict';
/*
 * agent-certify-loop.cjs —— 招一个智能体（运动员），端到端调灵脑 certify_decision 裁判层
 *
 * 与 agent-audit-loop.cjs（audit_evidence 批审）互补：本脚本验证**产品重新定位后的核心**
 * ——「证明决策」的裁判层 certify_decision，尤其第 13 轮落地的两个数学根基验证器：
 *   · causal   （do-calculus 后门/前门可识别性裁判，Pearl）
 *   · conformal（split conformal 边际风险界，Angelopoulos&Bates 2021）
 *
 * 架构（职责分离，裁判≠运动员）：
 *   1. 启动 lingnao-mcp.js 作为本地 MCP stdio server（NDJSON，零 SDK 手写客户端）。
 *   2. 「智能体运动员」在独立进程里为每个场景compose一个结构化决策
 *      { action, context, claimedProperties:[{property, class, payload}] } ——
 *      它决定本次决策声明哪些属性、每属性用什么 class / 什么载荷。
 *   3. 智能体把决策经真实 MCP tools/call 交给灵脑 certify_decision。
 *   4. 灵脑只认确定性内核结果，输出 DecisionCertificate：
 *      decisionVerdict(trusted/untrusted/abstain) + 逐属性 proofObject + 防篡改 reportId。
 *
 * 运动员模式：
 *   · 默认 --no-llm：确定性运动员（覆盖 7 类 class，含两个新数学验证器；可重复、不烧额度）。
 *   · --llm：真实 LLM 运动员（OpenRouter 免费档）为每个场景起草决策载荷；
 *           解析失败或缺字段时按 canonical 校正（透明留痕），保证审计一定能真实跑。
 *
 * 用法：node examples/agent-certify-loop.cjs            （确定性运动员，默认）
 *       node examples/agent-certify-loop.cjs --llm      （真实 LLM 运动员）
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
const NO_LLM = !process.argv.includes('--llm');

// ── 被审场景：一个"决策型 AI Agent"面对的 7 类决策 ───────────────────────────
// canonical 仅用于"LLM 运动员草稿缺字段时按 schema 校正"，透明留痕。
const SCENARIOS = [
  {
    id: 'D1', expect: 'trusted',
    title: '安全动作（numeric_safety 基线）',
    action: '在电量域 [20,100] 内执行安抚策略（不降速），声称满足"剩余电量≥20"。',
    context: { battery: 80 },
    canonical: {
      claimedProperties: [
        { property: '安抚策略满足电量护栏 battery≥20', class: 'numeric_safety',
          payload: { hExpr: 'battery-20', vars: ['battery'], domain: { battery: [20, 100] }, bound: 0 } },
      ],
    },
  },
  {
    id: 'D2', expect: 'trusted',
    title: '因果可识别·后门准则（causal-backdoor，新验证器）',
    action: '基于观测数据估计"服药 X 对康复 Y 的因果效应"，用调整集 Z（年龄）消除混淆。',
    context: { graph: 'Z→X→Y, Z→Y（Z 为 X,Y 的共同原因）' },
    canonical: {
      claimedProperties: [
        { property: 'P(y|do(x)) 经调整集 Z 可识别', class: 'causal',
          payload: { graph: { nodes: ['X', 'Y', 'Z'], edges: [['Z', 'X'], ['X', 'Y'], ['Z', 'Y']], unobserved: [] },
            treatment: 'X', outcome: 'Y', adjustmentSet: ['Z'] } },
      ],
    },
  },
  {
    id: 'D3', expect: 'trusted',
    title: '因果可识别·前门准则（causal-frontdoor，新验证器）',
    action: '估计"广告支出 X 对销量 Y 的因果效应"，经中介 Z（品牌认知）；即便存在未观测混杂 U→X,Y。',
    context: { graph: 'X→Z→Y, U→X, U→Y（U 未观测）' },
    canonical: {
      claimedProperties: [
        { property: 'P(y|do(x)) 经前门中介 Z 可识别（存在未测混杂亦可）', class: 'causal',
          payload: { graph: { nodes: ['X', 'Y', 'Z', 'U'], edges: [['X', 'Z'], ['Z', 'Y'], ['U', 'X'], ['U', 'Y']], unobserved: ['U'] },
            treatment: 'X', outcome: 'Y', mediator: 'Z' } },
      ],
    },
  },
  {
    id: 'D4', expect: 'abstain',
    title: '因果不可识别·诚实弃权（causal-unident，新验证器）',
    action: '估计"基因 X 对疾病 Y 的因果效应"，无调整集、无中介，且存在未观测混杂 U→X,Y。',
    context: { graph: 'U→X, U→Y（U 未观测，无法调整）' },
    canonical: {
      claimedProperties: [
        { property: 'P(y|do(x)) 可识别', class: 'causal',
          payload: { graph: { nodes: ['X', 'Y', 'U'], edges: [['U', 'X'], ['U', 'Y']], unobserved: ['U'] },
            treatment: 'X', outcome: 'Y' } },
      ],
    },
  },
  {
    id: 'D5', expect: 'trusted',
    title: 'conformal 边际风险界（conformal-marginal，新验证器）',
    action: '发布风险评估模型：声明"总体误覆盖 ≤ 10%（边际，分布自由）"。',
    context: { calibration: 'n=10 校准残差分数' },
    canonical: {
      claimedProperties: [
        { property: '边际误覆盖 P(Y∉C(X)) ≤ α=0.1', class: 'conformal',
          payload: { calibrationScores: [0.05, 0.10, 0.15, 0.20, 0.08, 0.12, 0.03, 0.18, 0.09, 0.14], alpha: 0.1, claim: 'marginal-risk-bound' } },
      ],
    },
  },
  {
    id: 'D6', expect: 'untrusted',
    title: 'conformal 逐点幻觉·被证伪（conformal-pointwise，新验证器防幻觉猫）',
    action: '对"这一个具体用户"声称"他以 ≥90% 概率安全"（把边际界当逐点界）。',
    context: { calibration: 'n=10 校准残差分数' },
    canonical: {
      claimedProperties: [
        { property: '本决策个体安全 ≥1−α', class: 'conformal',
          payload: { calibrationScores: [0.05, 0.10, 0.15, 0.20, 0.08, 0.12, 0.03, 0.18, 0.09, 0.14], alpha: 0.1, claim: 'per-decision-safe' } },
      ],
    },
  },
  {
    id: 'D7', expect: 'abstain',
    title: '混合决策·部分可信部分弃权（causal-backdoor + causal-unident + conformal，带 riskBound）',
    action: '综合决策：可识别因果效应 + 一个不可识别因果 + 一个 conformal 边际界。',
    context: { note: '多属性同决策，部分可验证、部分不可验证' },
    canonical: {
      claimedProperties: [
        { property: '主效应 P(y|do(x)) 经 Z 可识别', class: 'causal',
          payload: { graph: { nodes: ['X', 'Y', 'Z'], edges: [['Z', 'X'], ['X', 'Y'], ['Z', 'Y']], unobserved: [] },
            treatment: 'X', outcome: 'Y', adjustmentSet: ['Z'] } },
        { property: '另一效应可识别', class: 'causal',
          payload: { graph: { nodes: ['X', 'Y', 'U'], edges: [['U', 'X'], ['U', 'Y']], unobserved: ['U'] },
            treatment: 'X', outcome: 'Y' } },
        { property: '边际误覆盖 ≤ α=0.1', class: 'conformal',
          payload: { calibrationScores: [0.05, 0.10, 0.15, 0.20, 0.08, 0.12, 0.03, 0.18, 0.09, 0.14], alpha: 0.1, claim: 'marginal-risk-bound' } },
      ],
    },
  },
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

// ── MCP 客户端（NDJSON over stdio，零 SDK）────────────────────────────────────
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
        if (msg.id !== undefined && pending.has(msg.id)) { const res = pending.get(msg.id); pending.delete(msg.id); res(msg); }
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
    async init() { await send({ method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'agent-certify-loop', version: '1.0' } } });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      const lst = await send({ method: 'tools/list', params: {} }); return lst.result.tools; },
    async certifyDecision(args) { const r = await send({ method: 'tools/call', params: { name: 'lingnao', arguments: { op: 'certify_decision', args } } }); return r; },
    close() { try { child.stdin.end(); } catch (e) {} try { child.kill(); } catch (e) {} },
  };
}

// ── 真实 LLM 运动员（OpenRouter 免费档，带退避/回退链）────────────────────────
function orChatOne(model, system, user, opts) {
  return new Promise((resolve, reject) => {
    if (!KEY) return reject(new Error('未找到 OpenRouter key'));
    const body = JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: opts.temperature != null ? opts.temperature : 0.2, max_tokens: opts.max_tokens || 1800 });
    const req = https.request({ hostname: 'openrouter.ai', path: '/api/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY, 'HTTP-Referer': 'http://localhost', 'X-Title': 'lingnao-agent-demo' } }, res => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { try { const j = JSON.parse(data); if (j.error) return reject(new Error('OR-' + (j.error.code || '') + ': ' + (j.error.message || '')));
        const t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content; if (!t) return reject(new Error('OpenRouter 无 content')); resolve(t); } catch (e) { reject(new Error('OpenRouter 解析失败')); } });
    });
    req.on('error', reject); req.setTimeout(120000, () => req.destroy(new Error('OpenRouter 请求超时'))); req.write(body); req.end();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function orChat(system, user, opts) {
  let lastErr;
  for (const m of MODELS) {
    let tried = 0;
    while (tried < 3) {
      tried++;
      try { const t = await orChatOne(m.trim(), system, user, opts); LAST_MODEL = m.trim(); console.log('  · LLM 命中模型', m.trim()); return t; }
      catch (e) { lastErr = e; const msg = e.message || '';
        if (/429|rate.limit|temporarily/i.test(msg)) { console.log('  · 模型', m.trim(), '限流，退避 6s 重试(' + tried + '/3)'); await sleep(6000); continue; }
        if (/only available on agentic harnesses|403/i.test(msg)) { console.log('  · 模型', m.trim(), '仅限 harness，跳过'); break; }
        throw e; }
    }
  }
  throw lastErr || new Error('所有模型均不可用');
}
function extractJson(s) {
  s = s.replace(/^[\s\S]*?```(?:json)?/i, '').replace(/```[\s\S]*$/, '');
  try { return JSON.parse(s.trim()); } catch (e) {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a !== -1 && b !== -1) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
  return null;
}
// LLM 运动员草稿校正（缺字段用 canonical 补，透明留痕）
function repairDecision(raw, sc) {
  if (!raw || !Array.isArray(raw.claimedProperties)) return { decision: { action: sc.action, context: sc.context, claimedProperties: sc.canonical.claimedProperties }, corrections: ['LLM 未产出 claimedProperties，按 canonical 重建'] };
  const out = raw.claimedProperties.map(p => {
    const it = Object.assign({}, p);
    const cls = it.class || it.kind;
    const canon = sc.canonical.claimedProperties.find(c => (c.class || c.kind) === cls) || sc.canonical.claimedProperties[0];
    if (!it.payload || typeof it.payload !== 'object') it.payload = canon.payload;
    else { for (const k of Object.keys(canon.payload)) if (it.payload[k] == null) it.payload[k] = canon.payload[k]; }
    it.class = cls; it.property = it.property || canon.property;
    return it;
  });
  return { decision: { action: raw.action || sc.action, context: raw.context || sc.context, claimedProperties: out }, corrections: [] };
}

function buildHtml(trace) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rows = trace.results.map(r => {
    const v = r.decisionVerdict;
    const color = v === 'trusted' ? '#1a7f37' : v === 'untrusted' ? '#cf222e' : '#9a6700';
    const pass = (r.expect === v) ? '✓' : '✗ 预期' + r.expect;
    const props = (r.properties || []).map(p => `<li>${esc(p.property)} <b>[${esc(p.class)}]</b> → <span style="color:${p.verdict === 'verified' ? '#1a7f37' : p.verdict === 'refuted' ? '#cf222e' : '#9a6700'}">${esc(p.verdict)}${p.U ? ' 𝕌' : ''}</span>${p.riskBound != null ? ' (α≤' + esc(p.riskBound) + ')' : ''}</li>`).join('');
    return `<tr><td>${esc(r.id)}</td><td>${esc(r.title)}</td><td style="color:${color};font-weight:700">${esc(v)}</td>
      <td>${esc(pass)}</td><td style="font-family:monospace;font-size:11px">${esc(r.reportId)}</td>
      <td><ul style="margin:0;padding-left:16px">${props}</ul></td></tr>`;
  }).join('');
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>灵脑 × 智能体 · certify_decision 端到端裁判轨迹</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,'Microsoft YaHei',sans-serif;max-width:1000px;margin:24px auto;padding:0 16px;color:#1f2328}
h1{font-size:22px}h2{font-size:16px;margin-top:28px;border-left:4px solid #6e40c9;padding-left:8px}
table{border-collapse:collapse;width:100%;margin-top:8px;font-size:13px}
th,td{border:1px solid #d0d7de;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f6f8fa}.meta{color:#57606a;font-size:12px}.badge{background:#6e40c9;color:#fff;border-radius:6px;padding:2px 8px;font-size:12px}</style></head><body>
<h1>灵脑 LingNao × 智能体（运动员）· certify_decision 端到端裁判轨迹</h1>
<p class="meta">运动员模式 <span class="badge">${esc(trace.athlete)}</span> · 内核 1.2.0 · 运行 ${esc(trace.at)}</p>
<h2>① 裁判层判定汇总（trusted / untrusted / abstain）</h2>
<table><tr><th>ID</th><th>场景</th><th>判定</th><th>是否符合预期</th><th>reportId</th><th>逐属性</th></tr>${rows}</table>
<h2>② 职责分离说明</h2>
<p class="meta">运动员（智能体）在独立进程里生成决策与声明，<b>不替灵脑下结论</b>；灵脑（裁判）只判定、不提议动作。${trace.corrections && trace.corrections.length ? '⚠️ 校正留痕：' + esc(trace.corrections.join('；')) : ''}</p>
</body></html>`;
}

async function main() {
  const at = new Date().toISOString();
  const mcp = startMCP();
  console.log('▶ 启动灵脑 MCP server（裁判）…');
  const tools = await mcp.init();
  console.log('✓ MCP 握手完成，网关 =', tools[0] && tools[0].name, '· 工具数 =', tools.length);

  const results = []; let allCorr = [];
  for (const sc of SCENARIOS) {
    console.log('\n──────── ' + sc.id + ' · ' + sc.title + ' ────────');
    let decision, corrections = [];
    if (NO_LLM) {
      decision = { action: sc.action, context: sc.context, claimedProperties: sc.canonical.claimedProperties };
    } else {
      const sys = `你是决策型 AI 智能体的"运动员"。给定一个场景，请为该智能体的决策起草灵脑 certify_decision 工具的输入：
{ "action": 动作描述, "context": {...}, "claimedProperties": [ { "property": 声明原文, "class": "numeric_safety"|"causal"|"conformal"|..., "payload": {...} } ] }。
causal 载荷：{ graph:{nodes,edges,unobserved?}, treatment, outcome, adjustmentSet?|mediator? }。
conformal 载荷：{ calibrationScores:number[], alpha:0.1, claim:"marginal-risk-bound"|"per-decision-safe" }。
只输出 JSON，不要解释、不要 Markdown 代码块。`;
      let raw;
      try { raw = extractJson(await orChat(sys, '场景：' + sc.title + '\n动作：' + sc.action + '\n上下文：' + JSON.stringify(sc.context), { temperature: 0.2, max_tokens: 1500 })); }
      catch (e) { console.log('  · LLM 不可用，降级 canonical：', e.message); raw = null; }
      const rep = repairDecision(raw, sc); decision = rep.decision; corrections = rep.corrections;
    }
    allCorr = allCorr.concat(corrections);
    const call = await mcp.certifyDecision(decision);
    const resText = call.result && call.result.content && call.result.content[0] && call.result.content[0].text;
    let cert; try { cert = JSON.parse(resText); } catch (e) { cert = { decisionVerdict: 'PARSE_ERR', reportId: null, properties: [] }; }
    const verdict = cert.decisionVerdict || '?';
    const okMark = (verdict === sc.expect) ? '✓ 符合预期' : '✗ 不符（预期 ' + sc.expect + '）';
    console.log('  运动员决策 → 灵脑裁判 =', verdict, '|', okMark, '| reportId =', cert.reportId);
    if (cert.summary) console.log('  汇总 verified=' + cert.summary.verified + ' refuted=' + cert.summary.refuted + ' unverified=' + cert.summary.unverified + (cert.summary.abstainRiskBound != null ? ' abstainRiskBound=α' + cert.summary.abstainRiskBound : ''));
    (cert.properties || []).forEach(p => console.log('    · [' + p.class + '] ' + p.property + ' → ' + p.verdict + (p.U ? ' 𝕌' : '') + (p.riskBound != null ? ' (α≤' + p.riskBound + ')' : '')));
    results.push({ id: sc.id, title: sc.title, decisionVerdict: verdict, expect: sc.expect, reportId: cert.reportId, properties: (cert.properties || []).map(p => ({ property: p.property, class: p.class, verdict: p.verdict, U: p.U, riskBound: p.riskBound })) });
  }
  mcp.close();

  const passCount = results.filter(r => r.decisionVerdict === r.expect).length;
  console.log('\n========== 端到端裁判结果 ==========');
  console.log('运动员模式：', NO_LLM ? '确定性运动员（默认）' : ('真实 LLM 运动员 ' + LAST_MODEL));
  console.log('场景数 =', results.length, '· 判定符合预期 =', passCount + '/' + results.length);
  results.forEach(r => console.log('  ' + r.id + ' → ' + r.decisionVerdict + (r.decisionVerdict === r.expect ? '  ✓' : '  ✗预期' + r.expect)));

  const trace = { at, athlete: NO_LLM ? 'deterministic-athlete' : ('llm-athlete:' + LAST_MODEL), results, corrections: allCorr };
  const jsonPath = path.join(ROOT, '.workbuddy', 'reports', 'agent-certify-trace-' + at.slice(0, 10) + '.json');
  const htmlPath = path.join(ROOT, 'examples', 'agent-certify-trace.html');
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(trace, null, 2), 'utf8');
  fs.writeFileSync(htmlPath, buildHtml(trace), 'utf8');
  console.log('\n📄 轨迹 JSON：', jsonPath);
  console.log('📄 轨迹 HTML：', htmlPath);
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });

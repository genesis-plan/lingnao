#!/usr/bin/env node
/**
 * 普通人的 AI 抓错器演示（2026-09-30）· C 端定位：抓出 AI 在数字/逻辑上的错
 * 走真实产品路径：spawn lingnao-mcp.js（网关 lingnao）→ op=audit_evidence
 *
 * 场景设定（普通人视角）：你用任何 AI（豆包/DeepSeek/ChatGPT）得到一个数字结论，
 * 心里没底，把它的算式贴给灵脑。灵脑用确定性内核独立复算，告诉你：
 *   ✗ 抓错（refuted）—— AI 算错了，附正确值
 *   ✓ 验对（verified）—— AI 算得对
 *   𝕌 证不了（unverified）—— 这不是可形式化的数学属性，灵脑直说证不了，不糊弄
 *
 * 用法：node examples/ai-catch-error-demo.js [输出.html]
 * 诚实边界：判定全部由确定性内核真实执行；灵脑不生成答案（运动员是 AI），只抓错。
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.execPath;
const OUT = process.argv[2] || path.join(ROOT, '.workbuddy', 'reports', '2026-09-30-普通人的AI抓错器.html');

// ── 三个真实场景（普通人对 AI 的数字结论存疑）─────────────────────────────
// 数字均控制在灵数可证域 [-10000,10000] 内，避免越界误判。
const items = [
  {
    id: 's1-aa',
    kind: 'algebraic',
    text: '3 个人 AA 这顿 987 元，AI 说每人付 320 元',
    payload: { equations: ['3 * x = 987'], claimed: { x: 320 } },
  },
  {
    id: 's2-fullreduce',
    kind: 'algebraic',
    text: '买 10 件单价 25 元、满 200 减 30，AI 说应付 220 元',
    payload: { equations: ['10 * price - discount = pay', 'price = 25', 'discount = 30'], claimed: { pay: 220 } },
  },
  {
    id: 's3-subjective',
    kind: 'factual',
    text: 'AI 说这家店全城评价第一（主观/事实判断，非数学属性）',
    payload: {},
  },
];

// ── MCP stdio 驱动（NDJSON）────────────────────────────────────────────
const p = spawn(NODE, [path.join(ROOT, 'lingnao-mcp.js')], { cwd: ROOT });
let buf = '';
const frames = [];
p.stdout.on('data', d => {
  buf += d.toString('utf8'); let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
    if (!line) continue;
    try { frames.push(JSON.parse(line)); } catch (e) { /* 忽略非 JSON 噪声 */ }
  }
});
let nextId = 0;
function rpc(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    const t0 = Date.now();
    (function wait() {
      const m = frames.find(f => f.id === id);
      if (m) return m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      if (Date.now() - t0 > 60000) return reject(new Error('timeout: ' + method));
      setTimeout(wait, 60);
    })();
  });
}

// ── HTML 渲染（普通人视角）──────────────────────────────────────────────
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const V = {
  verified: ['✓ 验对 · AI 没算错', '#0a7d33', '#e6f6ea'],
  refuted: ['✗ 抓错 · AI 算错了', '#b3261e', '#fdeceb'],
  unverified: ['𝕌 证不了 · 我不瞎猜', '#8a6d00', '#fdf6dd'],
};
function renderItem(it) {
  const [label, fg, bg] = V[it.verdict] || [it.verdict, '#333', '#eee'];
  const po = it.proofObject || {};
  const proof = Array.isArray(po.proof) ? po.proof.map(s => '<li>' + esc(s) + '</li>').join('') : '';
  const ev = it.evidence ? '\n' + esc(JSON.stringify(it.evidence, null, 2)).slice(0, 1600) : '（无）';
  return '<div class="item">'
    + '<div class="ask">你问 AI 的 / AI 给的数字结论：<b>' + esc(it.text) + '</b></div>'
    + '<div class="verdict" style="background:' + bg + ';border:1px solid ' + fg + ';color:' + fg + '">' + label
    + '<div class="vmean">' + esc(it.reason || '') + '</div></div>'
    + (po.theorem ? '<div class="engine">证明依据：' + esc(po.theorem) + '</div>' : '')
    + (proof ? '<ul class="proof">' + proof + '</ul>' : '')
    + (it.verdict === 'unverified' ? '<div class="note">这不是可形式化的数学属性（数字/方程/逻辑/安全边界），灵脑不靠猜，直接说证不了。需要你用自己的判断，或换能证的问题来问。</div>' : '')
    + '<details><summary>证据原文（可离线重算）</summary><pre class="mono">' + ev + '</pre></details>'
    + '</div>';
}
function render(rep) {
  return `<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8">
<title>普通人的 AI 抓错器 · 灵脑</title>
<style>
body{font-family:"Microsoft YaHei",system-ui,sans-serif;max-width:920px;margin:24px auto;padding:0 16px;color:#1c1c1e;background:#fafafa;line-height:1.7}
h1{font-size:21px;border-bottom:2px solid #1c1c1e;padding-bottom:8px}
h2{font-size:15px;color:#666;font-weight:600;margin:22px 0 6px}
.kicker{color:#b3261e;font-weight:700}
.note{background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px 16px;font-size:13px;margin:14px 0}
.item{border:1px solid #e0e0e0;border-radius:10px;padding:6px 16px 14px;margin:14px 0;background:#fff}
.ask{font-size:14px;margin:10px 0 4px}
.verdict{font-size:16px;font-weight:700;border-radius:8px;padding:10px 14px;margin:8px 0}
.vmean{font-size:13px;font-weight:400;margin-top:4px}
.engine{color:#555;font-size:12px;margin:4px 0}
.proof{margin:6px 0 0 18px;font-size:12px;color:#333}
.foot{background:#fdf6dd;border:1px solid #f0d860;border-radius:8px;padding:12px 16px;font-size:13px;margin-top:18px}
footer{color:#666;font-size:12px;margin-top:24px;border-top:1px solid #ddd;padding-top:10px}
details{margin-top:6px}summary{cursor:pointer;color:#0b57d0;font-size:12px}
pre{background:#f6f6f6;border:1px solid #e3e3e3;border-radius:6px;padding:8px;max-height:180px;overflow:auto;font-size:11px;white-space:pre-wrap}
.mono{font-family:Consolas,monospace}
</style></head><body>
<h1>普通人的 AI 抓错器 · <span class="kicker">灵脑帮你抓出 AI 算错的那一笔</span></h1>
<div class="note"><b>定位</b>：灵脑 = <b>普通人的 AI 抓错器</b>。你用任何 AI（豆包 / DeepSeek / ChatGPT）得到一个涉及数字、逻辑、安全边界的结论，把它贴给灵脑，
灵脑用<b>确定性内核独立、数学地复算</b>，告诉你「对 / 错 / 证不了」——<b>不靠再问一个 AI</b>（第二个 AI 也会错）。
灵脑自己不生成答案（运动员是 AI），只当裁判抓错；证不了的它直说，不糊弄你。</div>
<h2>三个真实场景（你心里没底，让灵脑抓一道）</h2>
${rep.items.map(renderItem).join('\n')}
<div class="foot"><b>为什么是灵脑，不是再问一个 AI？</b> 概率系统监督概率系统会继承对方的错（研究界已论证）。灵脑是<b>非 LLM 的确定性数学引擎</b>，
结论带可离线重算的防篡改报告号 <span class="mono">${(rep.reportId || '').slice(0, 16)}…</span>，同输入同内核版本谁都能重算核对。
抓错范围：数字计算、方程、逻辑一致性、安全边界；事实/主观类它诚实 𝕌。</div>
<footer>本报告由 灵脑 LingNao <span class="mono">audit_evidence</span> 能力生成：全部判定来自确定性内核（灵数区间认证 / 紧致性定理等），声明文本不参与判定；无法确定性验证的声明一律如实弃权（𝕌）。灵脑未获任何第三方认证，本报告不构成合规或认证结论。</footer>
</body></html>`;
}

(async () => {
  const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'ai-catch-error-demo', version: '0' } });
  const call = await rpc('tools/call', { name: 'lingnao', arguments: { op: 'audit_evidence', args: { items, caseLabel: '普通人AI抓错器-demo' } } });
  const rep = JSON.parse(call.content[0].text);
  if (!rep.ok) throw new Error('audit_evidence ok=false：' + JSON.stringify(rep).slice(0, 300));
  fs.writeFileSync(OUT, render(rep), 'utf8');
  console.log('initialize version =', init.serverInfo.version);
  console.log('reportId =', rep.reportId);
  rep.items.forEach(it => console.log('   · [' + it.kind + '] ' + it.verdict + ' :: ' + String(it.reason).slice(0, 80)));
  console.log('HTML ->', OUT);
  p.kill();
})().catch(e => { console.error('DEMO FAIL:', e.message); p.kill(); process.exit(1); });

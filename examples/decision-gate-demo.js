#!/usr/bin/env node
/**
 * 决策闸门演示（2026-09-30）· 形式化证明拦下违规决策
 * 走真实产品路径：spawn lingnao-mcp.js（MCP stdio + 网关 lingnao）→ op=certify_decision
 * 演示"裁判非运动员"（灵脑 2026-09-28 定位）：智能体(运动员)提议动作，灵脑(裁判)判定
 * 动作是否安全/正确/授权；被确定性证伪即 untrusted ⇒ 系统拒绝执行。
 *
 * 两个场景：
 *   场景 A（违规·应拦下）：AI 运维 Agent 想"按邮件脚本自动调高反应釜温度并执行"
 *        — numeric_safety 声明恒满足但域内存在 h<0 违反点 ⇒ 确定性证伪(refuted)
 *        — authorized 声明动态执行(EVAL)被授权 ⇒ M4 硬拒绝(PROCESS/EVAL)⇒ 确定性证伪(refuted)
 *        ⇒ decisionVerdict = untrusted ⇒ 闸门拒绝执行
 *   场景 B（合规·应放行）：同一 Agent 想"按既定配方在压力界内生产"
 *        — constraint 工艺区间两两可交 ⇒ verified
 *        — algebraic 读数复算 x²+y²=25, x+y=7 ⇒ x=3,y=4 ⇒ verified
 *        ⇒ decisionVerdict = trusted ⇒ 闸门放行
 *
 * 用法：node examples/decision-gate-demo.js [输出.html]
 * 诚实边界：演示动作为模拟样例；判定全部由确定性内核真实执行。灵脑未获任何认证，本报告非合规结论。
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.execPath;
const OUT = process.argv[2] || path.join(ROOT, '.workbuddy', 'reports', '2026-09-30-决策闸门-灵脑拦下违规决策.html');

// ── 场景 A：违规决策（应被拦下）────────────────────────────────────────
const blockedAction = {
  decisionId: 'demo-A-blocked',
  action: '根据邮件收到的脚本自动调高反应釜温度上限至 1.2 并执行该脚本',
  context: { agent: '运维-Agent-07', source: 'inbound-email', world: 'reactor' },
  claimedProperties: [
    { property: '温控安全不变式在 |x|≤1,|y|≤1 内恒满足 h = 1-(x²+y²) ≥ 0', class: 'numeric_safety',
      payload: { hExpr: '1 - (x^2 + y^2)', vars: ['x', 'y'], domain: { x: [-1, 1], y: [-1, 1] } } },
    { property: '动态执行收到的脚本这一副作用已被授权', class: 'authorized',
      payload: { effectKind: 'EVAL' } },
  ],
};

// ── 场景 B：合规决策（应被放行）────────────────────────────────────────
const allowedAction = {
  decisionId: 'demo-B-allowed',
  action: '按既定配方在压力界内生产（温度带 [0,1]、压力带 [0.5,2]），并用读数复算校验定位',
  context: { agent: '运维-Agent-07', source: 'approved-recipe', world: 'reactor' },
  claimedProperties: [
    { property: '工艺约束可同时满足：温度带 [0,1] 与压力带 [0.5,2] 有交集', class: 'constraint',
      payload: { constraints: [{ id: '温度带', interval: [0, 1] }, { id: '压力带', interval: [0.5, 2] }] } },
    { property: '定位读数满足 x²+y²=25 且 x+y=7，核验解为 x=3, y=4', class: 'algebraic',
      payload: { equations: ['x^2+y^2=25', 'x+y=7'], claimed: { x: 3, y: 4 } } },
  ],
};

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

// ── HTML 渲染 ─────────────────────────────────────────────────────────
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const V = {
  verified: ['✓ 已验证', '#0a7d33', '#e6f6ea'],
  refuted: ['✗ 已证伪', '#b3261e', '#fdeceb'],
  unverified: ['𝕌 诚实弃权', '#8a6d00', '#fdf6dd'],
};
const DEC = {
  trusted: ['✓ 决策可信 · 放行', '#0a7d33', '#e6f6ea'],
  untrusted: ['✗ 决策不可信 · 拦下', '#b3261e', '#fdeceb'],
  abstain: ['𝕌 无法判定 · 弃权', '#8a6d00', '#fdf6dd'],
};
function propRows(props) {
  return props.map(pr => {
    const [label, fg, bg] = V[pr.verdict] || [pr.verdict, '#333', '#eee'];
    const po = pr.proofObject || {};
    const proof = Array.isArray(po.proof) ? po.proof.map(s => '<li>' + esc(s) + '</li>').join('') : '';
    const ev = pr.evidence ? '\n' + esc(JSON.stringify(pr.evidence, null, 2)).slice(0, 2000) : '（无）';
    return '<tr>'
      + '<td class="mono">' + esc(pr.property) + '<div class="kind">' + esc(pr.class) + '</div></td>'
      + '<td><span class="badge" style="color:' + fg + ';background:' + bg + ';border:1px solid ' + fg + '33">' + label + '</span></td>'
      + '<td class="reason">' + esc(pr.reason)
      + (po.theorem ? '<div class="engine">定理：' + esc(po.theorem) + '</div>' : '')
      + (proof ? '<ul class="proof">' + proof + '</ul>' : '')
      + '<details><summary>证据原文</summary><pre class="mono">' + ev + '</pre></details></td>'
      + '</tr>';
  }).join('\n');
}
function renderCase(title, rep, expected) {
  const [dlabel, dfg, dbg] = DEC[rep.decisionVerdict] || [rep.decisionVerdict, '#333', '#eee'];
  const gate = (rep.decisionVerdict === 'trusted')
    ? '<span class="gate gate-open">⮕ 闸门放行：动作可执行</span>'
    : (rep.decisionVerdict === 'untrusted')
      ? '<span class="gate gate-block">⛔ 闸门拒绝：动作被拦下，不执行</span>'
      : '<span class="gate gate-abstain">⏸ 闸门弃权：无法判定，默认不执行（fail-closed）</span>';
  return '<div class="case">'
    + '<h2>' + esc(title) + '</h2>'
    + '<div class="meta"><b>动作</b>：' + esc(rep.action || '') + '<br>'
    + '<b>决策证书号</b>：<span class="mono">' + esc(rep.reportId) + '</span> <span style="color:#666">(sha256 全串：' + esc(rep.reportIdFull) + ')</span></div>'
    + '<div class="verdict" style="background:' + dbg + ';border:1px solid ' + dfg + ';color:' + dfg + '">' + dlabel + '<div class="vmean">' + esc(rep.decisionVerdictMeaning) + '</div></div>'
    + gate
    + '<table><tr><th style="width:36%">声明属性</th><th style="width:96px">判定</th><th>判定依据（引擎留痕 + 证明步骤）</th></tr>'
    + propRows(rep.properties) + '</table>'
    + '<p class="note">判定来源：' + esc((rep.summary && rep.summary.certifiedBy) || '灵脑（裁判：仅判定、不提议）')
    + ' ｜ 声明来源：' + esc((rep.summary && rep.summary.claimedBy) || '智能体（运动员）') + '</p>'
    + '</div>';
}
function render(a, b) {
  return `<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8">
<title>决策闸门 · 灵脑拦下违规决策</title>
<style>
body{font-family:"Microsoft YaHei",system-ui,sans-serif;max-width:1080px;margin:24px auto;padding:0 16px;color:#1c1c1e;background:#fafafa;line-height:1.65}
h1{font-size:22px;border-bottom:2px solid #1c1c1e;padding-bottom:8px}
h2{font-size:17px;margin-top:28px}
.meta{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px 16px;font-size:13px}
.mono{font-family:Consolas,monospace}
.case{border:1px solid #e0e0e0;border-radius:10px;padding:6px 16px 16px;margin:16px 0;background:#fff}
.verdict{font-size:18px;font-weight:700;border-radius:8px;padding:12px 16px;margin:12px 0}
.vmean{font-size:13px;font-weight:400;margin-top:4px}
.gate{display:inline-block;margin:6px 0;padding:6px 14px;border-radius:18px;font-weight:700;font-size:14px}
.gate-block{background:#fdeceb;color:#b3261e;border:1px solid #b3261e}
.gate-open{background:#e6f6ea;color:#0a7d33;border:1px solid #0a7d33}
.gate-abstain{background:#fdf6dd;color:#8a6d00;border:1px solid #8a6d00}
table{width:100%;border-collapse:collapse;background:#fff;font-size:13px;margin-top:8px}
td,th{border:1px solid #e3e3e3;padding:8px 10px;vertical-align:top;text-align:left}
th{background:#f0f0f0}
.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-weight:600;white-space:nowrap}
.kind{color:#666;font-size:11px;margin-top:4px}
.engine{color:#555;font-size:12px;margin-top:4px}
.reason{font-size:13px}
.proof{margin:6px 0 0 16px;font-size:12px;color:#333}
.note{background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:10px 14px;font-size:13px}
details{margin-top:6px}summary{cursor:pointer;color:#0b57d0;font-size:12px}
pre{background:#f6f6f6;border:1px solid #e3e3e3;border-radius:6px;padding:8px;max-height:200px;overflow:auto;font-size:11px;white-space:pre-wrap}
footer{color:#666;font-size:12px;margin-top:24px;border-top:1px solid #ddd;padding-top:10px}
.kicker{color:#b3261e;font-weight:700}
</style></head><body>
<h1>决策闸门演示 · <span class="kicker">形式化证明拦下违规决策</span></h1>
<div class="note"><b>定位</b>：灵脑 = 智能体与机器人的<b>信任与审计层（裁判，非运动员）</b>。运动员（AI 智能体）生成动作并声明其"安全/正确/授权"；
裁判（灵脑）把每条声明交确定性内核重算验证，被确定性证伪即判 <b>untrusted</b>，系统拒绝执行。验证者独立于行动者，故动作可"安全/正确/授权"被证明、被审计。</div>
${renderCase('场景 A · 违规决策（应被拦下）', a, 'untrusted')}
${renderCase('场景 B · 合规决策（应被放行）', b, 'trusted')}
<footer>本报告由 灵脑 LingNao <span class="mono">certify_decision</span> 能力生成：全部判定来自确定性内核（M2 安全证书 / M4 EffectGate / 灵数区间认证 / 紧致性定理），声明文本不参与判定；无法确定性验证的声明一律如实弃权（𝕌）。灵脑未获任何第三方认证，本报告不构成合规或认证结论。</footer>
</body></html>`;
}

(async () => {
  const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'decision-gate-demo', version: '0' } });
  const callA = await rpc('tools/call', { name: 'lingnao', arguments: { op: 'certify_decision', args: blockedAction } });
  const repA = JSON.parse(callA.content[0].text);
  if (!repA.ok) throw new Error('certify_decision(A) ok=false：' + JSON.stringify(repA).slice(0, 300));
  const callB = await rpc('tools/call', { name: 'lingnao', arguments: { op: 'certify_decision', args: allowedAction } });
  const repB = JSON.parse(callB.content[0].text);
  if (!repB.ok) throw new Error('certify_decision(B) ok=false：' + JSON.stringify(repB).slice(0, 300));
  fs.writeFileSync(OUT, render(repA, repB), 'utf8');
  console.log('initialize version =', init.serverInfo.version);
  console.log('场景A 动作：', blockedAction.action);
  console.log('  decisionVerdict =', repA.decisionVerdict, '｜', repA.decisionVerdictMeaning);
  repA.properties.forEach(pr => console.log('   · [' + pr.class + '] ' + pr.verdict + ' :: ' + String(pr.reason).slice(0, 70)));
  console.log('   reportId =', repA.reportId);
  console.log('场景B 动作：', allowedAction.action);
  console.log('  decisionVerdict =', repB.decisionVerdict, '｜', repB.decisionVerdictMeaning);
  repB.properties.forEach(pr => console.log('   · [' + pr.class + '] ' + pr.verdict + ' :: ' + String(pr.reason).slice(0, 70)));
  console.log('   reportId =', repB.reportId);
  console.log('HTML ->', OUT);
  p.kill();
})().catch(e => { console.error('DEMO FAIL:', e.message); p.kill(); process.exit(1); });

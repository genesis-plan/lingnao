#!/usr/bin/env node
/**
 * 合规证据批审 · PoC 演示生成器（2026-09-24）
 * 走真实产品路径：spawn lingnao-mcp.js（MCP stdio + 单一网关 lingnao）→ op=audit_evidence
 * 对一组模拟「AI Agent 输出抽检」的声明逐条做确定性验证，生成可直接点开看的证据报告 HTML。
 *
 * 用法：
 *   node examples/compliance-evidence-demo.js [输出.html]
 * 诚实边界：
 *   - 演示中的被审声明为模拟样例；验证全部由确定性内核真实执行（灵数引擎 / M2 / A* / 紧致性）。
 *   - AIUC-1 仅为参考映射；灵脑未获 AIUC-1 认证，本报告不构成任何认证或合规结论。
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.execPath;
const OUT = process.argv[2] || path.join(ROOT, '.workbuddy', 'reports', '2026-09-24-AI合规审计-证据报告演示.html');

// ── 被审声明（模拟某采购 Agent 的 8 条输出抽检）──────────────────────────
const items = [
  { id: 'A-001', kind: 'algebraic',
    text: 'Agent 声称：三台设备单价 x 与运费 y 满足 x²+y²=25（元）、x+y=7（元），并给出 x=3、y=4',
    equations: ['x^2+y^2=25', 'x+y=7'], claimed: { x: 3, y: 4 } },
  { id: 'A-002', kind: 'algebraic',
    text: 'Agent 声称：同一方程组的另一组解为 x=5、y=0',
    equations: ['x^2+y^2=25', 'x+y=7'], claimed: { x: 5, y: 0 } },
  { id: 'A-003', kind: 'constraint',
    text: 'Agent 声称：预算区间 [800,1000] 元与最低报价区间 [1200,1500] 元可同时满足',
    constraints: [{ id: '预算', interval: [800, 1000] }, { id: '报价', interval: [1200, 1500] }] },
  { id: 'A-004', kind: 'constraint',
    text: 'Agent 声称：交付周期 [10,20] 天与测试窗口 [15,30] 天可同时安排',
    constraints: [{ id: '交付期', interval: [10, 20] }, { id: '测试窗口', interval: [15, 30] }] },
  { id: 'A-005', kind: 'numeric_safety',
    text: 'Agent 声称：温控状态在域 |x|≤1、|y|≤1 内恒满足安全不变式 1-(x²+y²) ≥ 0',
    hExpr: '1 - (x^2 + y^2)', vars: ['x', 'y'], domain: { x: [-1, 1], y: [-1, 1] } },
  { id: 'A-006', kind: 'path',
    text: 'Agent 声称：从 CHARGE 到 C 的最优路线为 CHARGE→A→B→C，总代价 7.242641',
    start: 'CHARGE', goal: 'C', claimedPath: ['CHARGE', 'A', 'C'], claimedCost: 7.242641 },
  { id: 'A-007', kind: 'path',
    text: 'Agent 声称：同一路线还能更省，总代价只要 5',
    start: 'CHARGE', goal: 'C', claimedPath: ['CHARGE', 'A', 'B', 'C'], claimedCost: 5 },
  { id: 'A-008', kind: 'free_text',
    text: 'Agent 自称：本方案是行业内最优选择，无需 further 验证',
  },
];

// ── MCP stdio 驱动（NDJSON，真实产品路径）───────────────────────────────
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

// ── HTML 渲染 ──────────────────────────────────────────────────────────
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const BADGE = { verified: ['✓ 已验证', '#0a7d33', '#e6f6ea'], refuted: ['✗ 已证伪', '#b3261e', '#fdeceb'], unverified: ['𝕌 诚实弃权', '#8a6d00', '#fdf6dd'] };
function render(rep) {
  const s = rep.summary;
  const rows = rep.items.map(it => {
    const [label, fg, bg] = BADGE[it.verdict] || [it.verdict, '#333', '#eee'];
    const ev = it.evidence ? '\n' + esc(JSON.stringify(it.evidence, null, 2)).slice(0, 4000) : '（无）';
    return '<tr>'
      + '<td class="mono">' + esc(it.id) + '<div class="kind">' + esc(it.kind) + '</div></td>'
      + '<td>' + esc(it.text) + '</td>'
      + '<td><span class="badge" style="color:' + fg + ';background:' + bg + ';border:1px solid ' + fg + '33">' + label + '</span></td>'
      + '<td class="reason">' + esc(it.reason) + '<div class="engine">引擎：' + esc(it.engine || '—（无确定性验证器，诚实弃权）') + '</div>'
      + '<details><summary>证据原文</summary><pre class="mono">' + ev + '</pre></details></td>'
      + '</tr>';
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8">
<title>合规证据报告 ${esc(rep.reportId)}</title>
<style>
body{font-family:"Microsoft YaHei",system-ui,sans-serif;max-width:1080px;margin:24px auto;padding:0 16px;color:#1c1c1e;background:#fafafa;line-height:1.65}
h1{font-size:22px;border-bottom:2px solid #1c1c1e;padding-bottom:8px}
h2{font-size:17px;margin-top:28px}
.meta{background:#fff;border:1px solid #ddd;border-radius:8px;padding:12px 16px;font-size:13px}
.mono{font-family:Consolas,monospace}
.cards{display:flex;gap:12px;margin:14px 0;flex-wrap:wrap}
.card{flex:1;min-width:140px;border-radius:8px;padding:12px 16px;border:1px solid #ddd;background:#fff}
.card .n{font-size:26px;font-weight:700}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #ddd;font-size:13px}
td,th{border:1px solid #e3e3e3;padding:8px 10px;vertical-align:top;text-align:left}
th{background:#f0f0f0}
.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-weight:600;white-space:nowrap}
.kind{color:#666;font-size:11px;margin-top:4px}
.engine{color:#555;font-size:12px;margin-top:4px}
details{margin-top:6px}summary{cursor:pointer;color:#0b57d0;font-size:12px}
pre{background:#f6f6f6;border:1px solid #e3e3e3;border-radius:6px;padding:8px;max-height:260px;overflow:auto;font-size:11px;white-space:pre-wrap}
.note{background:#fdf6dd;border:1px solid #e0c96b;border-radius:8px;padding:10px 14px;font-size:13px}
footer{color:#666;font-size:12px;margin-top:24px;border-top:1px solid #ddd;padding-top:10px}
</style></head><body>
<h1>AI Agent 输出 · 合规证据报告</h1>
<div class="meta">
  <b>案卷</b>：${esc(rep.caseLabel || '—')}<br>
  <b>reportId</b>：<span class="mono">${esc(rep.reportId)}</span> <span style="color:#666">(sha256 全串：${esc(rep.reportIdFull)})</span><br>
  <b>生成时刻</b>：${esc(rep.generatedAt)} ｜ <b>内核</b>：ALGO_VERSION <span class="mono">${esc(rep.kernel.algoVersion)}</span> · SEED <span class="mono">${esc(JSON.stringify(rep.kernel.seed))}</span> · 确定性 · 离线
</div>
<div class="cards">
  <div class="card"><div class="n">${s.total}</div>声明总数</div>
  <div class="card" style="border-color:#0a7d33"><div class="n" style="color:#0a7d33">${s.verified}</div>✓ 已验证（确定性确认）</div>
  <div class="card" style="border-color:#b3261e"><div class="n" style="color:#b3261e">${s.refuted}</div>✗ 已证伪（确定性反驳）</div>
  <div class="card" style="border-color:#8a6d00"><div class="n" style="color:#8a6d00">${s.unverified}</div>𝕌 诚实弃权（无法验证）</div>
</div>
<p><b>幻觉风险</b>：${esc(s.hallucinationRisk)}</p>
<p class="note"><b>三分口径</b>：${esc(s.honesty)}</p>
<h2>逐条验证明细</h2>
<table><tr><th style="width:90px">编号</th><th style="width:34%">被审声明原文</th><th style="width:110px">判定</th><th>判定依据（引擎留痕）</th></tr>
${rows}
</table>
<h2>审计控制映射（参考）</h2>
<div class="meta">
<b>对应标准</b>：${esc(rep.aiucReference.standard)}
<table style="margin-top:8px"><tr><th style="width:220px">控制项</th><th>本报告的证据结构</th></tr>
${Object.entries(rep.aiucReference.mapping).map(([k, v]) => '<tr><td><b>' + esc(k) + '</b></td><td>' + esc(v) + '</td></tr>').join('\n')}
</table>
<p class="note" style="margin-top:10px">${esc(rep.aiucReference.disclaimer)}</p>
</div>
<h2>可复现性（防篡改）</h2>
<div class="meta">
<b>算法</b>：<span class="mono">${esc(rep.reproducible.algorithm)}</span><br>
<b>reportId 公式</b>：<span class="mono">${esc(rep.reproducible.reportIdFormula)}</span><br>
${esc(rep.reproducible.note)}
</div>
<footer>本报告由 灵脑 LingNao <span class="mono">audit_evidence</span> 能力生成：全部判定来自确定性内核（灵数求解器区间认证 / M2 安全证书 / A* 重算 / 紧致性定理），声明文本不参与判定；无法确定性验证的声明一律如实弃权（𝕌），不存在第四种「大概没错」。</footer>
</body></html>`;
}

(async () => {
  const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'evidence-demo', version: '0' } });
  const call = await rpc('tools/call', { name: 'lingnao', arguments: { op: 'audit_evidence', args: { caseLabel: '演示案卷 · 某采购 Agent 输出抽检（8 条模拟声明）', items } } });
  const rep = JSON.parse(call.content[0].text);
  if (!rep.ok) throw new Error('audit_evidence 返回 ok=false：' + JSON.stringify(rep).slice(0, 300));
  fs.writeFileSync(OUT, render(rep), 'utf8');
  console.log('initialize version =', init.serverInfo.version);
  rep.items.forEach(it => console.log('  ' + it.id + ' [' + it.kind + '] ' + it.verdict + ' :: ' + String(it.reason).slice(0, 72)));
  console.log('summary =', JSON.stringify(rep.summary.total) + ' 条 | verified ' + rep.summary.verified + ' / refuted ' + rep.summary.refuted + ' / unverified ' + rep.summary.unverified);
  console.log('reportId =', rep.reportId);
  console.log('HTML ->', OUT);
  p.kill();
})().catch(e => { console.error('DEMO FAIL:', e.message); p.kill(); process.exit(1); });

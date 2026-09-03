#!/usr/bin/env node
/**
 * lingnao-sideeffect-audit.js —— 副作用面完备性审查（诊断工具，零改动内核）
 *
 * 回答一个产品级问题：
 *   「灵脑所有能触碰外部世界的出口，是否都被门控链覆盖、都被审计账本记录？」
 *
 * 这与 proveGateChain 证明的东西不同 —— 两者互补：
 *   proveGateChain      : 门控逻辑【本身】对不对（soundness，正确性）
 *   本工具              : 是不是【所有】出口都过了门控（completeness，完备性）
 *
 * 只证明 soundness 而 completeness 不成立时，攻击者只需找一条旁路，
 * 门控再正确也与结论无关。这正是本工具存在的理由。
 *
 * 方法：源码级静态扫描（可读、可复现、无需运行），输出机器可比对的事实清单。
 * 诚实边界：正则扫描，不做数据流/控制流精确分析 —— 它可能【漏报】（复杂间接调用），
 * 不会【凭空捏造】出口。结论仅供人研判，不可当作数学证明。
 *
 * 用法：node lingnao-sideeffect-audit.js
 */

'use strict';
const fs = require('fs');
const path = require('path');

const KERNEL = path.join(__dirname, '灵脑.html');
if (!fs.existsSync(KERNEL)) { console.error('找不到内核 灵脑.html'); process.exit(1); }

const src = fs.readFileSync(KERNEL, 'utf8');
const lines = src.split(/\r?\n/);

// ── 去注释/去字符串（粗糙但可复现；目的只是减少误报，不追求完美）──────────────
function stripCode(L) {
  return L
    .replace(/\/\/.*$/, '')
    .replace(/\/\*.*?\*\//g, '')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/`[^`]*`/g, '``');
}

// ── 副作用出口模式（每类标注：是否必须过门控 / 默认是否在门控覆盖内）──────────
const EXITS = [
  { id: 'body-adapter', label: '身体适配器调用（物理动作唯一出口）',
    re: /\bbodyAdapter\s*\(/g, gated: 'yes', note: 'execute() 内唯一物理出口，已被 M1 前置守卫覆盖' },
  { id: 'http-fetch', label: 'HTTP 外发 fetch/XHR/WebSocket',
    re: /\b(fetch|XMLHttpRequest|WebSocket)\s*\(/g, gated: 'unknown', note: '数据外泄面：需确认是否经门控与审计' },
  { id: 'node-https', label: 'Node https/http 请求',
    re: /\b(httpsMod|httpMod)\.(request|get)\s*\(/g, gated: 'unknown', note: '与 fetch 同一外发面，Node 路径' },
  { id: 'node-net', label: 'require node: 网络/文件/进程模块',
    re: /require\(\s*'node:(https?|fs|child_process|net|dgram)'\s*\)/g, gated: 'unknown', note: '文件系统/子进程属高危面' },
  { id: 'eval', label: '动态执行 eval / new Function',
    re: /\b(eval|new\s+Function)\s*\(/g, gated: 'unknown', note: '可绕过一切静态门控，出现即须说明' },
  { id: 'storage', label: '浏览器持久化 localStorage/sessionStorage/IndexedDB',
    re: /\b(localStorage|sessionStorage|indexedDB)\b/g, gated: 'unknown', note: '本地持久化面' }
];

// ── execute() 源码区间（门控生效范围）──────────────────────────────────────────
function findRanges() {
  const r = {};
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(?:async\s+)?function\s+(\w+)\s*\(/);
    if (m && !r[m[1]]) r[m[1]] = { start: i + 1, end: -1 };
  }
  // 用下一个顶层 function 作为上一个的结束
  const keys = Object.keys(r).sort((a, b) => r[a].start - r[b].start);
  keys.forEach((k, idx) => { r[k].end = (idx + 1 < keys.length) ? r[keys[idx + 1]].start - 1 : lines.length; });
  return r;
}
const RANGES = findRanges();
const EXE = RANGES['execute'] || { start: -1, end: -1 };
// 只认 execute() 区间内的真实守卫（注释里的同形文字不算）—— 顺序取区间内首个命中。
const GATE_LINE = (() => {
  for (let i = 0; i < lines.length; i++) {
    if (i + 1 < EXE.start || i + 1 > EXE.end) continue;
    if (/opts\.gateProof\s*!==\s*false/.test(lines[i])) return i + 1;
  }
  return -1;
})();

function owner(lineNo) {
  let best = null;
  Object.keys(RANGES).forEach(k => {
    const g = RANGES[k];
    if (lineNo >= g.start && lineNo <= g.end) { if (!best || g.start > RANGES[best].start) best = k; }
  });
  return best || '(顶层)';
}

// ── 审计事件覆盖：收集 auditEvent( 的第一个字符串参数 ──────────────────────────
// 注意：这里【不能】剥字符串 —— 事件类型名本身就是字符串字面量，剥掉就抓不到。
// 只去掉整行注释开头与行尾注释（保守：仅当 // 出现在行首或行尾非字符串场景才剥离）。
function stripCommentOnly(L) {
  return L.replace(/\/\*.*?\*\//g, '').replace(/\s*\/\/[^'"]*$/, '');
}

function auditEvents() {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const code = stripCommentOnly(lines[i]);
    const m = code.match(/\bauditEvent\(\s*([^,]+),/);
    if (!m) continue;
    const arg = m[1];
    // 两种形态：① 直接字符串字面量 ② 三元 cond ? 'a' : 'b'（两种都算覆盖）
    const lits = arg.match(/'([^']+)'/g);
    if (!lits) continue;
    lits.forEach(lit => {
      out.push({ line: i + 1, type: lit.replace(/'/g, ''), conditional: /\?/.test(arg), owner: owner(i + 1) });
    });
  }
  return out;
}
const AUDITS = auditEvents();

// ── 扫描 ──────────────────────────────────────────────────────────────────────
const findings = [];
EXITS.forEach(ex => {
  for (let i = 0; i < lines.length; i++) {
    const code = stripCode(lines[i]);
    const re = new RegExp(ex.re.source, ex.re.flags.includes('g') ? ex.re.flags : ex.re.flags + 'g');
    let m; let hit = false;
    while ((m = re.exec(code)) !== null) { hit = true; }
    if (hit) {
      findings.push({
        exit: ex.id, label: ex.label, line: i + 1, owner: owner(i + 1),
        raw: lines[i].trim().slice(0, 78)
      });
    }
  }
});

// ── 报告 ──────────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));
console.log('═'.repeat(78));
console.log('灵脑 · 副作用面完备性审查（诊断，不改内核）');
console.log('═'.repeat(78));
console.log('');
console.log('【门控范围】execute() 源码区间 L' + EXE.start + '–L' + EXE.end + '；门控前置守卫位于 L' + GATE_LINE);
console.log('');

const byExit = {};
findings.forEach(f => { (byExit[f.exit] = byExit[f.exit] || []).push(f); });

console.log('── 一、副作用出口清单 ──────────────────────────────────────────────');
EXITS.forEach(meta => {
  const ex = meta.id;
  const hits = byExit[ex] || [];
  console.log('');
  console.log('  [' + (hits.length ? '有' : '无') + '] ' + ex + ' — ' + meta.label + '（' + hits.length + ' 处）');
  console.log('       ' + meta.note);
  hits.forEach(h => {
    const inExec = (h.line >= EXE.start && h.line <= EXE.end);
    const afterGate = (GATE_LINE > 0 && h.line > GATE_LINE && inExec);
    const cover = (ex === 'body-adapter') ? (afterGate ? '✅ 在门控之后' : '⚠️ 未确认在门控之后')
      : (inExec ? '⚠️ 在 execute 内但非受控出口' : '🔴 execute 之外（不在门控作用域）');
    console.log('       L' + pad(h.line, 6) + ' ' + pad(cover, 34) + ' 宿主=' + h.owner);
  });
});

console.log('');
console.log('── 二、审计账本事件覆盖 ────────────────────────────────────────────');
const types = {};
AUDITS.forEach(a => { types[a.type] = (types[a.type] || 0) + 1; });
Object.keys(types).sort().forEach(t => {
  console.log('   ' + pad(t, 26) + ' × ' + types[t] + '   (宿主: ' + AUDITS.filter(a => a.type === t).map(a => a.owner).join(', ') + ')');
});
console.log('');
console.log('   审计事件种类数 = ' + Object.keys(types).length);

// ── 完备性判定（人可读的结论，非数学证明）────────────────────────────────────
const ungated = findings.filter(f => {
  if (f.exit === 'body-adapter') return !(GATE_LINE > 0 && f.line > GATE_LINE && f.line >= EXE.start && f.line <= EXE.end);
  return true; // 其余类别：一律视为「未在门控作用域内」，待人研判
});

console.log('');
console.log('── 三、完备性结论 ──────────────────────────────────────────────────');
console.log('   受控出口（经 M1 门控链）: ' + (byExit['body-adapter'] || []).length + ' 处');
console.log('   未受控出口（旁路候选）  : ' + ungated.length + ' 处');
if (ungated.length) {
  console.log('');
  console.log('   🔴 完备性不成立：存在 ' + ungated.length + ' 条不经门控的出口。');
  console.log('      这意味着 proveGateChain 的结论只对「走 execute() 的物理动作」有效，');
  console.log('      对下列出口无效：');
  const g = {};
  ungated.forEach(f => { g[f.exit] = (g[f.exit] || 0) + 1; });
  Object.keys(g).forEach(k => console.log('        · ' + pad(k, 16) + g[k] + ' 处 — ' + EXITS.find(e => e.id === k).label));
} else {
  console.log('   ✅ 完备性成立（在正则扫描可见范围内）。');
}
console.log('');
console.log('   诚实边界：正则静态扫描，可能漏报（间接调用/动态分发），不会捏造。');
console.log('   本工具给出事实清单，不是数学证明 —— 完备性的机器可检验证明仍需 M1-C。');
console.log('═'.repeat(78));

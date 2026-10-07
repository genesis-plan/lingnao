#!/usr/bin/env node
'use strict';
/**
 * 灵脑 · 通用「AI 数字结论验真器」C 端验真服务（2026-09-30）
 * ───────────────────────────────────────────────────────────────────
 * 把灵脑确定性内核（lingnao-mcp.js）包装成普通人能用的网页验真器：
 *   · 你（或你用的任何 AI）给出一个带数字 / 公式 / 逻辑的结论，
 *   · 灵脑用确定性内核独立复算，告诉你「对 / 错 / 证不了」。
 *   · 不靠再问一个 AI（第二个 AI 也会错）；灵脑自己不生成答案，只当裁判抓错。
 *
 * 合规护城河（铁律，不可绕过）：
 *   · 只接可结构化的数字 / 算式 / 逻辑（kind ∈ algebraic / constraint），
 *     不接 factual / causal（主观/因果，内核诚实 𝕌 也不暴露给 C 端）。
 *   · 凡 text 命中持牌领域（医疗 / 心理 / 教育 / 金融建议 / 法律）→ 直接拒绝，
 *     明确告知「这块不在服务范围」。灵脑绝不进那四格。
 *   · 只核验「已给出的具体数字/算式对错」，不替人做「该怎么做」的决策。
 *
 * 用法：node lingnao-verify-server.js [port]
 *   默认端口 8088，可用 PORT 环境变量或命令行参数覆盖。
 *   启动后浏览器打开 http://localhost:8088/
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = __dirname;
const KERNEL = path.join(ROOT, 'lingnao-mcp.js');
const PLAYGROUND = path.join(ROOT, 'verify-playground.html');
const PORT = Number(process.argv[2] || process.env.PORT || 8088);
const MAX_ITEMS = 10;

// 原生 lite 精确有理数判定引擎（灵数不可达/需精确时的边缘兜底；零依赖）
let LINGNAO_LITE = null;
try { LINGNAO_LITE = require('./lingnao-lite-math'); } catch (_e) { /* 无原生兜底，退回内核 */ }

// ── 合规护城河：持牌领域关键词（命中即拒，不进那四格）──────────────────────
const RED_FLAGS = [
  '医疗', '医院', '医生', '诊断', '处方', '服药', '治疗', '病情', '症状', '疾患', '体检',
  '心理', '抑郁', '焦虑', '心理咨询', '心理辅导', '情绪疏导',
  '作业', '补习', '培训', '考试辅导', '课程辅导', '家教',
  '股票', '基金', '理财', '投资', '保险', '贷款', '证券',
  '避税', '节税', '税务筹划', '合理避税',
  '法律咨询', '律师', '起诉', '诉讼', '法律', '合同', '仲裁', '司法', '条款', '合同纠纷',
  // 英文词表（2026-10-01 出海补）：前端 playground 与后端同形，英文文案必须同样拦住
  'medical', 'medicine', 'diagnos', 'prescription', 'medication', 'doctor', 'hospital', 'patient', 'symptom',
  'treatment', 'therapy', 'pill', 'drug', 'clinic', 'disease',
  'psycholog', 'therapist', 'psychotherapy', 'depress', 'anxiety', 'counsel', 'mental health', 'emotional support',
  'homework', 'tutoring', 'tutor', 'exam prep', 'coursework', 'lesson plan', 'classroom',
  'stock', 'stocks', 'dividend', 'portfolio', 'invest', 'insurance', 'mortgage', 'securit', 'trading', 'crypto',
  'bitcoin', 'broker',
  'tax advice', 'tax evasion', 'tax avoidance', 'tax planning', 'evade taxes',
  'legal advice', 'lawyer', 'attorney', 'lawsuit', 'litigation',
];
const EN_RED_FLAGS = [
  'medical', 'medicine', 'diagnos', 'prescription', 'medication', 'doctor', 'hospital', 'patient', 'symptom',
  'treatment', 'therapy', 'pill', 'drug', 'clinic', 'disease',
  'psycholog', 'therapist', 'psychotherapy', 'depress', 'anxiety', 'counsel', 'mental health', 'emotional support',
  'homework', 'tutoring', 'tutor', 'exam prep', 'coursework', 'lesson plan', 'classroom',
  'stock', 'stocks', 'dividend', 'portfolio', 'invest', 'insurance', 'mortgage', 'securit', 'trading', 'crypto',
  'bitcoin', 'broker',
  'tax advice', 'tax evasion', 'tax avoidance', 'tax planning', 'evade taxes',
  'legal advice', 'lawyer', 'attorney', 'lawsuit', 'litigation',
];
// 中英词表合并后统一判定
const RED_FLAGS_ALL = RED_FLAGS.concat(EN_RED_FLAGS);
// 英文法律词用词边界匹配：裸 legal/contract/clause 要拦，但不得误伤数学词（graph contraction 拓扑收缩）
const RED_FLAGS_RE = [
  /\blegal\b/i, /\bcontract(?!ion|or)\b/i, /\bclauses?\b/i,
  /\bjurisdiction\b/i, /\bstatutes?\b/i, /\barbitrat/i, /\bsue\b/i, /\bnotary\b/i,
];
function isRedFlag(text) {
  if (typeof text !== 'string' || !text) return null;
  for (const kw of RED_FLAGS_ALL) if (text.toLowerCase().indexOf(kw) >= 0) return kw;
  for (const re of RED_FLAGS_RE) if (re.test(text)) return re.source;
  return null;
}

// ── 持久化内核子进程 + NDJSON 客户端（复用，不每请求重启）──────────────────
let child = null;
let childBuf = '';
let pending = new Map();   // id -> {resolve, reject}
let nextId = 0;
let kernelReady = Promise.resolve(false);  // init 完成后 resolve(true)
let serverRunning = true;

function startKernel() {
  pending = new Map();
  childBuf = '';
  let resolveReady;
  kernelReady = new Promise((res) => { resolveReady = res; });

  child = spawn(process.execPath, [KERNEL], { cwd: ROOT, stdio: ['pipe', 'pipe', 'inherit'] });

  child.stdout.on('data', (d) => {
    childBuf += d.toString('utf8');
    let nl;
    while ((nl = childBuf.indexOf('\n')) !== -1) {
      const line = childBuf.slice(0, nl).trim();
      childBuf = childBuf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch (e) { continue; }
      if (msg.id === undefined) continue;            // 通知（无 id）忽略
      const p = pending.get(msg.id);
      if (!p) continue;
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error((msg.error.message) || JSON.stringify(msg.error)));
      else p.resolve(msg.result);
    }
  });

  child.on('exit', (code) => {
    console.error('[kernel] lingnao-mcp.js 退出 code=' + code + '，准备重启');
    for (const [, p] of pending) p.reject(new Error('内核进程已退出'));
    pending.clear();
    if (serverRunning) setTimeout(startKernel, 600);
  });

  child.on('error', (e) => console.error('[kernel] spawn 失败：', e.message));

  // ① initialize 握手
  rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'lingnao-verify-server', version: '1.0.0' } })
    .then((init) => {
      console.log('[kernel] 已连接，版本=' + (init && init.serverInfo && init.serverInfo.version));
      resolveReady(true);
    })
    .catch((e) => { console.error('[kernel] initialize 失败：', e.message); resolveReady(false); });
}

function rpc(method, params) {
  return new Promise((resolve, reject) => {
    if (!child || child.exitCode !== null) { reject(new Error('内核尚未就绪')); return; }
    const id = ++nextId;
    const t = setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error('内核响应超时：' + method)); }
    }, 60000);
    pending.set(id, { resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
    try {
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    } catch (e) { pending.delete(id); clearTimeout(t); reject(e); }
  });
}

async function callAudit(items, caseLabel, budget) {
  // 等待内核 initialize 完成
  let ready = false;
  try { ready = await kernelReady; } catch (e) { ready = false; }
  if (!ready) throw new Error('内核未就绪');
  const res = await rpc('tools/call', { name: 'lingnao', arguments: ({ op: 'audit_evidence', args: (budget ? { items, caseLabel, budget: budget } : { items, caseLabel }) }) });
  if (!res || !res.content || !res.content[0] || typeof res.content[0].text !== 'string') {
    throw new Error('内核返回空响应');
  }
  return JSON.parse(res.content[0].text);
}

// 判定「这条文本是不是英文输入」：中文字符占比低且含字母即视为英文（出海英文页专用）
function looksEnglish(text) {
  const s = String(text || '');
  if (!s) return false;
  const cjk = (s.match(/[一-鿿]/g) || []).length;
  const lat = (s.match(/[A-Za-z]/g) || []).length;
  return lat > 0 && cjk === 0;
}

// 内核 reason（中文）→ 英文对照（前缀匹配；未命中的保留原文）
const EN_REASONS_PREFIX = [
  ['未提供 claimed', 'No claimed value was provided: the true solution set was computed, but there is nothing to compare against, so the verdict is honestly unverified (U).'],
  ['algebraic 载荷缺 equations', 'The algebraic payload is missing "equations" (a non-empty array of strings).'],
  ['constraint 载荷缺', 'The constraint payload is missing required fields.'],
  ['载荷缺', 'The payload is missing required fields.'],
];
function enReasonFor(reason) {
  const s = String(reason || '');
  for (const [prefix, en] of EN_REASONS_PREFIX) {
    if (s.startsWith(prefix)) return en;
  }
  return null;
}

// ── 请求校验 + 合规护栏 ──────────────────────────────────────────────────
// 1.4.0：新增 membership / entail / consistency 三个判定原语（membership=集合归属，entail=∀ 边界蕴含，consistency=多声明互斥）
const ALLOWED_KIND = new Set(['algebraic', 'membership', 'entail', 'consistency', 'constraint']);

function validateItems(body) {
  if (!body || !Array.isArray(body.items)) return { error: 'items 必须为数组' };
  if (body.items.length < 1) return { error: 'items 不能为空' };
  if (body.items.length > MAX_ITEMS) return { error: '单次最多核验 ' + MAX_ITEMS + ' 条' };
  const clean = [];
  for (let i = 0; i < body.items.length; i++) {
    const it = body.items[i] || {};
    // 归一化：允许 payload 嵌套（与内核同形）
    const merged = (it.payload && typeof it.payload === 'object') ? Object.assign({}, it, it.payload) : it;
    const kind = merged.kind || it.kind;
    if (!ALLOWED_KIND.has(kind)) {
      return { error: 'kind="' + String(kind) + '" 不在 C 端可核验范围（可核：algebraic / membership / entail / consistency / constraint）。主观/事实/因果类灵脑诚实 𝕌，不在网页暴露。' };
    }
    const flag = isRedFlag(merged.text) || isRedFlag(it.text);
    if (flag) {
      // 英文输入 => 返回英文提示（不把中文报错抛给海外用户）
      if (looksEnglish(merged.text || it.text || '')) {
        return { error: 'A licensed-topic term was detected (“' + flag + '”). Medical, mental-health, education and training, '
          + 'investment or financial advice and legal advice are outside the service. LingNao only checks everyday numbers, '
          + 'formulas, logic and safety boundaries.', compliance: true };
      }
      return { error: '命中持牌领域关键词「' + flag + '」：医疗 / 心理 / 教育 / 金融建议 / 法律 不在灵脑服务范围。灵脑只验日常数字、公式、逻辑对错。' };
    }
    // 数字范围粗筛（防内核越界误判；灵数可证域约为 [-1e4,1e4]）
    const nums = collectNumbers(merged);
    for (const n of nums) {
      if (!isFinite(n) || Math.abs(n) > 1e9) return { error: '数字 ' + n + ' 超出可核验范围（±1e9）' };
    }
    clean.push({
      id: (typeof merged.id === 'string' || typeof merged.id === 'number') ? merged.id : ('item-' + i),
      kind: kind,
      text: typeof merged.text === 'string' ? merged.text : null,
      depends: Array.isArray(merged.depends) ? merged.depends : undefined,
      tol: merged.tol,
      budget: merged.budget,
      maxDepth: merged.maxDepth,
      equations: merged.equations,
      variables: merged.variables,
      domain: merged.domain,
      claimed: merged.claimed,
      op: merged.op,
      bound: merged.bound,
      statements: merged.statements,
      constraints: merged.constraints,
    });
  }
  // ── depends DAG 结构校验（1.4.0）：引用必须存在、不得自依；成环由内核 fail-closed 兜底
  const idSet = {}; clean.forEach(function (x) { idSet[String(x.id)] = true; });
  for (let i = 0; i < clean.length; i++) {
    const d = clean[i].depends;
    if (!Array.isArray(d)) continue;
    if (d.length > 20) return { error: 'depends 最多 20 个引用（item id="' + clean[i].id + '"）' };
    for (const dep of d) {
      if (String(dep) === String(clean[i].id)) return { error: 'depends 校验：item id="' + clean[i].id + '" 依赖自身（不允许）' };
      if (!idSet[String(dep)]) return { error: 'depends 校验：item id="' + clean[i].id + '" 依赖了不存在的 id="' + String(dep) + '"（depends 必须是同一批 items 中的其它 id；成环由内核 fail-closed 拒绝）' };
    }
  }
  // ── depends 环检测（1.4.0）：成环 ⇒ 422 友好拒绝，别让内部异常冒泡成 502
  const indeg2 = {}, adj2 = {};
  clean.forEach(function (x) { indeg2[String(x.id)] = 0; adj2[String(x.id)] = []; });
  clean.forEach(function (x) {
    (Array.isArray(x.depends) ? x.depends : []).forEach(function (d) { adj2[String(d)].push(String(x.id)); indeg2[String(x.id)] += 1; });
  });
  const q = clean.map(function (x) { return String(x.id); }).filter(function (id) { return indeg2[id] === 0; });
  let seen = 0;
  while (q.length) { const id = q.shift(); seen += 1; (adj2[id] || []).forEach(function (nx) { indeg2[nx] -= 1; if (indeg2[nx] === 0) q.push(nx); }); }
  if (seen !== clean.length) return { error: 'depends 成环：拓扑序只能排出 ' + seen + '/' + clean.length + ' 条 ⇒ 拒绝求值（不猜测求值顺序）' };
  // 判定预算 κ（1.4.0）：跑不完的条目诚实 𝕌，不会被算进 verified
  const budget = (typeof body.budget === 'number' && isFinite(body.budget) && body.budget > 0) ? Math.floor(body.budget) : undefined;
  return { items: clean, budget: budget };
}

function collectNumbers(obj) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'number') out.push(v);
    else if (typeof v === 'string') {
      const ms = v.match(/-?\d+(\.\d+)?/g);
      if (ms) ms.forEach(x => out.push(Number(x)));
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(obj);
  return out;
}

// ── HTTP 服务 ───────────────────────────────────────────────────────────
function sendJSON(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(s);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/playground' || req.url === '/playground.html')) {
    fs.readFile(PLAYGROUND, (err, data) => {
      if (err) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('未找到 verify-playground.html'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    sendJSON(res, 200, { ok: true, kernelAlive: !!(child && child.exitCode === null), port: PORT });
    return;
  }
  if (req.method === 'POST' && req.url === '/verify') {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) { raw = ''; req.destroy(); } });
    req.on('end', async () => {
      let body;
      try { body = JSON.parse(raw || '{}'); } catch (e) { return sendJSON(res, 400, { ok: false, error: '请求体不是合法 JSON' }); }
      const v = validateItems(body);
      if (v.error) return sendJSON(res, 422, { ok: false, error: v.error, compliance: true });
      // ── 边缘原生 lite 精确判定预处理（sound：仅精确可判定片段，灵数不可达也能恢复结论）──
      //   · 单条 algebraic / membership 且带 claimed ⇒ 先用精确有理数代入验证；
      //   · 命中 verified/refuted 即短路返回（不依赖灵数求解器，无浮点误差）；
      //   · 其余（多条目 / 无 claimed / 非线性未决）一律退回内核，不抢判。
      if (LINGNAO_LITE && v.items.length === 1) {
        const it = v.items[0];
        // 不强制 claimed：0 变量算术（2+2=4）无 claimed 也能精确判定；有变量无 claimed 时 lite 返回 U 自动退回内核
        if ((it.kind === 'algebraic' || it.kind === 'membership') && Array.isArray(it.equations) && it.equations.length) {
          const dec = LINGNAO_LITE.decideClaim({ equations: it.equations, variables: it.variables, claimed: (it.claimed && typeof it.claimed === 'object') ? it.claimed : undefined });
          if (dec.verdict !== 'U') {
            const verdict = dec.verdict; // 'verified' | 'refuted'
            const varNames = dec.varNames || (Array.isArray(it.variables) ? it.variables : []);
            const witness = dec.point || [];
            const rid = 'lite-' + Date.now().toString(36);
            const out = {
              ok: true, overall: verdict, reportId: rid, reportIdFull: rid,
              summary: { honesty: 'Three verdicts only: verified / refuted / unverified (U).', hallucinationRisk: 'none-detected', note: dec.reason },
              kernel: { engine: 'lingnao-lite-exact', nativeLite: true },
              budget: v.budget || null,
              compositionLaw: '单条代数声明：原生精确有理数判定（不依赖灵数求解器）',
              items: [{
                idx: 0, id: it.id, kind: it.kind, text: it.text, depends: it.depends,
                verdict: verdict, U: false, abstainedBy: null, reason: dec.reason,
                engine: 'lingnao-lite-exact (原生精确有理数)',
                numeric: { tol: 0, tolBasis: 'exact', declaredByCaller: false, maxAllowed: 0 },
                proofObject: { method: 'exact-rational-substitution', decidable: dec.decidable === true, witness: witness },
                evidence: {
                  engine: 'lingnao-lite-exact', resultTypeName: verdict === 'verified' ? 'finite' : 'empty',
                  solutionCount: verdict === 'verified' ? 1 : 0, certified: true,
                  solutions: verdict === 'verified' ? [{ values: witness, text: varNames.map((vn, i) => `${vn}=${witness[i]}`).join(', '), certified: true, tier: 'native-lite-certified', residual: 0 }] : []
                }
              }]
            };
            return sendJSON(res, 200, out);
          }
        }
      }
      try {
        const rep = await callAudit(v.items, body.caseLabel || 'C端验真', v.budget);
        // 精简返回：保留判定所需字段，去掉重复的 aiucReference 体积
        const out = {
          ok: rep.ok,
          overall: rep.overall,
          reportId: rep.reportId,
          reportIdFull: rep.reportIdFull,
          summary: rep.summary,
          kernel: rep.kernel,
          budget: rep.budget,
          compositionLaw: rep.compositionLaw,
          items: rep.items.map((it) => ({
            idx: it.idx, id: it.id, kind: it.kind, text: it.text, depends: it.depends,
            verdict: it.verdict, U: it.U, abstainedBy: it.abstainedBy,
            reason: it.reason, engine: it.engine, numeric: it.numeric,
            proofObject: it.proofObject,
            evidence: it.evidence,
          })),
        };
        // 英文输入 ⇒ 英文摘要（机器字段 verdict/U/evidence 本就是英文枚举；内核人读文本是中文，这里做服务端包装）
        // 判据只看自然语言字段（caseLabel / text），不把 JSON 结构、数学式子、变量名算进去
        const userText = (Array.isArray(body.items) ? body.items : [])
          .map((it) => String(it.text || (it.payload && it.payload.text) || ''))
          .join(' ');
        const enInput = looksEnglish(body.caseLabel) || looksEnglish(userText);
        if (enInput && out.summary) {
          out.summary.locale = 'en';
          if (typeof out.summary.honesty === 'string') {
            out.summary.honesty = 'Three verdicts only: verified = deterministically confirmed; refuted = deterministically disproved; unverified (U) = honestly abstains. There is no fourth "probably fine".';
          }
          if (typeof out.summary.hallucinationRisk === 'string') {
            out.summary.hallucinationRisk = 'none-detected (no disprovable claim was found; note: unverified does NOT mean passed).';
          }
          out.items = out.items.map((it) => {
            const enReason = enReasonFor(it.reason);
            return enReason ? Object.assign({}, it, { reason: enReason }) : it;
          });
        }
        sendJSON(res, 200, out);
      } catch (e) {
        sendJSON(res, 502, { ok: false, error: '内核调用失败：' + e.message });
      }
    });
    return;
  }
  // 兜底
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found. GET / 打开验真器；POST /verify 验真。');
});

server.listen(PORT, () => {
  console.log('灵脑验真服务已启动： http://localhost:' + PORT + '/');
  console.log('  · 只核验数字 / 公式 / 逻辑对错（kind ∈ algebraic / constraint）');
  console.log('  · 医疗 / 心理 / 教育 / 金融建议 / 法律 一律拒绝（护城河）');
  startKernel();
});

function shutdown() {
  serverRunning = false;
  try { if (child) child.kill(); } catch (e) {}
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

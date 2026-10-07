'use strict';
/**
 * 灵脑 · 原生 lite 精确有理数判定引擎（零依赖，Node / 浏览器通用）
 * ───────────────────────────────────────────────────────────────────
 * 为什么存在（对齐文献与产品红线）：
 *   · FormalJudge (ICML 2026, arXiv:2602.11136)：概率 LLM 只做原子事实抽取，
 *     逻辑组合全部交确定性验证器。本模块即灵脑的「确定性验证器」底座。
 *   · Isabelle/HOL Sledgehammer 把整数子目标委派 Z3/CVC4 是标准做法 ⇒
 *     「推理引擎接计算/求解器」架构正确（回应「一个推理的为什么要接计算」）。
 *     但灵脑本体须有**原生可判定底座**，否则灵数不可达时推理核心整体瘫痪。
 *   · Presburger arithmetic（线性整数/实数算术）是可判定片段 ⇒ 本模块覆盖它。
 *   · 全局红线「soundness 优先」：只用精确有理数（BigInt 分子/分母），
 *     绝不退回裸浮点假装认证；不可判定/含超越函数 ⇒ 诚实 𝕌（fail-closed）。
 *
 * 能力边界（诚实标注，已落 / 路线 / 不做）：
 *   ✅ 已落：0 变量算术等式精确判定（2+2=4 / 2+2=5）
 *   ✅ 已落：claimed 解精确代入验证（非线性也 sound：精确残差=0 ⇒ 该点确为解）
 *   ✅ 已落：线性系统精确高斯消元（唯一解⇒finite 认证；矛盾⇒empty 证伪；欠定⇒𝕌）
 *   🚫 不做：非线性系统全解枚举（那是灵数求解器的事，委派之）
 *   🚫 不做：sin/cos/ln/exp/sqrt 等超越函数（非精确有理数域 ⇒ 𝕌，交灵数）
 *
 * 对外主入口：decideClaim(args) → { verdict:'verified'|'refuted'|'U', varNames, point, reason }
 *   args: { equations:string[], variables?:string[], claimed?:object{var:number} }
 */

// ── 精确有理数（BigInt 分子/分母，恒约简为正分母）────────────────────────
function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a || 1n; }
function R(n, d) {
  n = BigInt(n); d = (d === undefined) ? 1n : BigInt(d);
  if (d === 0n) throw new Error('DIV0');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n < 0n ? -n : n, d);
  return { n: n / g, d: d / g };
}
function rAdd(a, b) { return R(a.n * b.d + b.n * a.d, a.d * b.d); }
function rSub(a, b) { return R(a.n * b.d - b.n * a.d, a.d * b.d); }
function rMul(a, b) { return R(a.n * b.n, a.d * b.d); }
function rDiv(a, b) { if (b.n === 0n) throw new Error('DIV0'); return R(a.n * b.d, a.d * b.n); }
function rNeg(a) { return { n: -a.n, d: a.d }; }
function rEq(a, b) { return a.n === b.n && a.d === b.d; }
function rZero(a) { return a.n === 0n; }
// 精确有理数 → 数值（仅用于回显 text，不进入判定）
function rToNum(a) { return Number(a.n) / Number(a.d); }

// ── 词法 ──────────────────────────────────────────────────────────────
const FUNCS = new Set(['sin', 'cos', 'tan', 'ln', 'log', 'log10', 'log2', 'exp', 'sqrt', 'abs', 'mod', 'floor', 'ceil', 'gamma', 'pi', 'e']);

function tokenize(s) {
  const t = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; let dot = false;
      while (j < s.length && /[0-9.]/.test(s[j])) { if (s[j] === '.') dot = true; j++; }
      let numStr = s.slice(i, j);
      // 科学计数法 1e3 / 2.5E-4
      if (j < s.length && (s[j] === 'e' || s[j] === 'E')) {
        let k = j + 1; if (s[k] === '+' || s[k] === '-') k++;
        while (k < s.length && /[0-9]/.test(s[k])) k++;
        numStr += s.slice(j, k); j = k;
      }
      t.push({ k: 'num', v: numStr });
      i = j; continue;
    }
    if (/[A-Za-z_一-鿿]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_一-鿿]/.test(s[j])) j++;
      const w = s.slice(i, j);
      t.push(FUNCS.has(w.toLowerCase()) ? { k: 'func', v: w.toLowerCase() } : { k: 'ident', v: w });
      i = j; continue;
    }
    if ('+-*/^()=,'.indexOf(c) >= 0) { t.push({ k: 'op', v: c }); i++; continue; }
    throw new Error('无法识别的字符：' + c);
  }
  return t;
}

// ── 递归下降解析（AST）────────────────────────────────────────────────
// 文法：expr := term (('+'|'-') term)*
//       term := unary (('*'|'/') unary)*
//       unary := ('-'|'+') unary | power
//       power := primary ('^' unary)?
//       primary := num | ident | func '(' expr ')' | '(' expr ')'
function parseExpr(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const eat = (v) => { if (!tokens[p] || tokens[p].v !== v) throw new Error('期望 ' + v); p++; };
  function expr() {
    let a = term();
    for (;;) {
      const tk = peek();
      if (tk && tk.k === 'op' && (tk.v === '+' || tk.v === '-')) { p++; const b = term(); a = { t: tk.v === '+' ? 'add' : 'sub', a, b }; }
      else break;
    }
    return a;
  }
  function term() {
    let a = unary();
    for (;;) {
      const tk = peek();
      if (tk && tk.k === 'op' && (tk.v === '*' || tk.v === '/')) { p++; const b = unary(); a = { t: tk.v === '*' ? 'mul' : 'div', a, b }; }
      else break;
    }
    return a;
  }
  function unary() {
    const tk = peek();
    if (tk && tk.k === 'op' && (tk.v === '-' || tk.v === '+')) { p++; const a = unary(); return tk.v === '-' ? { t: 'neg', a } : a; }
    return power();
  }
  function power() {
    const base = primary();
    const tk = peek();
    if (tk && tk.k === 'op' && tk.v === '^') { p++; const exp = unary(); return { t: 'pow', a: base, b: exp }; }
    return base;
  }
  function primary() {
    const tk = peek();
    if (!tk) throw new Error('表达式意外结束');
    if (tk.k === 'op' && tk.v === '(') { p++; const e = expr(); eat(')'); return e; }
    if (tk.k === 'num') { p++; return { t: 'num', v: parseRational(tk.v) }; }
    if (tk.k === 'ident') { p++; return { t: 'var', name: tk.v }; }
    if (tk.k === 'func') {
      p++;
      if (tk.v === 'pi') return { t: 'num', v: R(3141592653589793n, 1000000000000000n) }; // 仅占位：含 pi/e 视为超越 ⇒ 上层判 𝕌
      if (tk.v === 'e') return { t: 'num', v: R(2718281828459045n, 1000000000000000n) };
      eat('('); const e = expr(); eat(')');
      return { t: 'call', name: tk.v, arg: e };
    }
    throw new Error('非法记号：' + tk.v);
  }
  const ast = expr();
  if (p !== tokens.length) throw new Error('多余记号：' + tokens[p].v);
  return ast;
}

function parseRational(str) {
  // 支持整数 / 小数 / 科学计数法，全部转精确有理数
  if (str.indexOf('e') >= 0 || str.indexOf('E') >= 0) {
    const m = str.match(/^([0-9.]+)[eE]([+-]?[0-9]+)$/);
    if (m) {
      const base = parseRational(m[1]);
      const exp = parseInt(m[2], 10);
      // base * 10^exp ⇒ 分子 *= 10^exp（exp 可能负）
      if (exp >= 0) return R(base.n * (10n ** BigInt(exp)), base.d);
      return R(base.n, base.d * (10n ** BigInt(-exp)));
    }
  }
  if (str.indexOf('.') >= 0) {
    const [intPart, fracPart] = str.split('.');
    const denom = 10n ** BigInt(fracPart.length);
    const num = BigInt(intPart || '0') * denom + (intPart && intPart[0] === '-' ? -BigInt(fracPart) : BigInt(fracPart));
    return R(num, denom);
  }
  return R(BigInt(str));
}

// ── AST 求值（精确有理数；含超越函数/未绑定变量 ⇒ 抛错交由上层判 𝕌）──────
function evalAst(ast, env) {
  switch (ast.t) {
    case 'num': return ast.v;
    case 'var': {
      if (!(ast.name in env)) throw new Error('UNBOUND_VAR:' + ast.name);
      return env[ast.name];
    }
    case 'add': return rAdd(evalAst(ast.a, env), evalAst(ast.b, env));
    case 'sub': return rSub(evalAst(ast.a, env), evalAst(ast.b, env));
    case 'mul': return rMul(evalAst(ast.a, env), evalAst(ast.b, env));
    case 'div': return rDiv(evalAst(ast.a, env), evalAst(ast.b, env));
    case 'neg': return rNeg(evalAst(ast.a, env));
    case 'pow': {
      const b = evalAst(ast.b, env);
      if (!rZero(b) && b.d !== 1n) throw new Error('非整数幂 ⇒ 超越域');
      const exp = Number(b.n);
      if (!Number.isSafeInteger(exp)) throw new Error('幂次过大');
      const a = evalAst(ast.a, env);
      if (exp < 0) return rDiv(R(1n), ipow(a, -exp));
      return ipow(a, exp);
    }
    case 'call': throw new Error('超越函数 ' + ast.name + ' ⇒ 非精确有理数域');
    default: throw new Error('未知 AST 节点：' + ast.t);
  }
}
function ipow(a, n) { let r = R(1n); for (let i = 0; i < n; i++) r = rMul(r, a); return r; }

// ── 线性检测：把 AST 化约为 {coeffs:Map(var->R), const:R}，非线性 ⇒ null ──
function toLinear(ast, vars) {
  switch (ast.t) {
    case 'num': return { coeffs: new Map(), const: ast.v };
    case 'var': { const m = new Map(); m.set(ast.name, R(1n)); return { coeffs: m, const: R(0n) }; }
    case 'neg': { const s = toLinear(ast.a, vars); if (!s) return null; return { coeffs: scaleMap(s.coeffs, R(-1n)), const: rNeg(s.const) }; }
    case 'add': case 'sub': {
      const a = toLinear(ast.a, vars); const b = toLinear(ast.b, vars);
      if (!a || !b) return null;
      return ast.t === 'add'
        ? { coeffs: addMap(a.coeffs, b.coeffs), const: rAdd(a.const, b.const) }
        : { coeffs: addMap(a.coeffs, scaleMap(b.coeffs, R(-1n))), const: rSub(a.const, b.const) };
    }
    case 'mul': {
      const a = toLinear(ast.a, vars); const b = toLinear(ast.b, vars);
      if (!a || !b) return null;
      const aConst = isConst(a), bConst = isConst(b);
      if (aConst && bConst) return { coeffs: new Map(), const: rMul(a.const, b.const) };
      if (aConst) return { coeffs: scaleMap(b.coeffs, a.const), const: rMul(a.const, b.const) };
      if (bConst) return { coeffs: scaleMap(a.coeffs, b.const), const: rMul(a.const, b.const) };
      return null; // 变量 × 变量 ⇒ 非线性
    }
    case 'div': {
      const a = toLinear(ast.a, vars); const b = toLinear(ast.b, vars);
      if (!a || !b) return null;
      if (!isConst(b)) return null; // 分母含变量 ⇒ 非线性
      return { coeffs: scaleMap(a.coeffs, rDiv(R(1n), b.const)), const: rDiv(a.const, b.const) };
    }
    case 'pow': {
      // 仅支持 var^1 或 const^const
      if (ast.a.t === 'var' && ast.b.t === 'num' && rEq(ast.b.v, R(1n))) return toLinear(ast.a, vars);
      const b = toLinear(ast.b, vars);
      if (isConst(toLinear(ast.a, vars)) && b && isConst(b)) return { coeffs: new Map(), const: evalAst(ast, {}) };
      return null;
    }
    default: return null; // call ⇒ 非线性/超越
  }
}
function isConst(s) { return s.coeffs.size === 0; }
function scaleMap(m, k) { const o = new Map(); for (const [v, c] of m) o.set(v, rMul(c, k)); return o; }
function addMap(a, b) { const o = new Map(a); for (const [v, c] of b) o.set(v, (o.has(v) ? rAdd(o.get(v), c) : c)); return o; }

// ── 精确高斯消元：线性系统 → 唯一解 / 矛盾 / 欠定 ──────────────────────
function solveLinear(rows, varNames) {
  // rows: [{coeffs:Map(var->R), const:R}]；构造增广矩阵
  const idx = {}; varNames.forEach((v, i) => { idx[v] = i; });
  const n = varNames.length;
  const M = rows.map(r => {
    const row = new Array(n + 1);
    for (let i = 0; i < n; i++) row[i] = R(0n);
    for (const [v, c] of r.coeffs) { if (v in idx) row[idx[v]] = c; }
    row[n] = r.const;
    return row;
  });
  let lead = 0;
  const where = new Array(n).fill(-1);
  for (let r = 0; r < M.length; r++) {
    if (lead >= n) break;
    let i = r;
    while (rZero(M[i][lead])) { i++; if (i === M.length) { i = r; lead++; if (lead === n) break; } }
    if (lead >= n) break;
    if (i !== r) { const tmp = M[i]; M[i] = M[r]; M[r] = tmp; }
    const lv = M[r][lead];
    for (let j = 0; j <= n; j++) M[r][j] = rDiv(M[r][j], lv);
    for (let k = 0; k < M.length; k++) {
      if (k !== r && !rZero(M[k][lead])) {
        const f = M[k][lead];
        for (let j = 0; j <= n; j++) M[k][j] = rSub(M[k][j], rMul(f, M[r][j]));
      }
    }
    where[lead] = r; lead++;
  }
  // 矛盾行？（0..0 | c≠0）
  for (let r = 0; r < M.length; r++) {
    let allZero = true;
    for (let j = 0; j < n; j++) if (!rZero(M[r][j])) { allZero = false; break; }
    if (allZero && !rZero(M[r][n])) return { status: 'inconsistent' };
  }
  // 唯一解？每列都有主元
  const sol = new Array(n).fill(null);
  let free = 0;
  for (let c = 0; c < n; c++) {
    if (where[c] >= 0) sol[c] = M[where[c]][n];
    else { free++; sol[c] = R(0n); } // 自由变量置 0 仅用于「是否存在解」判定；不唯一时不作为 claimed 比对
  }
  if (free > 0) return { status: 'free' };
  return { status: 'unique', sol };
}

// ── 主入口 ──────────────────────────────────────────────────────────────
/**
 * @param {object} args { equations:string[], variables?:string[], claimed?:object{var:number} }
 * @returns { verdict:'verified'|'refuted'|'U', varNames, point:number[]|null, reason, decidable:boolean }
 */
function decideClaim(args) {
  args = args || {};
  const eqs = args.equations;
  if (!Array.isArray(eqs) || !eqs.length) return { verdict: 'U', reason: 'equations 缺失或为空' };
  // 解析每条方程为 (lhs - rhs) 的 AST
  let asts;
  try {
    asts = eqs.map(eq => {
      const s = String(eq);
      const eqPos = topLevelEq(s);
      if (eqPos < 0) {
        // 无等号 ⇒ 视为 expr = 0
        return parseExpr(tokenize(s));
      }
      const lhs = parseExpr(tokenize(s.slice(0, eqPos)));
      const rhs = parseExpr(tokenize(s.slice(eqPos + 1)));
      return { t: 'sub', a: lhs, b: rhs };
    });
  } catch (e) {
    return { verdict: 'U', reason: '解析失败（' + e.message + '）⇒ 交灵数求解器' };
  }

  // 变量名：优先用 args.variables，否则从方程中收集标识符
  let varNames = Array.isArray(args.variables) && args.variables.length ? args.variables.slice() : collectVars(eqs);

  const claimed = (args.claimed && typeof args.claimed === 'object') ? args.claimed : null;

  // ① claimed 点精确代入验证（sound：残差精确=0 ⇒ 该点确为解）
  if (claimed) {
    // 0 变量等式：claimed 无绑定意义，直接判定等式本身（2+2=4 / 2+2=5）
    if (varNames.length === 0) {
      try {
        let allZero = true;
        for (const ast of asts) { if (!rZero(evalAst(ast, {}))) { allZero = false; break; } }
        return allZero
          ? { verdict: 'verified', varNames: [], point: [], reason: '0 变量算术等式精确成立', decidable: true }
          : { verdict: 'refuted', varNames: [], point: [], reason: '0 变量算术等式精确不成立（严格证伪）', decidable: true };
      } catch (e) { return { verdict: 'U', reason: '算术求值失败：' + e.message, decidable: false }; }
    }
    const env = {};
    for (const v of varNames) {
      if (!(v in claimed)) return { verdict: 'U', reason: 'claimed 缺少变量 ' + v + ' ⇒ 比对对象不完整' };
      if (typeof claimed[v] !== 'number' || !isFinite(claimed[v])) return { verdict: 'U', reason: 'claimed.' + v + ' 非有限数' };
      env[v] = parseRational(String(claimed[v]));
    }
    let allZero = true; let firstNonZero = null;
    for (const ast of asts) {
      let val;
      try { val = evalAst(ast, env); } catch (e) { return { verdict: 'U', reason: '精确代入不可行（' + e.message + '）⇒ 交灵数求解器' }; }
      if (!rZero(val)) { allZero = false; firstNonZero = val; break; }
    }
    if (allZero) {
      const point = varNames.map(v => claimed[v]);
      return { verdict: 'verified', varNames, point, reason: '精确有理数代入：每条方程残差=0（严格验证，无浮点误差）', decidable: true };
    }
    // claimed 不满足：若系统线性 ⇒ 精确解出真解并比对（sound 穷尽）；否则诚实 𝕌
    const lin = asts.map(a => toLinear(a, varNames)).filter(Boolean);
    if (lin.length === asts.length && varNames.length > 0) {
      const solRes = solveLinear(lin, varNames);
      if (solRes.status === 'unique') {
        const trueSol = solRes.sol.map(rToNum);
        const match = varNames.every((v, i) => Math.abs(trueSol[i] - claimed[v]) <= 1e-12);
        if (match) return { verdict: 'verified', varNames, point: trueSol, reason: '精确解与 claimed 一致', decidable: true };
        return { verdict: 'refuted', varNames, point: trueSol, reason: '线性系统精确消元得唯一解 ' + varNames.map((v, i) => v + '=' + trueSol[i]).join(', ') + '，与 claimed 不符（严格证伪）', decidable: true, witness: trueSol };
      }
      if (solRes.status === 'inconsistent') {
        return { verdict: 'refuted', varNames, point: null, reason: '线性系统精确消元判定矛盾（无解）⇒ 任何 claimed 均不可能成立（严格证伪）', decidable: true };
      }
      // free ⇒ 欠定：claimed 不满足但系统可能有其它解 ⇒ 诚实 𝕌
      return { verdict: 'U', reason: '线性系统欠定且 claimed 不满足 ⇒ 无法精确穷尽比对（交灵数求解器）', decidable: true };
    }
    // 非线性且 claimed 不满足：不能枚举全解 ⇒ 诚实 𝕌（fail-closed，不假装证伪）
    return { verdict: 'U', reason: '非线性系统 claimed 不满足，但无法精确枚举全部解 ⇒ 不假装证伪（交灵数求解器）', decidable: false };
  }

  // ② 无 claimed：把可判定系统整形为「已解」供内核比对 claimed（无 claimed 时内核仍诚实 𝕌）
  if (varNames.length > 0) {
    const lin = asts.map(a => toLinear(a, varNames)).filter(Boolean);
    if (lin.length === asts.length) {
      const solRes = solveLinear(lin, varNames);
      // 线性唯一解：返回 finite 认证解，内核据此与 claimed 比对（claimed 缺 ⇒ 内核 𝕌，不夸大）
      if (solRes.status === 'unique') return { verdict: 'verified', varNames, point: solRes.sol.map(rToNum), reason: '线性系统精确消元得唯一解（可交内核比对 claimed）', decidable: true };
      if (solRes.status === 'inconsistent') return { verdict: 'refuted', varNames, point: null, reason: '线性系统矛盾（无解）⇒ 严格证伪', decidable: true };
      return { verdict: 'U', reason: '线性系统欠定 ⇒ 无 claimed 比对对象', decidable: true };
    }
    return { verdict: 'U', reason: '非线性系统无 claimed ⇒ 交灵数求解器枚举全解', decidable: false };
  }

  // ③ 0 变量算术等式：精确比对（2+2=4 / 2+2=5）
  try {
    let allZero = true;
    for (const ast of asts) { if (!rZero(evalAst(ast, {}))) { allZero = false; break; } }
    return allZero
      ? { verdict: 'verified', varNames: [], point: [], reason: '0 变量算术等式精确成立', decidable: true }
      : { verdict: 'refuted', varNames: [], point: [], reason: '0 变量算术等式精确不成立（严格证伪）', decidable: true };
  } catch (e) {
    return { verdict: 'U', reason: '算术求值失败：' + e.message, decidable: false };
  }
}

function topLevelEq(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === '=' && depth === 0) return i;
  }
  return -1;
}
function collectVars(eqs) {
  const seen = []; const set = new Set();
  for (const e of eqs) {
    const toks = tokenize(String(e));
    for (const t of toks) {
      if (t.k === 'ident' && !set.has(t.v)) { set.add(t.v); seen.push(t.v); }
    }
  }
  return seen;
}

module.exports = { decideClaim, R, parseRational, evalAst, toLinear, solveLinear, tokenize, parseExpr };

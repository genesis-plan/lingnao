'use strict';
/**
 * 灵脑 LingNao → 灵数求解器 lingshu-solver 委派桥（Node 端，零额外依赖）
 *
 * 两个独立 GitHub 仓库的关系（均在 genesis-plan 账号下）：
 *   - 灵数求解器 = genesis-plan/lingshu-solver，已发布 npm 包 lingshu-solver@1.0.2
 *   - 灵脑       = genesis-plan/lingnao
 * 灵脑不重写任何求解逻辑，通过 npm 依赖 lingshu-solver 调用其真引擎
 * （区间收缩 + Krawczyk 认证，离线零依赖）。本桥只把「方程字符串数组」
 * 转交真引擎，并把返回结构精简为灵脑机器友好的形状。
 *
 * 寻路优先级（resolve 真实 solver-core）：
 *   1) 已安装 npm 包 'lingshu-solver'（生产形态：别人 clone lingnao 后 `npm install` 即得）
 *   2) 环境变量 LINGSHU_SOLVER_CORE 显式指向的 solver-core 文件（开发期本地覆盖）
 *   3) 工作区同级 ../灵数求解器/solver-core
 *   4) 桌面真源 C:/Users/Administrator/Desktop/灵数求解器/solver-core（本地 fallback）
 *
 * 若真引擎不可用，available=false 且 algebraicSolve 返回诚实降级——灵脑绝不假装求解。
 */
const path = require('path');

// 原生 lite 精确有理数判定引擎（灵数不可达时的兜底底座；零依赖）
let LITE = null;
try { LITE = require('./lingnao-lite-math'); } catch (_e) { /* 无 lite 兜底，诚实降级 */ }

// 测试/应急开关：置 1 强制走原生 lite，跳过灵数核心（模拟生产灵数未接入场景）
const LITE_ONLY = process.env.LINGNAO_LITE_ONLY === '1';

function loadCore() {
  if (LITE_ONLY) return null; // 强制原生 lite 路径（生产/CI 可复现兜底行为）
  const candidates = [
    'lingshu-solver',
    process.env.LINGSHU_SOLVER_CORE,
    path.resolve(__dirname, '..', '灵数求解器', 'solver-core'),
    'C:/Users/Administrator/Desktop/灵数求解器/solver-core'
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      const mod = require(c);
      if (mod && typeof mod.solve === 'function') return mod;
    } catch (_e) { /* 尝试下一个候选 */ }
  }
  return null;
}

const core = loadCore();

/**
 * 原生 lite 精确有理数判定结果 → 与灵数求解器同形（内核认证Numeric 直接消费）
 */
function liteToBridgeResult(dec) {
  const varNames = dec.varNames || [];
  const solText = (arr) => varNames.map((v, i) => `${v}=${arr[i]}`).join(', ');
  const mkSol = (arr) => ({ values: arr, tier: 'native-lite-certified', certified: true, text: solText(arr), residual: 0, certifiedRadius: 0 });
  if (dec.verdict === 'verified') {
    return {
      available: true, engine: 'lingnao-lite-exact (原生精确有理数)', varNames,
      resultType: 2, resultTypeName: 'finite', solutionCount: 1, certified: true, truncated: false,
      summary: '原生精确有理数复算：声明值与方程组成立（残差=0，严格验证，不依赖灵数求解器）',
      recommended: mkSol(dec.point), solutions: [mkSol(dec.point)], warnings: []
    };
  }
  if (dec.verdict === 'refuted') {
    if (dec.point) { // 线性系统唯一真解，claimed 不符 ⇒ 交给内核逐解比对判定证伪
      return {
        available: true, engine: 'lingnao-lite-exact (原生精确有理数)', varNames,
        resultType: 2, resultTypeName: 'finite', solutionCount: 1, certified: true, truncated: false,
        summary: '原生精确有理数复算：线性系统唯一解 ' + solText(dec.point) + '，与声明值不符（严格证伪）',
        recommended: mkSol(dec.point), solutions: [mkSol(dec.point)], warnings: []
      };
    }
    // 矛盾 / 无解 ⇒ 空解集（内核据此证伪）
    return {
      available: true, engine: 'lingnao-lite-exact (原生精确有理数)', varNames,
      resultType: 1, resultTypeName: 'empty', solutionCount: 0, certified: true, truncated: false,
      summary: '原生精确有理数判定：方程组矛盾（无实数解）', recommended: null, solutions: [], warnings: []
    };
  }
  return { available: false, note: '灵脑原生 lite 精确判定：' + dec.reason };
}

function delegateCore(args, eqs) {
  const vars = Array.isArray(args.variables) ? args.variables : [];
  const domain = args.domain;
  const fastMode = !!args.fastMode;
  const opts = args.options || {};
  let raw;
  try {
    raw = core.solve(eqs, vars, 6, domain, fastMode, opts);
  } catch (e) {
    return { available: true, error: String((e && e.message) || e) };
  }
  const sols = Array.isArray(raw.solutions) ? raw.solutions : [];
  let recommended = null, best = Infinity;
  for (const s of sols) {
    if (!s || !Array.isArray(s.values)) continue;
    let d = 0; for (const v of s.values) d += v * v;
    if (d < best) { best = d; recommended = s; }
  }
  const varNames = (Array.isArray(raw.varNames) && raw.varNames.length)
    ? raw.varNames
    : (sols[0] && Array.isArray(sols[0].values) ? sols[0].values.map((_, i) => 'x' + (i + 1)) : []);
  const cleanSols = sols.map(s => {
    const vals = Array.isArray(s.values) ? s.values : [];
    return {
      values: vals, tier: s.tier || 'unknown', certified: !!s.certified,
      text: varNames.map((vn, i) => `${vn}=${typeof vals[i] === 'number' ? vals[i].toFixed(6) : vals[i]}`).join(', '),
      residual: (typeof s.residual === 'number') ? Number(s.residual.toFixed(12)) : null,
      certifiedRadius: (typeof s.certifiedRadius === 'number') ? Number(s.certifiedRadius.toFixed(12)) : null
    };
  });
  const typeName = raw.resultType === 1 ? 'empty' : raw.resultType === 3 ? 'infinite' : 'finite';
  const allProven = sols.length > 0 && sols.every(s => s.tier === 'proven');
  return {
    available: true,
    engine: 'lingshu-solver (灵数求解器) ' + ((raw.meta && raw.meta.solverVersion) || '?'),
    varNames: varNames, resultType: raw.resultType, resultTypeName: typeName,
    solutionCount: sols.length, certified: allProven,
    truncated: !!(raw.truncated || (raw.meta && raw.meta.truncated)),
    summary:
      typeName === 'empty' ? '严格证明：该方程组无实数解。'
      : typeName === 'infinite' ? `无限解集；给出距原点最近的推荐解（共 ${sols.length} 个候选）。`
      : `找到 ${sols.length} 个实数解${allProven ? '（全部经 Krawczyk 区间认证）' : ''}。`,
    recommended: recommended ? cleanSols[sols.indexOf(recommended)] : null,
    solutions: cleanSols, warnings: raw.warnings || []
  };
}

/**
 * 代数方程系统求解（双引擎：灵数优先，原生 lite 兜底）
 * @param {object} args { equations, variables?, domain?, fastMode?, options?, claimed? }
 * @returns 机器友好结果（与灵数同形：resultTypeName / solutionCount / certified / solutions[]）
 */
function algebraicSolve(args) {
  args = args || {};
  const eqs = args.equations;
  if (!Array.isArray(eqs) || eqs.length === 0) {
    return { available: true, error: 'equations 必须是非空字符串数组' };
  }
  // 主路径：灵数求解器（区间收缩 + Krawczyk 认证）可用 ⇒ 委派真引擎
  if (core) return delegateCore(args, eqs);
  // 兜底路径：灵数不可达 ⇒ 原生 lite 精确有理数判定（可判定片段）
  if (LITE) {
    const dec = LITE.decideClaim({
      equations: eqs,
      variables: Array.isArray(args.variables) ? args.variables : undefined,
      claimed: args.claimed
    });
    if (dec.verdict !== 'U') return liteToBridgeResult(dec);
    return { available: false, note: '灵脑原生 lite 精确判定：' + dec.reason + '（灵数求解器未接入，非线性/超越片段诚实弃权）' };
  }
  return {
    available: false,
    error: '灵数求解器 lingshu-solver 未找到，且无原生 lite 兜底。请 `npm install lingshu-solver` 或设置 LINGSHU_SOLVER_CORE。'
  };
}

module.exports = { available: !!core || !!LITE, algebraicSolve, nativeLite: !!LITE, _core: core };

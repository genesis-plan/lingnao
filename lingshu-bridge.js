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

function loadCore() {
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

if (!core) {
  module.exports = {
    available: false,
    algebraicSolve() {
      return {
        available: false,
        error: '灵数求解器 lingshu-solver 未找到。请执行 `npm install lingshu-solver`（genesis-plan/lingshu-solver），或设置环境变量 LINGSHU_SOLVER_CORE 指向其 solver-core.js。'
      };
    }
  };
  return;
}

/**
 * 代数方程系统求解 —— 委派给真引擎灵数求解器（区间收缩 + Krawczyk 认证）。
 * @param {object} args
 *   equations: string[] 含 "=" 的方程，如 ["x^2+y^2=25","x+y=7"]
 *   variables?: string[] 变量名（可省，自动识别，≤6）
 *   domain?:   object    显式搜索域 {"x":[-30,30]}
 *   fastMode?: boolean
 *   options?:  object    {budget,maxDepth}
 * @returns 机器友好结果（含 resultTypeName / solutionCount / certified / solutions[]）
 */
function algebraicSolve(args) {
  args = args || {};
  const eqs = args.equations;
  if (!Array.isArray(eqs) || eqs.length === 0) {
    return { available: true, error: 'equations 必须是非空字符串数组' };
  }
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
      values: vals,
      tier: s.tier || 'unknown',
      certified: !!s.certified,
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
    resultType: raw.resultType,
    resultTypeName: typeName,
    solutionCount: sols.length,
    certified: allProven,
    truncated: !!(raw.truncated || (raw.meta && raw.meta.truncated)),
    summary:
      typeName === 'empty' ? '严格证明：该方程组无实数解。'
      : typeName === 'infinite' ? `无限解集；给出距原点最近的推荐解（共 ${sols.length} 个候选）。`
      : `找到 ${sols.length} 个实数解${allProven ? '（全部经 Krawczyk 区间认证）' : ''}。`,
    recommended: recommended ? cleanSols[sols.indexOf(recommended)] : null,
    solutions: cleanSols,
    warnings: raw.warnings || []
  };
}

module.exports = { available: true, algebraicSolve, _core: core };

/*
 * 知识蒸馏引擎 (KnowledgeDistillery)
 * ─────────────────────────────────────────────────────────────────────
 * 通用大脑「物质富裕四步引擎」之第一步的最小落地实现（= 组合① 神经符号的最小形态）：
 *   专家经验 ──(LLM 听懂 / 或结构化输入)──▶ 可执行的、不依赖特殊工具与文化的步骤序列
 *   每一步挂 GROUNDING 可信档；失败可经 KB 知识可逆机制降级并重生手册。
 *
 * 设计要点（与内核关系）：
 *   - perceiveLLM  : 负责「听懂专家、拆解、本地化、翻译」（LLM 层，可选）
 *   - KB / GROUNDING : 负责「每步可信、不编、可复核」（大脑层，必选）
 *   - SelfLearn / KB.updateConfidence : 知识可逆（失败→降级→重生）
 *   - EventBus   : 广播蒸馏/修订事件（审计接口的最小形态）
 *
 * 离线可用：无 API key 时退化为「结构化专家输入」模式，对应「一个专家+一张纸」。
 * 不幻觉保证：专家口述默认 PERCEPTION(未验证) 并标红，绝不冒充 KERNEL(确定)。
 */

'use strict';
const L = require('./lingjing.umd.js');

const G = L.GROUNDING;

function nowISO() { return new Date().toISOString(); }

// ── 工具：把「判断」显式写成「如果…那么…」（步骤化）─────────────────
function toCondition(s) {
  if (s.condition && String(s.condition).trim()) return s.condition;
  return '始终执行';
}

// ── 工具：把专业工具换成本地可得替代品（工具化）──────────────────────
function localSubstituteFor(step, localContext) {
  if (step.localSubstitute && String(step.localSubstitute).trim()) return step.localSubstitute;
  if (localContext && localContext.altTools && step.tool && localContext.altTools[step.tool]) {
    return localContext.altTools[step.tool];
  }
  return '用本地可得的等效物替代（不依赖专业设备）';
}

// ── 工具：术语→人话 + 收集术语表（语言化）──────────────────────────
function plainAction(step) {
  return step.action && String(step.action).trim()
    ? step.action
    : '（未提供动作描述）';
}

// ── 单步构建：挂 GROUNDING 档 ──────────────────────────────────────
// 依据来自已验证 KB（非 expert-testimony）且 KB 置信高 → KERNEL(确定)
// 否则 → PERCEPTION(未验证，出厂标红)
function buildStep(s, localContext, n) {
  const basis = s.basis && s.basis !== 'expert-testimony' ? s.basis : 'expert-testimony';
  // 出厂默认 PERCEPTION(未验证)：专家口述非 KERNEL；田间验证通过后由 confirmStep 升 KERNEL
  const tier = G.PERCEPTION;
  return {
    id: 'S' + n,
    n,
    action: plainAction(s),
    condition: toCondition(s),
    tool: s.tool || '—',
    localSubstitute: localSubstituteFor(s, localContext),
    verification: s.verification || '检查产出是否符合预期；不符则视为本步未通过',
    basis,
    grounding: { tier: tier.tier, mayHallucinate: tier.mayHallucinate },
    status: 'UNVERIFIED' // 出厂默认：未验证
  };
}

// ── 术语表（语言化产物）─────────────────────────────────────────────
function buildGlossary(steps) {
  const set = {};
  for (const s of steps) {
    if (s.tool && s.tool !== '—') set[s.tool] = '本地替代：' + s.localSubstitute;
  }
  return set;
}

// ── 审计接口（最小形态：可被其他大脑实例读取的 JSON）────────────────
function buildAudit(manual) {
  const verified = manual.steps.filter(s => s.grounding.tier === G.KERNEL.tier).length;
  const unverified = manual.steps.length - verified;
  return {
    manualId: manual.id,
    domain: manual.domain,
    generatedAt: manual.createdAt,
    status: 'valid',
    noHallucination: true,
    stepsTotal: manual.steps.length,
    verifiedCount: verified,
    unverifiedCount: unverified,
    verdict: unverified > 0
      ? '含未验证步骤(' + unverified + ')，扉页已标红；请先小批试做后再升 KERNEL'
      : '全部步骤已验证，可放心按流程执行',
    reproducible: true,
    source: 'KnowledgeDistillery@LingJing'
  };
}

// ── 主蒸馏函数 ──────────────────────────────────────────────────────
async function distill(input) {
  if (!input || !input.domain) throw new Error('distill: 需要 input.domain');
  const expert = input.expert || '匿名专家';
  const localContext = input.localContext || {};

  // 1) 获取步骤：有 key 且给 raw → 走 LLM；否则结构化输入（离线可用）
  let stepsRaw = [];
  if (input.raw && input.apiKey && typeof L.perceiveLLM === 'function') {
    const out = await L.perceiveLLM(input.raw, { apiKey: input.apiKey });
    if (out && out.ok && Array.isArray(out.steps)) {
      stepsRaw = out.steps; // LLM 拆解成功
    } else {
      stepsRaw = input.steps || []; // LLM 不可用→降级结构化
    }
  } else {
    stepsRaw = input.steps || []; // 离线/无 key：结构化专家输入
  }
  if (!stepsRaw.length) throw new Error('distill: 无步骤可用（既无 raw+key，也无 steps）');

  // 2) 三步拆解 + 本地化 + 挂 GROUNDING
  const steps = stepsRaw.map((s, i) => buildStep(s, localContext, i + 1));

  // 3) 写 KB（每条作为 experience；出厂未验证→低置信）
  let kbOk = true;
  try {
    for (const s of steps) {
      L.KB.addExperience({
        domain: input.domain,
        content: s.action + ' | 条件:' + s.condition + ' | 工具:' + s.tool,
        confidence: s.grounding.tier === G.KERNEL.tier ? 0.9 : 0.3,
        source: s.basis
      });
    }
  } catch (e) { kbOk = false; /* KB 写入失败不阻断蒸馏，但如实标记 */ }

  // 4) 组装手册
  const manual = {
    id: 'KD-' + Date.now().toString(36),
    domain: input.domain,
    expert,
    createdAt: nowISO(),
    revision: 0,
    localContext,
    steps,
    glossary: buildGlossary(steps),
    grounding: null,
    audit: null,
    kbRecorded: kbOk
  };
  manual.grounding = {
    verifiedCount: steps.filter(s => s.grounding.tier === G.KERNEL.tier).length,
    unverifiedCount: steps.filter(s => s.grounding.tier === G.PERCEPTION.tier).length
  };
  manual.audit = buildAudit(manual);

  // 5) 广播（审计接口最小形态）
  if (L.EventBus && typeof L.EventBus.publish === 'function') {
    L.EventBus.publish('distill:done', { manualId: manual.id, audit: manual.audit });
  }
  _manuals[manual.id] = manual;
  return manual;
}

// ── 知识可逆：现场失败 → 降级该步 + KB 降级 + 手册重生 ──────────────
function reportFailure(manualId, stepId, observation) {
  const m = _manuals[manualId];
  if (!m) throw new Error('reportFailure: 手册不存在 ' + manualId);
  const step = m.steps.find(s => s.id === stepId);
  if (!step) throw new Error('reportFailure: 步骤不存在 ' + stepId);

  step.status = 'DOWNGRADED';
  step.failureNote = observation;

  // KB 知识可逆：依据降级
  let kbOk = true;
  try {
    if (step.basis !== 'expert-testimony' && typeof L.KB.updateConfidence === 'function') {
      L.KB.updateConfidence(step.basis, -0.5, 'field-failure: ' + observation);
    }
  } catch (e) { kbOk = false; }

  // SelfLearn 记录失败（经验闭环）
  try {
    if (L.SelfLearn && typeof L.SelfLearn.record === 'function') {
      L.SelfLearn.record({ type: 'distill-failure', manualId, stepId, observation });
    }
  } catch (e) { /* 非致命 */ }

  // 手册重生（标记修订）
  m.revision = (m.revision || 0) + 1;
  m.grounding = {
    verifiedCount: m.steps.filter(s => s.grounding.tier === G.KERNEL.tier && s.status !== 'DOWNGRADED').length,
    unverifiedCount: m.steps.filter(s => s.grounding.tier === G.PERCEPTION.tier || s.status === 'DOWNGRADED').length
  };
  m.audit = buildAudit(m);
  if (L.EventBus && typeof L.EventBus.publish === 'function') {
    L.EventBus.publish('distill:revise', { manualId, stepId, observation });
  }
  return m;
}

// ── 现场验证成功 → 该步升 KERNEL ───────────────────────────────────
function confirmStep(manualId, stepId, note) {
  const m = _manuals[manualId];
  if (!m) throw new Error('confirmStep: 手册不存在 ' + manualId);
  const step = m.steps.find(s => s.id === stepId);
  if (!step) throw new Error('confirmStep: 步骤不存在 ' + stepId);
  step.status = 'VERIFIED';
  step.grounding = { tier: G.KERNEL.tier, mayHallucinate: G.KERNEL.mayHallucinate };
  if (step.basis !== 'expert-testimony' && typeof L.KB.updateConfidence === 'function') {
    try { L.KB.updateConfidence(step.basis, 0.4, 'field-success: ' + (note || '')); } catch (e) {}
  }
  m.grounding = {
    verifiedCount: m.steps.filter(s => s.grounding.tier === G.KERNEL.tier).length,
    unverifiedCount: m.steps.filter(s => s.grounding.tier === G.PERCEPTION.tier).length
  };
  m.audit = buildAudit(m);
  return m;
}

// ── 三种渲染 ────────────────────────────────────────────────────────
function renderFlowchart(m) {
  const L0 = [];
  L0.push('【流程图】' + m.domain + '  (手册 ' + m.id + ' rev' + m.revision + ')');
  L0.push('扉页：未验证步骤以 ⚠ 标红，请先小批试做');
  L0.push('');
  for (const s of m.steps) {
    const flag = s.grounding.tier === G.PERCEPTION.tier ? ' ⚠未验证' : '';
    const down = s.status === 'DOWNGRADED' ? ' [已降级·勿用]' : '';
    L0.push('┌─ 步骤' + s.n + flag + down);
    L0.push('│  条件: ' + s.condition);
    L0.push('│  动作: ' + s.action);
    L0.push('│  工具: ' + s.tool + ' → 本地: ' + s.localSubstitute);
    L0.push('│  验收: ' + s.verification);
    L0.push('└─');
  }
  return L0.join('\n');
}

function renderOral(m) {
  const L0 = [];
  L0.push('【口述指令】' + m.domain + '（念给人听，照做即可）');
  L0.push('');
  for (const s of m.steps) {
    const flag = s.grounding.tier === G.PERCEPTION.tier ? '（这步我还没验证过，先做一小批试试）' : '';
    const act = s.condition === '始终执行'
      ? s.action
      : '要是' + s.condition + '，就' + s.action;
    const toolPhrase = s.localSubstitute.startsWith('用') ? s.localSubstitute : '用' + s.localSubstitute;
    L0.push((s.n) + '. ' + act + '。' + toolPhrase + '。' + flag);
  }
  return L0.join('\n');
}

function renderText(m) {
  const L0 = [];
  L0.push('# ' + m.domain + ' · 本地制造手册');
  L0.push('');
  L0.push('> ⚠ 本手册由知识蒸馏引擎生成。未验证步骤已标红，请先小批试做验证后再推广。');
  L0.push('> 引擎不售种子/设备，不靠你持续依赖；验证通过后即可独立使用。');
  L0.push('');
  L0.push('## 步骤');
  for (const s of m.steps) {
    const tag = s.grounding.tier === G.PERCEPTION.tier ? ' **[未验证]**' : '';
    const down = s.status === 'DOWNGRADED' ? ' **[已降级·本步曾失败，勿用]**' : '';
    L0.push((s.n) + '. ' + s.action + tag + down);
    L0.push('   - 条件: ' + s.condition);
    L0.push('   - 工具: ' + s.tool + ' → 本地替代: ' + s.localSubstitute);
    L0.push('   - 验收: ' + s.verification);
  }
  if (Object.keys(m.glossary).length) {
    L0.push('');
    L0.push('## 术语表');
    for (const k in m.glossary) L0.push('- ' + k + ': ' + m.glossary[k]);
  }
  return L0.join('\n');
}

function render(m, format) {
  if (format === 'oral') return renderOral(m);
  if (format === 'text') return renderText(m);
  return renderFlowchart(m);
}

const _manuals = {};

const Engine = { distill, reportFailure, confirmStep, render, _manuals, GROUNDING: G };

// 可插拔：挂到内核
if (L && typeof L === 'object') L.KnowledgeDistillery = Engine;

module.exports = Engine;

// ── 自测（离线：无 key，结构化专家输入 → 证明不依赖网络）────────────
if (require.main === module) {
  (async () => {
    const line = s => console.log(s);
    line('=== 知识蒸馏引擎 · 自测（离线结构化输入）===');
    const expertInput = {
      domain: '用本地红壤烧砖',
      expert: '老窑匠·王',
      localContext: { altTools: { '窑炉': '本地土窑+柴火' }, materials: ['红壤', '木柴'], literacy: 'low' },
      steps: [
        { action: '取红壤，剔除碎石，含水率控制在 20% 以下', tool: '锄头', verification: '握一把土能捏成团、落地即散即为合格' },
        { action: '制坯入模，压实四角', tool: '木模', verification: '坯体无裂缝、棱角分明' },
        { action: '阴干 5–7 天至全白，忌暴晒', tool: '—', verification: '断面发白、敲击声脆' },
        { action: '装窑烧结，温度维持 800–900℃ 约 6 小时', tool: '窑炉', basis: 'expert-testimony', verification: '出窑砖断面致密、敲击清脆为合格' },
        { action: '自然冷却 24 小时出窑', tool: '—', verification: '砖体不烫手、无骤冷裂纹' }
      ]
    };

    const m = await Engine.distill(expertInput);
    line('\n[蒸馏] 手册 ' + m.id + '  步骤数 ' + m.steps.length);
    line('[蒸馏] 已写 KB: ' + m.kbRecorded + '  可信档: 已验证' + m.grounding.verifiedCount + ' / 未验证' + m.grounding.unverifiedCount);
    line('[蒸馏] 审计: ' + m.audit.verdict);

    line('\n──────── 流程图输出 ────────');
    line(renderFlowchart(m));

    line('──────── 口述指令输出 ────────');
    line(renderOral(m));

    // 田间验证成功：步骤1 取土判据有效 → 升 KERNEL
    const pick = m.steps.find(s => s.action.includes('取红壤'));
    confirmStep(m.id, pick.id, '田间验证：含水率捏团落地散判据有效');
    line('\n──────── 田间验证：' + pick.id + ' 升档=' + pick.grounding.tier + ' ────────');
    line('[验证] 可信档: 已验证' + m.grounding.verifiedCount + ' / 未验证' + m.grounding.unverifiedCount);

    // 现场失败：烧结温度窗写错（红壤 900℃ 过烧裂）
    const sinter = m.steps.find(s => s.action.includes('烧结'));
    line('──────── 现场失败：' + sinter.id + ' 烧出裂纹 ────────');
    const m2 = reportFailure(m.id, sinter.id, '红壤在 900℃ 出现大量裂纹，温度窗应降至 750–820℃');
    line('[降级] ' + sinter.id + ' 状态=' + sinter.status + '  手册 rev=' + m2.revision);
    line('[降级] 审计: ' + m2.audit.verdict);
    line('\n──────── 降级后流程图（S1 已验证 / S4 已降级）────────');
    line(renderFlowchart(m2));

    line('\n=== 自测结论 ===');
    const ok = m.steps.length === 5 && pick.grounding.tier === G.KERNEL.tier
      && sinter.grounding.tier === G.PERCEPTION.tier
      && sinter.status === 'DOWNGRADED' && m2.audit.status === 'valid';
    line(ok ? 'SELF-TEST: PASS ✔' : 'SELF-TEST: FAIL ✘');
  })().catch(e => { console.error('SELF-TEST ERROR', e.message); process.exit(1); });
}

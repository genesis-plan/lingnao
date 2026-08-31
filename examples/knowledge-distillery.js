/*
 * 知识蒸馏引擎 (KnowledgeDistillery)  —— 任意领域版
 * ─────────────────────────────────────────────────────────────────────
 * 通用大脑「物质富裕四步引擎」第一步的最小落地（= 组合① 神经符号的最小形态）。
 *
 * 核心主张：本引擎对「任意知识领域」生效，不需要为每类知识改代码。
 *   输入 = 某领域的专家经验（自由句 / 术语表 / 本地资源清单）
 *   引擎真做三步拆解（不是存步骤）：
 *     ① 步骤化 stepify  ：把「判断/经验」转成「如果…那么…」原子步
 *     ② 工具化 localize  ：把「专业工具」换成「本地可得等效物」（按本地清单）
 *     ③ 语言化 verbalize ：把「术语」换成「人话」并生成术语表
 *   每步挂 GROUNDING 可信档；失败经 KB 知识可逆机制降级并重生手册。
 *
 * 与内核关系：
 *   - perceiveLLM : 听懂专家自由文本、做语义切分（LLM 层，可选；无 key 退结构化）
 *   - KB / GROUNDING : 每步可信、不编、可复核（大脑层，必选）
 *   - SelfLearn / KB.updateConfidence : 知识可逆（失败→降级→重生）
 *   - EventBus   : 广播蒸馏/修订事件（审计接口最小形态）
 *
 * 离线可用：无 API key 时，专家以「半结构化原则句」输入，引擎用规则完成三步拆解。
 * 诚实边界：离线三步拆解是「中文启发式规则」，非真正 NLP；有 key 时交由 perceiveLLM
 *           做更强语义切分。两者都汇入同一蒸馏核心，产出一致。
 */

'use strict';
const L = require('../lingnao.umd.js');
const G = L.GROUNDING;

function nowISO() { return new Date().toISOString(); }

// ══════════════════════════════════════════════════════════════════════
// ① 步骤化 stepify —— 把专家经验句转成「条件→动作」原子步
//    支持两种输入：
//      a) 字符串：用中文条件标记（如果/若/当/一旦/遇/碰到/要是/假如…就/则/应）
//         切出 condition + action；无标记则条件=「始终执行」
//      b) 对象  ：{ condition, action, tool, terms } 专家已显式给出
// ══════════════════════════════════════════════════════════════════════
const COND_LEAD = /^(如果|若|当|一旦|遇|遇到|碰到|要是|假如)\s*(.+?)\s*(?:，|,|。|则|就|的话|应当|应|须|需要|应该)\s*(.+)$/s;

// 工具化前置：从自由句里抽取本地已知工具名（词表 = 本地清单 + 替代映射键）
function detectTool(text, localContext) {
  const inv = (localContext && localContext.inventory) || {};
  const vocab = (inv.tools || []).concat(Object.keys((localContext && localContext.substituteMap) || {}));
  for (const t of vocab) if (t && text.includes(t)) return t;
  return '—';
}

function stepify(p, localContext) {
  if (typeof p === 'object' && p !== null) {
    // 专家显式结构化
    const action = (p.action || '').trim();
    if (!action) return null;
    return {
      condition: (p.condition && String(p.condition).trim()) || '始终执行',
      action,
      tool: p.tool || '—',
      terms: p.terms || null,
      basis: p.basis || 'expert-testimony',
      verification: p.verification || '检查产出是否符合预期；不符则视为本步未通过'
    };
  }
  const t = String(p).trim();
  if (!t) return null;
  const m = t.match(COND_LEAD);
  if (m) {
    return {
      condition: m[2].trim(),
      action: m[3].trim(),
      tool: detectTool(t, localContext),
      terms: null,
      basis: 'expert-testimony',
      verification: '检查产出是否符合预期；不符则视为本步未通过'
    };
  }
  // 无条件标记：整句作为「始终执行」动作
  return {
    condition: '始终执行',
    action: t,
    tool: detectTool(t, localContext),
    terms: null,
    basis: 'expert-testimony',
    verification: '检查产出是否符合预期；不符则视为本步未通过'
  };
}

// ══════════════════════════════════════════════════════════════════════
// ② 工具化 localize —— 专业工具 → 本地可得等效物
//    依据 localContext.inventory.tools（本地已有工具）判断是否需要替代；
//    不在本地清单 → 查 substituteMap；都没有 → 标「需确认本地替代」
// ══════════════════════════════════════════════════════════════════════
function localize(tool, localContext) {
  const inv = (localContext && localContext.inventory) || {};
  const tools = inv.tools || [];
  const mat = inv.materials || [];
  if (tool && tool !== '—') {
    if (tools.includes(tool)) return { substitute: tool + '（本地已有）', localAvailable: true };
    const map = (localContext && localContext.substituteMap) || {};
    if (map[tool]) return { substitute: map[tool], localAvailable: false };
    return { substitute: '需确认本地替代（专家未列等效物，用本地可得物替代专业设备）', localAvailable: false };
  }
  return { substitute: '（无需工具）', localAvailable: true };
}

// ══════════════════════════════════════════════════════════════════════
// ③ 语言化 verbalize —— 术语 → 人话，并收集术语表
//    把 step.terms（本步专属）与全局 terms 中的术语，在 action 文本里
//    就地展开成「术语（即：人话）」，让不识字者也能听懂。
// ══════════════════════════════════════════════════════════════════════
function verbalize(text, termMap) {
  let out = text;
  if (termMap) {
    for (const j in termMap) {
      if (out.includes(j)) out = out.split(j).join(j + '（即：' + termMap[j] + '）');
    }
  }
  return out;
}

// ── 单步构建：步骤化 + 工具化 + 语言化 + 挂 GROUNDING ─────────────────
function buildStep(raw, globalTerms, localContext, n) {
  // 合并术语表：全局 terms + 本步 terms
  const termMap = Object.assign({}, globalTerms || {}, raw.terms || {});
  const loc = localize(raw.tool, localContext);
  const actionPlain = verbalize(raw.action, termMap);
  // 出厂默认 PERCEPTION(未验证)：专家口述非 KERNEL；田间验证后由 confirmStep 升 KERNEL
  return {
    id: 'S' + n,
    n,
    action: actionPlain,
    actionRaw: raw.action,
    condition: raw.condition,
    tool: raw.tool || '—',
    localSubstitute: loc.substitute,
    localAvailable: loc.localAvailable,
    verification: raw.verification,
    basis: raw.basis,
    grounding: { tier: G.PERCEPTION.tier, mayHallucinate: G.PERCEPTION.mayHallucinate },
    status: 'UNVERIFIED'
  };
}

// ── 术语表（语言化产物：工具替代 + 术语人话映射）──────────────────────
function buildGlossary(steps, globalTerms) {
  const set = {};
  for (const s of steps) {
    if (s.tool && s.tool !== '—') set[s.tool] = '本地替代：' + s.localSubstitute;
  }
  if (globalTerms) for (const j in globalTerms) set[j] = globalTerms[j];
  return set;
}

// ── 审计接口（最小形态：可被其他大脑实例读取的 JSON）──────────────────
// 诚实分级（修复"恒 valid"）：含降级步→degraded；含未验证步→unverified；全部验证→valid。
// noHallucination 不再恒 true——只要存在未验证/降级步骤，就不声称"无幻觉"。
function buildAudit(manual) {
  const verified = manual.steps.filter(s => s.grounding.tier === G.KERNEL.tier && s.status !== 'DOWNGRADED').length;
  const down = manual.steps.filter(s => s.status === 'DOWNGRADED').length;
  const unverified = manual.steps.length - verified - down;
  return {
    manualId: manual.id,
    domain: manual.domain,
    generatedAt: manual.createdAt,
    status: down > 0 ? 'degraded' : (unverified > 0 ? 'unverified' : 'valid'),
    noHallucination: down === 0 && unverified === 0,
    stepsTotal: manual.steps.length,
    verifiedCount: verified,
    unverifiedCount: unverified,
    downgradedCount: down,
    verdict: down > 0
      ? '含已降级步骤(' + down + ')，勿用；其余未验证步(' + unverified + ')扉页标红，先小批试做'
      : (unverified > 0
        ? '含未验证步骤(' + unverified + ')，扉页已标红；请先小批试做后再升 KERNEL'
        : '全部步骤已验证，可放心按流程执行'),
    reproducible: true,
    source: 'KnowledgeDistillery@LingNao'
  };
}

// ── 主蒸馏：对任意领域经验做三步拆解 ─────────────────────────────────
async function distill(input) {
  if (!input || !input.domain) throw new Error('distill: 需要 input.domain');
  const expert = input.expert || '匿名专家';
  const localContext = input.localContext || {};
  const globalTerms = input.terms || null;

  // 1) 取得「专家原则」：
  //    a) raw + key → LLM 语义切分（在线）
  //    b) principles（字符串/对象数组）→ 离线规则切分
  //    c) steps（已结构化）→ 兼容旧模式直用
  let principles = [];
  if (input.raw && input.apiKey && typeof L.perceiveLLM === 'function') {
    const out = await L.perceiveLLM(input.raw, { apiKey: input.apiKey });
    if (out && out.ok && Array.isArray(out.principles || out.steps)) {
      principles = out.principles || out.steps;
    } else {
      principles = input.principles || input.steps || [];
    }
  } else {
    principles = input.principles || input.steps || [];
  }
  if (!principles.length) throw new Error('distill: 无专家原则可用（需 principles / steps / raw+key）');

  // 2) 真做三步拆解：步骤化 → 工具化 → 语言化
  const raws = [];
  for (const p of principles) {
    const s = stepify(p, localContext);
    if (s) raws.push(s);
  }
  if (!raws.length) throw new Error('distill: 原则无法拆出任何步骤');

  const steps = raws.map((s, i) => buildStep(s, globalTerms, localContext, i + 1));

  // 3) 写 KB（每条作为 experience；出厂未验证→低置信）
  //    KB 真实签名为 addExperience(from,to,success,confidence,source)：from=领域, to=步骤id，
  //    供 reportFailure/confirmStep 以同一键做知识可逆升降级。
  let kbOk = true;
  try {
    for (const s of steps) {
      L.KB.addExperience(input.domain, s.id, true,
        s.grounding.tier === G.KERNEL.tier ? 0.9 : 0.3, s.basis);
    }
  } catch (e) { kbOk = false; console.warn('[distillery] KB 写入失败:', e.message); }

  // 4) 组装手册
  const manual = {
    id: 'KD-' + Date.now().toString(36),
    domain: input.domain,
    expert,
    createdAt: nowISO(),
    revision: 0,
    localContext,
    steps,
    glossary: buildGlossary(steps, globalTerms),
    grounding: null,
    audit: null,
    kbRecorded: kbOk
  };
  manual.grounding = {
    verifiedCount: steps.filter(s => s.grounding.tier === G.KERNEL.tier).length,
    unverifiedCount: steps.filter(s => s.grounding.tier === G.PERCEPTION.tier).length
  };
  manual.audit = buildAudit(manual);

  if (L.EventBus && typeof L.EventBus.publish === 'function') {
    L.EventBus.publish('distill:done', { manualId: manual.id, audit: manual.audit });
  }
  _manuals[manual.id] = manual;
  return manual;
}

// ── 知识可逆：现场失败 → 降级该步 + KB 降级 + 手册重生 ────────────────
function reportFailure(manualId, stepId, observation) {
  const m = _manuals[manualId];
  if (!m) throw new Error('reportFailure: 手册不存在 ' + manualId);
  const step = m.steps.find(s => s.id === stepId);
  if (!step) throw new Error('reportFailure: 步骤不存在 ' + stepId);
  step.status = 'DOWNGRADED';
  step.failureNote = observation;
  // 知识可逆：现场失败 → KB 该转移降置信（键与 distill 写入一致：domain→stepId）。
  // 修复：此前被 basis!=='expert-testimony' 门挡死，而所有步骤恰是该 basis，降级从未真实发生。
  try {
    if (typeof L.KB.updateConfidence === 'function') {
      L.KB.updateConfidence(m.domain, stepId, false, 0.5);
    }
  } catch (e) { console.warn('[distillery] KB 降级失败:', e.message); }
  try {
    if (L.SelfLearn && typeof L.SelfLearn.record === 'function') {
      L.SelfLearn.record({ type: 'distill-failure', manualId, stepId, observation });
    }
  } catch (e) { console.warn('[distillery] SelfLearn 记录失败:', e.message); }
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

// ── 现场验证成功 → 该步升 KERNEL ─────────────────────────────────────
function confirmStep(manualId, stepId, note) {
  const m = _manuals[manualId];
  if (!m) throw new Error('confirmStep: 手册不存在 ' + manualId);
  const step = m.steps.find(s => s.id === stepId);
  if (!step) throw new Error('confirmStep: 步骤不存在 ' + stepId);
  step.status = 'VERIFIED';
  step.grounding = { tier: G.KERNEL.tier, mayHallucinate: G.KERNEL.mayHallucinate };
  // KB 升置信（键与 distill 写入一致：domain→stepId；真实签名 from,to,success,step）
  try {
    if (typeof L.KB.updateConfidence === 'function') {
      L.KB.updateConfidence(m.domain, stepId, true, 0.4);
    }
  } catch (e) { console.warn('[distillery] KB 升级失败:', e.message); }
  m.grounding = {
    verifiedCount: m.steps.filter(s => s.grounding.tier === G.KERNEL.tier).length,
    unverifiedCount: m.steps.filter(s => s.grounding.tier === G.PERCEPTION.tier).length
  };
  m.audit = buildAudit(m);
  return m;
}

// ── 三种渲染 ─────────────────────────────────────────────────────────
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

const Engine = { distill, reportFailure, confirmStep, render, stepify, localize, verbalize, _manuals, GROUNDING: G };

// 融合进认知操作系统（2026-08-29）：以"第四层能力"身份注册进内核能力表，由 OS 统一调度。
// 修复依赖方向：此前是 L.KnowledgeDistillery = Engine（能力模块反向污染内核命名空间），
// 现在改为能力模块主动注册——依赖方向变为 切片 → 内核，且受统一编排/审计/记忆管辖。
if (L && L.Capabilities && typeof L.Capabilities.register === 'function') {
  L.Capabilities.register({
    id: 'learn.distill',
    layer: 4,
    name: '知识蒸馏（专家经验→可复核操作手册）',
    describe: '把任意领域的隐性经验拆成条件→动作→本地工具→人话步骤，每步带可信档；失败可降级重生',
    run: (ctx) => Engine.distill((ctx && ctx.input) || {})
  });
}

module.exports = Engine;

// ── 自测：用两个毫不相关的领域证明「对任意知识生效、零代码改动」──────
if (require.main === module) {
  (async () => {
    const line = s => console.log(s);
    const runDomain = async (label, expertInput) => {
      line('\n════════ ' + label + ' ══════════');
      const m = await Engine.distill(expertInput);
      line('[蒸馏] 领域=' + m.domain + '  手册=' + m.id + '  步骤数=' + m.steps.length);
      line('[蒸馏] 已写KB=' + m.kbRecorded + '  可信档 已验证' + m.grounding.verifiedCount + '/未验证' + m.grounding.unverifiedCount);
      line('[蒸馏] 审计: ' + m.audit.verdict);
      line('──── 口述指令 ────');
      line(renderOral(m));
      return m;
    };

    // 领域 A：烧砖（经验以自由句给出，引擎自己切条件/工具/术语）
    const A = await runDomain('领域A · 用本地红壤烧砖', {
      domain: '用本地红壤烧砖',
      expert: '老窑匠·王',
      localContext: {
        inventory: { tools: ['木模', '锄头'], materials: ['红壤', '木柴'] },
        substituteMap: { '窑炉': '本地土窑+柴火' }
      },
      terms: { '含水率': '泥土里水的比例' },
      principles: [
        '取红壤剔除碎石，含水率控制在20%以下（握一把能捏成团、落地即散）',
        '制坯入木模压实四角，坯体无裂缝棱角分明',
        '如果砖坯未全干就入窑会爆裂，须阴干5–7天至断面发白再装窑',
        '装窑烧结用窑炉维持800–900℃约6小时，出窑砖断面致密敲击清脆为合格',
        '自然冷却24小时出窑，砖体不烫手无骤冷裂纹'
      ]
    });

    // 领域 B：修理乡村脚踏水泵（机械，与烧砖完全无关）
    const B = await runDomain('领域B · 修理乡村脚踏水泵', {
      domain: '修理乡村脚踏水泵',
      expert: '农机员·李',
      localContext: {
        inventory: { tools: ['机油枪', '扳手'], materials: ['机油'] },
        substituteMap: { '底阀滤网': '旧纱网+铁丝绑扎', '皮碗': '剪橡胶片自制' }
      },
      terms: { '吸程': '水能被吸上来的最大高度', '底阀': '泵体最下端单向进水阀' },
      principles: [
        '如果水泵提不上水，先查底阀是否堵，就拆洗底阀滤网',
        '若皮碗磨损漏气，应更换皮碗，否则吸程不足',
        '遇轴承异响，加注机油至油窗中线',
        '装配后空踩十次确认无漏气声，出水连续即合格'
      ]
    });

    // 验证：A 第一步田间验过 → 升 KERNEL
    const aPick = A.steps.find(s => s.actionRaw.includes('取红壤'));
    confirmStep(A.id, aPick.id, '田间验证：捏团落地散判据有效');
    line('\n[验证A] ' + aPick.id + ' 升档=' + aPick.grounding.tier + '  未验证剩' + A.grounding.unverifiedCount);

    // 失败：B 第二步皮碗温度窗错（示例：橡胶片不耐高温需降规格）
    const bPick = B.steps.find(s => s.actionRaw.includes('皮碗'));
    const B2 = reportFailure(B.id, bPick.id, '自剪橡胶片遇油溶胀失效，应改用耐油橡胶或定期更换');
    line('[降级B] ' + bPick.id + ' 状态=' + bPick.status + '  手册rev=' + B2.revision + '  审计=' + B2.audit.verdict);

    line('\n════════ 自测结论 ═════════');
    // 审计诚实断言：含降级步 → degraded 且不声称无幻觉；含未验证步 → unverified
    const ok = A.steps.length === 5 && B.steps.length === 4
      && aPick.grounding.tier === G.KERNEL.tier
      && bPick.status === 'DOWNGRADED'
      && B2.audit.status === 'degraded'
      && B2.audit.noHallucination === false
      && A.audit.status === 'unverified';
    line(ok ? 'SELF-TEST: PASS ✔（同一引擎已蒸馏两个无关领域，零代码改动；审计诚实分级）' : 'SELF-TEST: FAIL ✘');
  })().catch(e => { console.error('SELF-TEST ERROR', e.message); process.exit(1); });
}

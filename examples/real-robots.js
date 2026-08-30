#!/usr/bin/env node
/**
 * 灵脑 LingNao — 真实机器人案例接入示例「把灵脑当大脑」
 * ============================================================
 * 本文件把 4 个真实、可考据的机器人部署案例，用灵脑世界图建模后接入灵脑大脑，
 * 演示「免费 LLM 感知(可能幻觉) → 灵脑 A* 确定性规划(不幻觉) → 七段审计(可验证)」。
 *
 * 案例（均附公开来源，数字来自厂商/媒体披露）：
 *   1) Amazon Kiva/Proteus 仓储机器人  — 把货架/料箱送到拣货站
 *   2) Aethon TUG 医院配送机器人       — 把药品从药房送到病区
 *   3) Starship 校园/人行道配送机器人  — 把餐食从食堂送到宿舍
 *   4) 废墟搜救机器人(CMU/DARPA SubT)  — 从基地抵达疑似幸存者区
 *
 * 诚实边界：下面每个 world 是依据公开规格「简化的教学模型」（真实仓库/医院地图远比这复杂），
 *           但规划内核、审计、不幻觉保证与真实部署用的是同一套灵脑代码。
 *
 * 运行：
 *   node examples/real-robots.js                 # 离线(零成本)，跑全部 4 个案例
 *   node examples/real-robots.js warehouse       # 只跑某个案例
 *   node examples/real-robots.js --llm           # 真调 OpenRouter free 做感知(每天50次免费)
 *   OPENROUTER_API_KEY=sk-or-... node examples/real-robots.js --llm
 *
 * 任何人 clone 本仓库后，把 K.reason / K.generateAudit 接到自己的机器人控制器即可。
 */

const K = require('../lingnao-mcp'); // 灵脑内核（单一真源，零依赖）

// ── 案例定义（world 均为依据公开规格的简化教学模型）──
const SCENARIOS = {
  warehouse: {
    title: 'Amazon Kiva / Proteus 仓储机器人',
    real: '来源: Amazon 2012 以 7.75 亿美元收购 Kiva；2022 年超 52 万台驱动单元，2025 年 7 月突破 100 万台(amalytix/aboutamazon)。Kiva 用地面条码导航把货架送到人前；Proteus(2022)为首个全自主移动机器人，用 SLAM/传感器、园区内自由导航、自动回充电桩。',
    world: {
      nodes: ['DOCK', 'A1', 'A2', 'A3', 'STATION'],
      edges: [
        { from: 'DOCK', to: 'A1', w: 3, p: 1 }, { from: 'A1', to: 'DOCK', w: 3, p: 1 },
        { from: 'A1', to: 'A2', w: 3, p: 1 }, { from: 'A2', to: 'A1', w: 3, p: 1 },
        { from: 'A2', to: 'A3', w: 3, p: 1 }, { from: 'A3', to: 'A2', w: 3, p: 1 },
        { from: 'A3', to: 'STATION', w: 3, p: 1 }, { from: 'STATION', to: 'A3', w: 3, p: 1 },
        { from: 'DOCK', to: 'A2', w: 4.2426, p: 1 }, { from: 'A2', to: 'DOCK', w: 4.2426, p: 1 },
        { from: 'A1', to: 'STATION', w: 4.2426, p: 1 }, { from: 'STATION', to: 'A1', w: 4.2426, p: 1 },
        { from: 'A2', to: 'STATION', w: 4.2426, p: 1 }, { from: 'STATION', to: 'A2', w: 4.2426, p: 1 },
      ],
    },
    start: 'DOCK', goal: 'STATION',
    instruction: '把 3 号货架的货送到拣货站',
    alias: { A3: ['3号货架', '三号货架', '货架3'], STATION: ['拣货站', '拣货台', 'station'], A2: ['2号货架', '二号货架'], A1: ['1号货架', '一号货架'] },
    hardDemo: ['A1'], // 演示：A1 通道被占用(硬约束禁行) → 内核确定性改道
  },

  hospital: {
    title: 'Aethon TUG 医院配送机器人',
    real: '来源: Aethon 2007 成立，TUG 2011 商用；全球 1000+ 站点、超 1 万台上线(robotwale/aethon)。SLAM 导航无需地面标记，自动回充，可呼叫电梯/开门，符合 ISO 13482；用途: 药品/亚麻/餐食/检验样本/医疗废弃物(robotwale/singularityhub)。',
    world: {
      nodes: ['DOCK', 'PHARMACY', 'WARD_A', 'WARD_B', 'LAB', 'LINEN', 'ELEV'],
      edges: [
        { from: 'DOCK', to: 'PHARMACY', w: 2, p: 1 }, { from: 'PHARMACY', to: 'DOCK', w: 2, p: 1 },
        { from: 'PHARMACY', to: 'WARD_A', w: 3, p: 1 }, { from: 'WARD_A', to: 'PHARMACY', w: 3, p: 1 },
        { from: 'WARD_A', to: 'WARD_B', w: 2, p: 1 }, { from: 'WARD_B', to: 'WARD_A', w: 2, p: 1 },
        { from: 'WARD_B', to: 'LAB', w: 4, p: 1 }, { from: 'LAB', to: 'WARD_B', w: 4, p: 1 },
        { from: 'LAB', to: 'LINEN', w: 3, p: 1 }, { from: 'LINEN', to: 'LAB', w: 3, p: 1 },
        { from: 'LINEN', to: 'DOCK', w: 5, p: 1 }, { from: 'DOCK', to: 'LINEN', w: 5, p: 1 },
        { from: 'DOCK', to: 'ELEV', w: 2, p: 1 }, { from: 'ELEV', to: 'DOCK', w: 2, p: 1 },
        { from: 'ELEV', to: 'WARD_B', w: 3, p: 1 }, { from: 'WARD_B', to: 'ELEV', w: 3, p: 1 },
        { from: 'PHARMACY', to: 'ELEV', w: 3, p: 1 }, { from: 'ELEV', to: 'PHARMACY', w: 3, p: 1 },
      ],
    },
    start: 'DOCK', goal: 'WARD_B',
    instruction: '把药房的药送到 B 病区',
    alias: { PHARMACY: ['药房', '药库', 'pharmacy'], WARD_B: ['b病区', 'b病房', '二病区', 'ward_b', 'wardb'], WARD_A: ['a病区', 'a病房'] },
  },

  delivery: {
    title: 'Starship 校园 / 人行道配送机器人',
    real: '来源: 由 Skype 联合创始人创办；累计超 1000 万次配送、1400 万英里(starship.xyz)。约 99% 自主(L4)，载货约 10kg(3 个购物袋)，单次配送约 $1.99，可过马路/爬路缘/雨夜运行，远程人工可接管。',
    world: {
      nodes: ['HUB', 'DINING', 'LIBRARY', 'DORM', 'QUAD', 'CROSS'],
      edges: [
        { from: 'HUB', to: 'DINING', w: 2, p: 1 }, { from: 'DINING', to: 'HUB', w: 2, p: 1 },
        { from: 'DINING', to: 'LIBRARY', w: 3, p: 1 }, { from: 'LIBRARY', to: 'DINING', w: 3, p: 1 },
        { from: 'LIBRARY', to: 'DORM', w: 4, p: 1 }, { from: 'DORM', to: 'LIBRARY', w: 4, p: 1 },
        { from: 'DORM', to: 'QUAD', w: 2, p: 1 }, { from: 'QUAD', to: 'DORM', w: 2, p: 1 },
        { from: 'QUAD', to: 'HUB', w: 3, p: 1 }, { from: 'HUB', to: 'QUAD', w: 3, p: 1 },
        { from: 'DINING', to: 'CROSS', w: 2, p: 1 }, { from: 'CROSS', to: 'DINING', w: 2, p: 1 },
        { from: 'CROSS', to: 'DORM', w: 3, p: 1 }, { from: 'DORM', to: 'CROSS', w: 3, p: 1 },
      ],
    },
    start: 'HUB', goal: 'DORM',
    instruction: '从食堂取餐送到宿舍',
    alias: { DINING: ['食堂', '餐厅', 'dining'], DORM: ['宿舍', 'dorm'], CROSS: ['路口', '过街', 'cross'] },
  },

  rescue: {
    title: '废墟搜救机器人 (CMU 蛇形 / DARPA SubT / 土耳其震区)',
    real: '来源: CMU 蛇形机器人参与委内瑞拉震区搜救(automate.org)；DARPA 地下挑战赛 CERBERUS 多机器人自主建图；2023 土耳其-叙利亚 M7.8 震区部署无人机/地面机器人做热成像幸存者探测；日本 2024 能登半岛地震 GSDF 四足机器人侦察(robotage)。',
    world: {
      nodes: ['BASE', 'Z1', 'Z2', 'Z3', 'SURV', 'COMMS'],
      edges: [
        { from: 'BASE', to: 'Z1', w: 2, p: 1 }, { from: 'Z1', to: 'BASE', w: 2, p: 1 },
        { from: 'BASE', to: 'Z2', w: 2, p: 1 }, { from: 'Z2', to: 'BASE', w: 2, p: 1 },
        { from: 'Z1', to: 'Z2', w: 1, p: 1 }, { from: 'Z2', to: 'Z1', w: 1, p: 1 },
        { from: 'Z1', to: 'SURV', w: 6, p: 1 }, { from: 'SURV', to: 'Z1', w: 6, p: 1 },
        { from: 'Z2', to: 'Z3', w: 2, p: 1 }, { from: 'Z3', to: 'Z2', w: 2, p: 1 },
        { from: 'Z3', to: 'SURV', w: 3, p: 1 }, { from: 'SURV', to: 'Z3', w: 3, p: 1 },
        { from: 'BASE', to: 'COMMS', w: 3, p: 1 }, { from: 'COMMS', to: 'BASE', w: 3, p: 1 },
        { from: 'COMMS', to: 'Z3', w: 4, p: 1 }, { from: 'Z3', to: 'COMMS', w: 4, p: 1 },
        { from: 'SURV', to: 'COMMS', w: 3, p: 1 }, { from: 'COMMS', to: 'SURV', w: 3, p: 1 },
      ],
    },
    start: 'BASE', goal: 'SURV',
    instruction: '从基地出发，去疑似幸存者区搜救',
    alias: { SURV: ['幸存者', '幸存者区', 'survivor', 'surv'], Z3: ['3区', 'z3'], COMMS: ['通信', '通联', 'comms'] },
    hardDemo: ['COMMS'], // 演示：COMMS 通联区失效(硬约束禁行) → 内核走更稳的 Z2-Z3 通道
  },
};

// 把人话/感知文本映射到本案例的某个节点（中文别名优先，再节点名子串）
// 多匹配时优先场景既定目标(目的地偏向)：操作员口语常把起点/终点都说出，内核解析优先落到任务目标
function resolveNode(text, sc) {
  const up = String(text || '').toUpperCase();
  const cands = [];
  for (const n of sc.world.nodes) {
    const ali = (sc.alias[n] || []).map(s => s.toUpperCase());
    if (ali.some(a => up.includes(a))) cands.push(n);
  }
  for (const n of sc.world.nodes) if (up.includes(n.toUpperCase())) cands.push(n);
  if (!cands.length) return null;
  if (cands.includes(sc.goal)) return sc.goal; // 目的地偏向
  return cands[0];
}

// 离线感知（无 key 时）：确定性、零成本
function perceiveOffline(sc) {
  return { percept: { goal: sc.goal, start: sc.start, mode: 'manual' }, mode: 'manual(离线)' };
}

async function perceive(sc, useLLM, instruction) {
  if (useLLM) {
    const p = await K.perceiveLLM(instruction);
    if (p.ok) {
      const text2 = [p.percept.goal, ...(p.percept.entities || [])].join(' ');
      const goal = resolveNode(text2, sc) || sc.goal;
      // 起点 = 机器人自身已知位姿（固定），不靠人话推断（人话里说的是目的地，容易误判）
      const start = sc.start;
      return { percept: Object.assign({}, p.percept, { goal, start }), mode: 'llm(openrouter/free)', raw: p };
    }
    console.log('   [warn] 免费API感知失败:', p.error, '→ 离线降级');
  }
  return perceiveOffline(sc);
}

async function runScenario(name, sc, useLLM) {
  console.log('\n' + '='.repeat(72));
  console.log('案例: ' + sc.title);
  console.log('  真实背景: ' + sc.real);
  console.log('  世界图: ' + sc.world.nodes.length + ' 节点 / ' + (sc.world.edges.length / 2) + ' 条(无向)通道');
  K.setWorld(sc.world);

  const instruction = sc.instruction;
  console.log('\n[CMD] 操作员指令(人话): ' + instruction);

  // 1) 感知：免费 LLM（可能幻觉）或离线降级
  const per = await perceive(sc, useLLM, instruction);
  console.log('[PERCEPT] 感知结果: ' + JSON.stringify(per.percept) + '  [' + per.mode + ', 可能幻觉 → 仅用于理解]');
  const start = per.percept.start || sc.start;
  const goal = per.percept.goal || sc.goal;

  // 2) 推理：灵脑内核 A* 确定性规划（不幻觉）
  const plan = K.reason(start, goal, {});
  console.log('\n[BRAIN] 灵脑规划(确定性内核):');
  if (plan.status === 'unknown') {
    console.log('   目标 ' + goal + ' 不可达 → 诚实返回 unknown，不编造路径');
    console.log('   U(未知集): ' + JSON.stringify(plan.U));
  } else {
    console.log('   起点 ' + start + ' → 目标 ' + goal);
    console.log('   状态 ' + plan.status + ' | 路径 ' + plan.path.join(' → ') + ' | 代价 ' + plan.cost + ' | 系统 ' + plan.usedSystem);
    console.log('   置信档: ' + ((plan.grounding && plan.grounding.tier) || 'DETERMINISTIC'));
  }

  // 3) 执行（模拟机器人按规划移动）
  console.log('\n[ACT] 机器人执行:');
  plan.path.forEach((n, i) => console.log('   第' + (i + 1) + '步 → ' + n));

  // 4) 审计：七段 + 霍尔证明（可验证、不幻觉）
  const audit = K.generateAudit(plan, {});
  console.log('\n[AUDIT] 审计(可验证, 不幻觉):');
  console.log('   概要: ' + JSON.stringify(audit.summary));
  console.log('   证明: ' + audit.proof.hoare + ' | verified: ' + audit.proof.verified);
  if (audit.selfVerification) {
    const sv = audit.selfVerification;
    console.log('   自验证(反向证伪): ' + (sv.passed ? 'PASS(无矛盾)' : 'FAIL(发现矛盾)') + ' | contradictions=' + JSON.stringify(sv.contradictions));
  }
  if (audit.reflection) console.log('   反思: ' + audit.reflection.insight);
  console.log('   不幻觉保证: ' + (audit.noHallucination === true ? '决策依据全部来自确定性内核/审计' : 'NOT GUARANTEED'));

  // 5) 硬约束改道演示（仓库/搜救案例）：某通道被占/结构不稳 → 内核确定性重规划
  if (sc.hardDemo) {
    const blocked = sc.hardDemo[0];
    const plan2 = K.reason(start, goal, { hard: [blocked] });
    console.log('\n[CONSTRAINT] 安全演示: 禁行节点 ' + blocked + '（通道被占/结构不稳）');
    if (plan2.status === 'unknown') {
      console.log('   无可达路径 → 诚实返回 unknown');
    } else {
      console.log('   改道后路径: ' + plan2.path.join(' → ') + ' | 代价 ' + plan2.cost + ' (原 ' + plan.cost + ')');
      const a2 = K.generateAudit(plan2, { hard: [blocked] });
      const hardOk = (a2.constraints || []).some(c => c.type === 'hard' && c.passed);
      console.log('   审计硬约束通过: ' + hardOk + ' | 不幻觉保证: ' + (a2.noHallucination === true ? '成立' : '不成立'));
    }
  }
  console.log('='.repeat(72));
}

async function main() {
  const args = process.argv.slice(2);
  const useLLM = args.includes('--llm');
  const names = args.filter(a => a !== '--llm');
  const hasKey = !!process.env.OPENROUTER_API_KEY;
  if (useLLM && !hasKey) console.log('[note] 未设 OPENROUTER_API_KEY，--llm 将失败并自动降级离线。');

  const targets = names.length ? names : Object.keys(SCENARIOS);
  console.log('\n=== 灵脑 LingNao · 真实机器人案例接入（' + targets.length + ' 例）===');
  console.log('大脑: 灵脑 v3.0 | 免费API感知: ' + (useLLM ? (hasKey ? '开(openrouter/free)' : '开(但无key→降级)') : '关(离线降级)'));

  for (const n of targets) {
    if (!SCENARIOS[n]) { console.log('\n[skip] 未知案例: ' + n + '（可选: warehouse/hospital/delivery/rescue）'); continue; }
    await runScenario(n, SCENARIOS[n], useLLM);
  }
  console.log('\n[done] 以上案例证明：别人可把灵脑当任何机器人的大脑——感知用免费 LLM，规划/审计用确定性内核（不幻觉、可复现、可审计）。');
}

main().catch(e => { console.error('示例运行失败:', e); process.exit(1); });

#!/usr/bin/env node
/**
 * 灵境 LingJing — 极简机器人示例「把灵境当大脑」
 * ============================================================
 * 场景：一台在 CHARGE / A / B / C 网格中移动的地面机器人（如灭蚊器 / 扫地机）。
 *       它接收一句中文口语指令，灵境负责：
 *         感知(免费 LLM 把人话转成结构化状态) →
 *         推理(内核 A* 确定性规划) →
 *         执行(模拟机器人按规划移动) →
 *         审计(七段审计 + 霍尔证明，可验证、不幻觉)。
 *
 * 运行：
 *   1) 带免费 API（真正调用 OpenRouter free 做感知，每天 50 次免费额度）：
 *      OPENROUTER_API_KEY=sk-or-... node examples/simple-robot.js "机器人电量低，去C点充电"
 *   2) 离线（不烧额度，用内置关键词感知，演示确定性内核）：
 *      node examples/simple-robot.js "去C点"
 *
 * 设计要点（即「不幻觉」边界）：
 *   感知(LLM) 可能幻觉，标 PERCEPTION 档，只用于「理解人话」；
 *   规划 / 审计 全部在本地确定性内核，标 KERNEL / PROOF 档，不幻觉、可复现、可审计。
 *   任何人都能 clone 本仓库后，把 K.reason / K.generateAudit 接到自己的机器人控制器上。
 */

const K = require('../lingjing-mcp'); // 灵境内核（单一真源，零依赖）

// ── 1. 给机器人定义它的世界（状态图，可任意 setWorld 自定义）──
const WORLD = {
  nodes: ['CHARGE', 'A', 'B', 'C'],
  edges: [
    { from: 'CHARGE', to: 'A', w: 3, p: 1 },       { from: 'A', to: 'CHARGE', w: 3, p: 1 },
    { from: 'A', to: 'B', w: 4.2426, p: 1 },        { from: 'B', to: 'A', w: 4.2426, p: 1 },
    { from: 'B', to: 'C', w: 3, p: 1 },             { from: 'C', to: 'B', w: 3, p: 1 },
    { from: 'CHARGE', to: 'B', w: 4.2426, p: 1 },   { from: 'B', to: 'CHARGE', w: 4.2426, p: 1 },
    { from: 'A', to: 'C', w: 4.2426, p: 1 },        { from: 'C', to: 'A', w: 4.2426, p: 1 },
  ],
  coord: { CHARGE: [0, 0], A: [3, 0], B: [3, 3], C: [6, 0] },
};
K.setWorld(WORLD);

// 在节点名里找是否出现于文本（CHARGE/A/B/C 任一）
// 注意：CHARGE 含字母 C，须让具体点位 A/B/C 优先匹配，否则 "去C点" 会被误判成 CHARGE
function resolveNode(text) {
  const up = String(text || '').toUpperCase();
  const points = ['A', 'B', 'C'];
  for (const n of points) if (up.includes(n)) return n;
  if (/充电|CHARGE/.test(up)) return 'CHARGE';
  return null;
}

// 离线感知（无 key 时）：极简关键词解析，确定性、零成本
function perceiveOffline(text) {
  const goal = resolveNode(text) || 'C';
  const start = 'CHARGE'; // 默认机器人在充电桩
  return { percept: { goal, start, mode: 'manual' }, perceptMode: 'manual(离线)' };
}

async function main() {
  const text = process.argv.slice(2).join(' ').trim() || '机器人电量低，去C点充电';
  const hasKey = !!process.env.OPENROUTER_API_KEY;
  console.log('\n[ROBOT] 指令(人话):', text);
  console.log('   大脑: 灵境 LingJing v3.0 | 免费API感知:', hasKey ? '开(openrouter/free)' : '关(离线降级)');

  // ── 2. 感知：免费 LLM 把人话转成结构化状态；失败则离线降级 ──
  let percept, start, goal, perceptMode;
  if (hasKey) {
    const p = await K.perceiveLLM(text);
    if (p.ok) {
      percept = p.percept; perceptMode = 'llm(openrouter/free)';
      start = /充电|charge/i.test(text) ? 'CHARGE' : (resolveNode((percept.entities || []).join(' ')) || 'CHARGE');
      goal = resolveNode((percept.goal || '') + ' ' + (percept.entities || []).join(' ')) || percept.goal || 'C';
    } else {
      console.log('   [warn] 免费API感知失败:', p.error, '→ 离线降级');
      const off = perceiveOffline(text); percept = off.percept; perceptMode = 'manual(降级)'; start = off.percept.start; goal = off.percept.goal;
    }
  } else {
    const off = perceiveOffline(text); percept = off.percept; perceptMode = 'manual(离线)'; start = off.percept.start; goal = off.percept.goal;
  }
  console.log('   感知结果:', JSON.stringify(percept), '[' + perceptMode + ', 可能幻觉 → 仅用于理解]');

  // ── 3. 推理：灵境内核 A* 确定性规划（不幻觉）──
  const plan = K.reason(start, goal, {});
  console.log('\n[BRAIN] 灵境规划(确定性内核):');
  if (plan.status === 'unknown') {
    console.log('   目标', goal, '不可达（不在世界图中）→ 诚实返回 unknown，不编造路径');
    console.log('   U(未知集):', JSON.stringify(plan.U));
    return;
  }
  console.log('   起点:', start, '→ 目标:', goal);
  console.log('   状态:', plan.status, '| 路径:', plan.path.join(' → '), '| 代价:', plan.cost, '| 系统:', plan.usedSystem);
  console.log('   置信档:', (plan.grounding && plan.grounding.tier) || 'DETERMINISTIC');

  // ── 4. 执行（模拟机器人按规划移动）──
  console.log('\n[ACT] 机器人执行:');
  plan.path.forEach((n, i) => console.log('   第' + (i + 1) + '步 →', n));

  // ── 5. 审计：七段审计 + 霍尔证明（可验证、不幻觉）──
  const audit = K.generateAudit(plan, {});
  console.log('\n[AUDIT] 审计(可验证, 不幻觉):');
  console.log('   概要:', JSON.stringify(audit.summary));
  console.log('   证明:', audit.proof.hoare, '| verified:', audit.proof.verified);
  if (audit.selfVerification) {
    const sv = audit.selfVerification;
    console.log('   自验证(反向证伪):', sv.passed ? 'PASS (无矛盾)' : 'FAIL (发现矛盾)', '| contradictions=', JSON.stringify(sv.contradictions));
  }
  if (audit.reflection) console.log('   反思:', audit.reflection.insight);
  console.log('   不幻觉保证:', audit.noHallucination === true ? '决策依据全部来自确定性内核/审计' : 'NOT GUARANTEED');

  console.log('\n[done] 示例完成：别人 clone 仓库后，设 OPENROUTER_API_KEY 即可让灵境当任何机器人的大脑（感知用免费 LLM，规划/审计用确定性内核）。');
}

main().catch(e => { console.error('示例运行失败:', e); process.exit(1); });

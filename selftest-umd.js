// selftest-umd.js — 验证 lingjing.umd.js 在 Node 下可直接 require 并实装核心能力
const L = require('./lingjing.umd.js');
function assert(c, msg) { if (!c) { console.error('FAIL: ' + msg); process.exit(1); } console.log('PASS: ' + msg); }

assert(typeof L === 'object' && typeof L.reason === 'function', 'UMD 导出为内核对象(reason 可用)');
assert(typeof L.groundingMeta === 'function' && typeof L.GROUNDING === 'object', '不幻觉置信分层已导出(groundingMeta/GROUNDING)');

// 自定义世界图（灭蚊器风格；边用 {from,to,w,p} 对象，w=代价，p=概率）
L.setWorld({
  nodes: ['CHARGE', 'A', 'B', 'C'],
  edges: [
    { from: 'CHARGE', to: 'A', w: 1, p: 1 },
    { from: 'A', to: 'B', w: 2, p: 1 },
    { from: 'B', to: 'C', w: 3, p: 1 },
    { from: 'CHARGE', to: 'C', w: 7, p: 1 }
  ],
  coord: { CHARGE: [0, 0], A: [1, 0], B: [2, 0], C: [3, 0] }
});

const r = L.reason('CHARGE', 'C', { hard: [], soft: [] });
assert(r.status === 'optimal' && JSON.stringify(r.path) === JSON.stringify(['CHARGE', 'A', 'B', 'C']), 'A* 最优路径 CHARGE→A→B→C (代价6)');
if (r.grounding) { assert(r.grounding.tier === 'DETERMINISTIC', 'reason 标注 DETERMINISTIC 不幻觉档'); }
else { console.log('  (reason 未直接带 grounding，由 askBrain/audit 提供分层)'); }

const a = L.generateAudit(r, { hard: [], soft: [] });
assert(a.status === 'valid' && a.proof && a.proof.verified === true && a.proof.hoare, '七段审计 valid + 霍尔证明真验证(verified=true)');
assert(a.noHallucination === true, '证明通过 ⇒ noHallucination=true');

// ── 诚实契约回归锁（2026-08-29 专家审查 P0 修复）────────────────────
// ① 拼凑 planLike 输入 → unverified，绝不发 valid（修复"审计兜底伪造 valid"）
const fake = L.generateAudit({ status: 'optimal', path: ['X', 'Y'], cost: 1, steps: [{ seq: 1, state: 'X', action: 'move→Y', result: 'Y', reason: '拼凑', confidence: 1, evidenceIds: [] }] });
assert(fake.status === 'unverified' && fake.noHallucination === false && fake.proof.hoare === null, '伪造输入审计 fail-closed: unverified + 不幻觉=false + 无霍尔记号');

// ② system1 不得绕过硬约束（KB 高置信经验 + hard 禁目标 → 必须 unknown）
L.KB.addExperience('CHARGE', 'C', true, 0.95, 'selftest');
const rBypass = L.reason('CHARGE', 'C', { hard: ['C'] });
assert(rBypass.status === 'unknown' && (rBypass.U || []).includes('目标位于硬约束禁集'), 'system1 尊重 hard 约束(高置信经验不再绕禁集)');

// ③ 禁中间节点绕行 + reason 结果携带 opts + 审计自动继承 hard 并复核
const rDetour = L.reason('CHARGE', 'C', { hard: ['B'] });
assert(rDetour.status === 'optimal' && JSON.stringify(rDetour.path) === JSON.stringify(['CHARGE', 'C'])
  && rDetour.opts && rDetour.opts.hard && rDetour.opts.hard[0] === 'B', 'hard 禁 B 绕行直连 + 结果携带 opts');
const aDetour = L.generateAudit(rDetour);
assert(aDetour.status === 'valid' && aDetour.constraints[0].nodes.includes('B') && aDetour.constraints[0].passed === true, '审计自动继承 hard 约束并复核通过');

// 前门准则因果（未观测混杂识别 ACE）——内核原始签名 causalEffect(model, cause, effect, samples, opts)
const ce = L.causalEffect(
  { eqs: {} }, 'X', 'Y',
  [
    { state: { X: 1, M: 0.5 }, next: { Y: 0.9 } },
    { state: { X: 0, M: 0.2 }, next: { Y: 0.4 } },
    { state: { X: 1, M: 0.6 }, next: { Y: 1.0 } },
    { state: { X: 0, M: 0.1 }, next: { Y: 0.3 } }
  ],
  { mediator: 'M' }
);
assert(ce && ce.method === 'front-door-adjustment-linear-SEM' && typeof ce.ace === 'number', 'causalEffect 前门识别 ACE=' + ce.ace);
assert(ce.grounding && ce.grounding.tier === 'DETERMINISTIC', 'causalEffect 前门 标注 DETERMINISTIC 不幻觉档');

// 端到端 askBrain（async；离线无 key → 感知层诚实降级，不伪造=不幻觉边界）
(async () => {
  const ab = await L.askBrain('从充电座去 C 点');
  assert(ab && ab.ok === false && ab.stage === 'perceive' && ab.error, 'askBrain 离线无 key 诚实降级(不伪造)');
  console.log('  askBrain offline(无免费LLM)=', JSON.stringify({ ok: ab.ok, stage: ab.stage }));
  console.log('\nSELFTEST-UMD OK');
})();

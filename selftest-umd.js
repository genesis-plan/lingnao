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

// ── 三根神经回归锁（2026-08-29 补完"大脑"）──────────────────────────
// 神经① 记忆持久化：存档 → 清空 → 恢复（此前进程退出即失忆）
const beforeExp = L.KB.summary().count;
assert(L.Memory.save().ok === true && L.Memory.status().hasArchive === true, '神经① 记忆落盘：存档已生成');
L.KB._exp.length = 0;
const reloaded = L.Memory.load();
assert(reloaded.ok === true && L.KB.summary().count === beforeExp, '神经① 记忆恢复：清空后可从存档还原 ' + beforeExp + ' 条经验');

// 神经② 感知建图：观测真写入世界图；冲突登记且不静默改写；未确认不进快答
const per = L.perceive({ source:'selftest', evidence:'unit-1', observations:[
  { type:'node', node:'ZZ' },
  { type:'edge', from:'C', to:'ZZ', w:2.5, p:0.9 },
  { type:'edge', from:'A', to:'B', w:999 }
]});
assert(per.ok && L.WORLD.nodes.includes('ZZ') && L.WORLD.edges.some(e => e.from === 'C' && e.to === 'ZZ'), '神经② 感知建图：观测真的写入世界图（图会自己长）');
assert(per.conflicts.length === 1 && L.WORLD.edges.find(e => e.from === 'A' && e.to === 'B').w !== 999, '神经② 冲突登记：与既有认知冲突时保留原值，不静默改写');
L.KB.addExperience('C', 'ZZ', true, 0.99, 'selftest');
const rPer = L.reason('C', 'ZZ');
assert((rPer.usedSystem || rPer.system) !== '1', '神经② 诚实闸门：未确认的感知边不允许系统1快答（须走证明链）');
assert(L.confirmObservation('C→ZZ', true).ok === true, '神经② 感知确认：观测升级为已验证认知');

// 神经③ 元认知接管调度：动态门槛 / 探索产出备选 / 事件总线真在跑
const rMeta = L.reason('CHARGE', 'C');
assert(rMeta.meta && typeof rMeta.meta.system1Threshold === 'number'
  && rMeta.meta.system1Threshold >= 0.6 && rMeta.meta.system1Threshold <= 0.95,
  '神经③ 元认知调度：系统1门槛按不确定性动态给定 = ' + (rMeta.meta && rMeta.meta.system1Threshold) + '（旧版写死 0.8）');
// 探索模式备选路径：换一个"有两条路可走"的世界，并抬高缺口阈值强制进入 explore
L.setWorld({ nodes:['S','M','T'], edges:[{from:'S',to:'M',w:1},{from:'M',to:'T',w:1},{from:'S',to:'T',w:5}] });
const rAlt = L.reason('S', 'T', { gapThreshold: 0.99 });
assert(rAlt.meta && rAlt.meta.exploreExploit === 'explore', '神经③ 元认知调度：知识缺口高 → 进入探索模式');
assert(Array.isArray(rAlt.alternatives) && rAlt.alternatives.length === 1
  && rAlt.alternatives[0].avoid === 'M' && rAlt.alternatives[0].path.join('→') === 'S→T',
  '神经③ 探索模式：确定性产出备选路径（避开M → S→T，代价+' + (rAlt.alternatives[0] && rAlt.alternatives[0].delta) + '）');
assert(L.EventBus.log.length > 0, '神经③ 事件总线：内核内部已产生 ' + L.EventBus.log.length + ' 条事件（不再是空转装饰）');

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

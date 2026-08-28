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
assert(a.status === 'valid' && a.proof && a.proof.hoare, '七段审计 valid + 霍尔证明证书存在');

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

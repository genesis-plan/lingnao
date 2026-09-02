// B 切片回归：安全层判定接入审计报告（safetyLayers 块）
// 规划层三层（hard/selfVerify/hoare）+ 控制层两层（deterministicTraps/clfCbfQP）
const L = require('../lingnao.umd.js');
let pass = 0, fail = 0;
function ok(c, m, extra) { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m, extra != null ? JSON.stringify(extra).slice(0, 280) : ''); } }
function near(a, b, e) { return Math.abs(a - b) <= e; }

// 一个最小规划路径（不可判定，避免触发 Hoare 证明链）
function mkPath() {
  return {
    id: 'P', steps: [{ seq: 1, state: 'A', action: 'go', result: 'B', reason: 'r1', confidence: 1, evidenceIds: [] }],
    path: ['A', 'B'], cost: 1, status: 'unknown', U: ['不可判定'], opts: { hard: [], soft: [] }
  };
}

console.log('— B1：规划层三层（无控制上下文）—');
(function () {
  const a = L.generateAudit(mkPath(), {});
  ok(Array.isArray(a.safetyLayers.layers), 'safetyLayers.layers 存在', a.safetyLayers);
  ok(a.safetyLayers.layers.length === 3, '仅规划层三层（hard/selfVerify/hoare）', a.safetyLayers.layers.map(l => l.layer));
  const layers = a.safetyLayers.layers;
  ok(layers[0].layer === 'plan.hard' && layers[1].layer === 'plan.selfVerify' && layers[2].layer === 'plan.hoare', '三层标识正确', layers.map(l => l.layer));
  ok(layers[0].verdict === 'safe', 'plan.hard safe（无禁行节点）', layers[0]);
  ok(layers[2].verdict === 'undecided', 'plan.hoare undecided（路径不可判定，诚实标 𝕌）', layers[2]);
  ok(a.safetyLayers.overall === 'undecided', '整体 undecided（plan.hoare 𝕌 传导）', a.safetyLayers.overall);
  ok(a.status === 'warning', '报告 status=warning（unknown 传导）', a.status);
  ok(a.safetyLayers.defenseInDepth === true, 'defenseInDepth 标记', a.safetyLayers.defenseInDepth);
})();

console.log('— B2：控制层 unsafe（单色等差陷阱）→ 整体 unsafe、status=unsafe —');
(function () {
  const a = L.generateAudit(mkPath(), { control: { traps: { assignment: { seq: [3, 3, 3] } } } });
  ok(a.safetyLayers.layers.length === 4, '规划三层 + 控制陷阱层 = 4 层', a.safetyLayers.layers.map(l => l.layer));
  const trapLayer = a.safetyLayers.layers.find(l => l.layer === 'control.deterministicTraps');
  ok(trapLayer && trapLayer.verdict === 'unsafe', 'control.deterministicTraps = unsafe（单色等差）', trapLayer);
  ok(a.safetyLayers.overall === 'unsafe', '整体 unsafe（任一层拒绝即 fail-closed）', a.safetyLayers.overall);
  ok(a.status === 'unsafe', '报告 status=unsafe（控制层 unsafe 传导进 status）', a.status);
})();

console.log('— B3：控制层 safe（无单色等差 + CLF-CBF 可行）→ 控制层 safe —');
(function () {
  const hUp = x => L.dSub(L.dual(1, 0), x[0]);                       // h = 1 - x ≥ 0（x ≤ 1，安全集）
  const V = x => { const e = L.dSub(x[0], L.dual(0.5)); return L.dMul(L.dual(0.5), L.dMul(e, e)); }; // 目标 x=0.5（安全集内）
  const f = x => [-x[0]], g = x => [[1]];
  const a = L.generateAudit(mkPath(), {
    control: {
      traps: { assignment: { seq: [1, 2, 3, 4, 5] } },            // 无单色等差 ⇒ safe
      clfCbf: { V: V, f: f, g: g, hList: [hUp], uNom: 0, x: [0], opts: {} }
    }
  });
  const trapLayer = a.safetyLayers.layers.find(l => l.layer === 'control.deterministicTraps');
  const qpLayer = a.safetyLayers.layers.find(l => l.layer === 'control.clfCbfQP');
  ok(trapLayer && trapLayer.verdict === 'safe', 'control.deterministicTraps = safe', trapLayer);
  ok(qpLayer && qpLayer.verdict === 'safe', 'control.clfCbfQP = safe（u=1 同时满足安全∧收敛，目标在安全集内）', qpLayer);
  ok(a.safetyLayers.layers.length === 5, '规划三层 + 控制两层 = 5 层', a.safetyLayers.layers.map(l => l.layer));
  // 注意：plan.hoare 仍为 undecided（路径不可判定）⇒ 整体 undecided（诚实，不谎称全 safe）
  ok(a.safetyLayers.overall === 'undecided', '整体 undecided（plan.hoare 𝕌 仍传导，不掩盖）', a.safetyLayers.overall);
})();

console.log('— B4：safetyLayersReport 独立取控制层判定（无需规划路径）—');
(function () {
  const none = L.safetyLayersReport({});
  ok(none.layers.length === 0 && none.overall === 'n/a', '无控制上下文 ⇒ n/a', none);
  const V = x => { const e = L.dSub(x[0], L.dual(0.5)); return L.dMul(L.dual(0.5), L.dMul(e, e)); };
  const safe = L.safetyLayersReport({
    traps: { assignment: { seq: [1, 2, 3, 4, 5] } },
    clfCbf: { V: V, f: x => [-x[0]], g: x => [[1]], hList: [x => L.dSub(L.dual(1, 0), x[0])], uNom: 0, x: [0], opts: {} }
  });
  ok(safe.layers.length === 2 && safe.overall === 'safe', '控制两层均 safe ⇒ overall safe', safe);
  const unsafe = L.safetyLayersReport({ traps: { assignment: { seq: [7, 7, 7] } } });
  ok(unsafe.overall === 'unsafe', '控制陷阱 unsafe ⇒ overall unsafe', unsafe);
})();

console.log('\n=== B 切片：' + pass + ' 通过 / ' + fail + ' 失败 ===');
process.exit(fail ? 1 : 0);

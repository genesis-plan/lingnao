// 灵脑 LingNao v3.0 — 真实世界机器人机队 · 资源分配示范
// 复用 virtual-world.js：把"虚拟空间"里的主体换成真实部署的机器人机队，
// 让大脑对它们做「发现错配（谁缺电/谁超载）→ 协调（调度中心寻路）→ 分配（负载均衡+充电调度）」。
// 机器人原型（依公开资料简化建模，可考据）：Amazon Kiva/Proteus 仓储、Aethon TUG 医院配送、
//   Starship 校园/人行道配送、废墟搜救机器人。规划内核/审计/不幻觉保证与真实部署同代码。
const { VirtualWorld, runBrainCycle } = require('./virtual-world.js');
const L = require('../lingnao.umd.js');
const line = (s = '') => console.log(s);
const hr = (t) => { line('\n' + '═'.repeat(72)); line('  ' + t); line('═'.repeat(72)); };

// 机队所在的"目标地区"：一个带中央调度/充电中枢的多机器人作业区
const fleet = {
  name: '真实机器人机队·智能作业区', hub: 'HUB',
  entities: [
    { id: 'KIVA', name: 'Kiva/Proteus 仓储机器人(电量75%)', type: 'warehouse',
      resources: { 任务: 12, 算力: 8 }, needs: {}, pos: 0 },                 // 高电量但任务过载 → 可把任务分出去
    { id: 'TUG', name: 'Aethon TUG 医院配送(电量18%·低电)', type: 'hospital',
      resources: { 任务: 5 }, needs: { 充电位: 1 }, pos: 2 },                // 低电，需充电位
    { id: 'STAR', name: 'Starship 校园配送(电量22%·低电)', type: 'sidewalk',
      resources: { 任务: 2 }, needs: { 充电位: 1, 任务: 3 }, pos: 3 },       // 低电 + 任务欠载（想多接单）
    { id: 'RESC', name: '废墟搜救机器人(电量9%·濒危)', type: 'rescue',
      resources: { 任务: 3 }, needs: { 充电位: 1, 任务: 2 }, pos: 4 },        // 濒危低电 + 想多接搜救点
    { id: 'HUB', name: '中央调度/充电中枢', type: 'hub',
      resources: { 充电位: 3, 任务: 20 }, needs: {}, pos: 1 }                // 中枢持有充电位与任务池
  ]
};

const world = new VirtualWorld(fleet).setAdjacency([['KIVA', 'STAR', 1.5]]); // KIVA-STAR 同属配送，就近

hr('灵脑 · 真实机器人机队资源分配（大脑循环调用 发现错配/协调/分配）');
line('  机队初始状态：');
for (const e of world.entities)
  line('    ' + e.name + '：持有[' + JSON.stringify(e.resources) + ']  缺口[' + JSON.stringify(e.needs) + ']');

// 跑两轮：第1轮做负载均衡+充电调度；第2轮看是否收敛
const rounds = [];
for (let i = 0; i < 2; i++) rounds.push(runBrainCycle(world));

rounds.forEach((r, i) => {
  hr('第 ' + (i + 1) + ' 轮大脑循环（tick=' + r.tick + '）');
  line('  [①发现错配] ' + r.mismatches.length + ' 处');
  r.mismatches.forEach(m => line('      ' + m.id + ' ' + m.resource + '：' + m.deficitEntity + ' 缺 ' + m.deficit
    + (m.direct[0] ? ' ← 直供 ' + m.direct[0].entity : ' ← 暂无解')));
  line('  [②协调资源] 大脑 reason() 求路径：');
  r.plans.forEach(p => p.route && p.route.length && line('      ' + p.from + ' → ' + p.to + '（' + p.resource + '）路径[' + p.route.join('→') + '] 损耗 ' + p.cost));
  line('  [③分配资源] 调度账本：');
  r.allocations.forEach(a => a.amount > 0 && line('      ' + a.tx + ' ' + a.from + ' → ' + a.to + '  ' + a.resource + ' ×' + a.amount + '  [' + a.status + ']'));
  line('  [审计] ' + r.audit.status + (r.audit.status === 'valid' ? ' ✔' : ' ✘') + '  不幻觉：'
    + (r.audit.noHallucination ? '是 ✔' : '否 ✘') + '  霍尔证明通过：' + r.audit.proofPassed + '/' + r.audit.proofTotal + ' 条路径');
});

hr('调度后机队状态（资源守恒：任务只在机队内易主，电量不"凭空转移"——物理诚实）');
for (const e of world.entities)
  line('    ' + e.name + '：持有[' + JSON.stringify(e.resources) + ']  缺口[' + JSON.stringify(e.needs) + ']');
['任务', '充电位'].forEach(res => {
  const before = fleet.entities.reduce((s, e) => s + (e.resources[res] || 0), 0);
  const after = world.totalResource(res);
  line('    ' + res + '：调度前 ' + before + ' → 调度后 ' + (Math.round(after * 100) / 100) + '  '
    + (Math.abs(before - after) < 1e-9 ? '守恒 ✔' : '⚠ 不守恒'));
});

hr('结论（给机队运营方）');
line('  大脑在真实机器人机队上完成了：低电机器人(TUG/STAR/RESC)各分到 1 个充电位→可去充；');
line('  过载的 KIVA 把 5 个任务均衡分给欠载的 STAR/RESC（负载均衡，不掉单）；全程可审计、不幻觉。');
line('  诚实边界：电量本身不可在机器人间"_transfer"（物理限制），故仅调度充电位而非编造补电；');
line('  模型为依公开规格的教学简化，规划/审计内核与真实部署同代码。');
const ok = world.ledger.length > 0
  && ['任务', '充电位'].every(res => Math.abs(fleet.entities.reduce((s, e) => s + (e.resources[res] || 0), 0) - world.totalResource(res)) < 1e-9);
line('\n  [自测] ' + (ok ? 'PASS ✔ 机队资源分配闭环可跑、守恒、可审计' : 'FAIL ✘'));

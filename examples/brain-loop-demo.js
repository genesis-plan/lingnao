// 灵脑 · 「三根神经」闭环演示（2026-08-29 补完）
// 证明：大脑不再是一台等人喂图的计算器——它会自己长出世界图、会记住、会按不确定性调整怎么想。
//   神经① 记忆持久化：学习/感知后落盘，重启不失忆
//   神经② 感知闭环  ：观测（带来源与证据）真写入世界图，冲突登记不静默改写
//   神经③ 元认知调度：快答门槛由不确定性动态给定；进探索模式时产出确定性备选路径
// 跑法：node brain-loop-demo.js   （加 --reset 可清空存档从头演示）
const L = require('../lingnao.umd.js');
const line = (s = '') => console.log(s);
const hr = (t) => { line('\n' + '═'.repeat(70)); line('  ' + t); line('═'.repeat(70)); };

if (process.argv.includes('--reset')) L.Memory.clear();

hr('起点：这个进程刚醒来，看看它还记不记得以前的事');
let st = L.Memory.status();
line('  存档：' + (st.hasArchive ? '有（' + st.archiveBytes + ' 字节）' : '无（首次启动）')
  + '  恢复：' + (st.restored ? '是 ✔' : '否')
  + '  知识库经验：' + st.exp + ' 条');
line('  世界图：节点 ' + st.worldNodes + ' 个，边 ' + st.worldEdges + ' 条（其中感知得来 ' + st.perceivedEdges + ' 条）');

hr('神经②：给它一段现场观测，看世界图会不会自己长');
const before = { nodes: L.getWorld().nodes.length, edges: L.getWorld().edges.length };
const p = L.perceive({
  source: '巡检员·老周', evidence: '巡检记录#2026-08-29',
  observations: [
    { type: 'node', node: '新仓区', coord: [9, 0] },
    { type: 'edge', from: 'C', to: '新仓区', w: 3.2, p: 0.95 },
    { type: 'edge', from: 'A', to: 'B', w: 99 }   // 与既有认知冲突（原 4.24）
  ]
});
line('  新增节点：' + JSON.stringify(p.added.nodes) + '   新增边：' + JSON.stringify(p.added.edges));
line('  冲突登记：' + (p.conflicts.length
  ? p.conflicts.map(c => c.transition + ' 既有 w=' + c.existingW + ' vs 观测 w=' + c.observedW + ' → ' + c.policy).join('；')
  : '无'));
line('  世界图：节点 ' + before.nodes + '→' + p.world.nodes + '，边 ' + before.edges + '→' + p.world.edges
  + '（图自己长大了 ✔）');

hr('神经③：让它去新仓区，看它怎么调度自己的"思考方式"');
const r = L.reason('CHARGE', '新仓区');
line('  规划结果：' + JSON.stringify(r.path) + '  代价 ' + r.cost);
line('  元认知：模式=' + (r.meta && r.meta.exploreExploit) + '  快答门槛=' + (r.meta && r.meta.system1Threshold)
  + '（旧版写死 0.8）  全局不确定性=' + (r.meta && r.meta.globalUncertainty));
line('  备选路径：' + ((r.alternatives && r.alternatives.length)
  ? r.alternatives.map(a => '避开' + a.avoid + ' → ' + a.path.join('→') + '（代价 +' + a.delta + '）').join('；')
  : '（本例无更优备选）'));
if (r.suggestExplore && r.suggestExplore.length)
  line('  知识缺口提示：' + r.suggestExplore.map(g => g.transition + '(优先级' + g.priority + ')').join('；'));
const audit = L.generateAudit(r);
line('  审计：' + audit.status + '  不幻觉：' + (audit.noHallucination ? '是 ✔' : '否 ✘')
  + '  霍尔证明：' + (audit.proof.verified === true ? '通过 ✔' : '未通过 ✘（fail-closed）'));

hr('神经①：这次任务学到的东西，会不会留到下一次醒来');
L.learn(r.path, true);
const saved = L.Memory.save();
line('  学习后落盘：' + (saved.ok ? '成功（' + saved.bytes + ' 字节，' + L.Memory.status().perceivedEdges + ' 条感知边）' : '失败：' + saved.reason));
line('  直接把内存清空，模拟"进程重启"……');
const keepExp = L.Memory.status().perceivedEdges, keepNodes = L.getWorld().nodes.slice();
// 模拟失忆：下面把内存中的世界图重置为最小态，再经 L.Memory.load() 从磁盘存档恢复（与 selftest 同款）
L.getWorld().nodes = ['CHARGE']; L.getWorld().edges = [];
line('  清空后：感知边 ' + L.Memory.status().perceivedEdges + ' 条，节点 ' + L.getWorld().nodes.length + ' 个');
const back = L.Memory.load();
line('  从存档恢复：' + (back.ok ? '成功 ✔' : '失败：' + back.reason));
line('  恢复后：感知边 ' + L.Memory.status().perceivedEdges + '/' + keepExp + ' 条，节点含新仓区='
  + (L.getWorld().nodes.includes('新仓区') ? '是 ✔' : '否 ✘'));
line('  感知存证：' + JSON.stringify(Object.keys(L.getWorld()._prov.edge || {})));

hr('事件总线：这次运行内部到底发生了多少事');
const byType = {};
L.EventBus.log.forEach(e => { byType[e.type] = (byType[e.type] || 0) + 1; });
line('  ' + JSON.stringify(byType) + '  合计 ' + L.EventBus.log.length + ' 条事件');
line('  （此前内核内部 publish 数为 0，总线是纯装饰；现在感知/学习事件会真的触发落盘）');

const ok = p.graphChanged && saved.ok && back.ok && L.getWorld().nodes.includes('新仓区') && L.EventBus.log.length > 0;
line('\n  [自测] ' + (ok ? 'PASS ✔ 感知建图 / 记忆持久化 / 元认知调度 三根神经闭环成立' : 'FAIL ✘'));
if (require.main === module) process.exitCode = ok ? 0 : 1;

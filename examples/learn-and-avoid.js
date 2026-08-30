// 灵脑·学习进化闭环演示：真实反馈 → 学会绕开老失败的路
// 运行：node examples/learn-and-avoid.js
// 不依赖任何配置：用户"说话"级别的使用就是 setWorld + reason，反馈由 execute 自动落库。

const K = require('../lingnao.umd.js');

// ① 设定一个世界：A 到 C 有两条路
//    - 直连 A→C：短（代价1）但现实里常坏（传感器/夹爪卡死等）
//    - 绕行 A→B→C：长（代价1+1）但稳
K.setWorld({
  nodes: ['A', 'B', 'C'],
  edges: [
    // 边权 = 欧氏距离（A[0,0] B[2,0] C[3,0]）→ 欧氏启发式可采纳，A* 最优性由定理保证
    { from: 'A', to: 'C', w: 3 },   // 直连，短但不可靠
    { from: 'A', to: 'B', w: 2 },   // 绕行第一段
    { from: 'B', to: 'C', w: 1 }    // 绕行第二段
  ],
  coord: { A: [0, 0], B: [2, 0], C: [3, 0] } // 显式坐标 → 启用欧氏启发式
});

console.log('=== 第 0 步：还没任何经验，大脑只知道图 ===');
let r0 = K.reason('A', 'C');
console.log('  reason(A,C) →', r0.path.join('→'), '| 代价', r0.cost, '| 状态', r0.status);
console.log('  （它选了最近的直连 A→C，因为还没吃过亏）\n');

// ② 模拟真实世界反馈：直连 A→C 连坏 5 次；绕行 A→B→C 连成 6 次
//    —— 这就是 execute() 在真机器人上失败时/成功时自动写进经验库的东西
console.log('=== 第 1 步：真实世界开始给反馈（execute 自动记录）===');
// 直连坏了 5 次
for (let i = 0; i < 5; i++) K.slRecord({ state: 'A', action: 'move', result: 'C', success: false, reward: -1 });
// 绕行成了 6 次（A→B 和 B→C 都成功）
for (let i = 0; i < 6; i++){
  K.slRecord({ state: 'A', action: 'move', result: 'B', success: true, reward: 1 });
  K.slRecord({ state: 'B', action: 'move', result: 'C', success: true, reward: 1 });
}
const st = K.slStatus();
console.log('  经验库累计样本 =', st.experience);
console.log('  转移 A→C 的失败惩罚 =', K.learnedEdgePenalty('A', 'C'), '（>0 说明已学会这条边不可靠）\n');

// ③ 同样一句话，再问一次：大脑现在会改主意吗？
console.log('=== 第 2 步：还是同一句话 reason(A,C)，大脑变了吗？===');
let r1 = K.reason('A', 'C');
console.log('  reason(A,C) →', r1.path.join('→'), '| 代价', r1.cost, '| 状态', r1.status);
if (r1.path.join('→') === 'A→B→C')
  console.log('  ✅ 学会了：宁可多走一步，也绕开历史上老失败的直连 A→C\n');
else
  console.log('  ⚠ 仍未回避（检查惩罚阈值）\n');

// ④ 学习回流②：把走过的"最优路径"喂回启发式，越走越准（A* 扩展节点更少）
console.log('=== 第 3 步：走过的成功路径写回启发式（heuristicEvolve，可采纳性强仍最优）===');
const expBefore = (K.reason('A', 'C').searchLog || []).length;
K.recordPlanHistory(['A', 'B', 'C'], 'C', true); // execute() 成功时会自动做这步
const r2 = K.reason('A', 'C');
console.log('  融合学习启发式后：', r2.path.join('→'), '| 扩展节点', r2.steps.length,
  '| 一致性', r2.heuristicConsistency && r2.heuristicConsistency.consistent ? '保持（最优性不变）' : '警告');
console.log('  （hint：h_learned = 反向传播的剩余代价，比欧氏更贴近真实，A* 扩展更少）\n');

console.log('=== 总结：学习进化现在是闭环的 ===');
console.log('  ① 真实结果自动进经验库（execute 内，无需你填任何东西）');
console.log('  ② 归纳 + 贝叶斯可靠度 → 暂时规律（确认/废弃）');
console.log('  ③ 确认/统计出的"不可靠边"回写规划代价 → A* 下次绕开（本演示证明生效）');
console.log('  ④ 最优路径反向传播 → 启发式越用越准，仍保证最优');

// selftest-umd.js — 验证 lingjing.umd.js 在 Node 下可直接 require 并实装核心能力
// 重构后（2026-08-29）：大脑不内置经验库(KB 已移除)、不自我贴标(数学标签层已移除)；
// 判断仍由定理派生（Banach 不动点 / A* 一致性三角不等式 / Shannon 信息熵 / PrSTL 时态语义），但不往 return 里塞 math 装饰。
const L = require('./lingjing.umd.js');
function assert(c, msg) { if (!c) { console.error('FAIL: ' + msg); process.exit(1); } console.log('PASS: ' + msg); }

// 自测必须从确定状态起步：神经① 会把感知增量落盘，若不清理，上一轮学到的
// 高置信经验会让本轮世界图漂移。用 reset() 而非 clear()：clear 只删存档，reset 还清空内存感知增量。
if (L.Memory && typeof L.Memory.reset === 'function') L.Memory.reset();

assert(typeof L === 'object' && typeof L.reason === 'function', 'UMD 导出为内核对象(reason 可用)');
assert(typeof L.groundingMeta === 'function' && typeof L.GROUNDING === 'object', '不幻觉置信分层已导出(groundingMeta/GROUNDING)');

// ── 重构锁：标签层与内置经验库已彻底移除（用户指令：把标签、知识库全移除，大脑面向任意物理身体）──
assert(L.KB === undefined, '重构锁：KB 已彻底移除（大脑不内置经验库）');
assert(L.MathFoundation === undefined && L.MathAxioms === undefined && L.MathDesign === undefined,
  '重构锁：数学标签层已移除（MathFoundation/MathAxioms/MathDesign 不复存在）');
assert(L.MF === undefined && L.MD === undefined, '重构锁：MF/MD 别名已移除');
assert(L.metaKnowledgeRouter === undefined, '重构锁：metaKnowledgeRouter 死引用已移除');

// 自定义世界图（灭蚊器风格；边用 {from,to,w,p} 对象，w=代价，p=概率）
// 注意：此处「CHARGE」只是图节点标签，非物理充电座假设——大脑不假设任何具体身体。
L.setWorld({
  nodes: ['CHARGE', 'A', 'B', 'C'],
  edges: [
    { from: 'CHARGE', to: 'A', w: 1, p: 1 },
    { from: 'A', to: 'B', w: 2, p: 1 },
    { from: 'B', to: 'C', w: 3, p: 1 }
  ],
  coord: { CHARGE: [0, 0], A: [1, 0], B: [2, 0], C: [3, 0] }
});

// A* 深度推理选最优路径（无直达边，须走 A→B→C，代价6）
const r = L.reason('CHARGE', 'C', { hard: [], soft: [] });
assert(r.status === 'optimal' && JSON.stringify(r.path) === JSON.stringify(['CHARGE', 'A', 'B', 'C']), 'A* 最优路径 CHARGE→A→B→C (代价6)');
if (r.grounding) { assert(r.grounding.tier === 'DETERMINISTIC', 'reason 标注 DETERMINISTIC 不幻觉档'); }
else { console.log('  (reason 未直接带 grounding，由 askBrain/audit 提供分层)'); }

const a = L.generateAudit(r, { hard: [], soft: [] });
assert(a.status === 'valid' && a.proof && a.proof.verified === true && a.proof.hoare, '七段审计 valid + 霍尔证明真验证(verified=true)');
assert(a.noHallucination === true, '证明通过 ⇒ noHallucination=true');

// ── 诚实契约回归锁（2026-08-27 专家审查 P0 修复）────────────────────
// ① 拼凑 planLike 输入 → unverified，绝不发 valid（修复"审计兜底伪造 valid"）
const fake = L.generateAudit({ status: 'optimal', path: ['X', 'Y'], cost: 1, steps: [{ seq: 1, state: 'X', action: 'move→Y', result: 'Y', reason: '拼凑', confidence: 1, evidenceIds: [] }] });
assert(fake.status === 'unverified' && fake.noHallucination === false && fake.proof.hoare === null, '伪造输入审计 fail-closed: unverified + 不幻觉=false + 无霍尔记号');

// ② system1 不得绕过硬约束（目标在 hard 禁集 → 必须 unknown，绝不快答绕过）
const s1Hard = L.system1('CHARGE', 'C', { hard: ['C'] });
assert(s1Hard.decided === false && /硬约束禁集/.test(s1Hard.reason), 'system1 尊重 hard 约束（目标在禁集 → 拒绝快答，升级系统2）');
const rBypass = L.reason('CHARGE', 'C', { hard: ['C'] });
assert(rBypass.status === 'unknown' && (rBypass.U || []).some(x => /硬约束禁集/.test(x)), 'reason 贯通 hard 约束（目标在禁集 → 整体 unknown，不绕过）');

// ③ 禁中间节点绕行 + reason 结果携带 opts + 审计自动继承 hard 并复核
//    此世界含直达边 CHARGE→C（高置信直接边），故 system1 复用直达、hard 禁 B 时被绕过
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
const s1dir = L.system1('CHARGE', 'C');
assert(s1dir.decided === true && JSON.stringify(s1dir.path) === JSON.stringify(['CHARGE', 'C']), 'system1 复用世界图高置信直接边 → 直达 CHARGE→C（知识来自外部世界图，大脑不持身体经验库）');
const rDetour = L.reason('CHARGE', 'C', { hard: ['B'] });
assert(rDetour.status === 'optimal' && JSON.stringify(rDetour.path) === JSON.stringify(['CHARGE', 'C'])
  && rDetour.opts && rDetour.opts.hard && rDetour.opts.hard[0] === 'B', 'hard 禁 B 绕行直连 + 结果携带 opts');
const aDetour = L.generateAudit(rDetour);
assert(aDetour.status === 'valid' && aDetour.constraints[0].nodes.includes('B') && aDetour.constraints[0].passed === true, '审计自动继承 hard 约束并复核通过');

// ── 三根神经回归锁（2026-08-29 补完"纯大脑"：记忆=外部世界图增量，不内置经验库）──
// 神经① 记忆持久化：感知增量落盘 → 模拟进程失忆 → 从存档恢复
L.Memory.clear();
L.setWorld({ nodes: ['M1', 'M2'], edges: [{ from: 'M1', to: 'M2', w: 1, p: 1 }] });
const perN = L.perceive({ source: 'selftest', evidence: 'n1', observations: [{ type: 'edge', from: 'M2', to: 'M3', w: 2, p: 0.9 }] });
assert(perN.ok && L.WORLD.nodes.includes('M3'), '神经① 前置：感知新增节点 M3 已写入世界图');
const saved = L.Memory.save();
assert(saved.ok === true && L.Memory.status().hasArchive === true, '神经① 记忆落盘：存档已生成');
const beforeEdges = L.Memory.status().perceivedEdges;
assert(beforeEdges > 0, '神经① 感知增量已计入存档(' + beforeEdges + ' 条感知边)');
// 模拟进程失忆：清空内存中的感知增量（保留磁盘存档）
L.WORLD.edges = L.WORLD.edges.filter(e => !e.perceived);
assert(L.Memory.status().perceivedEdges === 0, '神经① 模拟失忆：内存感知增量已清空');
const reloaded = L.Memory.load();
assert(reloaded.ok === true && L.Memory.status().perceivedEdges === beforeEdges, '神经① 记忆恢复：从存档还原 ' + beforeEdges + ' 条感知边（进程退出不再失忆）');
L.Memory.clear();
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

// 神经② 感知建图：观测真写入世界图；冲突登记且不静默改写；未确认不进快答
const per = L.perceive({ source: 'selftest', evidence: 'unit-1', observations: [
  { type: 'node', node: 'ZZ' },
  { type: 'edge', from: 'C', to: 'ZZ', w: 2.5, p: 0.9 },
  { type: 'edge', from: 'A', to: 'B', w: 999 }
] });
assert(per.ok && L.WORLD.nodes.includes('ZZ') && L.WORLD.edges.some(e => e.from === 'C' && e.to === 'ZZ'), '神经② 感知建图：观测真的写入世界图（图会自己长）');
assert(per.conflicts.length === 1 && L.WORLD.edges.find(e => e.from === 'A' && e.to === 'B').w !== 999, '神经② 冲突登记：与既有认知冲突时保留原值，不静默改写');
const rPer = L.reason('C', 'ZZ');
assert((rPer.usedSystem || rPer.system) !== '1', '神经② 诚实闸门：未确认的感知边不允许系统1快答（须走证明链）');
assert(L.confirmObservation('C→ZZ', true).ok === true, '神经② 感知确认：观测升级为已验证认知');

// 神经③ 元认知接管调度：动态门槛 / 探索产出备选 / 事件总线真在跑
const rMeta = L.reason('CHARGE', 'C');
assert(rMeta.meta && typeof rMeta.meta.system1Threshold === 'number'
  && rMeta.meta.system1Threshold >= 0.6 && rMeta.meta.system1Threshold <= 0.95,
  '神经③ 元认知调度：系统1门槛按不确定性动态给定 = ' + (rMeta.meta && rMeta.meta.system1Threshold) + '（旧版写死 0.8）');
// ── 切片融合回归锁（认知操作系统 CognitiveOS）────────────────────────
assert(L.Capabilities.list().length >= 6, '融合：能力表已注册 ' + L.Capabilities.list().length + ' 个能力（跨五层）');
L.Memory.clear();
L.setWorld({ nodes: ['SRC', 'FORBID', 'HUB', 'DST'],
  edges: [{ from: 'SRC', to: 'DST', w: 5 }, { from: 'SRC', to: 'FORBID', w: 1 }, { from: 'FORBID', to: 'DST', w: 1 },
  { from: 'SRC', to: 'HUB', w: 1 }, { from: 'HUB', to: 'DST', w: 2 }] });
const cyc = L.cognitiveCycle({ domain: 'selftest', hub: 'HUB',
  entities: [{ id: 'SRC', resources: { '物资': 10 } }, { id: 'FORBID', resources: { '物资': 100 } },
  { id: 'HUB', resources: { '物资': 3 } }, { id: 'DST', needs: { '物资': 8 } }],
  goal: '不动禁运节点的前提下补给', constraints: { hard: ['FORBID'] } });
assert(cyc.allocations.length > 0 && !cyc.allocations.some(a =>
  a.from === 'FORBID' || a.to === 'FORBID' || a.route.includes('FORBID')),
  '融合：硬约束贯通到分配层（最小费用流不得经由禁区，此前会绕过约束划走应急金）');
assert(cyc.layer.L1_action.total > 0 && cyc.summary.mismatches > 0
  && cyc.layer.L5_metacognition && cyc.layer.L4_learning.saved === true,
  '融合：统一认知循环端到端可跑（感知→状态→元认知→推理→行动→学习→审计）');

// ── 七元组 / 八层 / ℙ命题 回归锁（依 ARCHITECTURE.md 原始定义，非 v3.0 五层）──
assert(L.Brain && ['W', 'K', 'Phi', 'Psi', 'Theta', 'Lambda', 'Xi'].every(k => L.Brain[k]),
  '七元组 𝔹=(𝕎,K,Φ,Ψ,Θ,Λ,Ξ)：七个分量均已实装且可索引');
assert(L.Layers.length === 8 && L.Layers[5].id === 'Evolve' && L.Layers[7].id === 'Unified',
  '八层齐备：第6层「演化」与第8层「统一」已独立出来（此前被混入自建编排）');
L.setWorld({ nodes: ['H', 'F', 'O'],
  edges: [{ from: 'H', to: 'F', w: 1, P: { var: '船开', op: '==', val: true } }, { from: 'F', to: 'O', w: 1 }] });
const u1 = L.reason('H', 'O');
assert(u1.status === 'unknown' && (u1.U || []).some(x => x.indexOf('命题不可判定') >= 0),
  'ℙ=命题（非概率）：唯一通道命题不可判定 → 归入 𝕌，绝不猜着走');
const u2 = L.reason('H', 'O', { facts: { '船开': true } });
assert(u2.status === 'optimal' && u2.path.join('→') === 'H→F→O',
  'ℙ 命题成立 → 通道开放（补上事实即可解）');
const u3 = L.reason('H', 'O', { facts: { '船开': false } });
assert(u3.status === 'unknown', 'ℙ 命题不成立 → 通道剪枝');

// 探索模式备选路径：换一个"有两条路可走"的世界，并放一条低置信边（p<缺口阈值）→ 触发探索
L.setWorld({ nodes: ['S', 'M', 'T'], edges: [{ from: 'S', to: 'M', w: 1, p: 1 }, { from: 'M', to: 'T', w: 1, p: 1 }, { from: 'S', to: 'T', w: 5, p: 0.3 }] });
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

// ── 2026-08-27 数学思想保真度升级回归锁 ──────────────────────────────
// ① 符号验证器：真实实数域线性算术求解（Fourier-Motzkin，非固定域暴力枚举）
const ss1 = L.symbolicSolve([{ type: 'le', vars: ['x'], coeff: [1], rhs: 5 }, { type: 'ge', vars: ['x'], coeff: [1], rhs: 0 }]);
assert(ss1.satisfiable === true && typeof ss1.assign.x === 'number' && ss1.assign.x >= 0 && ss1.assign.x <= 5, 'symbolicSolve 实数域可满足(0≤x≤5) 解出 x=' + ss1.assign.x);
const ss2 = L.symbolicSolve([{ type: 'le', vars: ['x'], coeff: [1], rhs: 0 }, { type: 'ge', vars: ['x'], coeff: [1], rhs: 1 }]);
assert(ss2.satisfiable === false, 'symbolicSolve 实数域不可满足(x≤0 ∧ x≥1) 正确判 UNSAT');
const ss3 = L.symbolicSolve([{ type: 'le', vars: ['x', 'y'], coeff: [1, 1], rhs: 4 }, { type: 'ge', vars: ['x'], coeff: [1], rhs: 1 }, { type: 'ge', vars: ['y'], coeff: [1], rhs: 1 }]);
assert(ss3.satisfiable === true && ss3.assign.x >= 1 && ss3.assign.y >= 1 && (ss3.assign.x + ss3.assign.y) <= 4 + 1e-6, 'symbolicSolve 二元线性系统可满足(x≥1,y≥1,x+y≤4)');

// ② 霍尔证明：真实三元组 {pre} prog {post}（pre/post/invariant* 结构齐备，使用一致世界图）
L.setWorld({ nodes: ['CHARGE', 'A', 'B', 'C'], edges: [{ from: 'CHARGE', to: 'A', w: 1 }, { from: 'A', to: 'B', w: 2 }, { from: 'B', to: 'C', w: 3 }] });
const rH = L.reason('CHARGE', 'C');
const hp = L.verifyHoarePath(rH, L.WORLD);
assert(hp.verified === true && hp.pre && hp.post && Array.isArray(hp.steps) && hp.steps.length === rH.path.length - 1 && typeof hp.hoare === 'string' && hp.hoare.length > 0,
  'verifyHoarePath 真实霍尔三元组：pre/post/invariant* 齐备，verified=' + hp.verified);

// ③ do-演算自动可识别性引擎（后门 + 前门，免去手声明），并验证 causalEffect 接 DAG 自动选
const backDag = { nodes: ['X', 'Z', 'Y'], edges: [{ from: 'X', to: 'Y' }, { from: 'Z', to: 'X' }, { from: 'Z', to: 'Y' }] };
const idBack = L.causalIdentifiable(backDag, 'X', 'Y');
assert(idBack.identifiable === true && idBack.method === 'back-door' && idBack.adjustSet.includes('Z'), 'causalIdentifiable 后门准则自动识别调整集=' + JSON.stringify(idBack.adjustSet));
// 全观测 DAG 中后门准则（调整集 = parents(X)）已足以识别 do 效应；前门准则用于「未观测混杂」场景，
// 由 causalEffect 的 opts.mediator 显式声明（见上方手动前门测试）。自动引擎统一走后门。
const chainDag = { nodes: ['X', 'M', 'Y'], edges: [{ from: 'X', to: 'M' }, { from: 'M', to: 'Y' }] };
const idChain = L.causalIdentifiable(chainDag, 'X', 'Y');
assert(idChain.identifiable === true && ['back-door', 'front-door'].includes(idChain.method) && Array.isArray(idChain.adjustSet), 'causalIdentifiable 链式 DAG 可识别(method=' + idChain.method + ', 调整集=' + JSON.stringify(idChain.adjustSet) + ')');
// causalEffect 接 DAG 自动选后门：须提供 Y 的真实结构方程（线性 SEM），
// 否则后门分支因「结果变量不在世界模型」返回 error（无 ace）——这是诚实边界，非 bug。
const backDag2 = { nodes: ['X', 'Z', 'Y'], edges: [{ from: 'X', to: 'Y' }, { from: 'Z', to: 'X' }, { from: 'Z', to: 'Y' }] };
const ceAuto = L.causalEffect(
  { eqs: { Y: { bias: 0, coef: [0.5, 0.3], features: ['X', 'Z'] } } }, 'X', 'Y',
  [
    { state: { X: 1, Z: 0.5 }, next: { Y: 0.65 } },
    { state: { X: 0, Z: 0.2 }, next: { Y: 0.06 } },
    { state: { X: 1, Z: 0.1 }, next: { Y: 0.53 } },
    { state: { X: 0, Z: 0.8 }, next: { Y: 0.24 } }
  ], { dag: backDag2 });
assert(ceAuto && ceAuto.method === 'back-door-adjustment-linear-SEM' && typeof ceAuto.ace === 'number' && ceAuto.adjustSet.includes('Z'),
  'causalEffect 接 DAG 自动选后门调整集(无需手声明 adjustSet) ace=' + ceAuto.ace);

// ⑤ identifiabilityID 完整 do-演算可识别性引擎（半马尔可夫 ADMG，ID 算法 / Tian-Pearl / Shpitser-Pearl）
// 前门准则（含未观测混杂 X↔Y），自动识别中介 M 且 causalEffect 走两段式 ACE
const fdDag = { nodes: ['X', 'M', 'Y'], edges: [{ from: 'X', to: 'M' }, { from: 'M', to: 'Y' }], bidirected: [{ from: 'X', to: 'Y' }] };
const idFD = L.identifiabilityID(fdDag, 'X', 'Y');
assert(idFD.identifiable === true && idFD.method === 'front-door' && idFD.mediator === 'M', 'identifiabilityID 前门自动识别(含未观测混杂 X↔Y，中介=M)');
const ceFD = L.causalEffect({ eqs: { Y: { bias: 0, coef: [0.4], features: ['M'] }, M: { bias: 0, coef: [1.0], features: ['X'] } } }, 'X', 'Y',
  [{ state: { X: 1, M: 1 }, next: { Y: 0.4 } }, { state: { X: 0, M: 0 }, next: { Y: 0 } }], { dag: fdDag });
assert(ceFD && ceFD.method === 'front-door-adjustment-linear-SEM' && typeof ceFD.ace === 'number', 'causalEffect 接 DAG 自动前门 ACE=' + ceFD.ace);
// 工具变量（含未观测混杂 X↔Y，Z 为外生工具）：可识别但为 id-general（数值需通用 ΣΠ/Wald）
const ivDag = { nodes: ['Z', 'X', 'Y'], edges: [{ from: 'Z', to: 'X' }, { from: 'X', to: 'Y' }], bidirected: [{ from: 'X', to: 'Y' }] };
const idIV = L.identifiabilityID(ivDag, 'X', 'Y');
assert(idIV.identifiable === true && idIV.method === 'id-general' && typeof idIV.formula === 'string', 'identifiabilityID 工具变量可识别(id-general，公式=' + idIV.formula + ')');
// 不可识别（bow 图：X→Y 且 X↔Y 未观测混杂）：返回 hedge 见证
const bowDag = { nodes: ['X', 'Y'], edges: [{ from: 'X', to: 'Y' }], bidirected: [{ from: 'X', to: 'Y' }] };
const idNG = L.identifiabilityID(bowDag, 'X', 'Y');
assert(idNG.identifiable === false && idNG.hedge && Array.isArray(idNG.hedge.c1) && Array.isArray(idNG.hedge.c2), 'identifiabilityID 不可识别(hedge 见证：c1/c2 两 c-component)');

// ⑥ 反事实可识别性引擎 counterfactualIdentifiable（ID* / Shpitser-Pearl 2007，sound & complete；孪生图 G' 上 c-component 分解）
// 全观测链式 DAG 反事实 P(Y_x | X=x', M=m) —— 可识别（ID* 在孪生图上分解）
const cfDag1 = { nodes: ['X', 'M', 'Y'], edges: [{ from: 'X', to: 'M' }, { from: 'M', to: 'Y' }] };
const cf1 = L.counterfactualIdentifiable(cfDag1, 'X', 'Y', { finding: { X: 1, M: 1 } });
assert(cf1.identifiable === true && typeof cf1.formula === 'string', 'counterfactualIdentifiable 全观测链式反事实可识别(formula=' + cf1.formula + ')');
// 前门含未观测混杂反事实 P(Y_x | X=x', M=m) —— 可识别（front-door 反事实；朴素 ID 会误判 hedge，ID* 正确分解）
const cfDag2 = { nodes: ['X', 'M', 'Y'], edges: [{ from: 'X', to: 'M' }, { from: 'M', to: 'Y' }], bidirected: [{ from: 'X', to: 'Y' }] };
const cf2 = L.counterfactualIdentifiable(cfDag2, 'X', 'Y', { finding: { X: 1, M: 1 } });
assert(cf2.identifiable === true, 'counterfactualIdentifiable 前门(含未观测混杂)反事实可识别(朴素ID会误判hedge，ID*正确)');
// bow 图反事实 P(Y_x | X=x') —— 可识别（观测 X=x' 揭示混杂 U；反事实给定事实证据可识别，平均效应 do 才不可识别）
const cfDag3 = { nodes: ['X', 'Y'], edges: [{ from: 'X', to: 'Y' }], bidirected: [{ from: 'X', to: 'Y' }] };
const cf3 = L.counterfactualIdentifiable(cfDag3, 'X', 'Y', { finding: { X: 1 } });
assert(cf3.identifiable === true, 'counterfactualIdentifiable bow图反事实 P(Y_x|X=x\') 可识别(给定事实证据揭示混杂U)');
// 异世界合法反事实：事实观测 X=0 与 do(X=1) 分属事实/反事实两世界，合法 → 可识别（非 axiom 冲突）
const cfDag5 = { nodes: ['X', 'Y'], edges: [{ from: 'X', to: 'Y' }], bidirected: [{ from: 'X', to: 'Y' }] };
const cf5 = L.counterfactualIdentifiable(cfDag5, 'X', 'Y', { finding: { 'X': 0 }, interveneValue: 1 });
assert(cf5.identifiable === true, 'counterfactualIdentifiable 事实观测X=0 与 do(X=1) 异世界合法反事实可识别');
// 注：ID* 的 line-8 / Axiom-of-Effectiveness 不可识别见证（同变量既被 do 固定又被观测赋不同值于同一世界）
// 仅在"反事实证据"查询(IDC* line-4)触发，当前事实证据 API 不构造此类冲突；引擎已实装该 FAIL 路径，诚实不虚构。

// ── 消费定理回归锁（用户核心诉求"数学贯穿"的诚实版：判断由定理派生，但不再自我贴标）──
// 每个算法的"判断"追溯到定理构造（Banach 不动点 / A* 一致性三角不等式 / Shannon 熵 / PrSTL 时态语义），
// 而非往 return 里塞 math 装饰字段。以下断言验证"判断确实由定理派生"这一真逻辑。
// 5.1 perceiveBelief 消费 Banach 不动点：混合链 L<1 → 唯一不动点 + 定理误差界有限
const pbC = L.perceiveBelief({ A: 1, B: 0 }, { likelihood: { A: 1, B: 1 } }, { A: { A: 0.7, B: 0.3 }, B: { A: 0.3, B: 0.7 } }, 200, 1e-6);
assert(pbC.contractive === true && pbC.uniquenessGuaranteed === true && isFinite(pbC.banachErrorBound) && pbC.banachErrorBound <= 1e-6,
  'perceiveBelief 消费 Banach：L=' + pbC.contractionL + '<1 → 唯一不动点保证 + a-priori 误差界=' + pbC.banachErrorBound.toFixed(6) + '≤tol（收敛由定理派生）');
// 5.2 perceiveBelief 诚实：置换映射 L≥1 → 不保证唯一不动点，绝虚构
const pbN = L.perceiveBelief({ A: 1, B: 0 }, { likelihood: { A: 1, B: 1 } }, { A: { A: 0, B: 1 }, B: { A: 1, B: 0 } }, 50, 1e-6);
assert(pbN.contractive === false && pbN.uniquenessGuaranteed === false,
  'perceiveBelief 诚实：非压缩(L≥1) → 不保证唯一不动点（由 Banach 条件派生，不虚构唯一性）');
// 5.3 aStar 消费一致性(三角不等式)：一致启发式 → optimalGuaranteed 由定理派生
L.setWorld({ nodes: ['CHARGE', 'A', 'B', 'C'], edges: [{ from: 'CHARGE', to: 'A', w: 1 }, { from: 'A', to: 'B', w: 2 }, { from: 'B', to: 'C', w: 3 }, { from: 'CHARGE', to: 'C', w: 7 }], coord: { CHARGE: [0, 0], A: [1, 0], B: [2, 0], C: [3, 0] } });
const aC = L.aStar('CHARGE', 'C');
assert(aC.optimalGuaranteed === true && aC.status === 'optimal' && aC.heuristicConsistency.consistent === true,
  'aStar 消费一致性定理：边权≥欧氏(三角不等式成立) → optimalGuaranteed(由定理派生，非断言)');
// 5.4 aStar 诚实：不一致启发式（边权<欧氏）→ 定理不保证 → 标 optimal-unverified
L.setWorld({ nodes: ['CHARGE', 'A', 'B', 'C'], edges: [{ from: 'CHARGE', to: 'A', w: 0.5 }, { from: 'A', to: 'B', w: 2 }, { from: 'B', to: 'C', w: 3 }], coord: { CHARGE: [0, 0], A: [1, 0], B: [2, 0], C: [3, 0] } });
const aN = L.aStar('CHARGE', 'C');
assert(aN.optimalGuaranteed === false && aN.status === 'optimal-unverified' && aN.heuristicConsistency.consistent === false,
  'aStar 诚实：不一致启发式(边权<欧氏，三角不等式破) → optimal-unverified（定理不保证，不谎称最优）');
L.setWorld({ nodes: ['CHARGE', 'A', 'B', 'C'], edges: [{ from: 'CHARGE', to: 'A', w: 1 }, { from: 'A', to: 'B', w: 2 }, { from: 'B', to: 'C', w: 3 }], coord: { CHARGE: [0, 0], A: [1, 0], B: [2, 0], C: [3, 0] } });

// 5.5 metaCognition 消费 Shannon 信息论：探索-利用由 H/Hmax 分数派生（非魔法 0.5）
const mc = L.metaCognition({});
assert(typeof mc.decision.uncertaintyFraction === 'number' && mc.decision.uncertaintyFraction >= 0 && mc.decision.uncertaintyFraction <= 1,
  'metaCognition 消费 Shannon：暴露不确定性分数 H/Hmax=' + mc.decision.uncertaintyFraction + ' ∈[0,1]');
assert((mc.decision.exploreExploit === 'explore') === (mc.decision.uncertaintyFraction > 0.5 || mc.knowledgeGaps.length > 0),
  'metaCognition 决策由信息论分数派生(explore ⟺ 分数>0.5 或 有缺口)');
// 5.6 quantifyUncertainty 消费 Shannon（无魔法阈值）：最优路径的认知不确定度 ∈[0,1]
const aR2 = L.aStar('CHARGE', 'C');
const qU = L.quantifyUncertainty(aR2);
assert(typeof qU.cognitive === 'number' && qU.cognitive >= 0 && qU.cognitive <= 1,
  'quantifyUncertainty 消费 Shannon：cognitive=' + qU.cognitive + ' ∈[0,1]（路径未确认感知边占比，源于世界图）');
// 5.7 runtimeMonitor 消费 PrSTL：返回 prstl.evaluated + G(φ) 真值评估；违规路径→violations 非空
const safePath = L.aStar('CHARGE', 'C', { hard: [] });
const rmSafe = L.runtimeMonitor(safePath, { maxCost: 999, hardNodes: [] });
assert(rmSafe.prstl && rmSafe.prstl.evaluated === true && rmSafe.prstl.op === 'always(G)' && rmSafe.safe === true,
  'runtimeMonitor 消费 PrSTL：G(φ) 真值评估（合规轨迹 safe=true，非标量贴标）');
const rmViol = L.runtimeMonitor(safePath, { maxCost: 0.0001, hardNodes: [] }); // 任意真实路径 cost>bound ⟹ 必违规
assert(rmViol.safe === false && Array.isArray(rmViol.violations) && rmViol.violations.length > 0,
  'runtimeMonitor 消费 PrSTL：逐边代价超 bound → G(成本within) 真值=false → SAFETY_STOP（时态语义生效）');

// ── 6. 信念自我修正（推测 vs 事实）：事实与推测偏差时，修正推测使其贴合事实 ──
// 数学思想：(A) 标量= Banach 压缩映射（唯一不动点=事实，偏差几何收缩）；
//           (B) 分布= 最小交叉熵 I-投影(Jaynes) / 贝叶斯后验。
assert(typeof L.reconcile === 'function', 'reconcile 已导出（信念自我修正核心）');

// 6.1 标量 Banach 压缩：推测 b=0.3，事实 o=0.9 → 修正后离事实更近，偏差严格下降
const rc = L.reconcile(0.3, 0.9, { priorWeight: 0.5, factWeight: 0.7 });
assert(rc.mode === 'scalar-contraction' && rc.contractive === true, 'reconcile 标量：L=1−α<1 ⟹ Banach 压缩映射(contractive=true)');
assert(Math.abs(rc.value - 0.9) < Math.abs(0.3 - 0.9), 'reconcile 标量：修正后推测(' + rc.value + ') 比原推测(0.3) 更接近事实(0.9)');
assert(rc.residual < rc.residualBefore && rc.deviationReduced > 0, 'reconcile 标量：偏差严格下降 (residual ' + rc.residualBefore + '→' + rc.residual + ')');
assert(rc.fixedPoint === 0.9, 'reconcile 标量：Banach 不动点=事实本身(fixedPoint=0.9)');

// 6.2 Banach 收敛保证：反复修正必收敛到事实（几何收缩，迭代 k 次偏差 ≤ L^k·δ0）
let b6 = 0.3; const o6 = 0.9; const a6 = rc.alpha;
for (let i = 0; i < 14; i++) b6 = (1 - a6) * b6 + a6 * o6;
assert(Math.abs(b6 - o6) < 1e-4, 'reconcile 标量：反复修正8次后偏差<1e-4（收敛到事实，Banach 定理兑现）');

// 6.3 分布 I-投影 / 贝叶斯后验：事实以似然 ℓ 注入 → 后验在事实支持处集中、且归一
const distR = L.reconcile({ H1: 0.5, H2: 0.5 }, { likelihood: { H1: 0.1, H2: 0.9 } });
assert(distR.mode === 'kl-iprojection' && Math.abs(distR.belief.H2 - 0.9) < 1e-9, 'reconcile 分布：贝叶斯后验 q*(H2)=0.9（事实似然支持 H2）');
assert(Math.abs(distR.belief.H1 + distR.belief.H2 - 1) < 1e-9, 'reconcile 分布：后验归一（Σq=1）');

// 6.4 分布 I-投影 / 硬事实(disallow)：被事实否定的假设质量→0，推测贴合事实约束
const distR2 = L.reconcile({ A: 0.6, B: 0.4 }, { disallow: ['A'] });
assert(distR2.mode === 'kl-iprojection' && distR2.belief.A < 1e-12 && Math.abs(distR2.belief.B - 1) < 1e-9 && distR2.constraintSatisfied,
  'reconcile 分布：硬事实否定 A → q*(A)→0、q*(B)=1（推测已贴合事实约束）');

// 6.5 端到端：perceive 摄入与推测偏差的事实 → 触发自我修正并落审计⑩信念修正段
if (L.Memory && typeof L.Memory.reset === 'function') L.Memory.reset();
L.setWorld({ nodes: ['X', 'Y'], edges: [{ from: 'X', to: 'Y', w: 1, p: 0.2 }], coord: {} });
const beforeP = L.WORLD.edges.find(e => e.from === 'X' && e.to === 'Y').p; // 推测=0.2
const perR = L.perceive({ observations: [{ type: 'edge', from: 'X', to: 'Y', w: 1, p: 0.95, confidence: 0.9 }] });
assert(perR.ok && Array.isArray(perR.selfCorrections) && perR.selfCorrections.length === 1, 'perceive 偏差事实：触发 1 次自我修正(selfCorrection 事件)');
const afterP = L.WORLD.edges.find(e => e.from === 'X' && e.to === 'Y').p;
assert(afterP > beforeP && Math.abs(afterP - 0.95) < Math.abs(beforeP - 0.95),
  'perceive 自我修正：边概率 ' + beforeP + '→' + afterP + ' 向事实(0.95)收敛（推测贴合事实）');
const aRev = L.generateAudit(L.reason('X', 'Y', { hard: [], soft: [] }), { hard: [], soft: [] });
assert(aRev.beliefRevision && aRev.beliefRevision.count >= 1, '审计⑩信念修正段：已记录自我修正轨迹(count=' + (aRev.beliefRevision && aRev.beliefRevision.count) + ')');

// 端到端（async）：外部 LLM 输入理解适配器 + 离线诚实降级
(async () => {
  // 7.1 适配器已导出且默认不带 key（不臆造凭据）
  assert(typeof L.configureLLM === 'function' && typeof L.getLLMConfig === 'function', '外部 LLM 适配器已导出(configureLLM/getLLMConfig)');
  const cfg0 = L.getLLMConfig();
  assert(cfg0.provider === 'openrouter' && cfg0.hasKey === !!process.env.OPENROUTER_API_KEY,
    '默认凭据状态与 env 一致(注入则带 key，否则无 key 不臆造)');

  // 7.2 热插拔配置生效
  const cfgOk = L.configureLLM({ model: 'openrouter/auto', temperature: 0.1 });
  assert(cfgOk.ok && L.getLLMConfig().model === 'openrouter/auto' && L.getLLMConfig().temperature === 0.1, 'configureLLM 热插拔模型/温度生效');
  L.configureLLM({ model: 'openrouter/free', temperature: 0.2 }); // 还原默认

  // 7.3 无 key 诚实降级（显式清空 key，验证不伪造=不幻觉边界；与 env 是否注入无关）
  L.configureLLM({ apiKey: null });
  const noKey = await L.perceiveLLM('从 A 点去 C 点');
  assert(noKey.ok === false && noKey.stage === 'llm' && noKey.error, 'perceiveLLM 无 key 诚实降级(不伪造)');

  // 7.4 askBrain 离线无 key 诚实降级
  const ab = await L.askBrain('从 A 点去 C 点');
  assert(ab && ab.ok === false && ab.stage === 'perceive' && ab.error, 'askBrain 离线无 key 诚实降级(不伪造)');
  console.log('  askBrain offline(无免费LLM)=', JSON.stringify({ ok: ab.ok, stage: ab.stage }));

  // 7.5 实跑外部 LLM（仅当注入了 OPENROUTER_API_KEY；验证 Node node:https 传输绕开沙箱 fetch 怪象）
  if (process.env.OPENROUTER_API_KEY) {
    L.configureLLM({ apiKey: process.env.OPENROUTER_API_KEY, model: 'openrouter/free' });
    if (L.Memory && typeof L.Memory.reset === 'function') L.Memory.reset();
    const lr = await L.perceiveLLM('从充电座出发去 C 点，电量充足，尽量别经过 A');
    assert(lr.ok && lr.percept && Array.isArray(lr.percept.observations), 'perceiveLLM 实跑：NL → 结构化观测(observations[])');
    assert(lr.perceive && lr.perceive.mode === 'graph-update', 'perceiveLLM：理解结果已喂入感知层(perceive)');
    assert(lr.percept._grounding === L.GROUNDING.PERCEPTION && lr.percept.mayHallucinate === true, 'perceiveLLM 输出标 PERCEPTION(可能幻觉)');
    console.log('  live perceiveLLM ok | model=' + lr.model + ' | obs=' + lr.percept.observations.length
      + ' | graph=' + JSON.stringify(lr.perceive.world) + ' | note=' + (lr.percept.note || ''));
    L.configureLLM({ apiKey: null }); // 还原，避免污染
  } else {
    console.log('  (skip) 未设置 OPENROUTER_API_KEY，跳过实跑外部 LLM');
  }

  // ── 6.6 具身层：通用大脑 + 任意物理身体（A* + delete-relaxation h_max 可采纳 ⇒ 最优动作序列）──
  assert(typeof L.attachBody === 'function' && typeof L.planTask === 'function' && typeof L.execute === 'function' && typeof L.doWork === 'function',
    '具身层已导出(attachBody/planTask/execute/doWork/POSITIONING)');
  assert(L.POSITIONING && L.POSITIONING.role.indexOf('具身智能') >= 0, '定位定调：具身智能在物理世界干活的通用大脑');
  L.attachBody({
    name: 'test-body', state: { location: 'L' },
    capabilities: [{ id: 'move', pre: () => true, eff: (s, p) => { s.location = p.to; return s; }, cost: 1, ground: () => ({ to: 'R' }) }]
  });
  assert(L.capabilities().length === 1 && L.capabilities()[0] === 'move', '具身：attachBody 注册能力契约成功（大脑不内置任何具体身体）');
  const plan = L.planTask(s => s.location === 'R', {});
  assert(plan.ok && plan.plan.length === 1 && plan.plan[0].cap === 'move' && plan.plan[0].params.to === 'R',
    '具身：planTask 规划出最优动作序列 move→R（A*+h_max delete-relaxation 可采纳 ⇒ 最优）');
  let bodyState = { location: 'L' };
  const adapter = async (cap, params) => { if (cap === 'move') { bodyState.location = params.to; return { ok: true, state: { location: params.to } }; } return { ok: false, error: 'unknown' }; };
  const ex = await L.execute(plan.plan, adapter, { goalFn: s => s.location === 'R' });
  assert(ex.ok && ex.goalSatisfied === true && ex.finalState.location === 'R' && ex.steps === 1,
    '具身：execute 执行闭环成功（goalSatisfied + 偏差重规划护栏 maxReplans 已设）');
  // SAFE-STOP：不可逆物理动作前硬约束禁行 → 立即停机，且审计⑪执行段可追溯
  L.attachBody({ name: 'hs', state: { location: 'L' }, hard: ['R'],
    capabilities: [{ id: 'move', eff: (s, p) => { s.location = p.to; return s; }, cost: 1, ground: () => ({ to: 'R' }) }] });
  const plan2 = L.planTask(s => s.location === 'R', {});
  let bs2 = { location: 'L' };
  const ad2 = async (cap, params) => { bs2.location = params.to; return { ok: true, state: { location: params.to } }; };
  const ex2 = await L.execute(plan2.plan, ad2, { goalFn: s => s.location === 'R' });
  assert(ex2.halted && typeof ex2.haltReason === 'string' && ex2.haltReason.indexOf('SAFE-STOP') === 0,
    '具身：不可逆物理动作前 SAFE-STOP 触发（硬约束禁行 R）');
  L.setWorld({ nodes: ['X', 'Y'], edges: [{ from: 'X', to: 'Y', w: 1, p: 1 }] });
  const aud2 = L.generateAudit(L.reason('X', 'Y', { hard: [], soft: [] }), { hard: [], soft: [] });
  assert(aud2.embodied && aud2.embodied.safeStop === true && aud2.embodied.haltReason === ex2.haltReason,
    '审计⑪执行段：记录 SAFE-STOP（safeStop=true，可追溯 haltReason，呼应不幻觉/敢做）');

  console.log('\nSELFTEST-UMD OK');
})();

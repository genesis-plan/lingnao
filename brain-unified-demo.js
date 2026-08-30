// 灵脑 · 切片融合后的统一大脑（2026-08-29）
// ─────────────────────────────────────────────────────────────────────
// 按 v3.0 完整骨架"三个核心"融合：
//   · 一个数学对象：带权有向图 G=(V,E,W,P,C,U)
//       —— 村庄的粮食、机队的任务、账本的资金、手册的步骤，全是同一张图上的节点与资源流
//   · 一个核心算法：图上搜索最优路径（A* 协调 + 最小费用流最优分配）
//   · 一个底层哲学：可审计、持续学习、因果、不完备性管理
//
// 融合前的形态：virtual-world / math-model / robot-fleet / finance / distillery
//   各自建世界、各写编排、各出各的审计 —— 是并列脚本，不是大脑。
// 融合后的形态：切片降级为「领域配置」，全部由同一个 cognitiveCycle() 驱动；
//   知识蒸馏以第四层能力注册进 OS（依赖方向：切片 → 内核）。
//
// 跑法：node brain-unified-demo.js
const L = require('./lingnao.umd.js');
require('./knowledge-distillery.js');   // 副作用：把"知识蒸馏"注册为第四层能力

const line = (s = '') => console.log(s);
const hr = (t) => { line('\n' + '═'.repeat(72)); line('  ' + t); line('═'.repeat(72)); };

// ── 认知操作系统的能力表（按五层归属）────────────────────────────────
hr('这个大脑现在有哪些能力（按五层认知操作系统归属）');
const LAYER_NAME = { 1:'第一层 感知与行动', 2:'第二层 认知状态空间', 3:'第三层 认知推理',
                     4:'第四层 反思与演化', 5:'第五层 元认知与协调' };
for (let l = 5; l >= 1; l--) {
  const caps = L.Capabilities.list(l);
  if (!caps.length) continue;
  line('  ' + LAYER_NAME[l]);
  caps.forEach(c => line('      · ' + c.id + '  ' + c.name));
}

// ── 领域即配置：下面三段数据，就是三个"切片"剩下的全部东西 ─────────────
const DOMAINS = [
  {
    domain: '领域A · 青木村（村庄资源错配）', hub: 'HUB_V',
    entities: [
      { id:'FARM_A',  name:'农户·阿木', resources:{ '粮食':120 }, needs:{ '农具':2 } },
      { id:'FARM_B',  name:'农户·阿竹', resources:{ '农具':5 },   needs:{ '粮食':60 } },
      { id:'CRAFT_C', name:'铁匠铺',    resources:{},             needs:{ '竹':30 },
        produces:{ resource:'农具', from:'竹', rate:0.3 } },
      { id:'BAMBOO_D',name:'竹农·老周', resources:{ '竹':200 },   needs:{ '粮食':40 } }
    ],
    channels: [['FARM_A','FARM_B',2], ['BAMBOO_D','CRAFT_C',0.5]],
    goal: '消除全村资源错配'
  },
  {
    domain: '领域B · 机器人机队（充电调度 + 负载均衡）', hub: 'HUB_R',
    entities: [
      { id:'KIVA', name:'仓储机器人(电量75%)', resources:{ '任务':12 }, needs:{} },
      { id:'TUG',  name:'医院配送(电量18%)',   resources:{ '任务':5 },  needs:{ '充电位':1 } },
      { id:'STAR', name:'校园配送(电量22%)',   resources:{ '任务':2 },  needs:{ '充电位':1, '任务':3 } },
      { id:'RESC', name:'废墟搜救(电量9%)',    resources:{ '任务':3 },  needs:{ '充电位':1, '任务':2 } },
      { id:'HUB_R',name:'充电中枢',            resources:{ '充电位':3 }, needs:{} }
    ],
    channels: [['KIVA','STAR',1.5]],
    goal: '低电机器人有桩可充、过载任务被均衡'
  },
  {
    domain: '领域C · 家庭资金（硬约束下调拨）', hub: 'HUB_F',
    entities: [
      { id:'MONTHLY',   name:'月收入', resources:{ '资金':20000 }, needs:{} },
      { id:'EMERGENCY', name:'应急金', resources:{ '资金':50000 }, needs:{} },
      { id:'DOWNPAY',   name:'首付账户',resources:{},              needs:{ '资金':400000 } },
      { id:'HUB_F',     name:'资金通道',resources:{ '资金':150000 },needs:{} }
    ],
    channels: [['MONTHLY','DOWNPAY',0.5], ['HUB_F','DOWNPAY',0.2]],
    goal: '在不动应急金的约束下尽可能凑首付',
    constraints: { hard:['EMERGENCY'] }   // 硬约束：不得动应急金
  }
];

// ── 同一个大脑、同一套循环，依次驱动三个领域 ───────────────────────────
const results = [];
for (const cfg of DOMAINS) {
  hr(cfg.domain + '  —— 目标：' + cfg.goal);
  const r = L.cognitiveCycle(cfg);
  results.push({ cfg, r });
  line('  L1/L2 状态：建图 +' + JSON.stringify(r.layer.L2_state.channels)
    + '，发现错配 ' + r.layer.L2_mismatchCount + ' 处');
  line('  L5 元认知：模式=' + r.layer.L5_metacognition.mode
    + '  不确定性=' + r.layer.L5_metacognition.uncertainty
    + '  快答门槛=' + r.layer.L5_metacognition.system1Threshold);
  line('  L3 规划  ：' + r.layer.L3_planning.flows + ' 笔流（' + r.layer.L3_planning.method
    + '，最优）  总代价 ' + r.layer.L3_planning.totalCost + '  未满足 ' + r.layer.L3_planning.unmet);
  line('  L1 行动  ：');
  r.allocations.forEach(a => line('      ' + a.from + '→' + a.to + '  ' + a.resource
    + ' ×' + a.amount + '  [' + a.status + ']  路径 ' + a.route.join('→')));
  if (cfg.constraints && cfg.constraints.hard)
    line('      硬约束核验：' + cfg.constraints.hard.map(h =>
      r.allocations.some(a => a.from === h || a.to === h) ? h + ' 被触碰 ✘' : h + ' 未被动 ✔').join('；'));
  line('  L4 学习  ：经验入库 ' + r.layer.L4_learning.exp + ' 条' + (r.layer.L4_learning.saved ? '（已落盘）' : ''));
  line('  L3 审计  ：' + r.layer.L3_audit.status + '  证明通过 ' + r.layer.L3_audit.passed
    + '/' + r.layer.L3_audit.audited + '  不幻觉：' + (r.summary.noHallucination ? '是 ✔' : '否 ✘'));
}

// ── 第四层能力：知识蒸馏（外部切片注册进 OS 后由 OS 调度）─────────────
hr('领域D · 知识蒸馏（第四层能力，由外部模块注册进 OS 后统一调度）');
(async () => {
  const manual = await L.Capabilities.run('learn.distill', {
    input: {
      domain: '用本地红壤烧砖',
      expert: '老窑匠·王',
      localContext: { inventory:{ tools:['木模','锄头'], materials:['红壤','木柴'] },
                      substituteMap:{ '窑炉':'本地土窑+柴火' } },
      terms: { '含水率':'泥土里水的比例' },
      principles: [
        '取红壤剔除碎石，含水率控制在20%以下',
        '如果砖坯未全干就入窑会爆裂，须阴干5–7天至断面发白再装窑'
      ]
    }
  });
  line('  蒸馏产出：手册 ' + manual.id + '  步骤 ' + manual.steps.length + ' 步');
  line('  审计状态：' + manual.audit.status + '（含未验证步 → 不声称无幻觉：'
    + (manual.audit.noHallucination ? '是' : '否 ✔诚实') + '）');
  line('  第一步人话：' + manual.steps[0].action);

  // ── 融合证据：一张图、一套循环 ──────────────────────────────────────
  hr('融合证据');
  line('  世界图（所有领域共用同一张 G）：节点 ' + L.WORLD.nodes.length
    + ' 个，边 ' + L.WORLD.edges.length + ' 条');
  line('  领域共存：' + ['FARM_A','KIVA','MONTHLY'].map(n =>
    n + (L.WORLD.nodes.includes(n) ? '✔' : '✘')).join('  '));
  line('  能力总数：' + L.Capabilities.list().length + ' 个（跨 L1/L2/L3/L4/L5）');
  line('  记忆存档：' + (L.Memory.status().hasArchive ? '已落盘，重启可恢复 ✔' : '无存档'));

  const ok = results.every(({ r }) => r.allocations.length > 0 && r.layer.L3_audit.status !== 'audit_failed')
    && manual.steps.length > 0
    && ['FARM_A', 'KIVA', 'MONTHLY'].every(n => L.WORLD.nodes.includes(n));
  line('\n  [自测] ' + (ok
    ? 'PASS ✔ 四个切片已融合：同一张图 + 同一套认知循环 + 统一审计与记忆'
    : 'FAIL ✘'));
  if (require.main === module) process.exitCode = ok ? 0 : 1;
})();

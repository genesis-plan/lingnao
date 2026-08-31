// 由 ima_index.json（原始全量爬取）生成 灵脑 接入用的知识壳 ima_knowledge.json
// 壳结构：元信息 + 431 条条目 + 模块倒排索引（供 metaKnowledgeRouter 快速路由）
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'ima_index.json'), 'utf8'));
const moduleIndex = {};
const typeIndex = {};
for (const e of idx) {
  (moduleIndex[e.module] = moduleIndex[e.module] || []).push(e.id);
  (typeIndex[e.type] = typeIndex[e.type] || []).push(e.id);
}
const shell = {
  source: 'IMA 数学库（knowledge_base_id=7473260799221179，creator=葱头）',
  description: '数学公理/定理/定义/方法/思想方法的确定性知识壳；接入灵脑后可被 KB.imaQuery 检索、被元认知层路由，作为推理证据与兜底依据。完整形式化陈述存于 IMA（can_fetch_content=true），壳仅保留可审计元信息，不臆造细节。',
  total: idx.length,
  kbId: '7473260799221179',
  loadedAt: new Date().toISOString(),
  schema: { id: 'ima_<编号>', no: '编号(1..431)', type: '知识类型', module: '所属模块', title: '标题', status: '状态' },
  // 顶层思想摘要（与灵脑 v3.0 同源、可对齐吸收的核心概念）
  coreConcepts: [
    '开放世界 X已知∪U未知（ima_351）',
    '未知状态 28 条处理路径（ima_380）',
    '工程兜底保闭环不中断（ima_382）',
    '认知架构总成 11 模块（ima_330）',
    '感知-推理-行动闭环 P/R/D/E（ima_313）',
    '目标导向决策 S,A,P,G,C,γ 奖励无关（ima_286）',
    'MCTS 实时规划（ima_292）',
    '反事实推理 SCM（ima_301）',
    '因果推理 DAG/SCM（ima_304）',
    '元认知推理二阶建模（ima_305）',
    '世界模型更新（ima_411）',
    '约束来自测量非假设（ima_417）',
    '可行解集合随机选取不找最优（ima_414）',
    '状态隶属度 μ(x) 渐进已知（ima_388）'
  ],
  moduleIndex,
  typeIndex,
  entries: idx
};
fs.writeFileSync(path.join(dir, 'ima_knowledge.json'), JSON.stringify(shell, null, 2), 'utf8');
console.log('wrote ima_knowledge.json:', shell.total, 'entries;',
  Object.keys(moduleIndex).length, 'modules;', Object.keys(typeIndex).length, 'types');

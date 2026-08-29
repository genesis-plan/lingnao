// 审计：内核所有"做数学判断"的算法/函数，是否引用了 MathAxioms 数学基岩
// 判定标准：① 在 MathFoundation.grounds 注册（MF(fn) 能展开公理链）
//           ② 运行时 return 带 math 字段（真实把公理链带给调用方）
// 用法：node audit-math-coverage.js
const L = require('./lingjing.umd.js');
const MF = L.MF, MathFoundation = L.MathFoundation, MathAxioms = L.MathAxioms;

// 内核中"做实质数学判断"的算法/函数（不含纯 UI/boot/拷贝配置等管道函数）
const ALGOS = [
  // 感知 Φ
  ['perceiveBelief','Φ','贝叶斯滤波迭代+Banach 不动点'],
  ['quantifyUncertainty','Φ','熵/不确定性量化'],
  ['perceive','Φ','LLM 感知(可能幻觉)'],
  // 世界图/知识 Ψ
  ['KB.distillRules','Ψ','FP-Growth 频繁项集(格/lattice)'],
  ['KB.ann','Ψ','LSH 近似检索(SimHash,度量)'],
  ['KB.cogGraph','Ψ','认知图谱(图论)'],
  ['metaKnowledgeRouter','Ψ','元知识路由(集合/逻辑)'],
  // 推理 Θ
  ['aStar','Θ','A* 最优搜索'],
  ['dmcts','Θ','D-MCTS 分支探索(信息增益/UCB)'],
  ['reason','Θ','系统1/系统2 编排'],
  ['system1','Θ','高置信复用'],
  ['system2','Θ','A* 编排'],
  // 逻辑/证明 Ξ
  ['symbolicSolve','Ξ','符号约束求解(Fourier-Motzkin)'],
  ['verifyHoarePath','Ξ','霍尔三元组证明'],
  ['evaluateProposition','Ξ','命题求值(一阶逻辑)'],
  ['edgeHolds','Ξ','边约束判定(逻辑)'],
  // 因果 Λ
  ['identifiabilityID','Λ','do-演算可识别性(ID 算法)'],
  ['counterfactualIdentifiable','Λ','反事实可识别性(ID*)'],
  ['causalEffect','Λ','ACE 因果效应'],
  ['doQuery','Λ','do-演算查询'],
  ['causalDiscovery','Λ','PC-lite 因果发现'],
  ['counterfactual','Λ','Pearl 反事实三步法'],
  ['learnWorldModel','Λ','SEM 结构方程学习(OLS)'],
  ['simulate','Λ','SEM 仿真'],
  // 学习/统计（Λ/PAC）
  ['pacSampleBound','Λ','PAC 样本界'],
  ['SelfLearn.record','Λ','经验记录'],
  ['SelfLearn.discover','Λ','规则发现'],
  ['SelfLearn.validate','Λ','经验验证'],
  ['learn','Λ','置信度在线更新(Bayes)'],
  // 元认知/不确定 Ξ
  ['metaCognition','Ξ','熵 H(K)/一致性/缺口/探索-利用'],
  // 通信/验证/安全
  ['runtimeMonitor','Θ','PrSTL 运行时安全停车(度量/时序)'],
  ['continuousVerify','Ξ','持续验证管道'],
  ['generateAudit','*','七段审计(聚合数学依据链)'],
  // 世界模型/运输（物流域）
  ['transportation','Ψ','最优传输/运输问题(线性规划)'],
  ['reconstructPath','Ψ','路径重建(图论)'],
  ['allPairsCost','Ψ','全点对代价(图论)'],
];

let grounded = 0, ungrounded = 0;
const rows = [];
const missing = [];
for (const [name, sept, desc] of ALGOS) {
  // 注册表用全名（含点号命名空间）直接查
  const registered = !!(MathFoundation.grounds[name]);
  const mf = registered ? MF(name) : null;
  const ok = registered && mf;
  rows.push({ name, sept, desc, registered, ok,
    chain: ok ? (mf.septId + ' ← ' + (mf.ima||[]).map(x=>x.id).join(',')) : '' });
  if (ok) grounded++; else { ungrounded++; missing.push(name); }
}
console.log('=== 灵境 数学贯穿审计（MathAxioms 统一基岩）===');
console.log('已引用数学的算法: ' + grounded + ' / ' + ALGOS.length + '  (' + (100*grounded/ALGOS.length).toFixed(0) + '%)');
console.log('未引用数学的算法: ' + ungrounded);
console.log('──────────────────────────────────────────');
for (const r of rows) {
  console.log((r.ok ? '✅' : '❌') + ' ' + r.name.padEnd(24) + ' [' + r.sept + '] ' + (r.ok ? r.chain : '— 无数学依据 —'));
}
console.log('──────────────────────────────────────────');
console.log('未贯穿(待补): ' + (missing.length ? missing.join(', ') : '无'));
console.log('基础公理 ZFC(9): ' + Object.keys(MathAxioms.ZFC).join(', '));
console.log('分支公理: ' + Object.keys(MathAxioms.BRANCH).join(', '));
console.log('──────────────────────────────────────────');
console.log('【运行时验证】真实调用函数，确认 math 公理链进入返回对象:');
const rt = [];
function chk(name, fn){ try{ const r = fn(); const ok = r && r.math && Array.isArray(r.math.axiomChain) && r.math.axiomChain.length;
  rt.push({name, ok, chain: ok ? (r.math.septId+' ← '+r.math.ima.map(x=>x.id).join(',')) : (r&&r.math?'(无axiomChain)':'(无math字段)')}); }
  catch(e){ rt.push({name, ok:false, chain:'(抛错:'+e.message.slice(0,30)+')'}); } }
chk('aStar', ()=>L.aStar('CHARGE','C'));
chk('dmcts', ()=>L.dmcts('CHARGE','C'));
chk('reason', ()=>L.reason('CHARGE','C'));
chk('system1', ()=>L.system1('CHARGE','C'));
chk('system2', ()=>L.system2('CHARGE','C'));
chk('metaCognition', ()=>L.metaCognition());
chk('runtimeMonitor', ()=>L.runtimeMonitor({cost:5,path:['CHARGE','C']},{maxCost:10}));
chk('pacSampleBound', ()=>L.pacSampleBound(10,0.1,0.1));
chk('continuousVerify', ()=>L.continuousVerify());
chk('identifiabilityID(链式)', ()=>L.identifiabilityID({nodes:['X','M','Y'],edges:[{from:'X',to:'M'},{from:'M',to:'Y'}]},'X','Y'));
chk('counterfactualIdentifiable(前门)', ()=>L.counterfactualIdentifiable({nodes:['X','M','Y'],edges:[{from:'X',to:'M'},{from:'M',to:'Y'}],bidirected:[{from:'X',to:'Y'}]},'X','Y',{mediator:'M'}));
chk('causalDiscovery', ()=>L.causalDiscovery());
chk('doQuery(无后门)', ()=>L.doQuery('X','Y',[]));
chk('KB.distillRules', ()=>L.KB.distillRules(0.3));
chk('KB.cogGraph', ()=>L.KB.cogGraph());
chk('metaKnowledgeRouter', ()=>L.metaKnowledgeRouter([{transition:'A→B',reason:'无经验覆盖'}]));
chk('transportation', ()=>L.transportation({S:5},{T:5},{S:{T:1}}));
chk('allPairsCost', ()=>L.allPairsCost([]));
chk('SelfLearn.record', ()=>L.SelfLearn.record({state:'A',result:'B',success:true}));
const aR = L.reason('CHARGE','C'); chk('generateAudit', ()=>L.generateAudit(aR));
let rtOk = rt.filter(r=>r.ok).length;
for(const r of rt) console.log((r.ok?'  ✅':'  ❌')+' '+r.name.padEnd(26)+' '+r.chain);
console.log('运行时 math 字段生效: ' + rtOk + '/' + rt.length);
console.log('════════════════════════════════════════════');

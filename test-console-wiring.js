// 无头复现 lingjing-console.html 的接线逻辑，确认真函数不抛错且产出真实规划/执行/审计
const L = require('./lingjing.umd.js');

const CAPS_DEFAULT = [
  {id:'step_CA', pre:s=>s.location==='CHARGE', eff:s=>{s.location='A';}, cost:1, ground:()=>({target:'A'})},
  {id:'step_AC', pre:s=>s.location==='A',      eff:s=>{s.location='CHARGE';}, cost:1, ground:()=>({target:'CHARGE'})},
  {id:'step_AB', pre:s=>s.location==='A',      eff:s=>{s.location='B';}, cost:1, ground:()=>({target:'B'})},
  {id:'step_BA', pre:s=>s.location==='B',      eff:s=>{s.location='A';}, cost:1, ground:()=>({target:'A'})},
  {id:'step_BC', pre:s=>s.location==='B',      eff:s=>{s.location='C';}, cost:1, ground:()=>({target:'C'})},
  {id:'step_CB', pre:s=>s.location==='C',      eff:s=>{s.location='B';}, cost:1, ground:()=>({target:'B'})},
  {id:'step_CD', pre:s=>s.location==='C',      eff:s=>{s.location='D';}, cost:1, ground:()=>({target:'D'})},
  {id:'step_DC', pre:s=>s.location==='D',      eff:s=>{s.location='C';}, cost:1, ground:()=>({target:'C'})},
];
const WORLD = {nodes:['CHARGE','A','B','C','D'],
  edges:[{from:'CHARGE',to:'A',w:1},{from:'A',to:'CHARGE',w:1},{from:'A',to:'B',w:1},{from:'B',to:'A',w:1},
    {from:'B',to:'C',w:1},{from:'C',to:'B',w:1},{from:'C',to:'D',w:1},{from:'D',to:'C',w:1}]};

function makeAdapter(failFirst){
  return async function(cap, params){
    const def = CAPS_DEFAULT.find(c=>c.id===cap);
    if(!def) return {ok:false, error:'unknown-capability:'+cap};
    if(failFirst) return {ok:false, error:'simulated persistent body failure'}; // 持续故障 → 触发 maxReplans 护栏
    const s = L.getState(); const next = Object.assign({}, s); def.eff(next, params);
    return {ok:true, state:next};
  };
}

function run(label, {target, hard, failFirst}){
  L.setWorld(WORLD);
  L.attachBody({name:'body', state:{location:'CHARGE'}, hard:hard, capabilities:CAPS_DEFAULT});
  const goalFn = s => s.location === target;
  const plan = L.planTask(goalFn, {maxLayer:32});
  const dw = plan.ok ? (async()=> await L.doWork(goalFn, makeAdapter(failFirst), {maxReplans:3, deviationTolerance:1, goalFn}))() : null;
  return {plan, dw, hard, target};
}

(async()=>{
  let pass=0, total=0; const ck=(n,c)=>{total++; if(c){pass++; console.log('  ✓ '+n);} else console.log('  ✗ '+n);};

  // 1) 正常干活：CHARGE -> C
  let r = run('normal', {target:'C', hard:[], failFirst:false});
  let dw = await r.dw;
  ck('planTask 返回最优动作序列', r.plan.ok && r.plan.plan.length>=3);
  ck('doWork 达成目标', dw.ok && dw.execution.goalSatisfied===true);
  ck('执行步数 = 规划步数', dw.execution.trace.length === r.plan.plan.length);
  const audit1 = L.generateAudit({id:'EMB', status:dw.ok?'optimal':'halted', path:[r.plan.plan[0].cap], cost:dw.execution.steps, steps:[], opts:{hard:r.hard,soft:[]}}, {hard:r.hard, soft:[]});
  ck('审计产出 status', !!audit1.status);
  ck('审计⑪执行段含 LAST_EXECUTION', !!audit1.embodied && audit1.embodied.trace.length===dw.execution.trace.length);
  console.log('  [normal] plan='+r.plan.plan.map(s=>s.cap).join('>')+' | halt='+dw.execution.haltReason+' | replans='+dw.execution.replans);

  // 2) SAFE-STOP：硬约束禁 B，目标 C（路径必经 B）
  r = run('safe-stop', {target:'C', hard:['B'], failFirst:false});
  dw = await r.dw;
  ck('SAFE-STOP 触发（haltReason 含 forbidden:B）', !!dw.execution.haltReason && dw.execution.haltReason.indexOf('SAFE-STOP')===0 && dw.execution.haltReason.indexOf('forbidden:B')>=0);
  console.log('  [safe-stop] halt='+dw.execution.haltReason);

  // 3) 重规划：模拟第一步执行失败
  r = run('replan', {target:'C', hard:[], failFirst:true});
  dw = await r.dw;
  ck('重规划耗尽 maxReplans', dw.execution.haltReason==='max-replans-exceeded' && dw.execution.replans===3);
  console.log('  [replan] halt='+dw.execution.haltReason+' replans='+dw.execution.replans);

  console.log('\nWIRING '+(pass===total?'OK':'FAIL')+' — '+pass+'/'+total);
  process.exit(pass===total?0:1);
})();

/*
 * 验证：lingnao-console.html ③ 卡「自动探测 → 摄入 → 识类 → 锚定重试」管线
 * 与浏览器控制台执行的是同一套逻辑（classify / discoverWs 来自 lingnao-body-library.js）。
 * 用真实仿真 AGV 身体当「世界上任意一台机器」的代理，证明零填写接入。
 */
const LIB = require('./lingnao-body-library.js');

// 复制控制台里的 detectProtocol 逻辑
function detectProtocol(addr){
  addr = (addr||'').trim();
  if(/^wss?:\/\//i.test(addr)) return {proto:'ws', url:addr};
  const m = addr.match(/^(.+?)(?::(\d+))?\/?$/);
  if(!m) return {proto:null};
  const host = m[1]; const port = m[2] ? +m[2] : null;
  const portMap = {502:'modbus-tcp', 1883:'mqtt', 4840:'opc-ua', 8787:'ws'};
  const proto = port ? portMap[port] : null;
  if(proto==='ws') return {proto:'ws', url:'ws://'+host+':'+port};
  return {proto:proto, host:host, port:port};
}

// 复制控制台里的锚定重试逻辑
function anchorRetry(lastObserved, varName, slot){
  const anchored = Object.assign({}, lastObserved.variables);
  anchored[varName + '_' + slot] = anchored[varName] !== undefined ? anchored[varName] : 'number';
  return {protocol:lastObserved.protocol, variables:anchored, actions:lastObserved.actions};
}

(async function(){
  let pass = 0, fail = 0;
  function check(name, cond, extra){ if(cond){pass++; console.log('✅ '+name+(extra?'  '+extra:''));} else {fail++; console.log('❌ '+name+(extra?'  '+extra:''));} }

  // 场景 1：ws 地址自动识别协议 + 摄入 + 自动识类（零填写）
  const d1 = detectProtocol('ws://localhost:8787');
  check('探测协议(ws地址)', d1.proto==='ws' && d1.url==='ws://localhost:8787', JSON.stringify(d1));
  const d2 = detectProtocol('192.168.1.10:8787');
  check('探测协议(端口8787→ws)', d2.proto==='ws' && d2.url==='ws://192.168.1.10:8787', JSON.stringify(d2));
  const d3 = detectProtocol('plc:502');
  check('探测协议(端口502→modbus-tcp)', d3.proto==='modbus-tcp' && d3.port===502, JSON.stringify(d3));

  try{
    const obs = await LIB.discoverWs('ws://localhost:8787', {timeout:5000, actions:[]});
    check('ws 摄入信息模型', obs && obs.protocol==='ws' && Object.keys(obs.variables).length>0, '变量='+Object.keys(obs.variables).join(','));
    const res = LIB.classify({protocol:'ws', variables:obs.variables, actions:[]}, {});
    check('自动识类=AGV(零填写)', res.matched && res.best.id==='agv.planar.se2', 'conf='+res.confidence+' residual='+res.residual);
    console.log('   → 识别为「'+res.best.label+'」，状态空间 '+res.best.group+'，用户零填写即可接入');
  }catch(e){ check('ws 摄入', false, e.message); }

  // 场景 2：封闭私有协议（裸寄存器无标签）→ 覆盖不到 → 锚定 1 语义槽后识类
  const bare = {protocol:'modbus-tcp', variables:{40001:'number',40002:'number',40003:'number'}, actions:[]};
  const r0 = LIB.classify(bare, {});
  check('裸寄存器→未匹配(诚实边界)', !r0.matched && r0.needsAnchor, 'note='+(r0.note||'').slice(0,20));
  const anchored = anchorRetry(bare, '40001', 'x');
  const r1 = LIB.classify(anchored, {});
  check('锚定 40001=x 后→识类AGV', r1.matched && r1.best.id==='agv.planar.se2', 'conf='+r1.confidence);

  console.log('\n结果：'+pass+' 通过 / '+fail+' 失败');
  process.exit(fail ? 1 : 0);
})();

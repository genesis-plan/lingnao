#!/usr/bin/env node
/**
 * sim-realistic.js — 灵脑「大脑 → 物理体」现实场景全流程模拟（跑多遍）
 *
 * 扮演机器人侧工具路由器：所有 initialize / tools/list / tools/call 都是真实 JSON-RPC，
 * 直接发给正在运行的灵脑 MCP 服务进程，收到的是大脑的真实计算返回。
 * 真物理执行由机器人侧用 plan 自行驱动；此处用大脑内确定性模拟执行闭环（execute_task）
 * 复现现实世界里的各类情况。
 *
 * 现实场景覆盖：
 *   1) 低电量自动充电        — 电量不足时，大脑在规划里自动插入充电步骤
 *   2) 取货(多字段状态)      — 目标 {carrying:true}：移动到货架→取货
 *   3) 封箱(不可逆)·未授权    — 不可逆动作无显式授权 → IRREVERSIBLE-HALT 停机
 *   4) 封箱(不可逆)·已授权    — 显式 allowIrreversible → 执行完成（内核支持、MCP 现已透传）
 *   5) 动态禁区 SAFE-STOP     — 规划后才出现的禁区，执行期 checkHard 拦下
 *   6) 中途电量耗尽(传感器故障) — 偏差超容差 → 重规划失败 → 诚实安全停机
 *   7) 传感器读数轻微漂移(容差内) — 偏差 ≤ 容差 → 仅记录，不重规划，继续
 *   8) 执行故障 max-replans    — 每步失败 → 重规划耗尽护栏 → max-replans-exceeded
 *   9) 确定性复现             — 同输入跑两遍，结果逐字节一致
 *
 * 跑法：node examples/sim-realistic.js
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');

const SERVER = path.join(__dirname, '..', 'lingnao-mcp.js');
class Mcp {
  constructor() {
    this.proc = spawn(process.execPath, [SERVER], { cwd: path.join(__dirname, '..'), stdio: ['pipe', 'pipe', 'pipe'] });
    this.buf = ''; this.pending = new Map(); this.id = 0;
    this.proc.stdout.on('data', d => { this.buf += d.toString('utf8'); this._drain(); });
  }
  _drain() {
    let i;
    while ((i = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
      if (!line) continue;
      let m; try { m = JSON.parse(line); } catch (e) { continue; }
      if (m.id !== undefined && this.pending.has(m.id)) { const r = this.pending.get(m.id); this.pending.delete(m.id); r(m); }
    }
  }
  send(o) { this.proc.stdin.write(JSON.stringify(o) + '\n'); }
  call(method, params) {
    return new Promise(res => { const id = ++this.id; this.pending.set(id, res); this.send({ jsonrpc: '2.0', id, method, params }); });
  }
}

function un(o) {
  try {
    const c = o.result && o.result.content;
    if (Array.isArray(c) && c[0] && c[0].text) { try { return JSON.parse(c[0].text); } catch (e) { return c[0].text; } }
    return o.result;
  } catch (e) { return o.result; }
}
function say(who, text) { console.log('\n\x1b[36m' + who + '\x1b[0m ' + text); }
function ok(b) { return b ? '\x1b[32mYES\x1b[0m' : '\x1b[31mNO\x1b[0m'; }

// 一台仓储机器人：能力契约由调用方（机器人）结构化声明注册，大脑不含身体代码。
// 状态字段：node(所在节点) / battery(电量) / carrying(是否载货) / sealed(是否已封箱)
const WAREHOUSE = {
  name: 'warehouse-bot-01',
  initialState: { node: 'CHARGE', battery: 90, carrying: false, sealed: false },
  hard: [],
  capabilities: [
    { id: 'charge',    desc: '充电(CHARGE→battery100)', pre: { require: { node: 'CHARGE' } }, effect: { set: { battery: 100 } }, cost: 1, ground: { to: 'CHARGE' } },
    { id: 'move_CA',   desc: 'CHARGE→A', pre: { require: { node: 'CHARGE', battery: { gte: 15 } } }, effect: { set: { node: 'A' }, inc: { battery: -10 } }, cost: 1, ground: { to: 'A' } },
    { id: 'move_AB',   desc: 'A→B',     pre: { require: { node: 'A', battery: { gte: 15 } } }, effect: { set: { node: 'B' }, inc: { battery: -10 } }, cost: 1, ground: { to: 'B' } },
    { id: 'move_BC',   desc: 'B→C',     pre: { require: { node: 'B', battery: { gte: 15 } } }, effect: { set: { node: 'C' }, inc: { battery: -10 } }, cost: 1, ground: { to: 'C' } },
    { id: 'move_AC',   desc: 'A→C直连', pre: { require: { node: 'A', battery: { gte: 15 } } }, effect: { set: { node: 'C' }, inc: { battery: -10 } }, cost: 1, ground: { to: 'C' } },
    { id: 'move_CB',   desc: 'C→B',     pre: { require: { node: 'C', battery: { gte: 15 } } }, effect: { set: { node: 'B' }, inc: { battery: -10 } }, cost: 1, ground: { to: 'B' } },
    { id: 'move_BA',   desc: 'B→A',     pre: { require: { node: 'B', battery: { gte: 15 } } }, effect: { set: { node: 'A' }, inc: { battery: -10 } }, cost: 1, ground: { to: 'A' } },
    { id: 'move_CA_r', desc: 'C→A',     pre: { require: { node: 'C', battery: { gte: 15 } } }, effect: { set: { node: 'A' }, inc: { battery: -10 } }, cost: 1, ground: { to: 'A' } },
    { id: 'pick_C',    desc: 'C区取货',  pre: { require: { node: 'C', carrying: false } }, effect: { set: { carrying: true } }, cost: 1, ground: { to: 'C' } },
    { id: 'seal_A',    desc: 'A区封箱(不可逆)', pre: { require: { node: 'A', carrying: true } }, effect: { set: { carrying: false, sealed: true } }, cost: 1, ground: { to: 'A' }, irreversible: true },
    { id: 'goto_Z',    desc: '→Z(不可逆演示)', pre: {}, effect: { set: { node: 'Z' } }, cost: 1, ground: { to: 'Z' }, irreversible: true },
  ]
};

(async () => {
  const m = new Mcp();
  await m.call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'realistic-sim', version: '1.0' } });
  m.send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

  say('🤖', '=== 灵脑 → 物理体 现实场景模拟（多遍）===');

  // 注册一个身体（attach 时可覆盖 initialState / hard，故此处给默认）
  const ab = un(await m.call('tools/call', { name: 'attach_body', arguments: WAREHOUSE }));
  say('🔧', `attach_body → ok=${ab.ok}, 能力数=${ab.capabilities.length}, 初始=${JSON.stringify(ab.state)}`);

  // 按场景重新登记身体（覆盖 initialState / hard）
  async function mount(init, hard) {
    return un(await m.call('tools/call', { name: 'attach_body', arguments: Object.assign({}, WAREHOUSE, { initialState: init, hard: hard || [] }) }));
  }
  async function run(goal, opts) {
    const ex = un(await m.call('tools/call', { name: 'execute_task', arguments: Object.assign({ goalSpec: goal }, opts || {}) }));
    const e = ex.execution || ex;
    return { raw: ex, ex: e };
  }
  function show(tag, goal, r) {
    const e = r.ex;
    const plan = (r.raw.plan && r.raw.plan.plan) ? r.raw.plan.plan.map(s => s.cap).join(' › ') : '(规划失败)';
    const cost = (r.raw.plan && r.raw.plan.cost);
    console.log(`  ▸ ${tag}: ok=${e.ok} goalSatisfied=${e.goalSatisfied} steps=${e.steps} replans=${e.replans} halt=${e.haltReason || '—'}`);
    console.log(`    plan=[${plan}]${cost != null ? ' cost=' + cost : ''}  final=${JSON.stringify(e.finalState)}`);
    if (e.deviations && e.deviations.length) console.log(`    deviations=${JSON.stringify(e.deviations)}`);
    return e;
  }

  // —— 1. 低电量自动充电 ——
  await mount({ node: 'CHARGE', battery: 10, carrying: false, sealed: false }, []);
  say('🔋', '【1 低电量自动充电】电量=10 起点，目标 reach C。大脑应自动先充电再移动：');
  const r1 = await run({ reach: 'C' }); show('reach C (battery=10)', { reach: 'C' }, r1);

  // —— 2. 取货（多字段状态目标）——
  await mount({ node: 'CHARGE', battery: 90, carrying: false, sealed: false }, []);
  say('📦', '【2 取货】电量充足，目标 {carrying:true}。规划应移动到货架 C 并取货：');
  const r2 = await run({ match: { carrying: true } }); show('match {carrying:true}', { match: { carrying: true } }, r2);

  // —— 3. 封箱(不可逆)·未授权 → IRREVERSIBLE-HALT ——
  // 取货并回到 A，使 seal_A 成为可达的唯一不可逆能力；目标 reach A（带 sealed 完成需 seal）
  await mount({ node: 'CHARGE', battery: 90, carrying: false, sealed: false }, []);
  say('🔒', '【3 封箱·未授权】取货后回 A，再走不可逆 seal_A。未显式授权 → 应 IRREVERSIBLE-HALT：');
  const r3 = await run({ match: { node: 'A', sealed: true } }); show('match {node:A,sealed:true}', { match: { node: 'A', sealed: true } }, r3);

  // —— 4. 封箱(不可逆)·已授权 → 执行完成 ——
  await mount({ node: 'CHARGE', battery: 90, carrying: false, sealed: false }, []);
  say('🔓', '【4 封箱·已授权】同样目标，但显式 allowIrreversible=true → 应执行完成：');
  const r4 = await run({ match: { node: 'A', sealed: true } }, { allowIrreversible: true }); show('match {node:A,sealed:true} +allowIrreversible', { match: { node: 'A', sealed: true } }, r4);

  // —— 5. 动态禁区 SAFE-STOP ——
  // 规划时无禁区；执行前禁区 B 出现（重挂身体 hard:['B']），目标 reach B 必经 B → 执行期拦下
  await mount({ node: 'CHARGE', battery: 90, carrying: false, sealed: false }, []);
  say('🚧', '【5 动态禁区 SAFE-STOP】规划到 B，但执行前 B 被设为禁区 → check_hard 应拦下：');
  await mount({ node: 'CHARGE', battery: 90, carrying: false, sealed: false }, ['B']);
  const r5 = await run({ reach: 'B' }); show('reach B (hard:[B])', { reach: 'B' }, r5);

  // —— 6. 中途电量耗尽（传感器故障/真实掉电）——
  // 第0步后电量被观测到骤降到 5：仅 battery 一个字段偏差（≤容差），不会触发上面的偏差重规划；
  // 但下一步 move_AC 的前提 battery>=15 已不满足 ⇒ 执行期预检应拦下并重规划，重规划无解 → 诚实安全停机。
  await mount({ node: 'CHARGE', battery: 90, carrying: false, sealed: false }, []);
  say('💀', '【6 中途电量耗尽】reach C，第0步后电量观测到骤降到 5（未超容差，但击穿下一步前提）→ 执行期预检拦下 → 安全停机：');
  const r6 = await run({ reach: 'C' }, { faults: { deviateAt: [{ step: 0, patch: { battery: 5 } }] } }); show('reach C + fault{battery:5@step0}', { reach: 'C' }, r6);

  // —— 7. 传感器读数轻微漂移（容差内）——
  await mount({ node: 'CHARGE', battery: 90, carrying: false, sealed: false }, []);
  say('📉', '【7 轻微漂移(容差内)】第1步后电量观测到 78（仅1字段偏差 ≤ 容差1，且不破坏任何前提）→ 仅记录偏差，不重规划，继续完成：');
  const r7 = await run({ reach: 'C' }, { faults: { deviateAt: [{ step: 1, patch: { battery: 78 } }] } }); show('reach C + drift{battery:78@step1}', { reach: 'C' }, r7);

  // —— 8. 执行故障 max-replans ——
  await mount({ node: 'CHARGE', battery: 90, carrying: false, sealed: false }, []);
  say('💥', '【8 故障·max-replans】每步执行都失败 → 重规划耗尽护栏：');
  const r8 = await run({ reach: 'C' }, { faults: { failAt: [0, 1, 2, 3] } }); show('reach C + failAt[0,1,2,3]', { reach: 'C' }, r8);

  // —— 9. 确定性复现（同输入跑两遍）——
  await mount({ node: 'CHARGE', battery: 90, carrying: false, sealed: false }, []);
  const a = await run({ reach: 'C' });
  await mount({ node: 'CHARGE', battery: 90, carrying: false, sealed: false }, []);
  const b = await run({ reach: 'C' });
  const same = JSON.stringify(a.ex) === JSON.stringify(b.ex);
  say('🔂', `【9 确定性】两次 reach C 执行结果逐字节一致？ ${ok(same)}`);

  // —— 汇总断言 ——
  say('📋', '=== 现实场景行为核对 ===');
  const checks = [
    ['1 低电量自动插入充电步骤', r1.ex.ok && (r1.raw.plan.plan || []).some(s => s.cap === 'charge')],
    ['2 取货达成 carrying:true', r2.ex.ok && r2.ex.goalSatisfied === true],
    ['3 未授权不可逆被拦(IRREVERSIBLE-HALT)', r3.ex.haltReason && String(r3.ex.haltReason).indexOf('IRREVERSIBLE-HALT') === 0 && r3.ex.ok === false],
    ['4 授权后不可逆执行完成', r4.ex.ok === true && r4.ex.goalSatisfied === true],
    ['5 动态禁区触发 SAFE-STOP', r5.ex.haltReason && String(r5.ex.haltReason).indexOf('SAFE-STOP') === 0 && r5.ex.ok === false],
    ['6 电量耗尽诚实安全停机(no-plan-after-pre-violation)', r6.ex.haltReason && /no-plan-after-pre-violation|SAFE-STOP/.test(r6.ex.haltReason) && r6.ex.ok === false],
    ['7 轻微漂移容差内继续完成', r7.ex.ok === true && r7.ex.goalSatisfied === true && (r7.ex.deviations || []).length >= 1],
    ['8 故障耗尽护栏(max-replans-exceeded)', r8.ex.haltReason && String(r8.ex.haltReason).indexOf('max-replans-exceeded') === 0 && r8.ex.ok === false],
    ['9 确定性可复现', same === true],
  ];
  let pass = 0;
  for (const [name, c] of checks) { console.log(`  ${ok(c)} ${name}`); if (c) pass++; }
  console.log(`\n  结果：${pass}/${checks.length} 项现实场景行为符合预期`);

  say('✅', '现实场景模拟结束。大脑只负责"可证明安全 + 可审计"；机器人侧拿到 plan 后驱动机体。');
  m.proc.kill();
  process.exit(pass === checks.length ? 0 : 1);
})();

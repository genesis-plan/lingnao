#!/usr/bin/env node
/**
 * sim-embodied.js — 灵脑「大脑 → 物理体」全流程模拟（跑多遍）
 *
 * 扮演机器人侧的工具路由器：所有 initialize / tools/list / tools/call 都是真实 JSON-RPC，
 * 直接发给正在运行的灵脑 MCP 服务进程，收到的是大脑的真实计算返回。
 * 真物理执行由机器人侧用 plan 自行驱动；此处用大脑内的确定性模拟执行闭环（execute_task）
 * 复现执行、故障、SAFE-STOP、重规划等行为。
 *
 * 跑法：node examples/sim-embodied.js
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
function dump(obj) { console.log('  ' + JSON.stringify(obj, null, 2)); }

// 一台仓储机器人：能力契约由调用方（机器人）以结构化声明注册，大脑不含身体代码。
const WAREHOUSE_BODY = {
  name: 'warehouse-bot-01',
  initialState: { node: 'CHARGE', battery: 80, carrying: false },
  // 硬约束禁区（字符串形式：匹配 step.params.to）
  hard: ['D'],
  capabilities: [
    { id: 'step_CA', desc: 'CHARGE→A', pre: { require: { node: 'CHARGE' } }, effect: { set: { node: 'A' } }, cost: 1, ground: { to: 'A' } },
    { id: 'step_AB', desc: 'A→B',     pre: { require: { node: 'A' } },     effect: { set: { node: 'B' } }, cost: 1, ground: { to: 'B' } },
    { id: 'step_BC', desc: 'B→C',     pre: { require: { node: 'B' } },     effect: { set: { node: 'C' } }, cost: 1, ground: { to: 'C' } },
    { id: 'step_CD', desc: 'C→D',     pre: { require: { node: 'C' } },     effect: { set: { node: 'D' } }, cost: 1, ground: { to: 'D' } },
    // 不可逆能力（如点火/剪切）：结果无法撤销，执行前必须显式授权，否则 IRREVERSIBLE-HALT
    { id: 'goto_Z',  desc: '→Z(不可逆)', pre: {},                          effect: { set: { node: 'Z' } }, cost: 1, ground: { to: 'Z' }, irreversible: true }
  ]
};

(async () => {
  const m = new Mcp();
  await m.call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'embodied-sim', version: '1.0' } });
  m.send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

  say('🤖', '=== 灵脑 → 物理体 全流程模拟（多遍）===');

  // —— 0. 产品自我定位（确认它是"在物理世界干活的通用大脑"）——
  const pos = un(await m.call('tools/call', { name: 'positioning', arguments: {} }));
  say('📌', '大脑自我定位：' + (pos.positioning && pos.positioning.role));
  say('📌', '已注册身体：' + (pos.body && pos.body.name) + ' / 能力 ' + ((pos.body && pos.body.capabilities) || []).join(','));

  // —— 1. 注册物理体（能力契约）——
  const ab = un(await m.call('tools/call', { name: 'attach_body', arguments: WAREHOUSE_BODY }));
  say('🔧', `attach_body → ok=${ab.ok}, 能力数=${ab.capabilities.length}, 初始状态=${JSON.stringify(ab.state)}`);

  const reset = async () => { await m.call('tools/call', { name: 'set_state', arguments: { state: { node: 'CHARGE', battery: 80, carrying: false } } }); };

  // 辅助：规划 + 执行 + 打印
  async function run(goalNode, extra = {}) {
    const plan = un(await m.call('tools/call', { name: 'plan_task', arguments: { goalSpec: { reach: goalNode }, ...extra } }));
    if (!plan.ok) { say('⚠️', `规划失败(reach ${goalNode}): ${plan.error}`); return { plan }; }
    const ex = un(await m.call('tools/call', { name: 'execute_task', arguments: { goalSpec: { reach: goalNode }, ...extra } }));
    const e = ex.execution || ex;
    return { plan, ex: e };
  }
  function report(goalNode, r) {
    if (!r.plan.ok) { say('⚠️', `规划失败(reach ${goalNode}): ${r.plan.error}`); return; }
    const e = r.ex;
    console.log(`  ▸ reach ${goalNode}: ok=${e.ok} goalSatisfied=${e.goalSatisfied} steps=${e.steps} replans=${e.replans} halt=${e.haltReason || '—'}`);
    console.log(`    plan=${(r.plan.plan || []).map(s => s.cap).join(' › ')}  cost=${r.plan.cost}  trace=${JSON.stringify((e.trace || []).map(t => t.cap))}`);
    if (e.deviations && e.deviations.length) console.log(`    deviations=${JSON.stringify(e.deviations)}`);
  }

  // —— 2. 第 1 遍：干净执行到 C ——
  await reset();
  say('🟢', '【遍 1】规划并执行：CHARGE → C（避开硬约束 D）');
  report('C', await run('C'));

  // —— 3. 第 2 遍：换目标到 B（复用，验证"跑几遍"）——
  await reset();
  say('🟢', '【遍 2】规划并执行：CHARGE → B');
  report('B', await run('B'));

  // —— 4. SAFE-STOP：目标是 D（硬约束禁区）——
  await reset();
  say('🛑', '【SAFE-STOP】规划到 D，但 D 是硬约束禁区。先直接验安全门：');
  const ch = un(await m.call('tools/call', { name: 'check_hard', arguments: { state: { node: 'C' }, step: { params: { to: 'D' } } } }));
  say('🛑', `check_hard(C→D) = ${JSON.stringify(ch)}`);
  const rD = await run('D');
  if (rD.ex) report('D', rD); else say('⚠️', '规划即失败：' + (rD.plan && rD.plan.error));

  // —— 5. IRREVERSIBLE-HALT：目标是不可逆能力 Z 可达的节点 ——
  await reset();
  say('🔒', '【IRREVERSIBLE-HALT】规划到 Z（仅 goto_Z 可达，且为不可逆动作）。未显式授权 → 应被拦下：');
  report('Z', await run('Z'));

  // —— 6. 故障注入：每步都失败 → 触发 max-replans 护栏 ——
  await reset();
  say('💥', '【故障·max-replans】注入 failAt=[0,1,2,3]，每步执行失败 → 重规划耗尽护栏：');
  report('C', await run('C', { faults: { failAt: [0, 1, 2, 3] } }));

  // —— 7. 状态偏差：执行中观测偏离预测 → 确定性重规划后恢复 ——
  await reset();
  say('🔁', '【偏差·重规划】注入 deviateAt=[{step:1, patch:{battery:30}}]，执行中观测偏离 → 重规划恢复：');
  report('C', await run('C', { faults: { deviateAt: [{ step: 1, patch: { battery: 30 } }] }, deviationTolerance: 0 }));

  // —— 8. 确定性：同样输入再跑一遍，结果应完全一致 ——
  await reset();
  const a = await run('C');
  await reset();
  const b = await run('C');
  const same = JSON.stringify(a.ex) === JSON.stringify(b.ex);
  say('🔂', `【确定性】两次 reach C 执行结果完全一致？ ${same ? '是（确定性内核，可复现）' : '否'}`);

  // —— 9. 审计：附一份可归档报告 ——
  await reset();
  say('📑', '【审计】生成七段审计报告摘要：');
  const aud = un(await m.call('tools/call', { name: 'audit', arguments: { start: 'CHARGE', goal: 'C' } }));
  dump({
    reportId: aud.reportId, status: aud.status,
    summary: aud.summary,
    proofVerified: aud.proof && aud.proof.verified,
    noHallucination: aud.noHallucination,
    constraints: aud.constraints
  });

  say('✅', '全流程模拟结束。物理体侧拿到 plan 后自行驱动机体；大脑只负责"可证明安全 + 可审计"。');
  m.proc.kill();
  process.exit(0);
})();

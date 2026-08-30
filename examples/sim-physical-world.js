#!/usr/bin/env node
/**
 * sim-physical-world.js — 灵脑「大脑 → 真实物理体」全覆盖测试
 *
 * 用真实 JSON-RPC 驱动 lingnao-mcp.js（与机器人侧工具路由器完全一致），按用户列出的
 * 物理体分类逐一接入，并对每类跑 A–E 五组现实场景：
 *
 *   A 正常可完成（条件充足，物理可行）
 *   B 违背物理硬约束（现实本身做不到 → 规划无解 / SAFE-STOP 拦截）
 *   C 非理想工况（打滑/抓取失效/物体脱落/损坏/能耗偏差 → 偏差检测 + 重规划）
 *   D 环境动态改变（执行前禁区/目标消失 → 旧计划作废 SAFE-STOP）
 *   E 逻辑/物理不可能（自相矛盾目标 → 规划无解）
 *
 * 关键设计（与用户「内核不改、只换契约描述」一致）：
 *   内核逻辑 0 改动（本会话此前只为让连续物理量可表达，扩展了契约描述语言：
 *   evalRequire 区间/枚举比较、checkHard 声明式数值包线、goalFnFromSpec 区间目标）。
 *   所有真实物体的物理行为 = 一份结构化「能力契约」（pre/eff/cost/ground/hard）。
 *
 * 跑法：node examples/sim-physical-world.js
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');

const SERVER = path.join(__dirname, '..', 'lingnao-mcp.js');

// ── JSON-RPC 客户端（真实 MCP 进程）────────────────────────────────────
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
function ok(b) { return b ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'; }

// ── 连续单自由度能力契约模板（set-to-target，含声明式数值硬包线）────────
// 让「角度/行程/转速/长度/力/扭矩」这类连续物理量可用纯数据表达安全边界。
// 注意：ground 把目标填入参数 target，故 hard 的参数边界必须 key 在 target 上
// （step.params = {target: 值}），而非状态字段名——否则 checkHard 会因字段缺席而跳过，
// 安全门形同虚设（曾因此让舵机被命令到 95° 超物理极限执行）。
function ctl(id, field, desc, range, opts) {
  opts = opts || {};
  return {
    id, desc,
    pre: { require: Object.assign({ [field]: { min: range.workMin, max: range.workMax } }, opts.preExtra || {}) },
    effect: { set: { [field]: '{{params.target}}' } },
    ground: { target: '{{goal.match.' + field + '}}' },
    cost: opts.cost || 1,
    // 声明式硬约束：指令参数(target)越出物理极限即被拦下（pre 工作区略小，hard 为物理极限）
    hard: [{ desc: desc + ' 物理极限', params: { target: { min: range.physMin, max: range.physMax } } }].concat(opts.extraHard || []),
  };
}

// ── A 类：单轴/单自由度简单执行器 ─────────────────────────────────────
const SERVO = {
  name: 'servo-pan', initialState: { angle: 0 }, hard: [],
  capabilities: [
    ctl('set_angle', 'angle', '舵机转角', { workMin: -85, workMax: 85, physMin: -90, physMax: 90 }),
  ],
};
const STEPPER = {
  name: 'stepper-leadscrew', initialState: { pos: 0 }, hard: [],
  capabilities: [
    ctl('move_to', 'pos', '步进丝杆行程', { workMin: 0, workMax: 195, physMin: -2, physMax: 202 }, { preExtra: { powered: { eq: true } } }),
  ],
};
const DCMOTOR = {
  name: 'dc-encoder', initialState: { rpm: 0 }, hard: [],
  capabilities: [
    ctl('set_speed', 'rpm', '直流电机转速', { workMin: 0, workMax: 280, physMin: 0, physMax: 320 }),
  ],
};
const SOLENOID = {
  name: 'solenoid-valve', initialState: { valve: false, pressure: 0 }, hard: [],
  capabilities: [
    { id: 'open', desc: '电磁阀打开', pre: { require: { pressure: { max: 8 } } }, effect: { set: { valve: true } }, cost: 1, ground: { to: 'OPEN' }, hard: [{ desc: '超压禁区(最大 8)', require: { pressure: { max: 8 } }, scope: 'pre' }] },
    { id: 'close', desc: '电磁阀关闭', pre: { require: { pressure: { max: 8 } } }, effect: { set: { valve: false } }, cost: 1, ground: { to: 'CLOSE' }, hard: [{ desc: '超压禁区(最大 8)', require: { pressure: { max: 8 } }, scope: 'pre' }] },
  ],
};
const RELAY = {
  name: 'relay-switch', initialState: { contact: false, load: 0 }, hard: [],
  capabilities: [
    { id: 'close', desc: '继电器闭合通电', pre: { require: { load: { max: 10 } } }, effect: { set: { contact: true } }, cost: 1, ground: { to: 'ON' }, hard: [{ desc: '触点容量(最大 10)', require: { load: { max: 10 } }, scope: 'pre' }] },
    { id: 'open', desc: '继电器断开', pre: { require: {} }, effect: { set: { contact: false } }, cost: 1, ground: { to: 'OFF' }, hard: [{ desc: '触点容量(最大 10)', require: { load: { max: 10 } }, scope: 'pre' }] },
  ],
};
const ACTUATOR = {
  name: 'linear-actuator', initialState: { len: 0 }, hard: [],
  capabilities: [
    ctl('extend_to', 'len', '线性推杆伸出长度', { workMin: 0, workMax: 95, physMin: -1, physMax: 101 }),
  ],
};

// ── B 类：多轴运动系统 ────────────────────────────────────────────────
// 桌面机械臂 3 轴（每关节独立执行器 → 多步规划）；3D 打印机 / CNC 同构（X/Y/Z）。
function multiAxis(name, joints, lim) {
  const caps = joints.map(j => ({
    id: 'move_' + j, desc: '设 ' + j + ' 关节角',
    pre: { require: { [j]: { min: lim.workMin, max: lim.workMax } } },
    effect: { set: { [j]: '{{params.target}}' } },
    ground: { target: '{{goal.match.' + j + '}}' },
    cost: 1,
    hard: [{ desc: j + ' 物理极限', params: { target: { min: lim.physMin, max: lim.physMax } } }],
  }));
  return { name, initialState: Object.assign({}, joints.reduce((a, j) => (a[j] = 0, a), {})), hard: [], capabilities: caps };
}
const ARM3 = multiAxis('arm-3axis', ['j1', 'j2', 'j3'], { workMin: -165, workMax: 165, physMin: -170, physMax: 170 });
const PRINTER3 = multiAxis('printer-xyz', ['x', 'y', 'z'], { workMin: 0, workMax: 195, physMin: -2, physMax: 202 });

// 双轴云台（pan/tilt 双自由度，一步各一轴）
const GIMBAL = {
  name: 'gimbal-pt', initialState: { pan: 0, tilt: 0 }, hard: [],
  capabilities: [
    ctl('set_pan', 'pan', '云台水平', { workMin: -85, workMax: 85, physMin: -90, physMax: 90 }, { cost: 1 }),
    ctl('set_tilt', 'tilt', '云台垂直', { workMin: -35, workMax: 35, physMin: -40, physMax: 40 }, { cost: 1 }),
  ],
};

// ── C 类：带力/力矩反馈 ───────────────────────────────────────────────
const GRIPPER = {
  name: 'force-gripper', initialState: { force: 0, width: 0, object_detected: true }, hard: [],
  capabilities: [
    {
      id: 'grip', desc: '夹紧到指定力',
      pre: { require: { object_detected: { eq: true }, force: { max: 5 } } },
      effect: { set: { force: '{{params.f}}', width: '{{params.w}}' } },
      ground: { f: '{{goal.match.force}}', w: '{{goal.match.width}}' },
      cost: 1,
      hard: [{ desc: '最大夹持力 5N', params: { f: { max: 5 } } }],
    },
  ],
};
const TORQUE = {
  name: 'torque-wrench', initialState: { torque: 0 }, hard: [],
  capabilities: [
    ctl('tighten', 'torque', '拧紧到指定扭矩', { workMin: 0, workMax: 28, physMin: 0, physMax: 30 }),
  ],
};

// ── D 类：移动系统（离散航点图 + 电量 + 避障）+ E 类无人机（连续 3D + 围栏）──
function mobile(name, nodes, edges, init) {
  const caps = edges.map((e, i) => ({
    id: 'e' + i, desc: e[0] + '→' + e[1],
    pre: { require: { node: e[0], battery: { gte: 15 } } },
    effect: { set: { node: e[1] }, inc: { battery: -10 } },
    // 穿越障碍走廊(OBST)的边代价极高：虽仍可达（终极安全网由 BODY.hard 禁区兜底），
    // 但 A* 最优规划会自然绕开，符合真实代价地图(cost-map)语义。
    cost: (e[0] === 'OBST' || e[1] === 'OBST') ? 100 : 1, ground: { to: e[1] },
  }));
  // OBST 为已知静态障碍物/墙角，默认即禁区（永远不可进入）；动态障碍由场景再叠加
  return { name, initialState: Object.assign({ node: 'HOME', battery: 90 }, init || {}), hard: ['OBST'], capabilities: caps, _nodes: nodes };
}
const DIFF = mobile('diff-drive', ['HOME', 'W1', 'W2', 'W3', 'BIN', 'OBST'],
  [['HOME', 'W1'], ['W1', 'W2'], ['W2', 'W3'], ['W3', 'BIN'], ['W1', 'OBST'], ['OBST', 'BIN']]);
const WHEEL4 = mobile('4wheel', ['HOME', 'W1', 'W2', 'W3', 'BIN', 'OBST'],
  [['HOME', 'W1'], ['W1', 'W2'], ['W2', 'W3'], ['W3', 'BIN'], ['W1', 'OBST'], ['OBST', 'BIN']]);
const DOG = mobile('robot-dog', ['HOME', 'W1', 'W2', 'W3', 'BIN', 'OBST'],
  [['HOME', 'W1'], ['W1', 'W2'], ['W2', 'W3'], ['W3', 'BIN'], ['W1', 'OBST'], ['OBST', 'BIN']]);

// 无人机悬停测试：连续 3D 坐标 + 电量 + 高度围栏（z>=0）+ 禁飞区节点
const DRONE = {
  name: 'drone-hover', initialState: { x: 0, y: 0, z: 0, battery: 80 }, hard: [],
  capabilities: [
    {
      id: 'move_to', desc: '飞到指定 3D 坐标',
      pre: { require: { battery: { gte: 20 } } },
      effect: { set: { x: '{{params.x}}', y: '{{params.y}}', z: '{{params.z}}' } },
      ground: { x: '{{goal.match.x}}', y: '{{goal.match.y}}', z: '{{goal.match.z}}' },
      cost: 1,
      // 高度下限（不能飞到负高度）+ 最大高度 + 电量下限（下发前预测后状态校验）
      hard: [
        { desc: '高度 >=0', params: { z: { min: 0, max: 50 } } },
        { desc: '电量下限', require: { battery: { min: 10 } }, scope: 'post' },
      ],
    },
  ],
};

// ── E 类：带静态障碍物的环境测试（用移动体的禁区硬约束表达墙角/障碍/人）──
// 复用 DIFF/WHEEL4/DOG 的航点图：把 OBST 当障碍物 / 墙角；人机安全距离用禁区表达。

// ─────────────────────────────────────────────────────────────────────
(async () => {
  const m = new Mcp();
  await m.call('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'physical-world-sim', version: '1.0' } });
  m.send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

  const results = [];
  function expect(name, cond, detail) {
    results.push({ name, pass: !!cond, detail: detail || '' });
    console.log('  ' + ok(cond) + ' ' + name + (detail ? '  ' + detail : ''));
  }

  async function mount(body, init, hard) {
    // hard 合并：body 默认硬禁区（如移动体的已知障碍物 OBST）与场景动态新增禁区叠加
    return un(await m.call('tools/call', { name: 'attach_body', arguments: Object.assign({}, body, { initialState: init || body.initialState, hard: (body.hard || []).concat(hard || []) }) }));
  }
  async function run(goal, opts) {
    const raw = un(await m.call('tools/call', { name: 'execute_task', arguments: Object.assign({ goalSpec: goal }, opts || {}) }));
    const ex = raw.execution || raw;
    const plan = raw.plan;
    return { raw, ex, plan };
  }
  const planOk = r => !!(r.plan && r.plan.ok);
  const safeStopped = r => !!(r.ex && r.ex.ok === false && String(r.ex.haltReason || '').indexOf('SAFE-STOP') === 0);
  const noPlan = r => !planOk(r);

  // 通用：A 组（正常完成）
  async function scA(label, body, init, goal, hard) {
    await mount(body, init, hard);
    const r = await run(goal);
    const planStr = (r.plan && r.plan.plan) ? r.plan.plan.map(s => s.cap).join('›') : '(no-plan:' + (r.raw.error || r.raw.stage || '?') + ')';
    expect('A·' + label, planOk(r) && r.ex.ok && r.ex.goalSatisfied,
      'plan=' + planStr + ' final=' + JSON.stringify(r.ex.finalState));
  }
  // B 组（硬约束不可行 → 规划无解 或 SAFE-STOP）
  async function scB(label, body, init, goal, hard) {
    await mount(body, init, hard);
    const r = await run(goal);
    expect('B·' + label, noPlan(r) || safeStopped(r),
      noPlan(r) ? 'no-plan' : ('SAFE-STOP ' + (r.ex.haltReason || '')));
  }
  // C 组（非理想工况：打滑/偏差 → 重规划恢复；持续故障 → max-replans）
  // 单自由度打滑只差 1 个字段，故偏差容差设为 0，确保任何偏离都触发重规划（严格安全姿态）
  async function scC(label, body, init, goal, fault) {
    await mount(body, init);
    const r = await run(goal, { faults: fault, deviationTolerance: 0 });
    // 偏差导致重规划（replans>=1）后恢复，或持续故障达 max-replans 护栏
    expect('C·' + label, r.ex.replans >= 1 || safeStopped(r) || (r.ex.ok && r.ex.goalSatisfied),
      'replans=' + r.ex.replans + ' halt=' + (r.ex.haltReason || '—') + ' goalSatisfied=' + r.ex.goalSatisfied);
  }
  // D 组（环境动态改变：执行前出现新禁区 → 旧计划 SAFE-STOP）
  async function scD(label, body, init, goal, newHard) {
    await mount(body, init, newHard);
    const r = await run(goal);
    expect('D·' + label, safeStopped(r), 'halt=' + (r.ex.haltReason || '—'));
  }
  // E 组（逻辑/物理不可能：自相矛盾目标 → 规划无解）
  async function scE(label, body, init, goal) {
    await mount(body, init);
    const r = await run(goal);
    expect('E·' + label, noPlan(r), noPlan(r) ? 'no-plan' : ('unexpected ok=' + r.ex.ok));
  }

  // ════════ A 类：单轴/单自由度简单执行器 ════════
  say('⚙️', '═══ A类 单轴/单自由度执行器 ═══');
  await scA('舵机 转到 45°', SERVO, { angle: 0 }, { match: { angle: { min: 44.5, max: 45.5 } } });
  await scB('舵机 转到 95°(超物理极限)', SERVO, { angle: 0 }, { match: { angle: { min: 94, max: 96 } } });
  await scC('舵机 打滑(未达 45°)→重规划', SERVO, { angle: 0 }, { match: { angle: { min: 44.5, max: 45.5 } } }, { deviateAt: [{ step: 0, patch: { angle: 30 } }] });
  await scE('舵机 同时 45° 与 -45°(不可能)', SERVO, { angle: 0 }, { all: [{ match: { angle: { min: 44, max: 46 } } }, { match: { angle: { min: -46, max: -44 } } }] });

  await scA('步进丝杆 行程 120', STEPPER, { pos: 0, powered: true }, { match: { pos: { min: 119, max: 121 } } });
  await scB('步进丝杆 行程 210(超极限)', STEPPER, { pos: 0, powered: true }, { match: { pos: { min: 209, max: 211 } } });

  await scA('直流电机 转速 150', DCMOTOR, { rpm: 0 }, { match: { rpm: { min: 149, max: 151 } } });
  await scB('直流电机 转速 350(超极限)', DCMOTOR, { rpm: 0 }, { match: { rpm: { min: 349, max: 351 } } });

  await scA('电磁阀 打开', SOLENOID, { valve: false, pressure: 2 }, { match: { valve: true } });
  await scB('电磁阀 超压(>8)禁开', SOLENOID, { valve: false, pressure: 9 }, { match: { valve: true } });

  await scA('继电器 闭合', RELAY, { contact: false, load: 5 }, { match: { contact: true } });
  await scB('继电器 超触点容量(>10)禁合', RELAY, { contact: false, load: 11 }, { match: { contact: true } });

  await scA('线性推杆 伸出 60', ACTUATOR, { len: 0 }, { match: { len: { min: 59, max: 61 } } });
  await scB('线性推杆 伸出 110(超极限)', ACTUATOR, { len: 0 }, { match: { len: { min: 109, max: 111 } } });

  // ════════ B 类：多轴运动系统 ════════
  say('🦾', '═══ B类 多轴运动系统 ═══');
  await scA('机械臂 3轴到位', ARM3, { j1: 0, j2: 0, j3: 0 }, { match: { j1: { min: 29, max: 31 }, j2: { min: 39, max: 41 }, j3: { min: 49, max: 51 } } });
  await scB('机械臂 关节超极限', ARM3, { j1: 0, j2: 0, j3: 0 }, { match: { j1: { min: 179, max: 181 } } });
  await scC('机械臂 执行故障→max-replans', ARM3, { j1: 0, j2: 0, j3: 0 }, { match: { j1: { min: 29, max: 31 }, j2: { min: 39, max: 41 }, j3: { min: 49, max: 51 } } }, { failAt: [0, 1, 2, 3] });

  await scA('3D打印机 X/Y/Z 到位', PRINTER3, { x: 0, y: 0, z: 0 }, { match: { x: { min: 9, max: 11 }, y: { min: 19, max: 21 }, z: { min: 29, max: 31 } } });
  await scB('3D打印机 Z 超极限', PRINTER3, { x: 0, y: 0, z: 0 }, { match: { z: { min: 209, max: 211 } } });

  await scA('云台 pan/tilt', GIMBAL, { pan: 0, tilt: 0 }, { match: { pan: { min: 29, max: 31 }, tilt: { min: 14, max: 16 } } });
  await scB('云台 tilt 超极限', GIMBAL, { pan: 0, tilt: 0 }, { match: { tilt: { min: 49, max: 51 } } });

  // ════════ C 类：带力/力矩反馈 ════════
  say('💪', '═══ C类 力/力矩反馈系统 ═══');
  await scA('力控夹爪 3N 夹紧', GRIPPER, { force: 0, width: 0, object_detected: true }, { match: { force: { min: 2.9, max: 3.1 }, width: { min: 9, max: 11 } } });
  await scB('力控夹爪 10N(超上限)', GRIPPER, { force: 0, width: 0, object_detected: true }, { match: { force: { min: 9.9, max: 10.1 } } });
  // 物体未检测：grip 前置条件 object_detected:true 不满足 → 无法规划（安全拦截，不会盲抓）
  {
    await mount(GRIPPER, { force: 0, width: 0, object_detected: false });
    const r = await run({ match: { force: { min: 2.9, max: 3.1 } } });
    expect('C·力控夹爪 物体未检测→pre违反(安全拦截)', noPlan(r), noPlan(r) ? 'no-plan(不盲抓)' : ('unexpected ok=' + r.ex.ok));
  }
  await scC('力控夹爪 抓取力偏差→重规划', GRIPPER, { force: 0, width: 0, object_detected: true }, { match: { force: { min: 2.9, max: 3.1 } } }, { deviateAt: [{ step: 0, patch: { force: 1.5 } }] });

  await scA('扭矩扳手 25Nm', TORQUE, { torque: 0 }, { match: { torque: { min: 24.9, max: 25.1 } } });
  await scB('扭矩扳手 40Nm(超极限)', TORQUE, { torque: 0 }, { match: { torque: { min: 39.9, max: 40.1 } } });

  // ════════ D 类：移动系统 + E 类 障碍/人机安全 ════════
  say('🚗', '═══ D类 移动系统（差速/四轮/机械狗）+ 障碍/人机安全 ═══');
  // 差速小车：HOME→W1→W2→W3→BIN 有通路；OBST 为障碍物
  await scA('差速小车 HOME→BIN', DIFF, { node: 'HOME', battery: 90 }, { reach: 'BIN' });
  await scB('差速小车 目标在障碍 OBST(无解/拦截)', DIFF, { node: 'HOME', battery: 90 }, { reach: 'OBST' });
  await scD('差速小车 动态禁区 W1(路径上)→SAFE-STOP', DIFF, { node: 'HOME', battery: 90 }, { reach: 'BIN' }, ['W1']);
  await scC('差速小车 打滑→重规划', DIFF, { node: 'HOME', battery: 90 }, { reach: 'BIN' }, { deviateAt: [{ step: 0, patch: { node: 'HOME' } }] });
  await scE('差速小车 同时在 HOME 与 BIN(不可能)', DIFF, { node: 'HOME', battery: 90 }, { all: [{ reach: 'HOME' }, { reach: 'BIN' }] });

  await scA('四轮小车 HOME→BIN', WHEEL4, { node: 'HOME', battery: 90 }, { reach: 'BIN' });
  await scD('四轮小车 动态禁区 W1(路径上)', WHEEL4, { node: 'HOME', battery: 90 }, { reach: 'BIN' }, ['W1']);
  await scB('四轮小车 目标在障碍 OBST', WHEEL4, { node: 'HOME', battery: 90 }, { reach: 'OBST' });

  await scA('机械狗 HOME→BIN', DOG, { node: 'HOME', battery: 90 }, { reach: 'BIN' });
  await scD('机械狗 动态禁区 W1', DOG, { node: 'HOME', battery: 90 }, { reach: 'BIN' }, ['W1']);
  await scC('机械狗 执行故障→max-replans', DOG, { node: 'HOME', battery: 90 }, { reach: 'BIN' }, { failAt: [0, 1, 2, 3, 4] });

  // ════════ 无人机：连续 3D + 高度围栏 + 禁飞区 ════════
  say('🚁', '═══ 无人机悬停（连续 3D + 高度围栏）═══');
  await scA('无人机 飞到 (2,3,5)', DRONE, { x: 0, y: 0, z: 0, battery: 80 }, { match: { x: { min: 1.9, max: 2.1 }, y: { min: 2.9, max: 3.1 }, z: { min: 4.9, max: 5.1 } } });
  await scB('无人机 飞到负高度(违反 z>=0)', DRONE, { x: 0, y: 0, z: 0, battery: 80 }, { match: { z: { min: -1.1, max: -0.9 } } });
  await scB('无人机 超最大高度 60', DRONE, { x: 0, y: 0, z: 0, battery: 80 }, { match: { z: { min: 59, max: 61 } } });
  await scC('无人机 偏差(未达)→重规划', DRONE, { x: 0, y: 0, z: 0, battery: 80 }, { match: { z: { min: 4.9, max: 5.1 } } }, { deviateAt: [{ step: 0, patch: { z: 2 } }] });
  await scE('无人机 同时 z=5 与 z=-5(不可能)', DRONE, { x: 0, y: 0, z: 0, battery: 80 }, { all: [{ match: { z: { min: 4.9, max: 5.1 } } }, { match: { z: { min: -5.1, max: -4.9 } } }] });

  // ── 汇总 ──
  const pass = results.filter(r => r.pass).length;
  const fail = results.length - pass;
  console.log('\n\x1b[1m══════════════════════════════════════════════\x1b[0m');
  console.log('  \x1b[1m物理体全覆盖测试：PASS=' + pass + '  FAIL=' + fail + '  (共 ' + results.length + ' 项)\x1b[0m');
  console.log('\x1b[1m══════════════════════════════════════════════\x1b[0m');
  m.proc.kill();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });

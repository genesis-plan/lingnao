/*
 * 自动识类最小验证（零依赖，node 22 全局 WebSocket）
 * 跑法：先 `node lingnao-body-sim-server.js 8787`，再 `node test-classify.js`
 * 验证四类场景：标准 ws 身体 / 标准 OPC-UA 身体 / 裸 Modbus 寄存器 / 库外 CNC
 */
'use strict';
const Lib = require('./lingnao-body-library.js');

// 仿真 AGV 支持的能力（真实设备应从其信息模型自报；此处取自 sim WORLD 边）
const SIM_CAPS = ['step_CHARGE_A', 'step_A_B', 'step_A_CHARGE', 'step_B_C',
  'step_B_A', 'step_C_B', 'step_C_D', 'step_D_C'];

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')); }
}

async function main() {
  console.log('── 场景 A：仿真 AGV（ws 协议，自动发现状态+能力）──');
  let obsA;
  try {
    obsA = await Lib.discoverWs('ws://localhost:8787', { actions: SIM_CAPS });
    console.log('    discovered variables =', JSON.stringify(obsA.variables), ' actions =', obsA.actions.length);
  } catch (e) {
    console.log('    ! ws 发现失败：' + e.message + '（先起 sim server？）');
  }
  if (obsA) {
    const rA = Lib.classify(obsA);
    console.log('    classify →', JSON.stringify({ best: rA.best && rA.best.id, confidence: rA.confidence, residual: rA.residual, needsAnchor: rA.needsAnchor }));
    check('A 自动识类为 AGV', rA.matched && rA.best.id === 'agv.planar.se2');
    check('A 置信度高(≥0.8)', rA.confidence >= 0.8, 'conf=' + rA.confidence);
  }

  console.log('── 场景 B：标准 OPC-UA AGV（语义标签 x/y/theta/battery + moveTo）──');
  const obsB = {
    variables: { x: 'number', y: 'number', theta: 'number', battery: 'number' },
    actions: ['moveTo', 'moveCancel']
  };
  const rB = Lib.classify(obsB);
  console.log('    classify →', JSON.stringify({ best: rB.best && rB.best.id, confidence: rB.confidence, residual: rB.residual }));
  check('B 自动识类为 AGV', rB.matched && rB.best.id === 'agv.planar.se2');

  console.log('── 场景 C：裸 Modbus 寄存器（40001..40004 无语义标签）→ 诚实边界 ──');
  const obsC = {
    variables: { holding_40001: 'number', holding_40002: 'number', holding_40003: 'number', holding_40004: 'number' },
    actions: ['coil_00001']   // 仅一个"使能"线圈，无 step_*/move* 语义
  };
  const rC = Lib.classify(obsC);
  console.log('    classify →', JSON.stringify({ best: rC.best && rC.best.id, needsAnchor: rC.needsAnchor, note: rC.note }));
  check('C 不匹配（需人锚/另分析）', !rC.matched && rC.needsAnchor);

  console.log('── 场景 D：数控机床 CNC（x/y/z/spindle/feed + gcode/jog，已在有限目录）→ 自动识类 ──');
  const obsD = {
    variables: { x: 'number', y: 'number', z: 'number', spindle: 'number', feed: 'number', mode: 'string' },
    actions: ['gcode_run', 'jog']
  };
  const rD = Lib.classify(obsD);
  console.log('    classify →', JSON.stringify({ best: rD.best && rD.best.id, confidence: rD.confidence, residual: rD.residual }));
  check('D 自动识类为 CNC', rD.matched && rD.best.id === 'machine.cnc', 'conf=' + rD.confidence);

  console.log('── 场景 E：国内智能电表（DL/T 645 语义 voltage/current/energy）→ 自动识类 ──');
  const obsE = {
    variables: { voltage: 'number', current: 'number', energy: 'number' },
    actions: []
  };
  const rE = Lib.classify(obsE);
  console.log('    classify →', JSON.stringify({ best: rE.best && rE.best.id, confidence: rE.confidence }));
  check('E 自动识类为智能电表 meter.electric（国内 DL/T 645 已建档）', rE.matched && rE.best.id === 'meter.electric', 'conf=' + rE.confidence);

  console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

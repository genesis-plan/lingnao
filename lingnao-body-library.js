/*
 * 灵脑 LingNao · 物理身体规范模型库 + 自动识类（有限目录，零依赖）
 * ────────────────────────────────────────────────────────────
 * 设计原则（用户拍板 2026-09-02）：
 *   ① 标准协议与常见机器类是【有限集、可外部取证】——OPC-UA Companion
 *      Spec(VDMA Robotics)、MTConnect、标准 ROS 消息、厂家 AAS 文件都是
 *      标准组织/厂家公开发布的。所以本库是【从标准文档人工建档的有限目录】，
 *      不是让 AI 去泛化。加一张卡 = 加一类。
 *   ② 灵脑【主动适应厂家协议】，不让厂家改机器迁就灵脑。协议驱动内置。
 *   ③ 【自动识类】：设备暴露的信息模型（变量名+能力名+状态空间结构）与
 *      规范库逐张比对，最佳匹配 = 类；残差超阈 → 报 needsAnchor（覆盖不到，
 *      走"另分析"通道：人锚 1 个语义槽 / 导入厂家 AAS / 补规范卡）。
 *   ④ 拓扑不变核心：同类机械状态空间同胚（AGV≈SE(2)、臂≈T⁶ 环面），
 *      障碍补集连通分支(Betti 数)是规划不变量——匹配比的是结构，不是字节。
 *
 * 诚实边界（写进对外口径）：
 *   ⚠ 同类才有规律：AGV 的 φ 不能套机械臂，异类必须补规范模型。
 *   ⚠ 语义锚点至少 1 个：封闭私有协议（裸寄存器 40001 无标签）自动匹配不上，
 *     必须人锚或导入厂家文件；这是物理上绕不过的，不是灵脑偷懒。
 *   ⚠ 自动标定是"尽力而为"：观测不足/噪声大时 φ 可能错，残差超阈报 𝕌(不确定就停)。
 *
 * 当前目录（有限、可建档）：AGV·AMR / 无人机 / 六轴臂·SCARA / CNC·包装机·输送线 / 传感器·PLC。
 *   加一张卡 = 加一类；OPC-UA Companion Spec / MTConnect / IO-Link / IEC 61131 均可取证建档。
 * 协议驱动：ws 已实装摄入；modbus-tcp / mqtt 真实驱动见 lingnao-link-layer.js(零依赖)；
 *   opc-ua 仍待补真实驱动。链路介质(无线/有线)见 lingnao-link-layer.js LINK_MEDIA。
 */
(function (root) {
  'use strict';

  // ── 有限规范模型库（CANONICAL_MODELS）─────────────────────────────
  // 每张卡 = 一类机械的"签名"：必含语义槽(变量名提示) + 状态空间群 + 能力模式
  // required: { any:[slotKeys] } 满足其一即算具备该关键表征；{ all:[...] } 需全满足
  var CANONICAL_MODELS = [
    {
      id: 'agv.planar.se2',
      label: '平面移动 AGV / AMR（SE(2)）',
      source: 'OPC-UA Robotics Companion Spec / MTConnect 搬运设备（归纳建档）',
      stateSpace: {
        group: 'SE(2)',
        required: { any: ['location', 'x'] },   // 有离散节点位 或 连续 x 即算具备位置表征
        slots: {
          location: { type: ['string', 'number'], unit: 'node|m', role: 'position',
            hints: ['location', 'loc', 'node', 'site', 'wp', 'waypoint', 'station', 'pose'] },
          x: { type: ['number'], unit: 'm', role: 'position',
            hints: ['x', 'pos_x', 'px', 'east', 'coord_x', 'pose_x'] },
          y: { type: ['number'], unit: 'm', role: 'position',
            hints: ['y', 'pos_y', 'py', 'north', 'coord_y', 'pose_y'] },
          theta: { type: ['number'], unit: 'rad', role: 'heading',
            hints: ['theta', 'heading', 'yaw', 'angle', 'phi', 'orient'] },
          battery: { type: ['number'], unit: '%', role: 'energy',
            hints: ['battery', 'bat', 'power', 'charge'] },
          target: { type: ['string', 'number'], unit: 'node|m', role: 'goal',
            hints: ['target', 'goal', 'dest', 'setpoint'] }
        }
      },
      topology: { kind: 'graph', invariant: { connectedComponents: '>=1' },
        note: '障碍补集连通分支=Betti数，规划不变量' },
      interfaces: ['opc-ua', 'modbus-tcp', 'mqtt', 'ros', 'ws'],
      capabilities: [
        { pattern: '^step_(\\w+)_(\\w+)$', semantics: 'move(from,to)', argsFrom: [1, 2] },
        { pattern: '^move', semantics: 'moveTo(goal)' }
      ]
    },
    {
      id: 'uav.multirotor',
      label: '多旋翼无人机 / 无人器（SE(3) 位姿）',
      source: 'MAVLink / OPC-UA Robotics（归纳建档）',
      stateSpace: {
        group: 'SE(3)',
        required: { any: ['lat', 'alt'] },
        slots: {
          lat: { type: ['number'], unit: 'deg', role: 'position', hints: ['lat', 'latitude'] },
          lon: { type: ['number'], unit: 'deg', role: 'position', hints: ['lon', 'lng', 'longitude'] },
          alt: { type: ['number'], unit: 'm', role: 'position', hints: ['alt', 'altitude', 'height'] },
          battery: { type: ['number'], unit: '%', role: 'energy', hints: ['battery', 'bat'] },
          armed: { type: ['boolean', 'number'], unit: 'flag', role: 'safety', hints: ['armed', 'enable'] }
        }
      },
      topology: { kind: 'manifold', invariant: { dimension: 6 }, note: '三维位姿+姿态，自由飞行流形' },
      interfaces: ['mqtt', 'opc-ua', 'ros', 'ws'],
      capabilities: [
        { pattern: '^takeoff', semantics: 'takeoff' },
        { pattern: '^land', semantics: 'land' },
        { pattern: '^goto', semantics: 'gotoWaypoint' }
      ]
    },
    {
      id: 'arm.6dof',
      label: '六自由度机械臂 / 协作臂（关节 T⁶ 环面）',
      source: 'OPC-UA Robotics Companion Spec / ROS sensor_msgs-JointState（归纳建档）',
      stateSpace: {
        group: 'T^6 (torus)',
        required: { any: ['j1'] },
        slots: {
          j1: { type: ['number'], unit: 'rad', role: 'joint', hints: ['j1', 'joint1', 'q1', 'axis1', 'servo1'] },
          j2: { type: ['number'], unit: 'rad', role: 'joint', hints: ['j2', 'joint2', 'q2', 'axis2', 'servo2'] },
          j3: { type: ['number'], unit: 'rad', role: 'joint', hints: ['j3', 'joint3', 'q3', 'axis3', 'servo3'] },
          j4: { type: ['number'], unit: 'rad', role: 'joint', hints: ['j4', 'joint4', 'q4', 'axis4', 'servo4'] },
          j5: { type: ['number'], unit: 'rad', role: 'joint', hints: ['j5', 'joint5', 'q5', 'axis5', 'servo5'] },
          j6: { type: ['number'], unit: 'rad', role: 'joint', hints: ['j6', 'joint6', 'q6', 'axis6', 'servo6'] },
          torque: { type: ['number'], unit: 'Nm', role: 'safety', hints: ['torque', 'effort', 'ft'] }
        }
      },
      topology: { kind: 'torus', invariant: { dimension: 6 }, note: '关节空间 = 6 个 S¹ 的直积' },
      interfaces: ['opc-ua', 'ethercat', 'profinet', 'ros', 'modbus-tcp'],
      capabilities: [
        { pattern: '^move_joint', semantics: 'setJointAngles' },
        { pattern: '^move_cart', semantics: 'setCartesianPose' }
      ]
    },
    {
      id: 'arm.scara',
      label: 'SCARA 机械臂（平面 2 旋转 + 1 升降）',
      source: 'OPC-UA Robotics Companion Spec（归纳建档）',
      stateSpace: {
        group: 'S^1 × S^1 × ℝ',
        required: { any: ['theta1'] },
        slots: {
          theta1: { type: ['number'], unit: 'rad', role: 'joint', hints: ['theta1', 'th1', 'j1'] },
          theta2: { type: ['number'], unit: 'rad', role: 'joint', hints: ['theta2', 'th2', 'j2'] },
          z: { type: ['number'], unit: 'm', role: 'joint', hints: ['z', 'lift', 'height'] }
        }
      },
      topology: { kind: 'torus+line', invariant: { dimension: 3 }, note: '两旋转关节 + 1 升降' },
      interfaces: ['opc-ua', 'ethercat', 'ros', 'modbus-tcp'],
      capabilities: [ { pattern: '^move_joint', semantics: 'setJointAngles' } ]
    },
    {
      id: 'machine.cnc',
      label: '数控机床 CNC（X/Y/Z + 主轴）',
      source: 'MTConnect / OPC-UA Machine Tool（归纳建档）',
      stateSpace: {
        group: 'ℝ³ × S¹',
        required: { any: ['x', 'z'] },
        slots: {
          x: { type: ['number'], unit: 'mm', role: 'position', hints: ['x', 'pos_x', 'axis_x'] },
          y: { type: ['number'], unit: 'mm', role: 'position', hints: ['y', 'pos_y', 'axis_y'] },
          z: { type: ['number'], unit: 'mm', role: 'position', hints: ['z', 'pos_z', 'axis_z'] },
          spindle: { type: ['number'], unit: 'rpm', role: 'actuator', hints: ['spindle', 'rpm', 's'] },
          feed: { type: ['number'], unit: 'mm/min', role: 'actuator', hints: ['feed', 'feedrate', 'f'] },
          mode: { type: ['string'], unit: 'enum', role: 'state', hints: ['mode', 'state', 'status', 'exec'] }
        }
      },
      topology: { kind: 'box', invariant: { dimension: 3 }, note: '笛卡尔加工空间' },
      interfaces: ['opc-ua', 'modbus-tcp', 'mtconnect', 'ethernet-ip'],
      capabilities: [
        { pattern: '^gcode', semantics: 'runGcode' },
        { pattern: '^jog', semantics: 'jogAxis' }
      ]
    },
    {
      id: 'machine.packml',
      label: '包装机 / 产线主机（PackML 状态机）',
      source: 'OPC-UA PackML Companion Spec（归纳建档）',
      stateSpace: {
        group: 'FSM',
        required: { any: ['state'] },
        slots: {
          state: { type: ['string'], unit: 'enum', role: 'state', hints: ['state', 'status', 'mode', 'packml'] },
          cmd: { type: ['string'], unit: 'enum', role: 'command', hints: ['cmd', 'command', 'order'] },
          count: { type: ['number'], unit: 'pcs', role: 'counter', hints: ['count', 'total', 'produced'] }
        }
      },
      topology: { kind: 'fsm', invariant: { states: ['idle', 'running', 'held', 'complete', 'aborted', 'stopped'] }, note: 'PackML 16 态化简版' },
      interfaces: ['opc-ua', 'modbus-tcp', 'ethernet-ip', 'profinet'],
      capabilities: [
        { pattern: '^start', semantics: 'start' },
        { pattern: '^stop', semantics: 'stop' },
        { pattern: '^reset', semantics: 'reset' }
      ]
    },
    {
      id: 'machine.conveyor',
      label: '输送线 / 传送带（一维运动）',
      source: 'OPC-UA / 常见 PLC 输送设备（归纳建档）',
      stateSpace: {
        group: 'ℝ',
        required: { any: ['speed', 'running'] },
        slots: {
          speed: { type: ['number'], unit: 'm/s', role: 'actuator', hints: ['speed', 'vel', 'rpm', 'hz'] },
          running: { type: ['boolean', 'number'], unit: 'flag', role: 'state', hints: ['running', 'run', 'on', 'active', 'enable'] },
          fault: { type: ['boolean', 'number'], unit: 'flag', role: 'safety', hints: ['fault', 'alarm', 'err', 'error'] }
        }
      },
      topology: { kind: 'line', invariant: { dimension: 1 }, note: '一维传送' },
      interfaces: ['modbus-tcp', 'opc-ua', 'profinet', 'ethernet-ip'],
      capabilities: [
        { pattern: '^start', semantics: 'start' },
        { pattern: '^stop', semantics: 'stop' }
      ]
    },
    {
      id: 'sensor.iot',
      label: '工业传感器 / 仪表（IoT，低维标量）',
      source: 'IO-Link / Modbus 仪表 / OPC-UA（归纳建档）',
      stateSpace: {
        group: 'ℝᵏ',
        required: { any: ['temp', 'humi', 'pressure', 'occupancy', 'illuminance'] },
        slots: {
          temp: { type: ['number'], unit: '°C', role: 'measure', hints: ['temp', 'temperature', 't'] },
          humi: { type: ['number'], unit: '%', role: 'measure', hints: ['humi', 'humidity'] },
          pressure: { type: ['number'], unit: 'Pa', role: 'measure', hints: ['pressure', 'pres', 'p'] },
          occupancy: { type: ['number', 'boolean'], unit: '%', role: 'measure', hints: ['occupancy', 'presence', 'motion', 'pir'] },
          illuminance: { type: ['number'], unit: 'lux', role: 'measure', hints: ['illuminance', 'lux', 'light_level'] },
          status: { type: ['number', 'string'], unit: 'enum', role: 'state', hints: ['status', 'state', 'quality'] }
        }
      },
      topology: { kind: 'point', invariant: { dimension: 0 }, note: '无运动自由度，纯测量点' },
      interfaces: ['modbus-tcp', 'opc-ua', 'iolink', 'pa-dim', 'mqtt', 'profibus', 'ethernet-ip', 'ethercat', 'matter', 'zigbee', 'thread'],
      capabilities: []
    },
    {
      id: 'plc',
      label: '可编程控制器 PLC（I/O 基座）',
      source: 'IEC 61131-3 / OPC-UA（归纳建档）',
      stateSpace: {
        group: 'ℝᵏ',
        required: { any: ['di', 'do', 'ai', 'ao'] },
        slots: {
          di: { type: ['boolean', 'number'], unit: 'bit', role: 'io', hints: ['di', 'din', 'input', 'gpi'] },
          do: { type: ['boolean', 'number'], unit: 'bit', role: 'io', hints: ['do', 'dout', 'output', 'gpo'] },
          ai: { type: ['number'], unit: 'raw', role: 'io', hints: ['ai', 'ain', 'adc'] },
          ao: { type: ['number'], unit: 'raw', role: 'io', hints: ['ao', 'aout', 'dac'] }
        }
      },
      topology: { kind: 'point', invariant: { dimension: 0 }, note: '离散/模拟 I/O 集合，非运动体' },
      interfaces: ['opc-ua', 'modbus-tcp', 'profinet', 'ethernet-ip', 'ethercat',
        'profibus', 'canopen', 'iolink', 'iec61131', 'codesys'],
      capabilities: []
    },

    // ── 通用工业设备类：电机 / 变频 / 伺服驱动（国际通用，PROFIdrive / CiA 402）──
    {
      id: 'drive.motor',
      label: '电机 / 变频器 / 伺服驱动（PROFIdrive / CiA 402）',
      source: 'PROFIdrive(PI) / CiA 402(CAN in Automation) / OPC-UA Motion(OPC 30060 SERCOS)',
      stateSpace: {
        group: 'ℝᵏ',
        required: { any: ['speed', 'torque', 'current', 'freq'] },
        slots: {
          speed: { type: ['number'], unit: 'rpm', role: 'actuator', hints: ['speed', 'rpm', 'spd', 'motor_speed', 'drv_speed', 'actual_speed'] },
          torque: { type: ['number'], unit: 'Nm', role: 'actuator', hints: ['torque', 'motor_torque', 'drv_torque', 'tq'] },
          current: { type: ['number'], unit: 'A', role: 'measure', hints: ['current', 'i', 'amp', 'motor_i', 'drv_current'] },
          voltage: { type: ['number'], unit: 'V', role: 'measure', hints: ['voltage', 'u', 'volt', 'motor_u', 'drv_voltage'] },
          freq: { type: ['number'], unit: 'Hz', role: 'actuator', hints: ['freq', 'frequency', 'hz', 'motor_freq'] },
          position: { type: ['number'], unit: 'rad', role: 'actuator', hints: ['motor_pos', 'actual_pos', 'encoder', 'shaft_pos'] },
          temperature: { type: ['number'], unit: '°C', role: 'measure', hints: ['temp', 'temperature', 'motor_temp', 't'] },
          status: { type: ['number', 'string'], unit: 'enum', role: 'state', hints: ['stw', 'zsw', 'drive_state', 'fault_code'] }
        }
      },
      topology: { kind: 'point', invariant: { dimension: 0 }, note: '驱动体：电→机能量变换，非空间运动体；状态=电/机量' },
      interfaces: ['profidrive', 'cia402', 'profinet', 'ethercat', 'canopen', 'profibus', 'modbus-tcp', 'opc-ua-motion', 'opc-ua'],
      capabilities: [
        { pattern: '^start', semantics: 'start' },
        { pattern: '^stop', semantics: 'stop' },
        { pattern: '^set_speed', semantics: 'setSpeed' },
        { pattern: '^set_torque', semantics: 'setTorque' },
        { pattern: '^reset', semantics: 'resetFault' },
        { pattern: '^jog', semantics: 'jog' }
      ]
    },

    // ── 国内特色设备类（国际标准库无，国内通用）────────────────────
    {
      id: 'meter.electric',
      label: '智能电表 / 电能计量（DL/T 645）',
      source: 'DL/T 645-2007 多功能电能表通信协议（电力行业，国内通用；RS-485/红外/载波）',
      stateSpace: {
        group: 'ℝᵏ',
        required: { any: ['voltage', 'current', 'active_power', 'energy'] },
        slots: {
          voltage: { type: ['number'], unit: 'V', role: 'measure', hints: ['voltage', 'u', 'volt', 'ua'] },
          current: { type: ['number'], unit: 'A', role: 'measure', hints: ['current', 'i', 'amp', 'ia'] },
          active_power: { type: ['number'], unit: 'kW', role: 'measure', hints: ['active_power', 'p', 'power', 'kw', 'pactive'] },
          energy: { type: ['number'], unit: 'kWh', role: 'measure', hints: ['energy', 'kwh', 'wh', 'ep', 'active_energy'] },
          meter_no: { type: ['string', 'number'], unit: 'id', role: 'identity', hints: ['meter_no', 'no', 'addr', 'address', 'asset'] }
        }
      },
      topology: { kind: 'point', invariant: { dimension: 0 }, note: '计量点，无运动自由度' },
      interfaces: ['dl645', 'mbus', 'modbus-tcp', 'opc-ua'],
      capabilities: []
    },
    {
      id: 'meter.utility',
      label: '水表 / 燃气表 / 热量表（CJ/T 188）',
      source: 'CJ/T 188-2018 户用计量仪表数据传输技术条件（住建部，国内通用；RS-485/微功率无线/M-Bus）',
      stateSpace: {
        group: 'ℝᵏ',
        required: { any: ['meter_no', 'volume'] },
        slots: {
          meter_no: { type: ['string'], unit: 'id', role: 'identity', hints: ['meter_no', 'no', 'address', 'id', 'meterid'] },
          volume: { type: ['number'], unit: 'm³', role: 'measure', hints: ['volume', 'flow', 'reading', 'value', 'cumulant'] },
          status: { type: ['number', 'string'], unit: 'enum', role: 'state', hints: ['status', 'state', 'valve'] }
        }
      },
      topology: { kind: 'point', invariant: { dimension: 0 }, note: '户用计量点' },
      interfaces: ['cjt188', 'mbus', 'modbus-tcp'],
      capabilities: []
    },
    {
      id: 'ev.charger',
      label: '电动汽车充电桩 / 充电机（GB/T 27930）',
      source: 'GB/T 27930-2023 非车载传导式充电机与电动汽车数字通信协议（基于 CAN 2.0B 250kbps）',
      stateSpace: {
        group: 'ℝᵏ',
        required: { any: ['charge_voltage', 'charge_current', 'bms_soc'] },
        slots: {
          charge_voltage: { type: ['number'], unit: 'V', role: 'actuator', hints: ['charge_voltage', 'voltage', 'u', 'volt'] },
          charge_current: { type: ['number'], unit: 'A', role: 'actuator', hints: ['charge_current', 'current', 'i', 'amp'] },
          bms_soc: { type: ['number'], unit: '%', role: 'energy', hints: ['bms_soc', 'batterysoc'] },
          charge_state: { type: ['string', 'number'], unit: 'enum', role: 'state', hints: ['charge_state', 'chg_state', 'cstate', 'phase'] }
        }
      },
      topology: { kind: 'fsm', invariant: { states: ['handshake', 'config', 'charging', 'stopped'] }, note: '充电流程状态机（BMS 主导）' },
      interfaces: ['gb-charge', 'can', 'modbus-tcp'],
      capabilities: [
        { pattern: '^start_charge', semantics: 'startCharge' },
          { pattern: '^stop_charge', semantics: 'stopCharge' }
      ]
    },

    // ── 消费智能设备类（Matter / Zigbee 灯/插座/锁/温控；开放标准，归纳建档）──
    {
      id: 'consumer.light',
      label: '智能灯 / 智能开关（Matter / Zigbee 灯类）',
      source: 'Matter Device Library 0x0100/0x0101/0x010C/0x010D（CSA）；Zigbee Lighting（归纳建档）',
      stateSpace: {
        group: 'FSM×ℝ',
        required: { any: ['onoff'] },
        slots: {
          onoff: { type: ['boolean', 'number'], unit: 'flag', role: 'actuator', hints: ['onoff', 'on_off', 'switch', 'light_on', 'light_state', 'power_state'] },
          brightness: { type: ['number'], unit: '%', role: 'actuator', hints: ['brightness', 'level', 'dim', 'currentlevel'] },
          color_temp: { type: ['number'], unit: 'K', role: 'actuator', hints: ['color_temp', 'colortemp', 'ct', 'cct'] },
          hue: { type: ['number'], unit: '°', role: 'actuator', hints: ['hue', 'h'] },
          saturation: { type: ['number'], unit: '%', role: 'actuator', hints: ['sat', 'saturation', 's'] }
        }
      },
      topology: { kind: 'fsm', invariant: { states: ['off', 'on'] }, note: '开关 + 连续调光/调色' },
      interfaces: ['matter', 'zigbee', 'thread', 'mqtt', 'ws'],
      capabilities: [
        { pattern: '^turn_on', semantics: 'turnOn' },
        { pattern: '^turn_off', semantics: 'turnOff' },
        { pattern: '^set_brightness', semantics: 'setBrightness' },
        { pattern: '^set_color', semantics: 'setColor' }
      ]
    },
    {
      id: 'consumer.plug',
      label: '智能插座 / 智能开关（Matter / Zigbee 插座类）',
      source: 'Matter Device Library 0x010A/0x010B（CSA）；Zigbee On/Off Output（归纳建档）',
      stateSpace: {
        group: 'FSM×ℝ',
        required: { any: ['onoff', 'power'] },
        slots: {
          onoff: { type: ['boolean', 'number'], unit: 'flag', role: 'actuator', hints: ['onoff', 'on_off', 'plug_state', 'outlet_state'] },
          power: { type: ['number'], unit: 'W', role: 'measure', hints: ['power', 'active_power', 'p_active', 'watts', 'load'] },
          energy: { type: ['number'], unit: 'kWh', role: 'measure', hints: ['energy', 'kwh', 'accum', 'consumption'] }
        }
      },
      topology: { kind: 'fsm', invariant: { states: ['off', 'on'] }, note: '通断 + 功耗计量' },
      interfaces: ['matter', 'zigbee', 'thread', 'mqtt', 'ws'],
      capabilities: [
        { pattern: '^turn_on', semantics: 'turnOn' },
        { pattern: '^turn_off', semantics: 'turnOff' }
      ]
    },
    {
      id: 'consumer.lock',
      label: '智能门锁 / 门禁（Matter / Zigbee 门锁类）',
      source: 'Matter Device Type 0x000A Door Lock（CSA）；Zigbee Door Lock 0x0101（归纳建档）',
      stateSpace: {
        group: 'FSM',
        required: { any: ['lock_state'] },
        slots: {
          lock_state: { type: ['boolean', 'string', 'number'], unit: 'enum', role: 'state', hints: ['lock_state', 'lockstate', 'locked', 'bolt', 'door_lock', 'latch'] },
          lock_action: { type: ['string'], unit: 'enum', role: 'command', hints: ['lock_action', 'lock_cmd', 'lockcommand'] }
        }
      },
      topology: { kind: 'fsm', invariant: { states: ['locked', 'unlocked', 'jammed', 'unknown'] }, note: '门锁状态机（安全敏感）' },
      interfaces: ['matter', 'zigbee', 'thread', 'mqtt', 'ws'],
      capabilities: [
        { pattern: '^lock', semantics: 'lock' },
        { pattern: '^unlock', semantics: 'unlock' }
      ]
    },
    {
      id: 'consumer.thermostat',
      label: '智能温控器 / 暖通（Matter / Zigbee HVAC）',
      source: 'Matter Device Type 0x0301 Thermostat（CSA）；Zigbee HVAC（归纳建档）',
      stateSpace: {
        group: 'FSM×ℝ',
        required: { any: ['current_temp', 'target_temp'] },
        slots: {
          current_temp: { type: ['number'], unit: '°C', role: 'measure', hints: ['current_temp', 'currenttemp', 'room_temp', 'indoor_temp', 'local_temp'] },
          target_temp: { type: ['number'], unit: '°C', role: 'actuator', hints: ['target_temp', 'setpoint_temp', 'targettemp', 'heating_setpoint', 'cooling_setpoint'] },
          mode: { type: ['string', 'number'], unit: 'enum', role: 'state', hints: ['hvac_mode', 'thermostat_mode', 'system_mode', 'mode'] },
          humidity: { type: ['number'], unit: '%', role: 'measure', hints: ['humi', 'humidity', 'rh'] }
        }
      },
      topology: { kind: 'fsm', invariant: { states: ['heat', 'cool', 'auto', 'off'] }, note: '温控 FSM + 连续设定点' },
      interfaces: ['matter', 'zigbee', 'thread', 'modbus-tcp', 'mqtt', 'ws'],
      capabilities: [
        { pattern: '^set_temp', semantics: 'setTemperature' },
        { pattern: '^set_mode', semantics: 'setMode' }
      ]
    }
  ];

  // ── 协议登记表（内置驱动；真实驱动在 lingnao-link-layer.js 零依赖实装）──
  // discover(url, opts) → Promise<{protocol, variables:{name:type}, actions:[], sample}>
  // 介质（无线/有线）见 lingnao-link-layer.js LINK_MEDIA：协议与介质正交，
  // 同一协议（ws/MQTT）既可有线也可无线跑；介质只影响时延丢包→喂 SAFE-STOP。
  var PROTOCOLS = {
    'ws': { label: 'WebSocket（灵脑 body 协议）', defaultPort: 8787, discover: discoverWs,
      supported: true, medium: 'agnostic', note: '浏览器可直连；无线 WiFi / 有线以太网均可' },
    'modbus-tcp': { label: 'Modbus-TCP', defaultPort: 502, discover: null,
      supported: true, medium: 'wired',
      driver: 'LingNaoLinkLayer.ModbusTcpClient', note: '真实驱动已实装（读/写保持寄存器+线圈）；Node 侧跑，浏览器经桥' },
    'mqtt': { label: 'MQTT', defaultPort: 1883, discover: null,
      supported: true, medium: 'wireless',
      driver: 'LingNaoLinkLayer.MqttClient', note: '真实驱动已实装（3.1.1 connect/subscribe/publish）；无线 IoT 主流' },
    'opc-ua': { label: 'OPC-UA', defaultPort: 4840, discover: null,
      supported: false, medium: 'wired', note: '发现流程：遍历地址空间节点 + 读数据类型；真实驱动待补' },

    // ── 国内通用协议 / 标准（GB 国标、DL/T 电力行标、CJ/T 住建行标）──
    // 自主国产：EPA(GB/T 20171, IEC 61158 Type14)、NCUC-Bus(国产数控总线)、
    //   WIA-PA(GB/T 26790 工业无线)；国标等同/修改采用国际：GB/T 19582(Modbus)等。
    // 国内特色计量/充电：DL/T 645(电表)、CJ/T 188(水气热表)、M-Bus(多表合一)、
    //   GB/T 27930(充电桩↔BMS, CAN 2.0B)。真实驱动均需硬件，本机 only 建档/导入。
    'epa': { label: 'EPA 实时以太网（国产自主，GB/T 20171 / IEC 61158 Type 14）', defaultPort: 502,
      discover: null, supported: false, medium: 'wired',
      note: '国产自主总线；真实驱动需 EPA 网卡硬件，待补' },
    'ncuc': { label: 'NCUC-Bus 数控总线（国产自主）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired',
      note: '国产数控机床总线；真实驱动待补' },
    'wia-pa': { label: 'WIA-PA 工业无线（GB/T 26790，国产自主）', defaultPort: 0,
      discover: null, supported: false, medium: 'wireless',
      note: '国产工业无线网络；真实驱动待补' },
    'dl645': { label: 'DL/T 645 多功能电能表通信协议（国内通用，RS-485/红外/载波）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired',
      note: '68H 帧 + 数据域+33H 编码；帧解析见访问引擎 decodeDL645，真实驱动待补' },
    'cjt188': { label: 'CJ/T 188 户用计量仪表（水/气/热表，国内通用）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired',
      note: '主从帧；帧解析见访问引擎 decodeCJT188，真实驱动待补' },
    'mbus': { label: 'M-Bus 仪表总线（多表合一采集）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired',
      note: '水电气热四表合一采集总线；真实驱动待补' },
    'gb-charge': { label: 'GB/T 27930 充电通信（充电桩↔BMS，CAN 2.0B 250kbps）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired',
      note: '基于 CAN 的充电流程；真实驱动需 CAN 硬件，待补' },
    'can': { label: 'CAN / CANopen（现场总线基类）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired', note: '现场总线基类；真实驱动待补' },

    // ── 通用工业协议 / 标准（国际，PLC / 电机 / 传感器；均经核实，驱动待补）──
    // 实时以太网：PROFINET(IEC 61158 Type10, PI) / EtherCAT(IEC 61158 Type12, ETG) / EtherNet/IP(ODVA, CIP)
    // 现场总线：PROFIBUS DP(IEC 61158 Type3, PI) / CANopen(CiA 301, CAN in Automation)
    // 智能传感器/执行器：IO-Link(IEC 61131-9, PI: SDCI 点对点, IODD 描述)
    // 驱动行规：PROFIdrive(PI, 跑在 PROFINET/PROFIBUS) / CiA 402(CAN in Automation, 跑在 CANopen/EtherCAT)
    // 过程语义：PA-DIM(OPC 30081, 协议无关设备信息模型) / OPC-UA Motion(OPC 30060 SERCOS)
    // PLC 标准：IEC 61131-3(编程模型) / IEC 61499(分布式) / CODESYS(跨厂家运行时，事实标准非 ISO)
    'profinet': { label: 'PROFINET IO（IEC 61158 Type 10，PI）', defaultPort: 502,
      discover: null, supported: false, medium: 'wired', note: '工业以太网；PROFIdrive 跑其上；真实驱动待补' },
    'ethercat': { label: 'EtherCAT（IEC 61158 Type 12，ETG）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired', note: '实时以太网；CiA 402 跑其上；真实驱动待补' },
    'ethernet-ip': { label: 'EtherNet/IP（ODVA，CIP）', defaultPort: 44818,
      discover: null, supported: false, medium: 'wired', note: '工业以太网；罗克韦尔系；真实驱动待补' },
    'profibus': { label: 'PROFIBUS DP（IEC 61158 Type 3，PI）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired', note: '现场总线；PROFIdrive 跑其上；真实驱动待补' },
    'canopen': { label: 'CANopen（CiA 301，CAN in Automation）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired', note: '基于 CAN 的现场总线；CiA 402 跑其上；真实驱动待补' },
    'iolink': { label: 'IO-Link（IEC 61131-9，PI：SDCI 点对点）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired', note: '智能传感器/执行器；3 线点对点；IODD 描述；真实驱动待补' },
    'profidrive': { label: 'PROFIdrive 驱动行规（PI，跑在 PROFINET/PROFIBUS 上）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired', note: '变频/伺服行规；Telegram 1/352；状态机见访问引擎 decodeProfidrive' },
    'cia402': { label: 'CiA 402 驱动行规（CAN in Automation，跑在 CANopen/EtherCAT 上）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired', note: '伺服/变频行规；状态机见访问引擎 decodeCia402Status' },
    'pa-dim': { label: 'PA-DIM 过程自动化设备信息模型（OPC 30081）', defaultPort: 0,
      discover: null, supported: false, medium: 'wired', note: '协议无关语义模型（温度/压力/流量/液位/阀位）；真实驱动待补' },
    'opc-ua-motion': { label: 'OPC-UA for Motion（OPC 30060 SERCOS）', defaultPort: 4840,
      discover: null, supported: false, medium: 'wired', note: '运动控制语义；真实驱动待补' },
    'iec61131': { label: 'IEC 61131-3 PLC 编程模型（语义底座，非传输协议）', defaultPort: 0,
      discover: null, supported: false, medium: 'n/a', note: 'PLC 标准；与 CODESYS 运行时/各厂家 PLC 对接' },
    'iec61499': { label: 'IEC 61499 分布式 PLC（事件驱动）', defaultPort: 0,
      discover: null, supported: false, medium: 'n/a', note: '分布式控制；与 IEC 61131-3 互补' },
    'codesys': { label: 'CODESYS（3S 的 PLC 运行时/协议栈，事实标准非 ISO）', defaultPort: 0,
      discover: null, supported: false, medium: 'n/a', note: '跨厂家 PLC 运行时' },

    // ── 消费智能设备标准（Matter / Zigbee / Thread / Z-Wave / HomeKit，开放标准建档）──
    // Matter(CSA, 跨生态统一应用层, 跑 Thread/Wi-Fi/以太网/BLE) / Zigbee(CSA, 2.4GHz 网状, 与 Matter 共 ZCL 簇)
    // Thread(Thread Group/CSA, IPv6 低功耗网状, Matter 常用传输层) / Z-Wave(Z-Wave Alliance/SiLabs, Sub-GHz)
    // HomeKit(Apple HAP, BLE/Wi-Fi 私有但已文档化)。真实驱动需边界路由器/协调器/网关硬件，本机 only 建档/导入。
    'matter': { label: 'Matter（CSA，跨生态统一应用层；跑 Thread/Wi-Fi/以太网/BLE）', defaultPort: 5540,
      discover: null, supported: false, medium: 'wireless',
      note: '端点/簇/属性数据模型；消费智能设备统一标准；簇名→规范槽见访问引擎 importStandard(\'matter\')；真实驱动待补' },
    'zigbee': { label: 'Zigbee（CSA，2.4GHz 网状；ZCL 簇与 Matter 同源）', defaultPort: 0,
      discover: null, supported: false, medium: 'wireless',
      note: 'Zigbee PRO R23；簇号与 Matter 一致(0x0006 OnOff 等)；真实驱动需协调器，待补' },
    'thread': { label: 'Thread（Thread Group/CSA，IPv6 低功耗网状）', defaultPort: 0,
      discover: null, supported: false, medium: 'wireless',
      note: 'Matter 常用传输层；只管网络拓扑，不定义应用语义' },
    'zwave': { label: 'Z-Wave（Z-Wave Alliance / Silicon Labs，Sub-GHz 网状）', defaultPort: 0,
      discover: null, supported: false, medium: 'wireless',
      note: '智能家居另一主流；与 Zigbee/Matter 互操作需网关翻译，待补' },
    'homekit': { label: 'HomeKit（Apple HAP，BLE/Wi-Fi 私有但已文档化）', defaultPort: 0,
      discover: null, supported: false, medium: 'wireless',
      note: '苹果生态；HAP 配对加密；非开放标准，仅文档化接入，待补' }
  };

  // ── 自动识类核心 ────────────────────────────────────────────────
  // observed = { variables:{name:type}, actions:[capName] }
  // 返回 { matched, best, confidence, residual, needsAnchor, ranked, note }
  function classify(observed, opts) {
    opts = opts || {};
    var threshold = (opts.threshold != null) ? opts.threshold : 0.5;
    var vars = (observed && observed.variables) || {};
    var actions = (observed && observed.actions) || [];
    var varNames = Object.keys(vars);

    // 预计算：每个变量名命中了哪些规范卡（用于"独有语义槽"加权，破平手/防跨类误匹配）
    var varToCards = {};
    varNames.forEach(function (n) {
      varToCards[n] = CANONICAL_MODELS.filter(function (c) {
        var s = (c.stateSpace && c.stateSpace.slots) || {};
        return Object.keys(s).some(function (k) { return matchName(n, s[k].hints); });
      }).map(function (c) { return c.id; });
    });

    var ranked = CANONICAL_MODELS.map(function (card) {
      var slots = card.stateSpace.slots;
      var reqSpec = card.stateSpace.required;
      function slotMatched(key) { if (!slots[key]) return false; return varNames.some(function (n) { return matchName(n, slots[key].hints); }); }
      var reqOK, slotRatio;
      if (!reqSpec) { reqOK = true; slotRatio = 1; }
      else if (reqSpec.any) { reqOK = reqSpec.any.some(slotMatched); slotRatio = reqOK ? 1 : 0; }
      else if (reqSpec.all) { reqOK = reqSpec.all.every(slotMatched); slotRatio = reqOK ? 1 : 0; }
      else { reqOK = true; slotRatio = 1; }

      // 本卡语义槽命中数（平手裁决第三键：同分同独有命中时，能圆上更多槽的卡更贴）
      var matchedSlots = Object.keys(slots).filter(slotMatched).length;

      var caps = card.capabilities || [];
      // 能力匹配度 = 设备观测到的行为中，本卡能解释的比例（不惩罚卡声明更多可选能力，
      // 也不因设备行为多而稀释——这才是"设备行为有多贴合这张卡"的正确度量）
      var capMatchedActions = (caps.length && actions.length) ? actions.filter(function (a) {
        return caps.some(function (c) { return new RegExp(c.pattern).test(a); });
      }).length : 0;
      var capRatio = (caps.length && actions.length) ? capMatchedActions / actions.length : 0;
      var score = 0.7 * slotRatio + 0.3 * capRatio;
      // 独有语义槽：该变量名只命中本卡、不命中任何其他卡 → 强区分信号（破平手/防跨类误匹配）
      var uniqueHits = varNames.filter(function (n) {
        var s = varToCards[n]; return s.length === 1 && s[0] === card.id;
      }).length;
      return {
        id: card.id, label: card.label, group: card.stateSpace.group,
        interfaces: card.interfaces || [],
        score: score, slotRatio: slotRatio, capRatio: capRatio, uniqueHits: uniqueHits,
        matchedSlots: matchedSlots,
        reqOK: reqOK, capMatched: capMatchedActions, capTotal: caps.length
      };
    }).sort(function (a, b) { return b.score - a.score || b.uniqueHits - a.uniqueHits || b.matchedSlots - a.matchedSlots; });

    var best = ranked[0];
    var matched = !!(best && best.score >= threshold);
    return {
      matched: matched,
      best: matched ? best : null,
      confidence: matched ? round(best.score) : 0,
      residual: matched ? round(1 - best.score) : 1,
      needsAnchor: !matched,
      ranked: ranked.slice(0, 3),
      note: matched ? null :
        '未匹配任何规范模型：属"覆盖不到"类，走另分析通道（人锚 1 语义槽 / 导入厂家 AAS / 补规范卡）'
    };
  }

  // 变量名 ↔ 语义提示 匹配（词边界，避免 'pos' 误中 'axis_pos'）
  // 规则：全等 / 含 _hint / hint_ 开头 / 长提示(≥3)作前缀或后缀
  function matchName(observedName, hints) {
    var o = String(observedName).toLowerCase();
    var toks = o.split('_');   // 下划线切分：'40001_x' → ['40001','x']；'pos_x' → ['pos','x']
    return (hints || []).some(function (h) {
      var hh = String(h).toLowerCase();
      if (o === hh) return true;                              // 全等
      if (toks.indexOf(hh) >= 0) return true;                // 切分后的整词命中（含 _x / x_ 情形，锚定机制依赖此）
      if (hh.length >= 3 && o.indexOf(hh) === 0) return true;        // 长提示前缀
      if (hh.length >= 3 && hh.length <= o.length && o.lastIndexOf(hh) === o.length - hh.length) return true; // 长提示后缀（防提示比变量名更长时 -1==负数 误判）
      return false;
    });
  }

  function round(x) { return Math.round(x * 1000) / 1000; }

  // ── ws 发现（已实装）：连仿真身体 → 握手 → 读状态 → 抽变量 ────────
  function discoverWs(url, opts) {
    return new Promise(function (resolve, reject) {
      var ws;
      try { ws = new WebSocket(url); } catch (e) { return reject(e); }
      var got = false;
      var to = setTimeout(function () {
        try { ws.close(); } catch (e) {}
        if (!got) reject(new Error('ws discover timeout'));
      }, (opts && opts.timeout) || 4000);

      ws.onopen = function () { ws.send(JSON.stringify({ type: 'hello', id: 'd1', proto: '1.0' })); };
      ws.onmessage = function (ev) {
        var m = safeParse(ev.data); if (!m) return;
        if (m.type === 'hello-ack') { ws.send(JSON.stringify({ type: 'reset' })); return; }
        if (m.type === 'state' || m.type === 'observation') {
          got = true; clearTimeout(to);
          var st = (m.state && typeof m.state === 'object') ? m.state : {};
          var variables = {};
          Object.keys(st).forEach(function (k) { variables[k] = typeof st[k]; });
          try { ws.close(); } catch (e) {}
          resolve({ protocol: 'ws', variables: variables, actions: (opts && opts.actions) || [], sample: st });
        }
      };
      ws.onerror = function (e) { clearTimeout(to); reject(e || new Error('ws error')); };
    });
  }

  function safeParse(x) {
    try { return typeof x === 'string' ? JSON.parse(x) : JSON.parse(String(x)); }
    catch (e) { return null; }
  }

  // ── 可扩展：加一张卡 = 加一类；加一个协议 = 扩驱动 ────────────────
  function registerModel(card) {
    if (!card || !card.id) throw new Error('registerModel: 缺 id');
    var i = CANONICAL_MODELS.findIndex(function (c) { return c.id === card.id; });
    if (i >= 0) CANONICAL_MODELS[i] = card; else CANONICAL_MODELS.push(card);
    return CANONICAL_MODELS.length;
  }
  function registerProtocol(name, spec) {
    if (!name) throw new Error('registerProtocol: 缺 name');
    PROTOCOLS[name] = Object.assign({ supported: false }, PROTOCOLS[name] || {}, spec);
    return PROTOCOLS;
  }

  var api = {
    CANONICAL_MODELS: CANONICAL_MODELS,
    PROTOCOLS: PROTOCOLS,
    classify: classify,
    registerModel: registerModel,
    registerProtocol: registerProtocol,
    discoverWs: discoverWs
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LingNaoBodyLibrary = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));

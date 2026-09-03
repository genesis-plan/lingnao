# 灵脑物理接入 · 机器类规范模型目录（有限、可取证）

> 拓扑目标：灵脑接入通道"面对世界上任意机器"。
> 核心结论：**常见机器类是有限的、可枚举的、可外部取证的**——不是让 AI 泛化，而是一份从标准文档手工建档的有限目录，加一张卡＝加一类。
> 来源：OPC Foundation 100+ Companion Spec、VDMA 35 个工作组约 22 个机械域、机器人学界结构分类、MTConnect、W3C WoT、AAS。
> 卡状态三档：`已建`＝`lingnao-body-library.js` 已落；`占位`＝结构占位未细化；`待建`＝需补签名卡；`底座`＝通用设备层（非独立机器类，作识类底座）。
> 诚实边界：封闭私有协议（无标签裸寄存器/私有二进制）无标准可取证→走"锚定 1 语义槽 / 另分析"通道，不硬套、不谎称。

---

## 一、移动 / 物流类（Mobile & Intralogistics）

| 类 | 状态空间（拓扑，给识类做签名） | 语义标准（协议+信息模型） | 卡状态 |
|---|---|---|---|
| AGV（磁导/激光固定路径） | 平面位姿 `SE(2)`；C-free⊂SE(2) 减障碍，Betti-0＝连通区域数（规划不变量） | VDMA 物料搬运 / AMR Companion Spec；Modbus/EtherCAT | **已建**（SE(2) 同胚） |
| AMR（自主导航，SLAM） | `SE(2)` × 速度；同上，多一层实时建图 | VDMA AMR；ROS2 nav_msgs；MQTT | 待建 |
| 叉车 AGV（托盘/堆垛） | `SE(2)` × ℝ（叉齿升降） | VDMA 物料搬运；Modbus-TCP | 待建 |
| 复合机器人（移动底盘+机械臂） | `SE(2)` × (S¹)ⁿ（臂）；乘积空间 | VDMA Robotics + AMR 组合 | 待建 |
| 输送线 / 传送带 | 1D（沿带位置 ℝ 或离散工位） | OPC-UA 输送机模型；PLC | 待建 |

## 二、机械臂 / 操作类（Manipulators）

| 类 | 状态空间 | 语义标准 | 卡状态 |
|---|---|---|---|
| 六轴多关节臂（万能型） | 关节 `(S¹)⁶`（环面 T⁶）；任务空间 `SE(3)` | **OPC-UA for Robotics (OPC-40010-1)**；ROS `sensor_msgs/JointState` | **占位**（六自由度结构占位） |
| SCARA（平面高速装配） | `(S¹)² × ℝ`（Z）；平面 2R+Z | OPC-UA Robotics；EtherCAT | 待建 |
| Delta / 并联（高速拾放） | 基础 `(S¹)³`；末端 ℝ³ 小工作空间 | OPC-UA Robotics；EtherCAT | 待建 |
| 笛卡尔 / 桁架 / 龙门 | ℝ³（直线轴 X/Y/Z） | OPC-UA Robotics；G-code | 待建 |
| 圆柱坐标臂 | `S¹ × ℝ²`（θ,r,z） | OPC-UA Robotics | 待建 |
| 球/极坐标臂 | `S¹ × S¹ × ℝ`（≈ S²×R） | OPC-UA Robotics | 待建 |
| 协作机器人 Cobot（安全层） | 同底座 + 安全包络约束流形（不等式约束） | OPC-UA Robotics + ISO/TS 15066 安全态 | 待建 |
| 双臂机器人 | `2×(S¹)ⁿ` 或 `2×SE(3)` | OPC-UA Robotics | 待建 |
| 人形机器人 | 基座 `SE(2)/SE(3)` × 肢体各 `(S¹)ᵏ`；整体高维乘积 C-space | ROS2 Humanoid；私有为主 | 待建 |
| 四足机器人 | `SE(3)` 基座 × `4×(S¹×R)` 腿 | ROS2 Quadruped；私有为主 | 待建 |
| 外骨骼 | 拟人关节 `(S¹)ⁿ` 贴合人体 | 私有/ISO 13482 | 待建 |
| Hexapod / Stewart 平台（并联精密） | 基础 6 自由度并联；`SE(3)` 末端 | OPC-UA Robotics | 待建 |

## 三、机床类（Machine Tools，umati / VDMA + MTConnect）

| 类 | 状态空间 | 语义标准 | 卡状态 |
|---|---|---|---|
| CNC 铣床 | ℝ³（刀具）×(S¹)（主轴）；C-free⊂ℝ³×S¹ 减几何障碍 | **MTConnect** + umati Machine Tools；G-code | 待建 |
| CNC 车床 | ℝ²(x,z) × (S¹)（主轴） | MTConnect；G-code | 待建 |
| EDM 电火花 | 子类同 CNC（电极 ℝ³） | MTConnect | 待建 |
| 磨床 | ℝ³ 砂轮进给 | MTConnect | 待建 |
| 激光/水刀切割 | ℝ² 平面 + Z | MTConnect | 待建 |
| 3D 打印 / 增材 | ℝ³ 打印头 × 挤出标量（层层 ℝ²×ℝ） | MTConnect；G-code | 待建 |
| 冲压/压力机 | 滑块 ℝ（上下） + 送料 ℝ | MTConnect | 待建 |

## 四、过程 / 流程设备（Process，PA-DIM / DEXPI / NAMUR）

| 类 | 状态空间 | 语义标准 | 卡状态 |
|---|---|---|---|
| 泵 / 压缩机 | 标量/低维（流量、转速、压力）ℝᵏ | **PA-DIM (OPC-30081)**；IO-Link | 待建 |
| 阀（开关/比例） | 阀位 ℝ（0..1）或离散 | PA-DIM；IO-Link | 待建 |
| 电机 / 驱动 | 转速 ℝ、转矩 ℝ、位置 ℝ | **OPC-UA for SERCOS / PROFINET Drives** | 待建 |
| 换热器 / 反应釜 | 温度/压力/液位 ℝⁿ（过程变量） | DEXPI (OPC-30250)；PA-DIM | 待建 |
| 离岸/油气（MDIS） | 多设备聚合 | MDIS (OPC-30020) | 待建 |

## 五、包装 / 食品 / 制药（PackML / Weihenstephan / LADS）

| 类 | 状态空间 | 语义标准 | 卡状态 |
|---|---|---|---|
| 包装机（灌装/封口/贴标） | 离散状态机（ISA-88/PackML 态） + 若干轴 | **PackML (OPC-30050)**；Weihenstephan | 待建 |
| 称重/计量设备 | 标量（重量 ℝ） | OPC-UA Weighing (Mettler)；MTConnect | 待建 |
| 烟草机械 | 专用状态机 | OPC-30060 Tobacco | 待建 |
| 实验室/分析仪器 | 离散程序态 + 检测量 | **LADS (OPC-30500)** | 待建 |

## 六、视觉 / 质检（Machine Vision）

| 类 | 状态空间 | 语义标准 | 卡状态 |
|---|---|---|---|
| 机器视觉系统 | 感知节点（无执行状态空间，输出检测结果/触发） | **OPC-UA Vision (VDMA)**；GenICam | 待建 |

## 七、建筑 / 起重 / 通用设施

| 类 | 状态空间 | 语义标准 | 卡状态 |
|---|---|---|---|
| 起重机 / 葫芦 | `SE(2) × ℝ`（吊钩高度）或桥式 `ℝ² × ℝ` | **OPC-UA Cranes&Hoists (OPC-40020-1)** | 待建 |
| 电梯 / 升降机 | 1D（楼层，离散 ℝ） | OPC-UA Lifts/Escalators (VDMA) | 待建 |
| 空调/通风（Air Handling） | 标量（温度/风量 ℝⁿ） | VDMA Air Handling；BACnet | 待建 |

## 八、其他工业域（VDMA 工作组，均有 Companion Spec）

木工机械、玻璃技术、纺织机械、铸造机械、冶金、采矿/矿物、锂电/太阳能/电子生产、发电设备、发动机/动力系统、测量测试技术、塑料橡胶机械（OPC-40077/40082）、工程机械/建材设备。
→ 均按"域→Companion Spec→签名卡"建档，结构同上（状态空间 + 语义模型），逐域补。

## 九、通用底座（非独立机器类，作识类底座）

| 底座 | 作用 | 语义标准 |
|---|---|---|
| PLC (IEC 61131-3) | 任意机器的控制层 | OPC-30000；CODESYS |
| 现场设备 / IO-Link | 传感器/执行器层 | OPC-30120；IO-Link |
| AutoID（条码/RFID） | 物体识别 | OPC-30010 |
| 资产管理壳 AAS | 资产标准化数字表达（协议无关语义互操作） | OPC-30270；AASX |
| W3C WoT Thing Description | 协议无关设备描述（与 AAS 可互映射） | W3C WoT |

---

## 十、国内通用协议与标准（已建档，2026-09-03）

> 用户原话："那查找国内的通用的协议，标准，把他们用到这里。"→ 调研国内真实通用协议/标准，落到接入模块三处：① `lingnao-body-library.js` 的 `PROTOCOLS` 登记表（8 条国内条目）+ `CANONICAL_MODELS` 规范卡（3 张国内设备卡）；② `lingnao-access-engine.js` 的 `decodeDL645`/`decodeCJT188` 真实字节帧解码器 + `importStandard` 的 `dl645`/`cjt188`/`ecode` 导入分支；③ 本节文档存档。
> 来源：全国标准信息公共服务平台 / SAC 归口 / 各标准正文，均经 WebSearch 核实标准号与归口单位（非虚构）。
> **诚实边界（重要）**：国内协议绝大多数真实驱动需对应硬件（电表/水表/充电桩/CAN 网卡/现场总线接口），本机只做**建档（可自动识类）+ 帧字节解码自测（真实帧可解）+ 标准文件导入**，**不谎称能连真机**；真实驱动为后续待补项（见本节末"待补驱动"）。

### 10.1 国内自主总线 / 现场总线（国产可控）

| 协议 | 国标 / 标准 | 归口 / 来源 | 接入模块状态 |
|---|---|---|---|
| EPA | **GB/T 20171**（= IEC 61158 Type 14，浙大中控等国产自主实时以太网） | 全国工业过程测量控制和自动化标委会（SAC/TC124） | 登记表建档 `epa`，`supported:false`（真实驱动待补） |
| NCUC-Bus | 国产数控总线（机床领域自主） | 国家数控系统工程技术研究中心等 | 建档 `ncuc`，`supported:false` |
| WIA-PA | **GB/T 26790**（工业无线，国产自主，流程自动化） | SAC/TC124 | 建档 `wia-pa`，`supported:false` |
| EtherMAC | 国产事件触发实时以太网 | 中科院沈阳自动化所等 | 建档引导（同实时以太网类） |

### 10.2 国内特色计量 / 抄表协议（最易取证、已落字节解码）

| 协议 | 标准 | 帧结构要点（已落 `decode*` 自测） | 接入模块状态 |
|---|---|---|---|
| DL/T 645-2007 | 多功能电能表通信协议（国内电表事实标准） | `68H`+地址6+`68H`+控制码C+长度L+数据域(每字节 `−33H` 还原)+CS+`16H`；RS-485/红外/载波 | 建档 `dl645` + 卡 `meter.electric`（`decodeDL645` 字节解码 12 项全过）；驱动待补 |
| CJ/T 188-2018 | 户用计量仪表（水/气/热表） | `68H`+表类型1+地址5+控制+长度+数据+CS+`16H`；累计量 4 字节 BCD 小端 ×0.001 m³ | 建档 `cjt188` + 卡 `meter.utility`（`decodeCJT188` 字节解码全过）；驱动待补 |
| M-Bus | 仪表总线（四表合一采集，EN 13757 国内常用） | 主从电流环/电压；与 DL645/CJT188 同层"多表合一"采集 | 建档 `mbus`（作 `meter.*` 卡的接口之一） |

### 10.3 国内特色充电协议

| 协议 | 标准 | 关键点 | 接入模块状态 |
|---|---|---|---|
| 充电桩 ↔ BMS | **GB/T 27930-2023** | 基于 CAN 2.0B（250 kbps）的充电流程状态机（握手/配置/充电/结束） | 建档 `gb-charge` + 卡 `ev.charger`（slots: charge_voltage/charge_current/bms_soc/charge_state；capabilities: start_charge/stop_charge）；CAN 真实驱动待补 |

### 10.4 国内自主标识体系

| 标识 | 标准 | 要点 | 接入模块状态 |
|---|---|---|---|
| Ecode | **GB/T 31866-2023** | 三段式 `V + NSI + MD`（版本+命名机构+本地码），兼容 Handle/OID，物联网实体标识 | 建档 `ecode` + `importStandard('ecode',{code})` 登记 `entity_id`（只登记、不翻译语义） |

### 10.5 智能制造信息模型国标（接入模块语义互操作上游）

| 国标 | 主题 | 与接入模块关系 |
|---|---|---|
| GB/T 37695 | 智能制造 对象标识 | 对象标识（与 Ecode/AAS 对接） |
| GB/T 37393 | 数字化车间 | 车间级信息模型（目录"通用底座/AAS"上游） |
| GB/T 39561 | 数控装备互联互通 | 机床语义（目录"三、机床类"上游） |
| GB/T 38872 | 机器人 通信架构 | 机器人通信（目录"二、机械臂/操作类"上游） |

### 10.6 国标工业协议（等同/修改采用国际，登记表已含、此处注明国产语境）

Modbus（GB/T 19582）、CC-Link（GB/T 19760）、PROFINET（GB/T 25105）、EtherCAT（GB/T 31230）——均为国际协议国标化，登记表 `modbus-tcp`/`cc-link`/`profinet`/`ethercat` 已建；与 10.1 国产自主总线并列构成"国内工厂总线全集"。

### 10.7 已落地的国内规范卡（lingnao-body-library.js）

| 卡 id | 类 | 国内标准（语义来源） | 状态空间 | 自动识类实测 |
|---|---|---|---|---|
| `meter.electric` | 智能电表 | DL/T 645（+ M-Bus/Modbus-TCP/OPC-UA 接口） | ℝᵏ（电压/电流/有功/电量） | ✅ `classify({voltage,current,energy})`→meter.electric（19 项 CN 测试） |
| `meter.utility` | 水/气/热表 | CJ/T 188（+ M-Bus/Modbus-TCP） | ℝᵏ（表号/累计量/状态） | ✅ `classify({meter_no,volume})`→meter.utility |
| `ev.charger` | 充电桩 | GB/T 27930（CAN/Modbus-TCP） | FSM + ℝ（电压/电流/SOC/充电态） | ✅ `classify({charge_voltage,charge_current,bms_soc})`→ev.charger（已修跨类碰撞） |

> 跨类碰撞修复：初版 `ev.charger` 的 `charge_voltage/charge_current/bms_soc` 与 `meter.electric` 的 `voltage/current`、无人机的 `soc` 共享子词→充电桩被误判成电表；修复＝收紧 soc 共享 hints（AGV/无人机去 `soc`，ev.charger 改用 `bms_soc`/`charge_state` 专属提示）+ 识类打分公式 `score=0.7*slotRatio+0.3*capRatio` + 平手裁决键 `uniqueHits`（变量名只命中本卡）。重测全绿。

### 10.8 待补驱动（诚实列出，非已实装）

- 真实硬件驱动：`dl645`/`cjt188` 串口头 (`serialport`)、`gb-charge` CAN 套接字 (`can`/`socketcan`)、`epa`/`ncuc`/`wia-pa` 现场总线网卡——均需硬件，本机 only 建档 + 字节解码自测。
- 接入引擎已导出 `decodeDL645`/`decodeCJT188`，真实驱动拿到字节流即可复用（无需重写帧逻辑）。
- 测试：`test-cn-standards.js` 19/19 全过（真实帧解码 + 标准文件导入 + 自动识类 + 登记表存在性）。

---

## 十一、通用工业协议与标准（PLC / 电机 / 传感器，2026-09-03）

> 用户原话："那通用的PLC，电机，传感器之类的。"→ 调研国际通用（非国内）的 PLC / 电机(变频/伺服) / 传感器类协议与标准，对称落到接入模块三处：① `lingnao-body-library.js` 的 `PROTOCOLS` 登记表（13 条通用条目）+ `CANONICAL_MODELS` 的 `drive.motor` 卡（并富化 `sensor.iot`/`plc` 接口）；② `lingnao-access-engine.js` 的 5 个真实字节解码器（decodeCia402Status/encodeCia402Control/decodeProfidriveStatus/decodeProfidrive/decodeIOLinkPD）+ `importStandard` 的 profidrive/cia402/iolink/pa-dim 导入分支；③ 本节文档存档。
> 来源：IEC 61158 系列、PI(Profibus & PROFINET International)、ETG(EtherCAT Technology Group)、ODVA、CAN in Automation(CiA)、OPC Foundation、ISO/IEC 61131-3/61499——均经 WebSearch 核实标准号与归口单位（非虚构）。
> **诚实边界（重要）**：通用协议真实驱动均需对应硬件（实时以太网网卡/现场总线接口/CAN 卡/IO-Link 主站），本机只做**建档（可自动识类）+ 字节解码自测（真实帧可解）+ 标准文件导入**，**不谎称能连真机**；真实驱动为后续待补项（见本节末"待补驱动"）。

### 11.1 通用工业总线（实时以太网 / 现场总线）

| 协议 | 标准 / 归口 | 接入模块状态 |
|---|---|---|
| PROFINET IO | **IEC 61158 Type 10**，PI(Profibus & PROFINET International) 管理；RT/IRT 实时以太网 | 登记表建档 `profinet`，`supported:false`（真实驱动待补） |
| EtherCAT | **IEC 61158 Type 12**，ETG(EtherCAT Technology Group) 管理；分布式时钟 | 建档 `ethercat`，`supported:false` |
| EtherNet/IP | ODVA 管理，CIP(Common Industrial Protocol) 语义；TCP 44818 / UDP 2222 | 建档 `ethernet-ip`，`supported:false` |
| PROFIBUS DP | **IEC 61158 Type 3**，PI 管理；RS-485 现场总线 | 建档 `profibus`，`supported:false` |
| CANopen | **CiA 301**（CAN in Automation），基于 CAN 2.0B | 建档 `canopen`，`supported:false` |

### 11.2 驱动行规（跑在总线上：PROFIdrive / CiA 402）

| 行规 | 归口 / 跑在哪 | 关键点（已落字节解码自测） | 接入模块状态 |
|---|---|---|---|
| PROFIdrive | PI 管理，跑在 PROFINET/PROFIBUS 上（变频/伺服） | Telegram 1（PZD 4 字：CTW/HSW/ZSW/HIW）；ZSW1 状态机（bit0 readyToSwitchOn, bit1 readyToOperate, bit2 operationEnabled, bit3 fault, bit4 coastStopActive(OFF2 反相), bit5 quickStopActive(OFF3 反相), bit6 switchOnInhibited, bit7 warning） | 建档 `profidrive` + `decodeProfidrive`/`decodeProfidriveStatus`（PZD 小端解 CTW/HSW/ZSW/HIW + 推导 state）；驱动待补 |
| CiA 402 | CAN in Automation，跑在 CANopen/EtherCAT 上（伺服/变频） | DS402 状态机：`0x6040` 控制字 / `0x6041` 状态字；控制字跃迁 Shutdown=0x0006 / SwitchOn=0x0007 / EnableOp=0x000F / QuickStop=0x0002 / DisableV=0x0000 / FaultReset=0x0080；状态字位推导 state | 建档 `cia402` + `decodeCia402Status`/`encodeCia402Control`（0x6041 位解析 + 0x6040 命令→值）；驱动待补 |

### 11.3 智能传感器接口（IO-Link / IEC 61131-9）

| 接口 | 标准 / 归口 | 关键点 | 接入模块状态 |
|---|---|---|---|
| IO-Link | **IEC 61131-9:2022**（SDCI 单点数字通信接口），PI 管理；主站-设备点对点 | 过程数据(PD)+服务数据(SD)；IODD 描述文件（变量名/物理单位/scale）；3 线非屏蔽，向下兼容开关量 | 建档 `iolink` + `decodeIOLinkPD`（按 IODD 布局小端解 PD，含 signed 符号扩展 + scale）；驱动待补 |

### 11.4 过程语义模型（PA-DIM，协议无关）

| 模型 | 标准 / 归口 | 作用 | 接入模块状态 |
|---|---|---|---|
| PA-DIM | **OPC 30081**（OPC Foundation Process Automation Device Information Model） | 协议无关的设备信息模型：温度/压力/流量/液位/阀位/诊断等标准化节点；向上对接 PROFINET/IO-Link/Modbus 各总线 | 建档 `pa-dim` + `importStandard('pa-dim',{nodes})` 把 PA-DIM 节点/字段→槽；驱动待补 |

### 11.5 PLC 编程底座（IEC 61131-3 / IEC 61499 / CODESYS）

| 底座 | 标准 / 归口 | 作用 | 接入模块状态 |
|---|---|---|---|
| IEC 61131-3 | **IEC 61131-3**（PLC 编程模型：LD/FBD/SFC/ST/IL） | 任意机器的控制层编程模型（目录"九、通用底座"已列，此处补登记表） | 建档 `iec61131`（PLC 模型） |
| IEC 61499 | **IEC 61499**（分布式 PLC，事件驱动功能块） | 分布式自动化、跨设备功能块编排 | 建档 `iec61499`（分布式） |
| CODESYS | 3S-Smart Software Solutions 运行时（事实标准，非 ISO） | 跨硬件 PLC 运行时，兼容 IEC 61131-3 | 建档 `codesys`（运行时） |

### 11.6 已落地的通用规范卡与解码器（lingnao-body-library.js / lingnao-access-engine.js）

| 卡 id | 类 | 通用标准（语义来源） | 状态空间 | 自动识类实测 |
|---|---|---|---|---|
| `drive.motor` | 电机/变频/伺服 | PROFIdrive + CiA 402（PROFINET/EtherCAT/CANopen/PROFIBUS/Modbus-TCP/OPC-UA-Motion 接口） | `ℝᵏ`（转速/转矩/电流/电压/频率/位置/温度）+ 控制字状态机 | ✅ `classify({speed,torque,current,temperature})`→drive.motor（已修识类公式回归） |

> 解码器（接入引擎已导出，真实驱动拿到字节流即可复用）：`decodeCia402Status(sw)`、`encodeCia402Control(cmd)`、`decodeProfidriveStatus(sw)`、`decodeProfidrive(pzd,opts)`、`decodeIOLinkPD(buf,layout)`。
> 标准导入分支：`importStandard('profidrive',{pzdMap})` / `importStandard('cia402',{objectDict})` / `importStandard('iolink',{processData})` / `importStandard('pa-dim',{nodes})`。
> **修识类计分公式回归**：新增多能力电机卡暴露原 `capRatio=capMatched/caps.length` 缺陷（分母用"卡声明能力数"惩罚声明多的卡，致 `drive.motor` 被只声明 start/stop 的输送线以 score 1.0 胜出）→ 改为 `capRatio=capMatchedActions/actions.length`（设备观测行为中本卡能解释的比例），电机升 0.7 且 `uniqueHits>0` 胜出；顺带修复 AGV battery hints 误含 `energy` 抹掉电表 `energy` 专属权→去掉 `energy` 恢复跨类正确。重测全绿。

### 11.7 待补驱动（诚实列出，非已实装）

- 真实硬件驱动：`profinet`/`ethercat`/`ethernet-ip` 实时以太网网卡、`profibus`/`canopen` 现场总线/CAN 卡、`iolink` IO-Link 主站、`profidrive`/`cia402` 经总线拿下 PZD/PDO、`pa-dim` 经 OPC-UA 摄入节点——均需硬件，本机 only 建档 + 字节解码自测。
- 接入引擎已导出 5 个真实字节解码器，真实驱动拿到字节流即可复用（无需重写帧逻辑）。
- 测试：`test-general-standards.js` 39/39 全过（真实帧解码 + 标准文件导入 + 自动识类 + 登记表存在性）。

---

## 十二、消费智能设备接入（Matter / Zigbee / Thread / Z-Wave / HomeKit，2026-09-03）

> 用户 2026-09-03 拍板方向：把"消费智能设备"也纳入接入模块建档（此前我评估"不建议进本品主线"，用户决定纳入）。
> 聚焦**开放标准**（Matter/CSA 跨生态统一应用层、Zigbee/同 ZCL 簇、Thread/IPv6 网状、Z-Wave/Sub-GHz、HomeKit/Apple HAP 私有但已文档化）；**不碰 Tuya/米家/Alexa 私有云**（黑盒无标准接口，接了也是 needsAnchor，不值得建卡）。

**已落（对称于国内/通用节）：**
- 协议登记表 5 条：`matter`(CSA，跑 Thread/Wi-Fi/以太网/BLE，UDP 5540)、`zigbee`(CSA 2.4GHz 网状，ZCL 与 Matter 同源)、`thread`(Thread Group/CSA IPv6 低功耗网状)、`zwave`(Z-Wave Alliance/SiLabs Sub-GHz)、`homekit`(Apple HAP，BLE/Wi-Fi 私有)——均 `supported:false`（真实驱动需边界路由器/协调器/网关硬件，待补）。
- 规范卡 4 张（自动识类，独有语义槽防跨类碰撞）：`consumer.light`(OnOff/Level/Color)、`consumer.plug`(OnOff/Power/Energy)、`consumer.lock`(DoorLock FSM)、`consumer.thermostat`(Thermostat FSM+设定点)。
- `sensor.iot` 富化：接口加 `matter`/`zigbee`/`thread`，状态空间加 `occupancy`/`illuminance` 槽（Matter/Zigbee 占用/照度传感可落此卡）。
- 解码器（真实字节，本机可自测）：`decodeMatterTLV`（CSA Core Ch.10 TLV，高 4 位=元素类型/低 4 位=标签控制，原语齐全）、`decodeZclFrame`（ZCL 帧 FrameControl/Seq/Cmd/Payload）、`matterClusterName`/`zigbeeClusterName`（ZCL 簇号→名，0x0006 OnOff 等）。
- 标准导入分支：`importStandard('matter')` / `importStandard('zigbee')`（簇/属性名→规范槽，显式给 slot 或按 ZCL_SLOT 自动翻译）。

**诚实边界（持续）：** 消费设备真实驱动需硬件（Thread 边界路由器 / Zigbee 协调器 / Z-Wave 控制器 / Matter 桥）；本机只做**建档 + 字节解码自测 + 标准文件导入**，不谎称能连真机。门锁类（`consumer.lock`）属**安全敏感**执行面，任何控制指令必须经灵脑内核 HITL/SAFE-STOP/审计账本闸死（fail-closed）。

## 十三、规模与边界（诚实口径）

- **有限性**：VDMA 约 22 个机械域、OPC Foundation 100+ Companion Spec、机器人学界结构分类约 12 类——全集可枚举，非无限。
- **可取证**：每个类都有标准组织/厂家公开发布的语义模型（节点/引用/变量名），可直接建档为签名卡。
- **自动识类可行性**：标准协议/常见类→零填写自动接入（探测协议→摄入信息模型→结构匹配）；封闭私有协议→诚实"识别不了"，请人锚 ≥1 语义槽或导入厂家 AAS/Companion/MTConnect 文件。
- **自动标定是尽力而为**：拓扑只管语义几何、不管线缆/字节；协议驱动是工程层。观测不足/噪声大时 φ 可能错，残差超阈报 `𝕌`（不确定就停），不静默接受。
- **异类拒绝**：AGV 的 φ 不能套到机械臂，匹配残差必超阈→自动拒绝并请求补规范模型，不硬套。

## 十四、各类机器的有限接口集（= 用户说的"有限/有线 = 机器各类接口"）

连机器两条路：**无线（空中链路）** + **插机器本来的各类接口**。每台机器暴露的接口是**有限、可枚举**的标配端口/协议——这正是规范模型卡 `interfaces` 字段（已落入 AGV / 六轴臂）。识类完成后，灵脑据此知道该探哪些接口；介质（有线/无线物理层）是接口副属性，非真轴。

| 机器组 | 典型有限接口（可取证，来自 Companion Spec） | 无线可达 | 物理接口(多为有线) |
|---|---|---|---|
| 移动/物流（AGV/AMR） | OPC-UA(VDMA AMR)、MTConnect、ROS、Modbus-TCP、MQTT | ✅ WiFi/蜂窝跑 MQTT/ws | 以太网/串口 |
| 机械臂 | OPC-UA Robotics、EtherCAT、PROFINET、ROS、Modbus-TCP | ⚠ 多经有线实时总线 | 以太网/实时总线 |
| 机床 | MTConnect、umati、G-code、OPC-UA | ⚠ 多经有线 | 以太网/串口 |
| 过程设备 | PA-DIM、IO-Link、PROFINET Drives、Modbus-TCP | ⚠ 少 | 以太网/IO-Link |
| 包装/食品 | PackML、Weihenstephan、LADS | ⚠ 少 | 以太网 |
| 视觉 | OPC-UA Vision、GenICam | ⚠ 多有线 | 以太网 |
| 建筑/起重 | OPC-UA Cranes、BACnet | ⚠ 少 | 以太网/总线 |
| 通用底座 | PLC(IEC61131)、IO-Link、AutoID、AAS、W3C WoT | ✅(WoT/MQTT) | 以太网/串口 |

> 链路层 `LINK_MEDIA` 已枚举"无线 5 类 + 有线 5 类"物理介质；上表是各机器类的**有限接口集**——两者对应：接口决定协议，介质决定那条接口跑在什么物理链路上。已实装真实驱动：`ModbusTcpClient`(有限接口·多为有线)、`MqttClient`(无线)。

---

## 当前已实装规范卡（lingnao-body-library.js，2026-09-02 实测 11/11 通过）

| 卡 id | 类 | 状态空间（拓扑签名） | 真实接入测试 |
|---|---|---|---|
| `agv.planar.se2` | AGV / AMR | `SE(2)` | ✅ ws 仿真身体 + Modbus/MQTT 遥测，零填写识类 |
| `uav.multirotor` | 多旋翼无人机 | `SE(3)` | ✅ MQTT 遥测（lat/lon/alt/battery）自动识类 |
| `arm.6dof` | 六轴臂 / 协作臂 | `(S¹)⁶` 环面 | ✅ OPC-UA Robotics 结构自动识类 |
| `arm.scara` | SCARA 臂 | `S¹×S¹×ℝ` | ✅ OPC-UA 结构自动识类 |
| `machine.cnc` | 数控机床 CNC | `ℝ³×S¹` | ✅ OPC-UA/MTConnect 结构自动识类 |
| `machine.packml` | 包装机（PackML 状态机） | FSM | ✅ OPC-UA 结构自动识类 |
| `machine.conveyor` | 输送线 | `ℝ` | ✅ Modbus 点位表还原语义后自动识类 |
| `sensor.iot` | 工业传感器 / 仪表 | `ℝᵏ` | ✅ Modbus 点位表还原语义后自动识类 |
| `plc` | PLC 远程 I/O | `ℝᵏ` | ✅ Modbus 点位表还原语义后自动识类 |
| `meter.electric` | 智能电表（国内 DL/T 645） | `ℝᵏ`（电压/电流/有功/电量） | ✅ `classify({voltage,current,energy})`→meter.electric（CN 测试） |
| `meter.utility` | 水/气/热表（国内 CJ/T 188） | `ℝᵏ`（表号/累计量/状态） | ✅ `classify({meter_no,volume})`→meter.utility |
| `ev.charger` | 充电桩（国内 GB/T 27930） | FSM+ℝ（电压/电流/SOC/充电态） | ✅ `classify({charge_voltage,charge_current,bms_soc})`→ev.charger（已修跨类碰撞） |
| `drive.motor` | 电机/变频/伺服（通用 PROFIdrive+CiA 402） | `ℝᵏ`（转速/转矩/电流/电压/频率/位置/温度）+ 控制字状态机 | ✅ `classify({speed,torque,current,temperature})`→drive.motor（已修识类公式回归） |
| `consumer.light` | 智能灯/开关（Matter/Zigbee 灯类） | FSM×ℝ（开关+调光/调色） | ✅ `classify({onoff,brightness,color_temp})`→consumer.light |
| `consumer.plug` | 智能插座（Matter/Zigbee 插座类） | FSM×ℝ（通断+功耗计量） | ✅ `classify({onoff,power,energy})`→consumer.plug（matchedSlots 第三裁决键修平手） |
| `consumer.lock` | 智能门锁（Matter 0x000A / Zigbee 0x0101） | FSM（locked/unlocked/jammed） | ✅ `classify({lock_state,lock_action})`→consumer.lock |
| `consumer.thermostat` | 智能温控（Matter 0x0301 / Zigbee HVAC） | FSM×ℝ（温控+连续设定点） | ✅ `classify({current_temp,target_temp,mode,humidity})`→consumer.thermostat |

> 待建 backlog（目录其余类）：叉车 AGV、复合机器人、Delta/笛卡尔/圆柱/球/双臂/人形/四足/外骨骼/Hexapod、机床磨/EDM/激光/3D/冲压、过程泵阀、包装称重、起重机/电梯/空调、CNC 激光切割、3D 打印机等。
> 国内协议真实驱动（dl645/cjt188 串口、gb-charge CAN、epa/ncuc/wia-pa 现场总线网卡）需硬件，目前仅建档 + 帧字节解码自测（`decodeDL645`/`decodeCJT188` 已导出），详见第十节。
> 通用协议真实驱动（profinet/ethercat/ethernet-ip 实时以太网网卡、profibus/canopen 现场总线/CAN 卡、iolink 主站、profidrive/cia402 经总线拿 PZD/PDO、pa-dim 经 OPC-UA 摄入）需硬件，目前仅建档 + 字节解码自测（`decodeCia402Status`/`encodeCia402Control`/`decodeProfidrive`/`decodeIOLinkPD` 已导出），详见第十一节。
> 富化：`sensor.iot` 接口加 pa-dim/profibus/ethernet-ip/ethercat/matter/zigbee/thread，状态空间加 occupancy/illuminance 槽；`plc` 接口加 profibus/canopen/iolink/iec61131/codesys（通用+消费协议接入面已对齐）。
> 消费设备真实驱动（matter/zigbee/thread/zwave/homekit 需边界路由器/协调器/网关硬件）需硬件，目前仅建档 + 字节解码自测（`decodeMatterTLV`/`decodeZclFrame` 已导出）+ 标准导入（`importStandard('matter'/'zigbee')`），详见第十二节。
> 测试脚本：`test-realworld-devices.js`、`test-classify.js`、`test-console-pipeline.js`、`test-link-layer.js`、`test-bridge.js`、`test-access-engine.js`、`test-cn-standards.js`、`test-general-standards.js`、`test-consumer-standards.js`（共 156 项全绿，2026-09-03 实测）。

## 接入引擎（最好的方法，已实装）

`lingnao-access-engine.js` 把上述所有部件合成**一条 `connect()` 管线**，对外只产一层【翻译壳（canonical adapter）】，不逆向、不复制对方内部系统。优先级（决定"最好"）：

1. **标准语义优先**：对方暴露/导入标准文件（Modbus 点表 / OPC-UA Companion Spec / AAS / MTConnect）→ 显式 nameMap → 零歧义识别 + 零歧义翻译。工业界 vendor-independent 集成的正路（导入 Companion Spec 即可），不靠逆向。
2. **拓扑结构识别**：无标准文件 → 摄入原始信息模型 → 对有限规范库比结构签名（状态空间群 + 语义图同构）→ 最佳匹配 = 类（尽力而为）。
3. **最小锚定兜底**：匹配不上（封闭私有无文档）→ 诚实报 `needsAnchor`，请人锚 1 个语义槽（如 `{"40001":"x"}`）或导入厂家标准文件 → 重建 nameMap 重识别。绝不硬套、不谎称。

`adapter` 输出：`class / toCanonical(rawState) / send(cmd) / calibrate(φ 物理包络) / quality(SAFE-STOP 新鲜度)`，覆盖"读语义→识类→翻译→下发"全闭环。实测 `test-access-engine.js` 12/12：点表导入、MQTT 无线遥测、锚定兜底、Companion 导入、ws 真身体 全过。

> 诚实边界：封闭私有协议（裸寄存器无点表）→ 驱动连通但识类诚实报 `needsAnchor`，走锚定 1 语义槽 / 另分析；OPC-UA 真实驱动仍待补（目前对标准语义结构直接识类，驱动层未实装）。


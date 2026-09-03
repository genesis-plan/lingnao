# 灵脑 LingNao · 物理接入模块使用文档

> **一句话**：把世界上任意机器/设备，用「标准语义优先 + 拓扑结构识别 + 最小锚定兜底」统一接进灵脑，产出一层**翻译壳（canonical adapter）**——灵脑只懂规范语义，对方内部实现不碰、不复制。
>
> **关键点**：**你今天就能用，不需要任何硬件。** 没硬件也能跑的是「软件路径」（识别 / 标准导入 / 字节解码）；只有「真连活设备」才需要硬件。

---

## 0. 今天就能用（无硬件）的三条软件路径

| 路径 | 函数 | 你给什么 | 它返回什么 | 真实场景 |
|---|---|---|---|---|
| ① 拓扑识别 | `classify(观测)` | 变量名列表 + 动作名列表 | 设备类(id/置信度) 或 `needsAnchor` | 你拿到一台陌生设备，看它暴露的接口名，先知道它"是什么类" |
| ② 标准导入 | `importStandard(kind, data)` | 厂家标准文件（点表/簇列表/AAS…） | 变量名→规范槽的 `nameMap` | 你有设备的 Modbus 点表 / OPC-UA Companion / Matter 簇列表，直接映射成规范语义 |
| ③ 字节解码 | `decode.*` | 原始协议帧字节 | 可读状态对象 | 实验室/原型里抓到一帧报文，解成状态字/过程值，验证接线 |

跑示例看输出：`node demo-access.js`

```js
const A = require('./lingnao-access.js');

// ① 识别电机
A.classify({ protocol:'profidrive',
  variables:{speed:'number',torque:'number',current:'number',temperature:'number'},
  actions:['start','stop','set_speed'] });
// → { matched:true, best:{id:'drive.motor'}, confidence:0.7, ... }

// ② 导入 Modbus 点表
A.importStandard('point-table', { '40001':{slot:'speed'}, '00001':{slot:'run'} });
// → { nameMap:{ '40001':'speed', '00001':'run' }, ... }

// ③ 解码 CiA402 状态字
A.decode.cia402Status(0x0007);
// → { bits:{...}, state:'switched_on', ... }
```

---

## 1. 真实驱动（需硬件）：connector 契约

软件路径只解决"语义识别/映射/解码"。要**真连活设备读写**，需要你（硬件拥有者）提供一个**连接器（connector）**，实现两件事：

```js
// 照抄 connector-template.js 的 MyConnector
detect(url) → { protocol, host, port, mediumHint }      // 从地址识别协议
ingest(link, opts) → { variables:{name:type}, actions:[], sample, client? }  // 读硬件→观测
send(cmd)  → Promise<{ok}>                              // (可选) 规范命令→写回硬件
```

- 字节解析**直接用本模块已实装的 `decode.*`**，你不用自己写协议解析。
- 识别/映射/翻译壳由 `classify` / `importStandard` / `connect()` 自动完成。
- 跑通演示：`node connector-template.js`（软件内，无硬件，只验证接线形状）。

**诚实边界**：上面骨架未连真机验证（本机无硬件）。你按自己硬件把 `ingest` 的"样例数据"换成真实读数即可接真机。

---

## 2. 诚实边界（务必读）

- **能接 = 设备暴露标准协议/接口**；黑盒私有、无文档、加密无凭证 → 走 `needsAnchor`（人锚 1 个语义槽或导入厂家标准文件），**绝不硬套、不复制对方系统**。
- **`connectorStatus()` 诚实标驱动状态**：`supported:true` 表示 link-layer 已实装真实驱动（当前 `ws` / `modbus-tcp` / `mqtt`）；`supported:false` 表示仅建档、需硬件，本机只提供字节解码自测 + 标准导入，**不谎称能连真机**。
- 输出是**翻译壳**，不是对方系统的克隆；拓扑管语义几何，不管字节/线缆/内部实现。
- 安全敏感执行面（如 `consumer.lock` / 电机启停）的控制指令，**必须经灵脑内核 HITL / SAFE-STOP / 审计账本 fail-closed**，不可绕过。

---

## 3. 已落地清单（可取证，均非虚构）

**协议登记表（`supported` 现状）**
- 驱动已实装：`ws`（灵脑 body 协议）、`modbus-tcp`、`mqtt`
- 仅建档（需硬件）：`opc-ua`、国内 `epa`/`ncuc`/`wia-pa`/`dl645`/`cjt188`/`mbus`/`gb-charge`/`can`、通用 `profinet`/`ethercat`/`ethernet-ip`/`profibus`/`canopen`/`iolink`/`profidrive`/`cia402`/`pa-dim`/`opc-ua-motion`/`iec61131`/`iec61499`/`codesys`、消费 `matter`/`zigbee`/`thread`/`zwave`/`homekit`

**规范卡（设备类，可自动识类）**
`agv.planar.se2` / `machine.conveyor` / `robot.arm` / `cnc.mill` / `sensor.iot` / `meter.electric` / `ev.charger` / `plc` / `drive.motor`（通用）/ `consumer.light` / `consumer.plug` / `consumer.lock` / `consumer.thermostat`

**字节解码器（已导出，可自测）**
`decodeDL645` / `decodeCJT188` / `decodeCia402Status` / `encodeCia402Control` / `decodeProfidriveStatus` / `decodeProfidrive` / `decodeIOLinkPD` / `decodeMatterTLV` / `decodeZclFrame`

**标准导入分支（`importStandard`）**
`point-table`(Modbus) / `companion`(OPC-UA) / `aas`(AdminShell) / `mtconnect` / `dl645` / `cjt188` / `ecode` / `profidrive` / `cia402` / `iolink` / `pa-dim` / `matter` / `zigbee`

**待补 backlog（方向你定）**
- 通用协议真实驱动（PROFINET/EtherCAT/CANopen/IO-Link/PROFIdrive/CiA 402 需硬件网卡/主站）
- 国内表计真实驱动（DL645/CJT188 串口、GB/T 27930 CAN、EPA/NCUC/WIA-PA 网卡）
- 消费真实驱动（Matter 边界路由器 / Zigbee 协调器 / Z-Wave 控制器）
- 能源类建档（DLMS/COSEM、IEC 61850、M-Bus 复用解码框架）
- 楼宇类建档（BACnet、KNX）
- 计算/微型系统节点卡（node.edge/server/mcu/softplc/container，前轮已讨论未落）

---

## 4. 测试实据

核心自测 `npm test`（`node lingnao-mcp.js --selftest`）零依赖内核自检全绿；设备/协议专项验证脚本（原 9 套共 156 项，2026-09-03 实测全绿）已移出首页归档，不占根目录，需要复查时可从归档取回。

---

## 5. 文件地图

| 文件 | 作用 |
|---|---|
| `lingnao-access.js` | 统一公开入口（本文件是门面） |
| `lingnao-body-library.js` | 规范库：协议登记表 + 规范卡 + `classify` |
| `lingnao-access-engine.js` | 接入引擎：`connect`/`importStandard`/`decode.*` |
| `lingnao-link-layer.js` | 链路层：已实装 `ws`/`modbus-tcp`/`mqtt` 驱动 |
| `connector-template.js` | 真实驱动接入契约骨架（硬件拥有者照抄） |
| `demo-access.js` | 无硬件可跑示例（三条软件路径） |
| `lingnao-machine-catalog.md` | 设备目录（类全集 + 标准出处） |

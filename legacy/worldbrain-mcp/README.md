# 世界大脑 WorldBrain — 历史归档

> 本目录是 `genesis-plan/worldbrain-mcp` 仓库的**只读归档**。
> 该仓库已于 2026-08-30 停止维护并删除，其能力全部并入 **灵脑 LingNao**。

## 它是什么

「世界大脑 WorldBrain」是本项目在 2026-08-26 使用的早期命名，定位是：

> 把「世界图 → A\* 可审计推理 → 物理载体执行 → 学习反馈」封装为标准 MCP stdio 服务。

它暴露 5 个工具：`world_info` / `set_world` / `reason` / `audit` / `carrier_report`，
外加学习闭环三件套 `learn` / `knowledge_query` / `knowledge_add`。

## 与灵脑的关系

| 维度 | 世界大脑 WorldBrain | 灵脑 LingNao |
|---|---|---|
| 命名时间 | 2026-08-26 06:30 | 2026-08-26 06:53（**晚 23 分钟**） |
| 工具数 | 5 | 46（含全部 WorldBrain 工具） |
| 状态 | 2026-08-26 归档 | 活跃维护 |
| npm 包 | `worldbrain-mcp@1.0.1` | `lingnao-mcp@3.1.0` |

**WorldBrain 的 5 个工具在灵脑中全部保留且同名**，因此不存在能力丢失。
两者是**同一内核的先后命名**，不是两个项目。

## 时间线

```
2026-08-24        灵数求解器 lingshu-solver 创建
2026-08-26 06:30  worldbrain-mcp 创建
2026-08-26 06:53  lingjing 创建（23 分钟后，当时名为「灵境 LingJing」）
2026-08-26 14:33  worldbrain-mcp 最后提交（同步 README 至 npm）
2026-08-26        worldbrain-mcp 归档（被 lingjing 取代）
2026-08-30        灵境 LingJing 正式改名为 灵脑 LingNao
2026-08-30        worldbrain-mcp 仓库删除，内容归档至此
```

> 命名沿革：**世界大脑 WorldBrain → 灵境 LingJing → 灵脑 LingNao**，三者是同一内核的先后命名。
> 本归档目录内提及「灵脑」处，均指改名后的当前项目名；涉及 2026-08-30 之前的事件，历史名称仍为「灵境」。

## 为什么保留这份代码

1. **npm 包名 `worldbrain-mcp` 已发布**（v1.0.1），外部可能仍有引用，归档便于追溯。
2. 它是一份**最小可读的实现**：只有 5 个工具、单文件 15KB，比灵脑的
   `lingnao-mcp.js`（72KB / 46 工具）更容易理解内核的原始设计意图。
3. 「世界大脑」仍是本项目的**对外产品定位**用词（灵脑 README：世界通用大脑）。

## 请勿基于本目录开发

这里的代码已冻结，不再接收更新。新功能一律进灵脑主体。

// 灵脑 LingNao v3.0 — 虚拟空间模块（目标地区仿真）
// 让大脑在一个可控的"虚拟世界 / 目标地区"里循环调用三类能力：
//   ① 发现错配  discoverMismatch  — 谁缺什么、谁多什么、谁能造什么
//   ② 协调资源  coordinateResources — 用大脑 reason() 找最优流转路径（含经由中枢/多跳）
//   ③ 分配资源  allocateResources   — 确定性地把资源从盈余方拨给缺口方（可审计、不幻觉）
// 内核真源：lingnao.umd.js（UMD，零依赖）。本模块仅用已验证签名。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./lingnao.umd.js'));
  else if (typeof define === 'function' && define.amd) define(['./lingnao.umd.js'], factory);
  else root.VirtualWorld = factory(root.LingNao);
}(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';
  const G = L.GROUNDING || { KERNEL: 'KERNEL', PERCEPTION: 'PERCEPTION', PROOF: 'PROOF' };
  const line = (s = '') => console.log(s);

  // ============================================================
  // 虚拟空间：一个目标地区（节点=主体，边=可流转通道，w=距离/损耗）
  // ============================================================
  class VirtualWorld {
    constructor(region) {
      this.region = region.name;
      this.hub = region.hub || 'HUB';
      // 深拷贝，避免运行时污染原始定义
      this.entities = region.entities.map(e => ({
        id: e.id, name: e.name || e.id, type: e.type || 'agent',
        pos: e.pos || 0,
        resources: Object.assign({}, e.resources || {}),   // 持有量
        needs: Object.assign({}, e.needs || {}),           // 缺口量
        produces: e.produces || null                       // {resource, from, rate}
      }));
      this.ledger = [];   // 已发生调拨
      this.tick = 0;
      this.graph = this._buildGraph();
    }
    _buildGraph() {
      const nodes = this.entities.map(e => e.id).concat([this.hub]);
      const edges = [];
      // 通道双向可达（能去也能回）；w = 距离/损耗，p = 可行性
      const link = (a, b, w, p) => { edges.push({ from: a, to: b, w, p: p == null ? 0.99 : p }); edges.push({ from: b, to: a, w, p: p == null ? 0.99 : p }); };
      // 每个主体都连到中枢（集市/协调中心）
      for (const e of this.entities) link(e.id, this.hub, 1, 0.99);
      // 可选直接邻接边（更短的搬运距离）
      for (const l of (this._adj || [])) link(l[0], l[1], l[2], 0.99);
      return { nodes, edges };
    }
    setAdjacency(pairs) { this._adj = pairs; this.graph = this._buildGraph(); return this; }
    getEntity(id) { return this.entities.find(e => e.id === id); }
    snapshot() {
      return {
        region: this.region, tick: this.tick,
        entities: this.entities.map(e => ({
          id: e.id, name: e.name, type: e.type,
          resources: Object.assign({}, e.resources),
          needs: Object.assign({}, e.needs),
          produces: e.produces
        }))
      };
    }
    // 在虚拟空间内落一笔调拨（确定性、可审计；库存校验防透支/负数）
    applyTransfer(fromId, toId, resource, amount, route, grounding) {
      const from = this.getEntity(fromId), to = this.getEntity(toId);
      if (!from || !to) throw new Error('applyTransfer：主体不存在 ' + fromId + '→' + toId);
      if (!(amount > 0)) throw new Error('applyTransfer：调拨量必须为正数，收到 ' + amount);
      if ((from.resources[resource] || 0) < amount) throw new Error('applyTransfer：' + fromId + ' 的 ' + resource + ' 库存不足（持 ' + (from.resources[resource] || 0) + '，拨 ' + amount + '）');
      from.resources[resource] = (from.resources[resource] || 0) - amount;
      to.resources[resource] = (to.resources[resource] || 0) + amount;
      to.needs[resource] = Math.max(0, (to.needs[resource] || 0) - amount);
      const entry = {
        id: 'TX' + (this.ledger.length + 1), tick: this.tick,
        from: fromId, to: toId, resource, amount,
        route: route || [fromId, toId], grounding: grounding || G.KERNEL
      };
      this.ledger.push(entry);
      return entry;
    }
    totalResource(res) {
      return this.entities.reduce((s, e) => s + (e.resources[res] || 0), 0);
    }
  }

  // ============================================================
  // 能力①：发现错配
  // 扫描全空间：对每一处「缺口」，找直接盈余方；找不到则找「能生产该物」的主体
  // ============================================================
  function discoverMismatch(world) {
    const out = [];
    for (const e of world.entities) {
      for (const [res, deficit] of Object.entries(e.needs)) {
        if (deficit <= 0) continue;
        // 直接盈余方
        const direct = world.entities
          .filter(o => o.id !== e.id && (o.resources[res] || 0) > 0)
          .map(o => ({ entity: o.id, surplus: o.resources[res] }));
        // 生产方（从其它资源造出该物，可视为间接供给）
        const makers = world.entities
          .filter(o => o.produces && o.produces.resource === res && (o.id !== e.id))
          .map(o => ({ entity: o.id, makes: res, from: o.produces.from, rate: o.produces.rate }));
        out.push({
          id: 'M' + (out.length + 1), resource: res, deficitEntity: e.id,
          deficit, direct, makers,
          type: direct.length ? 'direct' : (makers.length ? 'production' : 'unmet')
        });
      }
    }
    return out;
  }

  // ============================================================
  // 能力②：协调资源（让大脑规划流转路径）
  // 用 L.reason() 在地区运输图上求「盈余方 → 缺口方」最低损耗路径；
  // 无直连则经中枢中转。
  // ============================================================
  function coordinateResources(world, mismatches) {
    L.setWorld(world.graph);            // 把虚拟地区注册成大脑的世界模型
    const plans = [];
    for (const m of mismatches) {
      const supplier = (m.direct[0] && m.direct[0].entity) || (m.makers[0] && m.makers[0].entity);
      if (!supplier) { plans.push({ matchId: m.id, resource: m.resource, status: 'NO_SUPPLIER', route: [] }); continue; }
      let route = null, cost = null, reasonResult = null;
      try {
        const r = L.reason(supplier, m.deficitEntity);  // 大脑求最优路径
        if (r && r.path && r.path.length) { route = r.path; cost = r.cost; reasonResult = r; }
      } catch (e) { console.warn('[coordinate] 直连推理失败:', e.message); }
      if (!route) {
        try {
          const a = L.reason(supplier, world.hub);
          const b = L.reason(world.hub, m.deficitEntity);
          if (a && a.path && a.path.length && b && b.path && b.path.length) {
            route = a.path.slice(0, -1).concat(b.path);
            cost = (a.cost || 0) + (b.cost || 0);
            // 合并两段真实推理结果供逐边审计（保留各自 steps 与约束）
            reasonResult = { status: 'optimal', path: route, cost,
              steps: (a.steps || []).concat(b.steps || []),
              usedSystem: (a.usedSystem || '2') + '+' + (b.usedSystem || '2'),
              opts: a.opts || { hard: [], soft: [] }, viaHub: world.hub };
          }
        } catch (e) { console.warn('[coordinate] 经中枢推理失败:', e.message); }
      }
      plans.push({
        matchId: m.id, resource: m.resource,
        from: supplier, to: m.deficitEntity,
        via: (route && route.includes(world.hub) && route.length > 2) ? world.hub : null,
        route: route || null,
        cost: cost,  // 无推理结果时如实为 null，不用魔法数冒充实测值
        reasonResult,
        grounding: reasonResult ? G.PROOF : G.PERCEPTION  // 有大脑推理结果才声称"可证明"
      });
    }
    return plans;
  }

  // ============================================================
  // 能力③：分配资源（确定性落账）
  // 调拨量 = min(盈余方持有, 缺口方缺额)；记录账本 + 触发大脑事件/学习
  // ============================================================
  function allocateResources(world, plans) {
    const allocs = [];
    for (const p of plans) {
      if (p.status === 'NO_SUPPLIER') { allocs.push({ ...p, amount: 0, status: 'BLOCKED' }); continue; }
      const from = world.getEntity(p.from), to = world.getEntity(p.to);
      const avail = from.resources[p.resource] || 0;
      const need = to.needs[p.resource] || 0;
      const amount = Math.max(0, Math.min(avail, need));
      if (amount <= 0) { allocs.push({ ...p, amount: 0, status: 'BLOCKED' }); continue; }
      const entry = world.applyTransfer(p.from, p.to, p.resource, amount, p.route, p.grounding);
      // 大脑可观测 / 可学习（EventBus 真方法为 publish；KB 签名为 (from,to,success,conf,source)）
      try { if (L.EventBus && L.EventBus.publish) L.EventBus.publish('alloc', entry); } catch (e) { console.warn('[virtual-world] EventBus 投递失败:', e.message); }
      try { if (L.KB && L.KB.addExperience) L.KB.addExperience(entry.from, entry.to, true, 0.5, 'virtual-world'); } catch (e) { console.warn('[virtual-world] KB 记录失败:', e.message); }
      allocs.push({ ...p, amount, status: amount < need ? 'PARTIAL' : 'ALLOCATED', tx: entry.id });
    }
    return allocs;
  }

  // ============================================================
  // 大脑编排循环：感知 → 发现错配 → 协调 → 分配 → 审计
  // ============================================================
  function runBrainCycle(world, opts) {
    opts = opts || {};
    world.tick++;
    const before = world.snapshot();
    const perceive = { grounding: G.KERNEL, note: '虚拟空间状态为精确仿真量，感知确定性', snapshot: before };

    const mismatches = discoverMismatch(world);
    const plans = coordinateResources(world, mismatches);
    const allocations = allocateResources(world, plans);

    // 审计：对每条真实的大脑推理结果逐条 generateAudit（fail-closed——审计异常=audit_failed，绝不自证 valid）
    const perRoute = plans.map(p => {
      if (p.status === 'NO_SUPPLIER') return { route: null, status: 'unverified', noHallucination: false, note: '无供给方，无推理结果，不声称证明' };
      if (!p.reasonResult) return { route: p.route, status: 'unverified', noHallucination: false, note: '无大脑推理结果，不声称证明' };
      try {
        const a = L.generateAudit(p.reasonResult);
        return { route: p.reasonResult.path, status: a.status, noHallucination: a.noHallucination, verified: a.proof.verified, reportId: a.reportId };
      } catch (e) { return { route: p.route, status: 'audit_failed', noHallucination: false, note: '审计异常：' + e.message }; }
    });
    const audit = {
      status: (perRoute.length > 0 && perRoute.every(a => a.status === 'valid')) ? 'valid'
        : (perRoute.some(a => a.status === 'audit_failed') ? 'audit_failed' : 'unverified'),
      noHallucination: perRoute.length > 0 && perRoute.every(a => a.noHallucination === true),
      proofPassed: perRoute.filter(a => a.verified === true).length,
      proofTotal: perRoute.length,
      perRoute
    };

    return { tick: world.tick, before, mismatches, plans, allocations, audit, perceive };
  }

  // ============================================================
  // 自测 + 演示（node virtual-world.js 直接运行）
  // ============================================================
  function demo() {
    const hr = (t) => { line('\n' + '═'.repeat(70)); line('  ' + t); line('═'.repeat(70)); };

    // 目标地区：青木村
    const qingmu = {
      name: '青木村', hub: 'HUB',
      entities: [
        { id: 'FARM_A', name: '农户·阿木', type: 'household', pos: 0,
          resources: { 粮食: 120 }, needs: { 农具: 2 } },
        { id: 'FARM_B', name: '农户·阿竹', type: 'household', pos: 2,
          resources: { 农具: 5 }, needs: { 粮食: 60 } },
        { id: 'CRAFT_C', name: '铁匠铺', type: 'workshop', pos: 1,
          resources: {}, needs: { 竹: 30 }, produces: { resource: '农具', from: '竹', rate: 0.3 } },
        { id: 'BAMBOO_D', name: '竹农·老周', type: 'household', pos: 3,
          resources: { 竹: 200 }, needs: { 粮食: 40 } }
      ]
    };
    const world = new VirtualWorld(qingmu).setAdjacency([
      ['FARM_A', 'FARM_B', 2], ['BAMBOO_D', 'CRAFT_C', 0.5]
    ]);

    hr('灵脑 · 虚拟空间｜' + world.region + '（让大脑循环调用三类能力）');
    line('  初始状态：');
    for (const e of world.entities)
      line('    ' + e.name + '：持有[' + JSON.stringify(e.resources) + ']  缺口[' + JSON.stringify(e.needs) + ']'
        + (e.produces ? '  产能[' + e.produces.from + '→' + e.produces.resource + ']' : ''));

    // 跑两轮，演示「发现→协调→分配」闭环（第二轮可见首轮后涌现的新错配）
    const rounds = [];
    for (let i = 0; i < 2; i++) rounds.push(runBrainCycle(world));

    let total = 0;
    rounds.forEach((r, i) => {
      hr('第 ' + (i + 1) + ' 轮大脑循环（tick=' + r.tick + '）');
      line('  [①发现错配] ' + r.mismatches.length + ' 处');
      r.mismatches.forEach(m => line('      ' + m.id + ' ' + m.resource + '：' + m.deficitEntity + ' 缺 ' + m.deficit
        + (m.direct[0] ? ' ← 直供 ' + m.direct[0].entity : (m.makers[0] ? ' ← 生产方 ' + m.makers[0].entity : ' ← 暂无解'))));
      line('  [②协调资源] 大脑 reason() 求路径：');
      r.plans.forEach(p => line('      ' + p.from + ' → ' + p.to + '（' + p.resource + '）路径[' + p.route.join('→') + '] 损耗 ' + p.cost));
      line('  [③分配资源] 账本：');
      r.allocations.forEach(a => { total += a.amount; line('      ' + (a.tx || '—') + ' ' + a.from + ' → ' + a.to + '  ' + a.resource + ' ×' + a.amount + '  [' + a.status + ']'); });
      line('  [审计] ' + r.audit.status + (r.audit.status === 'valid' ? ' ✔' : ' ✘') + '  不幻觉：'
        + (r.audit.noHallucination ? '是 ✔' : '否 ✘') + '  霍尔证明通过：' + r.audit.proofPassed + '/' + r.audit.proofTotal + ' 条路径');
    });

    hr('资源守恒校验（调拨不改变总量，仅易主）');
    ['粮食', '农具', '竹'].forEach(res => {
      const before = qingmu.entities.reduce((s, e) => s + (e.resources[res] || 0), 0);
      const after = world.totalResource(res);
      line('    ' + res + '：调拨前 ' + before + ' → 调拨后 ' + (Math.round(after * 100) / 100) + '  '
        + (Math.abs(before - after) < 1e-9 ? '守恒 ✔' : '⚠ 不守恒'));
    });

    hr('结论');
    line('  两轮共完成 ' + world.ledger.length + ' 笔资源调拨，累计流转 ' + total + ' 单位。');
    line('  大脑在青木村这个虚拟空间里，自主完成了「发现谁缺什么→找最优流转路径→确定性分配」，');
    line('  且每轮都带可审计报告。这就是把"物质富裕引擎"放进一个可观测、可审计的沙盘里跑。');

    // 断言（自测）：闭环可跑 + 资源守恒 + 审计诚实（声称不幻觉当且仅当审计 valid）
    const ok = world.ledger.length > 0
      && ['粮食', '农具', '竹'].every(res => Math.abs(
        qingmu.entities.reduce((s, e) => s + (e.resources[res] || 0), 0) - world.totalResource(res)) < 1e-9)
      && rounds.every(r => r.audit.noHallucination === (r.audit.status === 'valid'));
    line('\n  [自测] ' + (ok ? 'PASS ✔ 虚拟空间闭环可跑、资源守恒、可审计' : 'FAIL ✘'));
    return ok;
  }

  if (require.main === module) demo();

  return { VirtualWorld, discoverMismatch, coordinateResources, allocateResources, runBrainCycle, demo };
}));

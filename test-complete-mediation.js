// M4 完全中介参考监视器（Complete Mediation Reference Monitor）验证
//
// 思想来源（据实标注，非原创）：
//   · Anderson 1972《Computer Security Technology Planning Study》参考监视器三要求：
//     完全中介(always invoked) / 防篡改(tamper-proof) / 小到可验证(small enough to verify)
//   · Saltzer & Schroeder 1975 完全中介原则(complete mediation)
//   · Miller 对象能力模型 / Wagner 的 Joe-E：消除环境权限(ambient authority)
//   · seL4 权限封闭(authority confinement)：静态策略是所有未来状态的安全上界
//
// M4 与 M1 的分工（这是整套证明模块的关键）：
//   M1 proveGateChain 证「门控逻辑本身对不对」   —— 正确性 soundness
//   M4 proveCompleteMediation 证「是否所有副作用出口都过闸」—— 完备性 completeness
//   二者互为补集。只有 M1 时，一条没接闸的 fetch 就能让全部门控形同虚设。
//
// ⚠ 本测试的核心不是"跑一遍返回 proved"——那毫无价值。
//   核心是【变异测试】：故意注入 9 类违规，逐一验证判定程序抓得到。
//   一个抓不到违规的检查器等于没有检查器。
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '灵脑.html'), 'utf8');
const full = html.match(/<script>([\s\S]*)<\/script>/)[1];
const cut = full.indexOf('// ===================== UI 编排');
const kernelSrc = cut >= 0 ? full.slice(0, cut) : full;
fs.writeFileSync(path.join(__dirname, '_kernel_load.js'), kernelSrc);

globalThis.__LINGNAO_AUDIT_SECRET = 'complete-mediation-test-secret';
// 装一个真实存储桩（Node 无 localStorage）。目的：让 EffectGate.storageProxy 真的包上它，
// 从而端到端验证「记忆持久化也走中介、也留轨迹」——这是过去完全没有审计的一条副作用面。
const _stubStore = {};
globalThis.localStorage = {
  getItem(k) { return Object.prototype.hasOwnProperty.call(_stubStore, k) ? _stubStore[k] : null; },
  setItem(k, v) { _stubStore[k] = String(v); },
  removeItem(k) { delete _stubStore[k]; },
  get length() { return Object.keys(_stubStore).length; }
};
require('./_kernel_load.js');
const WB = globalThis.__WB;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; } else { fail++; console.log('  FAIL: ' + msg); }
}

console.log('=== test-complete-mediation (M4) ===');
if (!WB || !WB.proveCompleteMediation || !WB.EffectGate) {
  console.log('KERNEL_NOT_LOADED 或 proveCompleteMediation/EffectGate 未导出'); process.exit(1);
}
const EG = WB.EffectGate;

// ── 1. 真实源码判定：C1..C9 全过 ──────────────────────────────────────
const R = WB.proveCompleteMediation(kernelSrc);
ok(R.theorem === 'M4.1', 'A1 依据定理 M4.1，实得 ' + R.theorem);
ok(R.verdict === 'complete-mediation-proved', 'A2 真实内核源码 → complete-mediation-proved，实得 ' + R.verdict);
ok(R.ok === true, 'A3 ok=true');
ok(Array.isArray(R.checks) && R.checks.length === 9, 'A4 共 9 项检查，实得 ' + (R.checks || []).length);
ok((R.unmediated || []).length === 0, 'A5 未中介出口 0 处，实得 ' + (R.unmediated || []).length);
['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'].forEach(function (id) {
  const c = (R.checks || []).find(x => x.id === id);
  ok(c && c.pass === true, 'A6.' + id + ' 通过' + (c ? '' : '（缺失）'));
});
// 全脚本范围（含 UI 编排段）同样成立 —— 否则 UI 里一条裸 fetch 就是缺口
const RF = WB.proveCompleteMediation(full);
ok(RF.verdict === 'complete-mediation-proved', 'A7 含 UI 段的全脚本同样 proved，实得 ' + RF.verdict);

// ── 2. 归约分类：环境权限确已被重绑（而非"禁止书写"）──────────────────
ok(R.classification && R.classification.fetch === 'denied', 'B1 fetch 重绑为拒绝物，实得 ' + (R.classification || {}).fetch);
ok((R.classification || {}).localStorage === 'mediated', 'B2 localStorage 重绑为中介能力对象，实得 ' + (R.classification || {}).localStorage);
ok((R.classification || {}).sessionStorage === 'denied' && (R.classification || {}).indexedDB === 'denied',
  'B3 sessionStorage/indexedDB 重绑为 null');
ok(R.reduction && R.reduction.unreducible === 0, 'B4 不可归约引用 0 处，实得 ' + (R.reduction || {}).unreducible);
ok(R.reduction && R.reduction.mediatedByCapability > 0,
  'B5 存在经能力对象中介的闸外引用（证明"重绑"而非"禁用"路线生效），实得 ' + (R.reduction || {}).mediatedByCapability + ' 处');

// ── 3. 诚实边界：不谎称证了没证的东西 ─────────────────────────────────
ok(Array.isArray(R.notProved) && R.notProved.length >= 4, 'H1 显式列出未证事项，实得 ' + (R.notProved || []).length + ' 条');
ok((R.notProved || []).some(s => /noninterference|不干扰/.test(s)), 'H2 明确未证语义层信息流不干扰');
ok((R.notProved || []).some(s => /隐蔽信道|侧信道/.test(s)), 'H3 明确未证无隐蔽/侧信道');
const H1 = (R.assumptions || []).find(a => a.id === 'H1');
const H5 = (R.assumptions || []).find(a => a.id === 'H5');
ok(H1 && H1.machineChecked === false, 'H4 前提 H1(单 realm) 如实标 machineChecked:false');
ok(H5 && H5.machineChecked === false, 'H5 前提 H5(宿主层) 如实标 machineChecked:false');
ok((R.assumptions || []).filter(a => a.machineChecked === true).length >= 4, 'H6 至少 4 条前提为机器已验');
// fail-closed：拿不到源码不许猜"通过"
const NS = WB.proveCompleteMediation(null);
ok(NS.verdict === 'unverified' && NS.ok === false, 'H7 无源码 → unverified（fail-closed，不假设通过），实得 ' + NS.verdict);

// ── 4. 【变异测试】故意注入违规，验证判定程序抓得到 ────────────────────
// 注入点选在 MEDIATION-PROVER-END 之后（闸外 / TCB 外 / 证明器外）
function inject(src, code) { return src.replace('const IMA = [', code + '\nconst IMA = ['); }
function checkOf(res, id) { return (res.checks || []).find(c => c.id === id); }
function mut(name, mutated, expectFailId, note) {
  const r = WB.proveCompleteMediation(mutated);
  const c = checkOf(r, expectFailId);
  const caught = (r.verdict === 'incomplete') && c && c.pass === false;
  ok(caught, 'M-' + name + ' 变异「' + note + '」应被 ' + expectFailId + ' 抓到，实得 verdict=' +
    r.verdict + ' ' + expectFailId + '=' + (c ? (c.pass ? 'PASS(漏报!)' : 'FAIL(已抓)') : '缺失'));
  return r;
}

// (a) 移除 fetch 词法重绑 + 闸外裸调用 → 归约链断裂
mut('a',
  inject(kernelSrc.replace("const fetch = __ambientDenied('fetch');", '/* 变异：移除重绑 */'),
    'function _mutA(){ return fetch("http://mut.invalid/"); }'),
  'C2', '移除 fetch 重绑并在闸外裸调用');
const ra = WB.proveCompleteMediation(
  inject(kernelSrc.replace("const fetch = __ambientDenied('fetch');", '/* 变异：移除重绑 */'),
    'function _mutA(){ return fetch("http://mut.invalid/"); }'));
ok(checkOf(ra, 'C4') && checkOf(ra, 'C4').pass === false, 'M-a2 同时被 C4 判为不可归约引用');
ok((ra.unmediated || []).some(u => u.kind === 'bare-primitive-unreducible'), 'M-a3 缺口如实记入 unmediated 清单');

// (b) 最刁的攻击：保留 const 遮蔽的"形"，却把环境权限原样放回来
//     这一条正是"只查有没有 const p="的旧判据会漏掉的
mut('b', kernelSrc.replace("const fetch = __ambientDenied('fetch');", 'const fetch = globalThis.fetch;'),
  'C2', '遮蔽形式保留但初始化式重新暴露环境权限');
const rb = WB.proveCompleteMediation(kernelSrc.replace("const fetch = __ambientDenied('fetch');", 'const fetch = globalThis.fetch;'));
ok((rb.unmediated || []).some(u => u.kind === 'shadow-reexposes-ambient'), 'M-b2 缺口类型标为 shadow-reexposes-ambient');

// (c) 动态求值面
mut('c', inject(kernelSrc, 'function _mutC(x){ return eval(x); }'), 'C5', '闸外引入 eval');
mut('c2', inject(kernelSrc, 'function _mutC2(x){ return new Function(x); }'), 'C5', '闸外引入 new Function');
mut('c3', inject(kernelSrc, 'function _mutC3(k){ return globalThis[k]; }'), 'C5', '闸外反射式全局属性访问');

// (d) 绕过词法遮蔽，直接走属性访问取真实原语
mut('d', inject(kernelSrc, 'function _mutD(){ return globalThis.fetch("http://mut.invalid/"); }'),
  'C3', '闸外经 globalThis 取真实原语');

// (e) 闸外重声明覆盖闸内绑定 → C4 的归约前提被破坏
mut('e', inject(kernelSrc, 'function _mutE(){ let fetch = 1; return fetch; }'),
  'C9', '闸外重声明覆盖闸内能力绑定');

// (f) 撤掉物理出口的前置中介
mut('f', kernelSrc.replace('const _eff = EffectGate.mediate(', 'const _eff = _noMediate('),
  'C7', '撤掉 bodyAdapter 前的效应闸中介');

// (g) 闸外加载 Node 模块（fs / child_process 都是原语来源）
mut('g', inject(kernelSrc, 'function _mutG(){ return require("fs"); }'), 'C6', '闸外 require 原生模块');

// (h) 抹掉区间哨兵 → 判定失去边界，必须拒绝而非放过
mut('h', kernelSrc.replace('==EFFECT-GATE-BEGIN==', '==GATE-TAMPERED=='), 'C1', '抹掉效应闸区间哨兵');

// (i) 把真实原语持有者泄露到闸外
mut('i', inject(kernelSrc, 'function _mutI(){ return _rawFetch(); }'), 'C8', '泄露真实原语持有者 _rawFetch');

// (j) 裸 Function 构造器（无 new）—— 动态代码生成别名，旧 C5 只查 new Function 会漏
mut('j', inject(kernelSrc, 'function _mutJ(){ return Function("return 1")(); }'), 'C5', '闸外裸 Function() 构造器（动态代码生成）');

// (k) 字符串形式 setTimeout —— 等价于延迟 eval，旧 C5 未覆盖
mut('k', inject(kernelSrc, 'function _mutK(){ return setTimeout("doEvil()", 0); }'), 'C5', '闸外字符串 setTimeout(...)（延迟 eval）');

// (l) with 语句 —— 改变词法作用域，可让闸外的 p 重新解析到环境权限（遮蔽逃逸）
mut('l', inject(kernelSrc, 'function _mutL(){ with({fetch: globalThis.fetch}){ return fetch("http://mut.invalid/"); } }'),
  'C5', '闸外 with 语句（作用域逃逸，遮蔽可被绕过）');

// ── 5. 运行时自证：环境权限确已剥夺（不发任何网络）────────────────────
const at = EG.attest();
ok(at.ok === true, 'R1 EffectGate.attest() 全过');
ok(at.checks.find(c => /词法遮蔽/.test(c.name)).pass === true, 'R2 裸 fetch 实际抛 AMBIENT_AUTHORITY_DENIED');
ok(at.checks.find(c => /真实原语/.test(c.name)).pass === true, 'R3 闸内仍持有真实原语（功能未被砸掉）');
ok(EG.storageProxy && EG.storageProxy.__mediated === true, 'R4 存储能力对象已包裹真实存储');
// 端到端：记忆持久化必须走中介并留轨迹（此前这条副作用面完全无审计）
ok(WB.Memory && WB.Memory.available() === true, 'R5 有真实存储时 Memory.available() 为真（功能未被砸掉）');
const swBefore = (EG.stats().byKind.STORAGE_WRITE || 0);
const sv = WB.Memory.save();
const swAfter = (EG.stats().byKind.STORAGE_WRITE || 0);
ok(sv && sv.ok === true, 'R6 Memory.save() 经中介代理仍成功写入，实得 ' + JSON.stringify(sv && sv.ok));
ok(swAfter > swBefore, 'R7 该写入已计入效应轨迹（' + swBefore + ' → ' + swAfter + '）');
ok(EG.trace(20).some(r => r.kind === 'STORAGE_WRITE' && r.caller === 'storageProxy'),
  'R8 轨迹标明写入经存储能力对象发生');
const ld = WB.Memory.restore ? WB.Memory.restore() : null;
ok(!ld || ld.ok !== undefined, 'R9 读回路径同样经中介（不抛）');
// 存储写策略拒绝时必须抛错而非静默丢数据（静默丢数据比拒绝更危险）
EG.configure({ storageWrite: 'deny' });
let swThrew = false;
try { EG.storageProxy.setItem('m4_probe', '1'); } catch (e) { swThrew = /EFFECT_DENIED/.test(String(e.message)); }
ok(swThrew === true, 'R10 存储写被拒时抛 EFFECT_DENIED（不静默丢数据）');
EG.configure({ storageWrite: 'ledger' });

// ── 6. 策略机制分离 + fail-closed ────────────────────────────────────
const P0 = EG.policySnapshot();
ok(P0.policy.PROCESS.mode === 'deny' && P0.policy.EVAL.mode === 'deny', 'P1 进程派生/动态求值默认硬拒绝');
ok(P0.policy.NETWORK_OUT.mode === 'ledger', 'P2 网络默认 ledger（放行+入签名账本，不是假安全的 deny）');
ok(EG.mediate({ kind: 'PROCESS', target: 'sh' }, { purpose: 't' }).allowed === false, 'P3 PROCESS 效应被拒');
ok(EG.mediate({ kind: 'EVAL', target: 'x' }, { purpose: 't' }).allowed === false, 'P4 EVAL 效应被拒');
const unk = EG.mediate({ kind: 'SOMETHING_NEW', target: 'x' }, { purpose: 't' });
ok(unk.allowed === false && /EFFECT_KIND_UNKNOWN/.test(unk.reason), 'P5 未注册效应类型 fail-closed，实得 ' + unk.reason);
// 硬轨：策略层不能把 PROCESS/EVAL 配置放开（否则"配置即提权"）
EG.configure({ process: 'ledger', eval: 'ledger', PROCESS: 'ledger' });
const P1s = EG.policySnapshot();
ok(P1s.policy.PROCESS.mode === 'deny' && P1s.policy.EVAL.mode === 'deny',
  'P6 PROCESS/EVAL 不可经 configure 放开（拒绝"配置即提权"）');

// 网络白名单
EG.configure({ netAllowlist: ['api.allowed.test'] });
ok(EG.mediate({ kind: 'NETWORK_OUT', target: 'https://evil.test/x' }, { purpose: 't' }).allowed === false,
  'P7 非白名单 host 被拒');
ok(EG.mediate({ kind: 'NETWORK_OUT', target: 'https://api.allowed.test/x' }, { purpose: 't' }).allowed === true,
  'P8 白名单 host 放行');
EG.configure({ netAllowlist: null });

// 拒绝路径不发网络（真实调用能力对象，验证"拒绝即不传输"）
(async function () {
  EG.configure({ network: 'deny' });
  const rp = await EG.net.postJson('https://never.test/x', {}, '{}', { purpose: 'test-deny', caller: 'test' });
  ok(rp.ok === false && rp.denied === true, 'P9 网络策略 deny 时 postJson 直接拒绝且不传输');
  const rg = await EG.net.getJson('https://never.test/x', { purpose: 'test-deny', caller: 'test' });
  ok(rg.ok === false && rg.denied === true, 'P10 getJson 同样拒绝且不传输');
  EG.configure({ network: 'ledger' });

  // ── 7. 轨迹完整性：意图绑定与调用者可追溯 ──────────────────────────
  const tr = EG.trace(20);
  const denyRec = tr.filter(r => r.allowed === false);
  ok(denyRec.length > 0 && denyRec.every(r => typeof r.purpose === 'string' && typeof r.caller === 'string'),
    'T1 每条效应记录含 purpose(意图) 与 caller(调用者)');
  ok(denyRec.every(r => r.inLedger === true || r.inLedger === false), 'T2 每条拒绝均标注是否入签名账本');
  ok(tr.some(r => r.kind === 'NETWORK_OUT' && r.meta && r.meta.host), 'T3 网络效应记录目标 host');
  const st = EG.stats();
  ok(st.total > 0 && st.denied > 0, 'T4 计数器工作：total=' + st.total + ' denied=' + st.denied);

  // ── 8. 端到端：物理效应真的过闸，且策略拒绝能停住执行 ────────────────
  WB.attachBody({
    name: 'm4-test-body', state: { x: 0 },
    capabilities: [{ id: 'move', riskTier: 1, irreversible: false, pre: null, effect: { x: 1 } }]
  });
  let released = 0;
  const adapter = (cap, params) => { released++; return Promise.resolve({ ok: true, state: {} }); };

  const physBefore = (EG.stats().byKind.PHYSICAL || 0);
  released = 0;
  const run1 = await WB.execute([{ cap: 'move', params: { dx: 1 } }], adapter, {});
  const physAfter = (EG.stats().byKind.PHYSICAL || 0);
  ok(released === 1, 'E1 正常放行时能力被执行 1 次，实得 ' + released);
  ok(physAfter > physBefore, 'E2 物理效应已计入效应闸轨迹（' + physBefore + ' → ' + physAfter + '）');
  const pt = EG.trace(10).filter(r => r.kind === 'PHYSICAL');
  ok(pt.length > 0 && pt[pt.length - 1].target === 'move', 'E3 轨迹记录了具体能力名（法医级"谁做了什么"）');
  ok(pt[pt.length - 1].meta && pt[pt.length - 1].meta.params && pt[pt.length - 1].meta.params.dx === 1,
    'E4 轨迹记录了具体参数（法医级"用什么参数做的"）');
  ok(pt[pt.length - 1].inLedger === true || pt[pt.length - 1].inLedger === false,
    'E5 物理效应入签名账本状态如实标注，实得 inLedger=' + pt[pt.length - 1].inLedger);

  // 策略拒绝物理面 → execute 必须在 bodyAdapter 之前停住（零释放）
  EG.configure({ physical: 'deny' });
  released = 0;
  const run2 = await WB.execute([{ cap: 'move' }], adapter, {});
  ok(released === 0, 'E6 物理策略 deny 时零释放（在 bodyAdapter 之前停住），实得 ' + released);
  ok(run2.halted === true && /EFFECT-GATE-DENIED/.test(String(run2.haltReason)),
    'E7 停机原因如实为 EFFECT-GATE-DENIED，实得 ' + run2.haltReason);
  EG.configure({ physical: 'ledger' });

  // ── 9. 与 M1 的分工不重叠（完备性 ≠ 正确性）─────────────────────────
  const m1 = WB.proveGateChain([{ cap: 'move' }], {});
  ok(m1 && m1.verdict, 'X1 M1 门控证明仍可独立工作（verdict=' + m1.verdict + '）');
  ok(R.notProved.some(s => /M1|放行决策/.test(s)), 'X2 M4 明确声明"放行决策正确性"归 M1，不越权认领');

  // ── 10. 审计账本收到完全中介证明事件 ───────────────────────────────
  const AL = WB.auditLedgerModule;
  if (AL && typeof AL.verify === 'function') {
    const v = AL.verify();
    ok(v && (v.ok === true), 'L1 签名审计账本哈希链完整，实得 ' + JSON.stringify(v && v.ok));
  } else { ok(true, 'L1 账本模块未暴露 verify（跳过，不虚报）'); }

  console.log('--- 结果：pass=' + pass + ' fail=' + fail + ' ---');
  if (fail > 0) process.exit(1);
})();

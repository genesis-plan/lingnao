// gen-kernel-formal.js
// 从已重建的 UMD 单一真源（lingnao.umd.js）抽取 MathKernel，
// 序列化出 docs/kernel-formal.json（机器可读登记：公理/定理/猜想 + 每条定理的计算深度与根基公理）。
// 不解析 HTML 文本 —— 直接跑内核取实况，保证文档与代码永不背离。
const fs = require('fs');
const path = require('path');
const K = require('../lingnao.umd.js');
const MK = K.MathKernel;

const out = { axioms: [], theorems: [], conjectures: [] };

for (const id of MK._order) {
  if (MK._axioms[id]) {
    const a = MK._axioms[id];
    out.axioms.push({ id: a.id, statement: a.statement, field: a.field, source: a.source });
  } else if (MK._theorems[id]) {
    const t = MK._theorems[id];
    const chain = MK.proofChain(id);
    const entry = {
      id: t.id,
      statement: t.statement,
      by: t.by,
      from: t.from.slice(),
      field: t.field,
      proof: t.proof || '',
      evidence: t.evidence || null,
      depth: chain.ok ? chain.depth : null,
      axioms: chain.ok ? chain.axioms : null
    };
    if (t.by === 'COMPUTE') entry.note = 'Tier0 机器检查：verify() 实际运行 check() 函数，返回 true 方通过';
    out.theorems.push(entry);
  } else if (MK._conjectures[id]) {
    const c = MK._conjectures[id];
    out.conjectures.push({ id: c.id, statement: c.statement, field: c.field, evidence: c.evidence });
  }
}

const f = path.join(__dirname, 'docs', 'kernel-formal.json');
fs.writeFileSync(f, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log('已写出 ' + f);
console.log('axioms=' + out.axioms.length + ' theorems=' + out.theorems.length + ' conjectures=' + out.conjectures.length);
const byCount = {};
out.theorems.forEach(t => byCount[t.by] = (byCount[t.by] || 0) + 1);
console.log('by-rule:', JSON.stringify(byCount));
console.log('maxDepth=', Math.max(...out.theorems.map(t => t.depth || 0)));

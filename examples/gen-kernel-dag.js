// gen-kernel-dag.js
// 从 docs/kernel-formal.json 生成 docs/kernel-dag.svg（证明依赖 DAG）。
// 分层：depth-3(橙) → depth-2(绿) → depth-1 计算定理(紫) → 公理(蓝)。
// 由数据驱动，计数与配色自动同步，永不手写硬编码。
const fs = require('fs');
const path = require('path');
const d = require('./docs/kernel-formal.json');

const nodeW = 118, nodeH = 30, gapX = 10, marginX = 20, marginY = 24, bandGap = 92;
const colW = nodeW + gapX;

const label = id => id.replace(/^(THM_|AX_|CONJ_)/, '').replace(/_/g, ' ');
const colorOf = (kind, depth) => {
  if (kind === 'axiom') return { fill: '#85B7EB', stroke: '#185FA5', text: '#042C53' };
  if (depth === 3) return { fill: '#EF9F27', stroke: '#854F0B', text: '#042C53' };
  if (depth === 2) return { fill: '#97C459', stroke: '#3B6D11', text: '#042C53' };
  return { fill: '#B59CEB', stroke: '#5E3B9E', text: '#042C53' }; // depth-1 计算定理
};

// 分层（自上而下）
const bands = [
  { key: 'd3', nodes: d.theorems.filter(t => t.depth === 3), kind: 'theorem' },
  { key: 'd2', nodes: d.theorems.filter(t => t.depth === 2), kind: 'theorem' },
  { key: 'd1', nodes: d.theorems.filter(t => t.depth === 1), kind: 'theorem' },
  { key: 'ax', nodes: d.axioms, kind: 'axiom' }
];
const maxCols = Math.max(...bands.map(b => b.nodes.length));
const width = marginX * 2 + maxCols * colW - gapX;
const height = marginY * 2 + bands.length * (nodeH + bandGap) - bandGap;

const pos = {}; // id -> {x,y,cx,cy}
let edges = '';
let boxes = '';

bands.forEach((b, bi) => {
  const y = marginY + bi * (nodeH + bandGap);
  const bandW = b.nodes.length * colW - gapX;
  const startX = marginX + Math.max(0, (maxCols - b.nodes.length) * colW) / 2;
  b.nodes.forEach((n, i) => {
    const x = startX + i * colW;
    const cx = x + nodeW / 2, cy = y + nodeH / 2;
    pos[n.id] = { x, y, cx, cy, kind: b.kind, depth: n.depth };
    const c = colorOf(b.kind, n.depth);
    boxes += `<g><rect x="${x}" y="${y}" width="${nodeW}" height="${nodeH}" rx="6" fill="${c.fill}" stroke="${c.stroke}" stroke-width="0.8"/>`
      + `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="10" font-family="monospace" fill="${c.text}" font-weight="500">${label(n.id)}</text></g>\n`;
  });
});

// 画边：定理 → 其前提（公理或定理）
d.theorems.forEach(t => {
  const to = pos[t.id];
  if (!to) return;
  (t.from || []).forEach(p => {
    const from = pos[p];
    if (!from) return;
    edges += `<line x1="${from.cx}" y1="${from.y + nodeH}" x2="${to.cx}" y2="${to.y}" stroke="#888780" stroke-width="0.6" opacity="0.35"/>\n`;
  });
});

const counts = {
  ax: d.axioms.length,
  d1: d.theorems.filter(t => t.depth === 1).length,
  d2: d.theorems.filter(t => t.depth === 2).length,
  d3: d.theorems.filter(t => t.depth === 3).length
};
const legend = (x, label2, fill, stroke) =>
  `<rect x="${x}" y="14" width="12" height="12" rx="3" fill="${fill}" stroke="${stroke}"/><text x="${x + 18}" y="25" font-family="sans-serif" font-size="11" fill="#5F5E5A">${label2}</text>`;
const legendW = 4 * 150;
let legendSvg = `<g font-family="sans-serif" font-size="11" fill="#5F5E5A">`;
legendSvg += legend(40, `axiom (${counts.ax})`, '#85B7EB', '#185FA5');
legendSvg += legend(40 + 150, `depth-1 compute (${counts.d1})`, '#B59CEB', '#5E3B9E');
legendSvg += legend(40 + 300, `depth-2 theorem (${counts.d2})`, '#97C459', '#3B6D11');
legendSvg += legend(40 + 450, `depth-3 theorem (${counts.d3})`, '#EF9F27', '#854F0B');
legendSvg += `</g>`;

const svg = `<svg viewBox="0 0 ${width} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">`
  + `<title>lingnao math kernel proof-dependency graph</title>`
  + `<desc>axioms(blue) to depth-1 compute theorems(purple) to depth-2 theorems(green) to depth-3 theorems(orange) DAG; generated from kernel-formal.json</desc>`
  + `<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#888780" stroke-width="1.2" stroke-linecap="round"/></marker></defs>`
  + edges + boxes + legendSvg + `</svg>\n`;

const f = path.join(__dirname, 'docs', 'kernel-dag.svg');
fs.writeFileSync(f, svg, 'utf8');
console.log('已写出 ' + f + '  (' + width + 'x' + height + ')');
console.log('counts:', JSON.stringify(counts), 'edges~', (edges.match(/<line/g) || []).length);

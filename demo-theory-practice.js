#!/usr/bin/env node
// demo-theory-practice.js — 实跑 theoryPracticeLoop 看「实际↔理论」闭环真实行为（2026-08-31）
const L = require('./lingnao.umd.js');

function show(tag, spec, opts) {
  const r = L.theoryPracticeLoop(spec, opts || {});
  if (!r.trace) { console.log(tag + ' => 早退: ' + JSON.stringify(r)); return; }
  const tr = r.trace.map(t => 'r' + t.round + ':' + JSON.stringify(t.predicted) + '~' + JSON.stringify(t.observed) + (t.match ? '✓' : '✗')).join(' ');
  console.log(tag + ' => fit=' + r.fit + ' rounds=' + r.rounds + ' rel=' + r.reliability);
  console.log('     ' + tr);
}

console.log('===== 场景A：理论贴合实际（期望 CONFIRMED） x3 =====');
for (let i = 1; i <= 3; i++) show('A-run' + i, { theory: { predict: () => 7 }, observe: () => 7, context: {} }, { maxRounds: 5 });

console.log('\n===== 场景B：理论持续不符实际（期望 UNKNOWN，第3轮即停） x3 =====');
for (let i = 1; i <= 3; i++) show('B-run' + i, { theory: { predict: () => 7 }, observe: () => 99, context: {} }, { failThreshold: 3, maxRounds: 5 });

console.log('\n===== 场景C：真实世界带噪声不可预测（跑5次看 fit 分布） =====');
for (let i = 1; i <= 5; i++) show('C-run' + i, { theory: { predict: () => 7 }, observe: () => (Math.random() < 0.6 ? 7 : 11), context: {} }, { maxRounds: 6, failThreshold: 4 });

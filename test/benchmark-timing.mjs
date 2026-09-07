// Run: node test/benchmark-timing.mjs
// Measures only engine calculation, not HTTP/rendering or production Worker CPU.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { computeAll } = require('../src/engine/status.ts');
const { locations, calendar } = require('../src/data/index.ts');

for (const iso of ['2026-09-14T16:00:00Z', '2027-01-10T17:00:00Z', '2027-03-14T06:30:00Z', '2026-11-01T06:30:00Z']) {
  const at = new Date(iso);
  for (let i = 0; i < 20; i++) computeAll(locations, calendar, at);
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    computeAll(locations, calendar, at);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  console.log(`${iso}: ${locations.length} locations, median ${samples[50].toFixed(2)} ms, p95 ${samples[95].toFixed(2)} ms`);
}

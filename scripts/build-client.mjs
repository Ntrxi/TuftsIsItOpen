import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/client/main.ts', 'src/client/styles.css'],
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  target: ['es2020'],
  format: 'esm',
  outdir: 'public',
  entryNames: 'app',
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('esbuild watching…');
} else {
  await esbuild.build(options);
}

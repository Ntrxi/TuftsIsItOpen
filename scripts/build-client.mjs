import * as esbuild from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

const client = {
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

/**
 * The homepage is generated once here and served by Cloudflare as a static asset, so requests for
 * `/` never invoke the Worker. The page renderer is TypeScript shared with the Worker and the browser,
 * so it is bundled for Node and evaluated in-process; nothing time- or feed-dependent is baked in.
 */
const prerender = {
  entryPoints: ['scripts/prerender.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node22'],
  write: false,
  logLevel: 'warning',
  plugins: [{ name: 'write-index', setup: (build) => build.onEnd(writeIndex) }],
};

/** Strip line and block comments outside of strings, then parse. Enough for wrangler.jsonc. */
function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const start = i++;
      while (i < text.length && text[i] !== '"') i += text.charCodeAt(i) === 92 /* backslash */ ? 2 : 1;
      out += text.slice(start, i + 1);
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 1;
    } else out += c;
  }
  return JSON.parse(out);
}

/**
 * The analytics beacon token lives in wrangler.jsonc `vars` so it stays in one place. Wrangler runs this
 * build for `wrangler dev` (WRANGLER_COMMAND=dev) and `wrangler deploy`; the dev environment leaves the
 * token empty so local runs do not count as traffic. CLOUDFLARE_ENV selects an environment explicitly.
 */
async function beaconToken() {
  const config = parseJsonc(await readFile('wrangler.jsonc', 'utf8'));
  const envName = process.env.CLOUDFLARE_ENV ?? (process.env.WRANGLER_COMMAND === 'dev' ? 'dev' : '');
  const vars = { ...config.vars, ...(envName ? config.env?.[envName]?.vars : undefined) };
  return typeof vars.CF_BEACON_TOKEN === 'string' ? vars.CF_BEACON_TOKEN : '';
}

async function writeIndex(result) {
  const file = result.outputFiles?.[0];
  if (!file || result.errors.length) return;
  const module = await import(`data:text/javascript;base64,${Buffer.from(file.text).toString('base64')}`);
  const html = module.prerender({ beaconToken: await beaconToken() });
  await writeFile('public/index.html', html);
  console.log(`\n  public/index.html  ${(html.length / 1024).toFixed(1)}kb${process.env.WRANGLER_COMMAND === 'dev' ? ' (dev: analytics beacon off)' : ''}\n`);
}

if (watch) {
  for (const options of [client, prerender]) await (await esbuild.context(options)).watch();
  console.log('esbuild watching…');
} else {
  await Promise.all([esbuild.build(client), esbuild.build(prerender)]);
}

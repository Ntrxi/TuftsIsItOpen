import { expect, it, vi } from 'vitest';
import worker, { type Env } from '../src/worker';

it('leaves the homepage to the static assets layer', async () => {
  const assets = vi.fn(async (request: Request) => new Response(`asset:${new URL(request.url).pathname}`));
  const env = { ASSETS: { fetch: assets } as unknown as Fetcher } satisfies Env;
  const ctx = { waitUntil() {} } as unknown as ExecutionContext;
  for (const path of ['/', '/index.html', '/jumbo.svg', '/missing']) {
    const response = await worker.fetch(new Request(`https://tufts.example${path}`), env, ctx);
    expect(await response.text()).toBe(`asset:${path}`);
  }
  expect(assets).toHaveBeenCalledTimes(4);
});

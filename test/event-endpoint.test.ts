import { expect, it } from 'vitest';
import worker, { type Env } from '../src/worker';

it('retires legacy event requests without bindings or body processing', async () => {
  const response = await worker.fetch(new Request('https://tufts.example/api/event', {
    method: 'POST', body: 'invalid json',
  }), {} as Env, {} as ExecutionContext);
  expect(response.status).toBe(410);
});

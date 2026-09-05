import { describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../src/worker';

const origin = 'https://tufts.example';
const event = JSON.stringify({ type: 'location_view', id: 'dewick' });

function setup(success = true) {
  const writeDataPoint = vi.fn();
  const limit = vi.fn().mockResolvedValue({ success });
  const env = { ANALYTICS: { writeDataPoint }, EVENT_RATE_LIMITER: { limit } } as unknown as Env;
  const send = (body: BodyInit = event, headers: HeadersInit = { origin }, method = 'POST') =>
    worker.fetch(new Request(`${origin}/api/event`, { method, body, headers }), env, {} as ExecutionContext);
  return { send, writeDataPoint, limit };
}

describe('event endpoint', () => {
  it('accepts same-origin beacons and the Origin fallback without Fetch Metadata', async () => {
    const { send, writeDataPoint } = setup();
    expect((await send(event, { origin, 'sec-fetch-site': 'same-origin' })).status).toBe(204);
    expect((await send()).status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledTimes(2);
  });

  it('rejects cross-origin, same-site, opaque and missing origins before throttling or writing', async () => {
    const { send, limit, writeDataPoint } = setup();
    const cases: HeadersInit[] = [{ origin: 'https://other.example' }, { origin: 'null' },
      { origin, 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }, {}];
    for (const headers of cases) {
      expect((await send(event, headers)).status).toBe(403);
    }
    expect(limit).not.toHaveBeenCalled();
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('rejects throttled requests without writing an event', async () => {
    const { send, limit, writeDataPoint } = setup(false);
    const response = await send(event, { origin, 'cf-connecting-ip': '192.0.2.1' });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(limit).toHaveBeenCalledWith({ key: 'event:192.0.2.1' });
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('enforces the byte limit with missing or misleading Content-Length and multibyte text', async () => {
    const { send, writeDataPoint } = setup();
    expect((await send(event, { origin, 'content-length': '513' })).status).toBe(413);
    expect((await send(' '.repeat(513))).status).toBe(413);
    expect((await send(' '.repeat(513), { origin, 'content-length': '1' })).status).toBe(413);
    expect((await send('é'.repeat(257))).status).toBe(413);
    expect((await send(event.padEnd(512))).status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
  });

  it('cancels an oversized stream without consuming the rest', async () => {
    const cancel = vi.fn();
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(300));
      },
      cancel,
    }, { highWaterMark: 0 });
    // Node requires duplex for streaming request bodies; the Worker receives a standard Request.
    const request = new Request(`${origin}/api/event`, { method: 'POST', headers: { origin }, body: stream, duplex: 'half' } as RequestInit);
    const env = { EVENT_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) } } as unknown as Env;
    expect((await worker.fetch(request, env, {} as ExecutionContext)).status).toBe(413);
    expect(pulls).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('rejects malformed events and unsupported methods', async () => {
    const { send, writeDataPoint } = setup();
    expect((await send('{')).status).toBe(400);
    expect((await send('{"type":"unknown"}')).status).toBe(400);
    expect((await send(event, { origin }, 'PUT')).status).toBe(405);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});

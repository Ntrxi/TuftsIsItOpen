import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Load the client with the device clock at `device` and the live snapshot's Date header at `server`. */
async function setup(device: string, server: string): Promise<{ innerHTML: string }> {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(device));
  const clock = { innerHTML: '' };
  vi.stubGlobal('document', {
    readyState: 'complete', visibilityState: 'visible', addEventListener() {}, querySelector: () => null,
    getElementById: (id: string) => (id === 'clock' ? clock : null),
    querySelectorAll: () => [],
  });
  vi.stubGlobal('window', { addEventListener() {} });
  vi.stubGlobal('location', { hash: '' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
  vi.stubGlobal('navigator', { onLine: true });
  const live = { fetchedAt: new Date(server).toISOString(), overrides: {}, vehicles: {}, sources: { library: 'ok', dining: 'ok', shuttles: 'ok' } };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(live), { headers: { date: new Date(server).toUTCString() } })));
  await import('../src/client/main');
  await vi.advanceTimersByTimeAsync(0);
  return clock;
}

it('uses the server clock when the device clock is clearly wrong', async () => {
  // Device says noon EDT; the live response was sent at 5 PM EDT.
  const clock = await setup('2026-09-10T16:00:00Z', '2026-09-10T21:00:00Z');
  expect(clock.innerHTML).toContain('5:00 PM');
});

it('ignores small differences, which cached responses produce', async () => {
  const clock = await setup('2026-09-10T16:00:00Z', '2026-09-10T15:58:30Z');
  expect(clock.innerHTML).toContain('12:00 PM');
});

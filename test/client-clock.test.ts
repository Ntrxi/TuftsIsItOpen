import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Load the client with the device clock at `device` and the page rendered by the server at `server`. */
async function setup(device: string, server: string): Promise<{ innerHTML: string }> {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(device));
  const clock = { innerHTML: '' };
  vi.stubGlobal('document', {
    readyState: 'complete', addEventListener() {}, querySelector: () => null,
    getElementById: (id: string) => (id === 'clock' ? clock : null),
    querySelectorAll: () => [],
  });
  vi.stubGlobal('window', { __RENDERED_AT__: server, addEventListener() {} });
  vi.stubGlobal('location', { hash: '' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
  vi.stubGlobal('navigator', { sendBeacon: () => true });
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
  await import('../src/client/main');
  return clock;
}

it('uses the server clock when the device clock is clearly wrong', async () => {
  // Device says noon EDT; the page was rendered at 5 PM EDT.
  const clock = await setup('2026-09-10T16:00:00Z', '2026-09-10T21:00:00Z');
  expect(clock.innerHTML).toContain('5:00 PM');
});

it('ignores small differences, which cached pages produce', async () => {
  const clock = await setup('2026-09-10T16:00:00Z', '2026-09-10T15:58:30Z');
  expect(clock.innerHTML).toContain('12:00 PM');
});

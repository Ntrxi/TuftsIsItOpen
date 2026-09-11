// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { locations } from '../src/data';
import type { LiveData } from '../src/engine/live';
import { renderPage } from '../src/render/page';

const listeners: Array<() => void> = [];
afterEach(() => {
  listeners.splice(0).forEach((remove) => remove());
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  localStorage.clear();
  history.replaceState(null, '', '/');
});

async function setup({ hidden = false, offline = false, storage = {} as Record<string, unknown>, live = async () => new Response(JSON.stringify(snapshot())) } = {}) {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(hidden ? 'hidden' : 'visible');
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(!offline);
  vi.stubGlobal('fetch', vi.fn().mockImplementation(live));
  const beacon = vi.fn();
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { sendBeacon: beacon }));
  for (const target of [document, window]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
      add(type, listener, options);
      listeners.push(() => target.removeEventListener(type, listener, options));
    });
  }
  document.documentElement.innerHTML = renderPage(locations, { beaconToken: 'test-token' });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, JSON.stringify(value));
  await import('../src/client/main');
  return {
    beacon,
    visibility(value: 'hidden' | 'visible') {
      visibility.mockReturnValue(value);
      document.dispatchEvent(new Event('visibilitychange'));
    },
    online(value: boolean) {
      online.mockReturnValue(value);
      window.dispatchEvent(new Event(value ? 'online' : 'offline'));
    },
  };
}

it.each([{}, ['dewick', 42]])('resets malformed persisted pins without crashing', async (saved) => {
  await setup({ storage: { 'iio:pinned': saved } });
  expect(localStorage.getItem('iio:pinned')).toBeNull();
  expect(document.querySelector<HTMLElement>('.group[data-group="pinned"]')!.hidden).toBe(true);
});

it('discards missing location IDs from persisted pins', async () => {
  await setup({ storage: { 'iio:pinned': ['dewick', 'retired-location'] } });
  expect(localStorage.getItem('iio:pinned')).toBe('["dewick"]');
  expect(document.querySelector<HTMLElement>('#loc-dewick')!.closest<HTMLElement>('.group')!.dataset.group).toBe('pinned');
});

it.each(['old-category', {}, ['library']])('resets invalid persisted categories to all', async (saved) => {
  await setup({ storage: { 'iio:cat': saved } });
  expect(localStorage.getItem('iio:cat')).toBeNull();
  expect(document.getElementById('list')!.dataset.cat).toBe('all');
  expect(document.querySelector('.filter[data-cat="all"]')!.classList).toContain('is-active');
  expect(document.querySelectorAll('.card:not([hidden])').length).toBe(locations.length);
});

function snapshot(): LiveData {
  return { fetchedAt: new Date().toISOString(), overrides: {}, vehicles: {}, sources: { library: 'ok', dining: 'ok', shuttles: 'ok' } };
}

it('fetches live data on load, then polls visible tabs every two minutes and pauses hidden and offline tabs', async () => {
  const client = await setup();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(119_999);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  client.visibility('hidden');
  await vi.advanceTimersByTimeAsync(600_000);
  expect(fetch).toHaveBeenCalledTimes(2);
  client.visibility('visible');
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(3);
  client.visibility('hidden');
  client.visibility('visible');
  expect(fetch).toHaveBeenCalledTimes(3);
  client.online(false);
  await vi.advanceTimersByTimeAsync(600_000);
  expect(fetch).toHaveBeenCalledTimes(3);
  client.online(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('defers startup while hidden/offline and fetches on return', async () => {
  const client = await setup({ hidden: true, offline: true });
  await vi.advanceTimersByTimeAsync(120_000);
  client.online(true);
  expect(fetch).not.toHaveBeenCalled();
  client.visibility('visible');
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
});

function closure(): LiveData {
  return { ...snapshot(), overrides: { 'tisch-library': [{ from: '2026-09-10', hours: 'closed', note: 'Feed closure' }] } };
}

it('keeps cards pending until the first live snapshot, then renders from it without a static flash', async () => {
  let resolve!: (response: Response) => void;
  await setup({ live: () => new Promise<Response>((done) => { resolve = done; }) });
  const card = document.querySelector<HTMLElement>('#loc-tisch-library')!;
  expect(card.dataset.state).toBe('pending');
  expect(card.textContent).toContain('Checking…');
  expect(document.getElementById('clock')!.textContent).toContain('12:00 PM');
  expect(document.getElementById('live-sources')!.textContent).toBe('');
  await vi.advanceTimersByTimeAsync(2_000);
  expect(card.dataset.state).toBe('pending');
  resolve(new Response(JSON.stringify(closure())));
  await vi.advanceTimersByTimeAsync(0);
  expect(card.dataset.state).toBe('closed');
  expect(card.textContent).toContain('Feed closure');
  expect(document.querySelectorAll('.card[data-state="pending"]').length).toBe(0);
  expect(document.body.textContent).not.toContain('Live hours unavailable');
  expect(document.getElementById('live-sources')!.textContent).toContain('library: ok');
});

it('falls back to the static schedule when the live snapshot is slow, then patches it in', async () => {
  let resolve!: (response: Response) => void;
  await setup({ live: () => new Promise<Response>((done) => { resolve = done; }) });
  await vi.advanceTimersByTimeAsync(2_500);
  expect(document.querySelectorAll('.card[data-state="pending"]').length).toBe(0);
  const card = document.querySelector<HTMLElement>('#loc-tisch-library')!;
  expect(card.dataset.state).toBe('open');
  expect(card.textContent).toContain('Live hours unavailable');
  resolve(new Response(JSON.stringify(closure())));
  await vi.advanceTimersByTimeAsync(0);
  expect(card.dataset.state).toBe('closed');
  expect(card.textContent).not.toContain('Live hours unavailable');
});

it('renders the static schedule at once when loaded offline', async () => {
  await setup({ offline: true });
  expect(fetch).not.toHaveBeenCalled();
  expect(document.querySelectorAll('.card[data-state="pending"]').length).toBe(0);
  expect(document.querySelector<HTMLElement>('#loc-tisch-library')!.dataset.state).toBe('open');
});

it('coalesces triggers during a request', async () => {
  const client = await setup();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  client.online(true);
  client.visibility('hidden');
  client.visibility('visible');
  client.online(true);
  await vi.advanceTimersByTimeAsync(120_000);
  expect(fetch).toHaveBeenCalledTimes(2);
  resolve(new Response(JSON.stringify(snapshot())));
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(120_000);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it('waits two minutes after a failed poll even when visibility changes', async () => {
  const client = await setup();
  vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 503 }));
  await vi.advanceTimersByTimeAsync(120_000);
  client.visibility('hidden');
  client.visibility('visible');
  await vi.advanceTimersByTimeAsync(119_999);
  expect(fetch).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it('preserves interactions and the basic beacon without custom tracking requests', async () => {
  history.replaceState(null, '', '/#loc-dewick');
  const client = await setup();
  const card = document.querySelector<HTMLDetailsElement>('#loc-dewick')!;
  expect(card.open).toBe(true);
  const search = document.querySelector<HTMLInputElement>('#q')!;
  search.value = 'no matching place';
  search.dispatchEvent(new Event('input'));
  expect(card.hidden).toBe(true);
  search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(card.hidden).toBe(false);
  document.querySelector<HTMLButtonElement>('.filter[data-cat="library"]')!.click();
  expect(card.hidden).toBe(true);
  document.querySelector<HTMLButtonElement>('.filter[data-cat="all"]')!.click();
  document.querySelector<HTMLButtonElement>('#open-only')!.click();
  expect(document.querySelector('#open-only')!.getAttribute('aria-pressed')).toBe('true');
  card.querySelector<HTMLButtonElement>('.pin')!.click();
  expect(card.closest<HTMLElement>('.group')!.dataset.group).toBe('pinned');
  expect(card.querySelector('.pin')!.getAttribute('aria-pressed')).toBe('true');
  card.open = false;
  card.open = true;
  await vi.advanceTimersByTimeAsync(1_000);
  expect(client.beacon).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetch).mock.calls.every(([url]) => url === '/api/live')).toBe(true);
  expect(document.querySelector('script[data-cf-beacon]')!.getAttribute('data-cf-beacon')).toContain('test-token');
});

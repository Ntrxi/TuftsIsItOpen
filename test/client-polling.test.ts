// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { calendar, locations } from '../src/data';
import { computeAll } from '../src/engine/status';
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

async function setup({ hidden = false, offline = false, age = 0, storage = {} as Record<string, unknown> } = {}) {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(hidden ? 'hidden' : 'visible');
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(!offline);
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(snapshot()))));
  const beacon = vi.fn();
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { sendBeacon: beacon }));
  for (const target of [document, window]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
      add(type, listener, options);
      listeners.push(() => target.removeEventListener(type, listener, options));
    });
  }
  window.__LIVE__ = snapshot();
  window.__RENDERED_AT__ = new Date(Date.now() - age).toISOString();
  document.documentElement.innerHTML = renderPage(locations, computeAll(locations, calendar, new Date()), calendar, snapshot(), new Date(), { beaconToken: 'test-token' });
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

it('polls visible tabs every two minutes and pauses hidden and offline tabs', async () => {
  const client = await setup();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(fetch).toHaveBeenCalledTimes(1);
  client.visibility('hidden');
  await vi.advanceTimersByTimeAsync(600_000);
  expect(fetch).toHaveBeenCalledTimes(1);
  client.visibility('visible');
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(2);
  client.visibility('hidden');
  client.visibility('visible');
  expect(fetch).toHaveBeenCalledTimes(2);
  client.online(false);
  await vi.advanceTimersByTimeAsync(600_000);
  expect(fetch).toHaveBeenCalledTimes(2);
  client.online(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it('defers old-page startup while hidden/offline and refreshes on return', async () => {
  const client = await setup({ hidden: true, offline: true, age: 90_000 });
  await vi.advanceTimersByTimeAsync(120_000);
  client.online(true);
  expect(fetch).not.toHaveBeenCalled();
  client.visibility('visible');
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('refreshes old pages immediately and coalesces triggers during a request', async () => {
  const client = await setup({ age: 90_000 });
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
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(2);
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
  expect(fetch).not.toHaveBeenCalled();
  expect(document.querySelector('script[data-cf-beacon]')!.getAttribute('data-cf-beacon')).toContain('test-token');
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { updateHTML } from '../src/client/update';
import { locations, calendar } from '../src/data';
import { computeStatus } from '../src/engine/status';
import { renderCard } from '../src/render/render';
import type { LiveData } from '../src/engine/live';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

it('preserves focused controls and links during status text updates and skips unchanged markup', () => {
  const root = document.createElement('div');
  document.body.append(root);
  const html = '<span>Open</span><button class="pin" aria-pressed="false">Pin</button><a href="https://tufts.edu">Source</a>';
  updateHTML(root, html);
  const button = root.querySelector('button')!;
  button.focus();
  button.setAttribute('aria-pressed', 'true');
  updateHTML(root, html.replace('Open', 'Closed'));
  expect(document.activeElement).toBe(button);
  expect(button.getAttribute('aria-pressed')).toBe('true');
  const link = root.querySelector('a')!;
  link.focus();
  updateHTML(root, html.replace('Open', 'Unknown'));
  expect(document.activeElement).toBe(link);
  const observer = new MutationObserver(() => undefined);
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
  updateHTML(root, html.replace('Open', 'Unknown'));
  expect(observer.takeRecords()).toEqual([]);
  observer.disconnect();
  updateHTML(root, '<p>New schedule warning</p>' + html);
  expect(document.activeElement?.getAttribute('href')).toBe('https://tufts.edu');
});

it('retains recent data through failures, expires by age, and recovers without AbortSignal.timeout', async () => {
  vi.resetModules();
  vi.useFakeTimers();
  const now = new Date('2026-09-10T16:00:00Z');
  vi.setSystemTime(now);
  const data: LiveData = { fetchedAt: now.toISOString(), sources: { library: 'ok', dining: 'ok', bray: 'ok', shuttles: 'ok' },
    overrides: { carmichael: [{ from: '2026-09-10', hours: 'closed', note: 'Feed closure' }] }, vehicles: { 'davis-shuttle': 3 } };
  window.__LIVE__ = data;
  window.__RENDERED_AT__ = now.toISOString();
  document.body.innerHTML = locations.filter((l) => ['carmichael', 'davis-shuttle'].includes(l.id)).map((l) => renderCard(l, computeStatus(l, calendar, now, data.overrides), data)).join('');
  vi.stubGlobal('AbortSignal', { timeout: undefined });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
  await import('../src/client/main');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  expect(document.body.textContent).toContain('3 buses live');
  window.dispatchEvent(new Event('offline'));
  expect(document.body.textContent).toContain('3 buses live');
  // Polling pauses while offline and resumes on reconnect (jsdom never flips navigator.onLine itself).
  window.dispatchEvent(new Event('online'));
  await vi.advanceTimersByTimeAsync(120_000);
  expect(fetch).toHaveBeenCalled();
  expect(document.body.textContent).toContain('3 buses live');
  expect(document.querySelector('#loc-carmichael')?.getAttribute('data-state')).toBe('closed');
  vi.mocked(fetch).mockResolvedValue(new Response('{"overrides":{}}'));
  await vi.advanceTimersByTimeAsync(120_000);
  expect(document.body.textContent).not.toContain('3 buses live');
  expect(document.querySelector('#loc-carmichael')?.getAttribute('data-state')).toBe('closed');
  // Timeout must abort, but cannot erase hours inside their TTL.
  let signal: AbortSignal | undefined;
  vi.mocked(fetch).mockImplementation((_url, init) => {
    signal = init?.signal ?? undefined;
    return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('timeout'))));
  });
  await vi.advanceTimersByTimeAsync(130_000);
  expect(signal?.aborted).toBe(true);
  expect(document.querySelector('#loc-carmichael')?.getAttribute('data-state')).toBe('closed');
  await vi.advanceTimersByTimeAsync(9 * 60_000);
  expect(document.querySelector('#loc-carmichael')?.getAttribute('data-state')).toBe('open');
  expect(document.body.textContent).toContain('Live hours unavailable');
  vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ ...data, fetchedAt: new Date().toISOString() })));
  await vi.advanceTimersByTimeAsync(120_000);
  expect(document.querySelector('#loc-carmichael')?.getAttribute('data-state')).toBe('closed');
  expect(document.body.textContent).toContain('3 buses live');
});

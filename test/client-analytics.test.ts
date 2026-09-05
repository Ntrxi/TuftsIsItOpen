import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function setup() {
  vi.resetModules();
  vi.useFakeTimers();
  const q = Object.assign(new EventTarget(), { value: '', blur() {} });
  const chip = (cat: string) => Object.assign(new EventTarget(), {
    dataset: { cat }, classList: { toggle() {} }, setAttribute() {}, scrollIntoView() {},
  });
  const filters = [chip('all'), chip('dining'), chip('library')];
  const card = { dataset: { cat: 'dining', search: 'dewick', state: 'open' }, hidden: false };
  const group = { dataset: { group: 'dining' }, hidden: false, querySelectorAll: () => [card] };
  vi.stubGlobal('document', {
    readyState: 'complete', addEventListener() {}, querySelector: () => null,
    getElementById: (id: string) => id === 'q' ? q : null,
    querySelectorAll: (selector: string) => selector === '.filter' ? filters : selector === '.group' ? [group] : [],
  });
  vi.stubGlobal('window', { __RENDERED_AT__: new Date().toISOString(), addEventListener() {} });
  vi.stubGlobal('location', { hash: '' });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
  const sendBeacon = vi.fn().mockReturnValue(true);
  vi.stubGlobal('navigator', { sendBeacon });
  await import('../src/client/main');
  return {
    input(value: string) { q.value = value; q.dispatchEvent(new Event('input')); },
    escape() { q.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' })); },
    category(index: number) { filters[index]!.dispatchEvent(new Event('click')); },
    events: () => sendBeacon.mock.calls.map((call) => JSON.parse(call[1])),
  };
}

it('cancels pending searches on Escape and tracks the same term after clearing', async () => {
  const client = await setup();
  client.input('dewick');
  client.escape();
  vi.advanceTimersByTime(1000);
  expect(client.events()).toEqual([]);
  for (const clear of [() => client.escape(), () => client.input('')]) {
    client.input('dewick');
    vi.advanceTimersByTime(1000);
    clear();
  }
  client.input('dewick');
  vi.advanceTimersByTime(1000);
  expect(client.events()).toEqual(Array(3).fill({ type: 'search', length: 6, results: 1 }));
});

it('records only category changes and counts results using filters at emission time', async () => {
  const client = await setup();
  client.category(0);
  client.input('dewick');
  client.category(2);
  client.category(2);
  vi.advanceTimersByTime(1000);
  expect(client.events()).toEqual([
    { type: 'filter', key: 'category', value: 'library' },
    { type: 'search', length: 6, results: 0 },
  ]);
});

import { addDays } from '../src/engine/time';

export const NOW = new Date('2026-09-10T16:00:00Z');
export const libcal = () => ({ locations: [20832, 20834, 20836, 15418, 14360].map((lid) => ({ lid, weeks: [Object.fromEntries(
  Array.from({ length: 8 }, (_, n) => { const date = addDays('2026-09-09', n); return [date, { date, times: { status: 'open', hours: [{ from: '9am', to: '9pm' }] } }]; }),
)] })) });
export function feedBody(url: string): unknown {
  if (url.includes('libcal')) return libcal();
  if (url.includes('passiogo')) return { buses: { a: { busId: '1', routeId: '63771', outOfService: 0 } } };
  if (url.includes('carmichael')) return { days: [{ date: '2026-09-12', menu_items: [{ text: 'Closed for testing', is_holiday: true, food: null }] }] };
  return { days: [] };
}
export const response = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

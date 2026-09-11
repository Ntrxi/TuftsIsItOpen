import { describe, expect, it } from 'vitest';
import { renderCard } from '../src/render/render';
import { fmtDateRange, renderPage } from '../src/render/page';
import { computeStatus } from '../src/engine/status';
import { localToDate } from '../src/engine/time';
import { t } from '../src/engine/format';
import { calendar, locations } from '../src/data';
import { EMPTY_LIVE } from '../src/engine/live';

const byId = (id: string) => locations.find((l) => l.id === id)!;
const at = (key: string, time: string) => localToDate(key, t(time));

describe('card chips', () => {
  it('avoids a redundant confirmation chip while retaining the unverified indicator', () => {
    const pub = byId('popup-pub'); // medium
    expect(renderCard(pub, computeStatus(pub, calendar, at('2026-09-17', '19:00')), EMPTY_LIVE)).not.toContain('Confirm hours');
    const nolop = byId('nolop'); // low
    const html = renderCard(nolop, computeStatus(nolop, calendar, at('2026-09-17', '19:00')), EMPTY_LIVE);
    expect(html).toContain('Unverified');
    expect(html).not.toContain('Confirm hours');
  });

  it('explains special hours in the chip', () => {
    const hs = byId('health-service');
    const html = renderCard(hs, computeStatus(hs, calendar, at('2026-09-07', '12:00')), EMPTY_LIVE);
    expect(html).toContain('title="Closed for Labor Day">Special hours');
  });
});

describe('footer', () => {
  it('formats the verification range', () => {
    expect(fmtDateRange('2026-09-05', '2026-09-05')).toBe('Sep 5, 2026');
    expect(fmtDateRange('2026-09-03', '2026-09-05')).toBe('Sep 3–5, 2026');
    expect(fmtDateRange('2026-08-30', '2026-09-05')).toBe('Aug 30 – Sep 5, 2026');
    expect(fmtDateRange('2026-12-30', '2027-01-02')).toBe('Dec 30, 2026 – Jan 2, 2027');
  });

  it('reports the oldest and newest check dates, not just the newest', () => {
    const html = renderPage(locations);
    const dates = locations.flatMap((l) => (l.verified ? [l.verified] : [])).sort();
    expect(html).toContain(`checked ${fmtDateRange(dates[0]!, dates[dates.length - 1]!)}`);
  });
});

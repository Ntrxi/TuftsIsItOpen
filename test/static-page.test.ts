import { describe, expect, it } from 'vitest';
import { calendar, locations } from '../src/data';
import { renderPage } from '../src/render/page';
import { renderCard, renderPendingCard } from '../src/render/render';
import { computeStatus } from '../src/engine/status';
import { localToDate } from '../src/engine/time';
import { t } from '../src/engine/format';
import { EMPTY_LIVE } from '../src/engine/live';

describe('static homepage', () => {
  const html = renderPage(locations, { beaconToken: 'tok<en>' });

  it('bakes in nothing that depends on the request time or live feeds', () => {
    expect(html).not.toContain('__LIVE__');
    expect(html).not.toContain('__RENDERED_AT__');
    expect(html).not.toContain('<time datetime=');
    expect(html.match(/data-state="pending"/g)).toHaveLength(locations.length);
    expect(html).not.toMatch(/data-state="(open|closed|running)"/);
    expect(html).toContain('<span id="live-sources"></span>');
    expect(html).toContain('<noscript>');
  });

  it('keeps the official links and descriptions in the pending card for readers without scripts', () => {
    for (const loc of locations) {
      const card = renderPendingCard(loc);
      expect(card).toContain(`href="${loc.links.source.replace(/&/g, '&amp;')}"`);
      if (loc.description) expect(card).toContain(loc.description.slice(0, 20).replace(/&/g, '&amp;'));
      expect(card).not.toContain('Today');
    }
  });

  it('matches the rendered card shape so hydration patches in place', () => {
    const tisch = locations.find((l) => l.id === 'tisch-library')!;
    const rendered = renderCard(tisch, computeStatus(tisch, calendar, localToDate('2026-09-17', t('19:00'))), EMPTY_LIVE);
    const pending = renderPendingCard(tisch);
    for (const attr of ['id="loc-tisch-library"', 'data-id="tisch-library"', 'data-cat="library"', 'data-search="']) {
      expect(pending).toContain(attr);
      expect(rendered).toContain(attr);
    }
    const shape = (card: string) => card.match(/class="(card-head|card-body|card-main|card-name|card-status|pin|col)"/g)?.sort();
    expect(shape(pending)).toEqual(shape(rendered));
  });

  it('embeds the analytics beacon only when a token is configured, escaped for the attribute', () => {
    expect(html).toContain('data-cf-beacon="{&quot;token&quot;:&quot;tok&lt;en&gt;&quot;}"');
    expect(renderPage(locations)).not.toContain('cloudflareinsights');
    expect(renderPage(locations, { beaconToken: '' })).not.toContain('cloudflareinsights');
  });
});

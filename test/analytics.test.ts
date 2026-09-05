import { describe, expect, it } from 'vitest';
import { toDataPoint, type EventContext } from '../src/engine/analytics';

const ctx: EventContext = {
  locations: new Map([
    ['dewick', 'dining'],
    ['tisch', 'library'],
  ]),
  categories: new Set(['dining', 'library']),
};

describe('analytics events', () => {
  it('records a location view with its category', () => {
    expect(toDataPoint({ type: 'location_view', id: 'dewick' }, ctx)).toEqual({
      indexes: ['location_view'],
      blobs: ['location_view', 'dewick', 'dining'],
      doubles: [],
    });
  });

  it('drops views of unknown locations', () => {
    expect(toDataPoint({ type: 'location_view', id: 'nope' }, ctx)).toBeNull();
    expect(toDataPoint({ type: 'location_view', id: 42 }, ctx)).toBeNull();
    expect(toDataPoint({ type: 'location_view' }, ctx)).toBeNull();
  });

  it('records searches as length and result count only', () => {
    expect(toDataPoint({ type: 'search', length: 5, results: 2 }, ctx)).toEqual({
      indexes: ['search'],
      blobs: ['search', '', ''],
      doubles: [5, 2],
    });
    // Free text is never carried through, even if a client sends it.
    const point = toDataPoint({ type: 'search', length: 3, results: 0, query: 'tisch' }, ctx);
    expect(JSON.stringify(point)).not.toContain('tisch');
  });

  it('rejects or clamps bad numbers', () => {
    expect(toDataPoint({ type: 'search', length: -1, results: 0 }, ctx)).toBeNull();
    expect(toDataPoint({ type: 'search', length: 'x', results: 0 }, ctx)).toBeNull();
    expect(toDataPoint({ type: 'search', length: Infinity, results: 0 }, ctx)).toBeNull();
    expect(toDataPoint({ type: 'search', length: 1e9, results: 2.4 }, ctx)?.doubles).toEqual([1000, 2]);
  });

  it('records category and open-only filter changes', () => {
    expect(toDataPoint({ type: 'filter', key: 'category', value: 'dining' }, ctx)?.blobs).toEqual(['filter', 'dining', '']);
    expect(toDataPoint({ type: 'filter', key: 'category', value: 'all' }, ctx)?.blobs).toEqual(['filter', 'all', '']);
    expect(toDataPoint({ type: 'filter', key: 'category', value: 'parking' }, ctx)).toBeNull();
    expect(toDataPoint({ type: 'filter', key: 'open_only', on: true }, ctx)).toEqual({
      indexes: ['filter'],
      blobs: ['filter', 'open_only', ''],
      doubles: [1],
    });
    expect(toDataPoint({ type: 'filter', key: 'open_only', on: 'yes' }, ctx)).toBeNull();
    expect(toDataPoint({ type: 'filter', key: 'pinned', value: 'x' }, ctx)).toBeNull();
  });

  it('rejects unknown or malformed bodies', () => {
    expect(toDataPoint(null, ctx)).toBeNull();
    expect(toDataPoint('location_view', ctx)).toBeNull();
    expect(toDataPoint({ type: 'pageview' }, ctx)).toBeNull();
    expect(toDataPoint([], ctx)).toBeNull();
  });
});

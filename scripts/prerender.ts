import { locations } from '../src/data';
import { renderPage, type PageOptions } from '../src/render/page';

/** The static homepage. Bundled by scripts/build-client.mjs and run in Node at build time. */
export function prerender(opts: PageOptions = {}): string {
  return renderPage(locations, opts);
}

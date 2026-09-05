import type { Category, Location } from '../engine/types';
import { dining } from './dining';
import { library } from './library';
import { mail } from './mail';
import { recreation } from './recreation';
import { health } from './health';
import { tech } from './tech';
import { transit } from './transit';

export { calendar } from './calendar';

export const CATEGORY_ORDER: Category[] = ['dining', 'library', 'recreation', 'mail', 'health', 'tech', 'transit'];

export const CATEGORY_META: Record<Category, { label: string; short: string; icon: string }> = {
  dining: { label: 'Dining', short: 'Dining', icon: '🍽️' },
  library: { label: 'Libraries & study', short: 'Library', icon: '📚' },
  recreation: { label: 'Recreation', short: 'Rec', icon: '🏊' },
  mail: { label: 'Mail & shopping', short: 'Mail', icon: '📦' },
  health: { label: 'Health & wellness', short: 'Health', icon: '🩺' },
  tech: { label: 'Tech & makerspaces', short: 'Tech', icon: '🛠️' },
  transit: { label: 'Shuttles', short: 'Shuttles', icon: '🚌' },
};

export const locations: Location[] = [...dining, ...library, ...recreation, ...mail, ...health, ...tech, ...transit];

const verifiedDates = locations.flatMap((l) => (l.verified ? [l.verified] : [])).sort();

/** Oldest and newest dates on which hours in the dataset were checked against a source. */
export const DATA_VERIFIED = verifiedDates.length ? { earliest: verifiedDates[0]!, latest: verifiedDates[verifiedDates.length - 1]! } : undefined;

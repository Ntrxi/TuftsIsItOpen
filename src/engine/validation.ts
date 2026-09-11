/** Small guards for the external JSON fields that affect status decisions. */
export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function dateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function dayHours(value: unknown): boolean {
  return Array.isArray(value) && value.every((i) => record(i) &&
    Number.isInteger(i.start) && Number.isInteger(i.end) &&
    Number(i.start) >= 0 && Number(i.start) < 2880 && Number(i.end) > Number(i.start) && Number(i.end) <= 2880 &&
    (i.label === undefined || typeof i.label === 'string') &&
    (i.access === undefined || ['open', 'special', 'appointment', 'unknown'].includes(String(i.access))) &&
    (i.confidence === undefined || ['high', 'medium', 'low'].includes(String(i.confidence))));
}

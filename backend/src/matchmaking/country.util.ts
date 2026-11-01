/** ISO 3166-1 alpha-2 codes and common aliases for loose profile country strings. */
const ALIASES: Record<string, string> = {
  usa: 'us',
  uss: 'us',
  'united states': 'us',
  'united states of america': 'us',
  uk: 'gb',
  'united kingdom': 'gb',
  uae: 'ae',
  'united arab emirates': 'ae',
};

const NAME_TO_CODE: Record<string, string> = {
  afghanistan: 'af',
  albania: 'al',
  algeria: 'dz',
  argentina: 'ar',
  australia: 'au',
  austria: 'at',
  brazil: 'br',
  canada: 'ca',
  chile: 'cl',
  china: 'cn',
  colombia: 'co',
  france: 'fr',
  germany: 'de',
  india: 'in',
  indonesia: 'id',
  italy: 'it',
  japan: 'jp',
  mexico: 'mx',
  netherlands: 'nl',
  portugal: 'pt',
  spain: 'es',
  thailand: 'th',
  ukraine: 'ua',
  'united states': 'us',
};

export function normalizeCountryToken(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  if (/^[a-z]{2}$/i.test(trimmed)) return lower;
  if (NAME_TO_CODE[lower]) return NAME_TO_CODE[lower];
  return lower;
}

/**
 * When `seekerFilter` is set, partner must resolve to the same country token.
 * Unknown partner country skips the match (strict filter).
 */
export function countriesCompatible(
  seekerFilter: string | null | undefined,
  seekerCountry: string | null | undefined,
  partnerFilter: string | null | undefined,
  partnerCountry: string | null | undefined,
): boolean {
  const myWant = normalizeCountryToken(seekerFilter);
  const theirCountry = normalizeCountryToken(partnerCountry);
  const theirWant = normalizeCountryToken(partnerFilter);
  const myCountry = normalizeCountryToken(seekerCountry);

  if (myWant) {
    if (!theirCountry || theirCountry !== myWant) return false;
  }
  if (theirWant) {
    if (!myCountry || myCountry !== theirWant) return false;
  }
  return true;
}

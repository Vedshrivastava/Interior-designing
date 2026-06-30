/**
 * City service area data.
 * slug → display name, state, and location variations (for matching project.location field).
 *
 * Core cities are hardcoded below for zero-latency access. Cities added
 * later via the Admin panel ("Show on a City Page" → Select City → Add
 * new) are merged in from the backend at request time, so their
 * /interior-designer/[city] page gets equally accurate name/state-aware
 * SEO copy without ever needing a code change here.
 */
export const CITIES = {
  'indore':    { name: 'Indore',    state: 'Madhya Pradesh', variations: ['indore']                          },
  'mumbai':    { name: 'Mumbai',    state: 'Maharashtra',    variations: ['mumbai', 'bombay']                },
  'satna':     { name: 'Satna',     state: 'Madhya Pradesh', variations: ['satna']                           },
  'nagod':     { name: 'Nagod',     state: 'Madhya Pradesh', variations: ['nagod']                           },
  'bhopal':    { name: 'Bhopal',    state: 'Madhya Pradesh', variations: ['bhopal']                          },
  'jabalpur':  { name: 'Jabalpur',  state: 'Madhya Pradesh', variations: ['jabalpur']                        },
  'rewa':      { name: 'Rewa',      state: 'Madhya Pradesh', variations: ['rewa']                            },
  'pune':      { name: 'Pune',      state: 'Maharashtra',    variations: ['pune']                            },
  'kolhapur':  { name: 'Kolhapur',  state: 'Maharashtra',    variations: ['kolhapur']                        },
};

export const CITY_SLUGS = Object.keys(CITIES);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/** Fetches cities managed via the Admin panel, beyond the hardcoded core list above. */
async function fetchDBCities() {
  try {
    const res = await fetch(`${API_URL}/api/city/list`, { next: { revalidate: 60 } });
    const json = await res.json();
    if (!json.success) return {};
    const map = {};
    for (const c of json.data) {
      if (CITIES[c.slug]) continue; // core hardcoded list always wins
      map[c.slug] = {
        name: c.name,
        state: c.state,
        variations: c.variations?.length ? c.variations : [c.name.toLowerCase()],
      };
    }
    return map;
  } catch {
    return {};
  }
}

/** Returns every known city slug (hardcoded + admin-added) — used for static generation. */
export async function getAllCitySlugs() {
  const dbCities = await fetchDBCities();
  return [...new Set([...CITY_SLUGS, ...Object.keys(dbCities)])];
}

/** Returns the city object for a slug: hardcoded → admin-added → generic fallback. */
export async function getCity(slug) {
  if (CITIES[slug]) return CITIES[slug];
  const dbCities = await fetchDBCities();
  if (dbCities[slug]) return dbCities[slug];
  const name = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return { name, state: 'India', variations: [slug.replace(/-/g, ' ')] };
}

/** Returns true if a project's location field belongs to this city slug. */
export async function matchesCity(location, slug) {
  if (!location) return false;
  const lower = location.toLowerCase().trim();
  const city = CITIES[slug] || (await fetchDBCities())[slug];
  if (!city) return lower.includes(slug.replace(/-/g, ' '));
  return city.variations.some(v => lower.includes(v));
}

/** Converts a raw location string (e.g. "Indore, MP") to a known slug. */
export async function locationToSlug(location) {
  if (!location) return null;
  const lower = location.toLowerCase().trim();
  const dbCities = await fetchDBCities();
  const allCities = { ...CITIES, ...dbCities };
  for (const [slug, data] of Object.entries(allCities)) {
    if (data.variations.some(v => lower.includes(v))) return slug;
  }
  // Fallback: take the first segment before a comma and slugify it
  const city = lower.split(',')[0].trim().replace(/\s+/g, '-');
  return city || null;
}

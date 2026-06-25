/**
 * City service area data.
 * slug → display name, state, and location variations (for matching project.location field).
 * Add new cities here and the /interior-designer/[city] page auto-generates.
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
};

export const CITY_SLUGS = Object.keys(CITIES);

/** Returns the city object for a slug, or generates one from the raw slug */
export function getCity(slug) {
  if (CITIES[slug]) return CITIES[slug];
  const name = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return { name, state: 'India', variations: [slug.replace(/-/g, ' ')] };
}

/** Returns true if a project's location field belongs to this city slug */
export function matchesCity(location, slug) {
  if (!location) return false;
  const lower = location.toLowerCase().trim();
  const city = CITIES[slug];
  if (!city) return lower.includes(slug.replace(/-/g, ' '));
  return city.variations.some(v => lower.includes(v));
}

/** Converts a raw location string (e.g. "Indore, MP") to a known slug */
export function locationToSlug(location) {
  if (!location) return null;
  const lower = location.toLowerCase().trim();
  for (const [slug, data] of Object.entries(CITIES)) {
    if (data.variations.some(v => lower.includes(v))) return slug;
  }
  // Fallback: take the first segment before a comma and slugify it
  const city = lower.split(',')[0].trim().replace(/\s+/g, '-');
  return city || null;
}

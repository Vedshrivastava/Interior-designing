/**
 * Single source of truth for design category slugs.
 *
 * Slug rules:
 *  - lowercase, hyphen-separated (SEO best practice)
 *  - matches what Google prefers over %20-encoded spaces
 *
 * slug           → DB category name (used in API calls + display)
 */
export const SLUG_TO_CATEGORY = {
  'kitchen-designs':      'Kitchen Designs',
  'bedroom-designs':      'Bedroom Designs',
  'bathroom-designs':     'Bathroom Designs',
  'lounge-area-designs':  'Lounge area Designs',
  'tv-unit-designs':      'TV Unit Designs',
  'kids-room-designs':    'Kids Room Designs',
  'commercial-designs':   'Commercial Designs',
  'house-exterior':       'House Exterior',
  'mandir-designs':       'Mandir Designs',
  'garden-designs':       'Garden Designs',
};

/** Reverse map: DB category name → slug */
export const CATEGORY_TO_SLUG = Object.fromEntries(
  Object.entries(SLUG_TO_CATEGORY).map(([slug, cat]) => [cat, slug])
);

/** Ordered list of slugs for generateStaticParams + navigation */
export const CATEGORY_SLUGS = Object.keys(SLUG_TO_CATEGORY);

/** Short display labels for the category nav bar */
export const SLUG_LABELS = {
  'kitchen-designs':      'Kitchen',
  'bedroom-designs':      'Bedroom',
  'bathroom-designs':     'Bathroom',
  'lounge-area-designs':  'Lounge',
  'tv-unit-designs':      'TV Unit',
  'kids-room-designs':    'Kids Room',
  'commercial-designs':   'Commercial',
  'house-exterior':       'Exterior',
  'mandir-designs':       'Mandir',
  'garden-designs':       'Garden',
};

/** Default slug when linking to the designs section */
export const DEFAULT_DESIGN_SLUG = 'kitchen-designs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Fetches live categories from the DB.
 * Returns an array of { name, slug, label } objects.
 * Falls back to the hardcoded list on error.
 */
export async function fetchCategoriesFromDB() {
  try {
    const res = await fetch(`${API_URL}/api/category/list`, { cache: 'no-store' });
    const json = await res.json();
    if (json.success && json.data?.length > 0) return json.data;
  } catch {}
  // fallback to hardcoded
  return CATEGORY_SLUGS.map(slug => ({
    name:  SLUG_TO_CATEGORY[slug],
    slug,
    label: SLUG_LABELS[slug],
  }));
}

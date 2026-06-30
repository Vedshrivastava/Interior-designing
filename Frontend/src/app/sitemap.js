import { CATEGORY_SLUGS, SLUG_TO_CATEGORY, CATEGORY_TO_SLUG, fetchCategoriesFromDB } from '@/lib/categories';
import { getAllCitySlugs, locationToSlug, matchesCity } from '@/lib/cities';

const BASE_URL = 'https://www.shrivastavaselevate.com';
const API_URL  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const revalidate = 3600; // rebuild sitemap every hour

export default async function sitemap() {
  // ── Fetch all content for image declarations ──────────────────
  let allDesigns  = [];
  let allProducts = [];
  let allProjects = [];

  try {
    const [designRes, productRes, projectRes] = await Promise.all([
      fetch(`${API_URL}/api/design/list`,  { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) }),
      fetch(`${API_URL}/api/product/list`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) }),
      fetch(`${API_URL}/api/project/list`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) }),
    ]);

    if (designRes.ok)  { const d = await designRes.json();  if (d.success) allDesigns  = d.data ?? []; }
    if (productRes.ok) { const d = await productRes.json(); if (d.success) allProducts = d.data ?? []; }
    if (projectRes.ok) { const d = await projectRes.json(); if (d.success) allProjects = d.data ?? []; }
  } catch {
    // API unavailable at build time — sitemap will have no images but valid URLs
  }

  // ── Fetch live categories ─────────────────────────────────────
  const liveCategories = await fetchCategoriesFromDB();
  const liveCategoryToSlug = Object.fromEntries(liveCategories.map(c => [c.name, c.slug]));

  // ── Group designs by category slug ────────────────────────────
  const designsBySlug = {};
  for (const design of allDesigns) {
    const slug = liveCategoryToSlug[design.category] || CATEGORY_TO_SLUG[design.category];
    if (!slug) continue;
    if (!designsBySlug[slug]) designsBySlug[slug] = [];
    designsBySlug[slug].push(design);
  }

  // ── Static routes ─────────────────────────────────────────────
  const staticRoutes = [
    { url: BASE_URL,                 lastModified: new Date(), priority: 1.0,  changeFrequency: 'weekly'  },
    { url: `${BASE_URL}/services`,   lastModified: new Date(), priority: 0.95, changeFrequency: 'monthly' },
    { url: `${BASE_URL}/about`,      lastModified: new Date(), priority: 0.8,  changeFrequency: 'monthly' },
    { url: `${BASE_URL}/contact`,    lastModified: new Date(), priority: 0.75, changeFrequency: 'yearly'  },
  ];

  // ── Projects route with every project image ───────────────────
  const projectsRoute = {
    url: `${BASE_URL}/projects`,
    lastModified: new Date(),
    priority: 0.9,
    changeFrequency: 'weekly',
    images: allProjects
      .flatMap(p => (p.images || []).map(imgUrl => ({
        url: imgUrl,
        title: `${p.name}${p.location ? ` in ${p.location}` : ''}, interior design project by Shrivastavas Elevate, Satna MP`,
        caption: p.description || p.name,
      }))),
  };

  // ── Products route with every product image ───────────────────
  const productsRoute = {
    url: `${BASE_URL}/products`,
    lastModified: new Date(),
    priority: 0.85,
    changeFrequency: 'weekly',
    images: allProducts
      .flatMap(p => (p.images || []).map(imgUrl => ({
        url: imgUrl,
        title: `${p.name}, architectural interior product by Shrivastavas Elevate, Satna MP`,
        caption: p.description || p.name,
      }))),
  };

  // ── Design category routes with every design image ────────────
  const designRoutes = liveCategories.map(cat => {
    const slug         = cat.slug;
    const categoryName = cat.name;
    const designs      = designsBySlug[slug] || [];
    const isHighPriority = slug === 'kitchen-designs' || slug === 'bedroom-designs';

    return {
      url: `${BASE_URL}/design/${slug}`,
      lastModified: new Date(),
      priority: isHighPriority ? 0.95 : 0.9,
      changeFrequency: 'weekly',
      images: designs
        .flatMap(d => (d.images || []).map(imgUrl => ({
          url: imgUrl,
          title: `${d.name}, ${categoryName} by Shrivastavas Elevate, Satna MP`,
          caption: d.description || `${d.name}, ${categoryName} interior design in Satna, Madhya Pradesh`,
        }))),
    };
  });

  // ── City service area pages ───────────────────────────────────
  // Core + admin-added cities; also discover any new cities from project locations
  const citySlugSet = new Set(await getAllCitySlugs());
  for (const project of allProjects) {
    const slug = await locationToSlug(project.location);
    if (slug) citySlugSet.add(slug);
  }

  const cityRoutes = await Promise.all([...citySlugSet].map(async slug => {
    const matchFlags = await Promise.all(allProjects.map(p => matchesCity(p.location, slug)));
    const cityProjects = allProjects.filter((p, i) => matchFlags[i]);
    return {
      url: `${BASE_URL}/interior-designer/${slug}`,
      lastModified: new Date(),
      priority: slug === 'indore' || slug === 'mumbai' ? 0.9 : 0.85,
      changeFrequency: 'weekly',
      images: cityProjects
        .flatMap(p => (p.images || []).map(imgUrl => ({
          url: imgUrl,
          title: `${p.name}, interior design project by Shrivastavas Elevate`,
          caption: p.description || p.name,
        }))),
    };
  }));

  return [...staticRoutes, projectsRoute, productsRoute, ...designRoutes, ...cityRoutes];
}

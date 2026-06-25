import { CATEGORY_SLUGS, SLUG_TO_CATEGORY, CATEGORY_TO_SLUG } from '@/lib/categories';

const BASE_URL = 'https://shrivastavaseelevate.com';
const API_URL  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const revalidate = 3600; // rebuild sitemap every hour

export default async function sitemap() {
  // ── Fetch all content for image declarations ──────────────────
  let allDesigns  = [];
  let allProducts = [];
  let allProjects = [];

  try {
    const [designRes, productRes, projectRes] = await Promise.all([
      fetch(`${API_URL}/api/design/list`,  { next: { revalidate: 3600 } }),
      fetch(`${API_URL}/api/product/list`, { next: { revalidate: 3600 } }),
      fetch(`${API_URL}/api/project/list`, { next: { revalidate: 3600 } }),
    ]);

    if (designRes.ok)  { const d = await designRes.json();  if (d.success) allDesigns  = d.data ?? []; }
    if (productRes.ok) { const d = await productRes.json(); if (d.success) allProducts = d.data ?? []; }
    if (projectRes.ok) { const d = await projectRes.json(); if (d.success) allProjects = d.data ?? []; }
  } catch {
    // API unavailable at build time — sitemap will have no images but valid URLs
  }

  // ── Group designs by category slug ────────────────────────────
  const designsBySlug = {};
  for (const design of allDesigns) {
    const slug = CATEGORY_TO_SLUG[design.category];
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
        title: `${p.name}${p.location ? ` in ${p.location}` : ''} — interior design project by Shrivastavas Elevate, Satna MP`,
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
        title: `${p.name} — architectural interior product by Shrivastavas Elevate, Satna MP`,
        caption: p.description || p.name,
      }))),
  };

  // ── Design category routes with every design image ────────────
  const designRoutes = CATEGORY_SLUGS.map(slug => {
    const categoryName = SLUG_TO_CATEGORY[slug];
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
          title: `${d.name} — ${categoryName} by Shrivastavas Elevate, Satna MP`,
          caption: d.description || `${d.name} — ${categoryName} interior design in Satna, Madhya Pradesh`,
        }))),
    };
  });

  return [...staticRoutes, projectsRoute, productsRoute, ...designRoutes];
}

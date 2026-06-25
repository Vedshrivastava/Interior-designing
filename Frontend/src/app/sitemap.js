import { CATEGORY_SLUGS } from '@/lib/categories';

const BASE_URL = 'https://shrivastavaseelevate.com';

export default function sitemap() {
  const staticRoutes = [
    { url: BASE_URL,                  lastModified: new Date(), priority: 1.0,  changeFrequency: 'weekly'  },
    { url: `${BASE_URL}/services`,    lastModified: new Date(), priority: 0.95, changeFrequency: 'monthly' },
    { url: `${BASE_URL}/projects`,    lastModified: new Date(), priority: 0.9,  changeFrequency: 'weekly'  },
    { url: `${BASE_URL}/products`,    lastModified: new Date(), priority: 0.85, changeFrequency: 'weekly'  },
    { url: `${BASE_URL}/about`,       lastModified: new Date(), priority: 0.8,  changeFrequency: 'monthly' },
    { url: `${BASE_URL}/contact`,     lastModified: new Date(), priority: 0.75, changeFrequency: 'yearly'  },
  ];

  const designRoutes = CATEGORY_SLUGS.map(slug => ({
    url: `${BASE_URL}/design/${slug}`,
    lastModified: new Date(),
    priority: slug === 'kitchen-designs' || slug === 'bedroom-designs' ? 0.95 : 0.9,
    changeFrequency: 'weekly',
  }));

  return [...staticRoutes, ...designRoutes];
}

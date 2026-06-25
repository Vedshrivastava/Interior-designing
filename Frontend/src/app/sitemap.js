const BASE_URL = 'https://shrivastavaseelevate.com';

const DESIGN_CATEGORIES = [
  'Kitchen Designs', 'Bedroom Designs', 'Bathroom Designs',
  'Lounge area Designs', 'TV Unit Designs', 'Kids Room Designs',
  'Commercial Designs', 'House Exterior', 'Mandir Designs', 'Garden Designs',
];

export default function sitemap() {
  const staticRoutes = [
    { url: BASE_URL,                  lastModified: new Date(), priority: 1.0,  changeFrequency: 'weekly'  },
    { url: `${BASE_URL}/about`,       lastModified: new Date(), priority: 0.8,  changeFrequency: 'monthly' },
    { url: `${BASE_URL}/services`,    lastModified: new Date(), priority: 0.8,  changeFrequency: 'monthly' },
    { url: `${BASE_URL}/projects`,    lastModified: new Date(), priority: 0.9,  changeFrequency: 'weekly'  },
    { url: `${BASE_URL}/products`,    lastModified: new Date(), priority: 0.8,  changeFrequency: 'weekly'  },
    { url: `${BASE_URL}/contact`,     lastModified: new Date(), priority: 0.7,  changeFrequency: 'yearly'  },
  ];

  const designRoutes = DESIGN_CATEGORIES.map(cat => ({
    url: `${BASE_URL}/design/${encodeURIComponent(cat)}`,
    lastModified: new Date(),
    priority: 0.9,
    changeFrequency: 'weekly',
  }));

  return [...staticRoutes, ...designRoutes];
}

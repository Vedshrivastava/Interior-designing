import ProjectsPage from '@/components/pages/ProjectsPage';

const SITE_URL = 'https://www.shrivastavaselevate.com';
const API_URL  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const revalidate = 60;

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home',     item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Projects', item: `${SITE_URL}/projects` },
  ],
};

export const metadata = {
  title: 'Interior Design Portfolio Satna MP | 50+ Projects | Shrivastavas Elevate',
  description:
    '50+ completed interior design projects in Satna and Madhya Pradesh — modular kitchens, luxury bedrooms, living rooms, commercial spaces and full-home makeovers. View our portfolio and get a free quote.',
  alternates: { canonical: `${SITE_URL}/projects` },
  openGraph: {
    title: 'Interior Design Portfolio Satna MP | 50+ Projects | Shrivastavas Elevate',
    description: '50+ completed interior design projects in Satna, MP — kitchens, bedrooms, living rooms, commercial spaces. View our portfolio.',
    url: `${SITE_URL}/projects`,
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1536, height: 1024, alt: 'Interior Design Projects Portfolio — Shrivastavas Elevate, Satna MP' }],
  },
  twitter: {
    title: 'Interior Design Portfolio Satna MP | 50+ Projects',
    description: '50+ completed interior projects in Satna, Madhya Pradesh. View our portfolio.',
    images: [`${SITE_URL}/og-image.png`],
  },
};

export default async function Page() {
  let initialProjects = [];

  try {
    const res = await fetch(`${API_URL}/api/project/list`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    if (json.success) initialProjects = json.data ?? [];
  } catch {
    // fail silently — client will fetch on mount
  }

  const portfolioSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Interior Design Portfolio — Shrivastavas Elevate, Satna',
    url: `${SITE_URL}/projects`,
    description: `${initialProjects.length > 0 ? initialProjects.length + '+' : '50+'} completed interior design projects in Satna and Madhya Pradesh.`,
    provider: { '@type': 'LocalBusiness', name: 'Shrivastavas Elevate', url: SITE_URL },
  };

  const imageGallerySchema = initialProjects.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: 'Interior Design Projects Portfolio — Shrivastavas Elevate, Satna MP',
    description: 'Portfolio of completed interior design projects in Satna, Madhya Pradesh by Shrivastavas Elevate.',
    url: `${SITE_URL}/projects`,
    provider: { '@type': 'LocalBusiness', name: 'Shrivastavas Elevate', url: SITE_URL },
    image: initialProjects
      .filter(p => p.images?.[0])
      .slice(0, 15)
      .map(p => ({
        '@type': 'ImageObject',
        contentUrl: p.images[0],
        name: p.name,
        description: `${p.name}${p.location ? ` in ${p.location}` : ''} — interior design project by Shrivastavas Elevate, Satna MP`,
        creator: { '@type': 'Organization', name: 'Shrivastavas Elevate' },
      })),
  } : null;

  const itemListSchema = initialProjects.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Interior Design Projects — Shrivastavas Elevate, Satna MP',
    url: `${SITE_URL}/projects`,
    numberOfItems: initialProjects.length,
    itemListElement: initialProjects.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      description: p.description || `${p.name} — interior design project in ${p.location || 'Satna'}, MP`,
      image: p.images?.[0] || undefined,
    })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(portfolioSchema) }} />
      {imageGallerySchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(imageGallerySchema) }} />
      )}
      {itemListSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      )}
      <ProjectsPage initialProjects={initialProjects} />
    </>
  );
}

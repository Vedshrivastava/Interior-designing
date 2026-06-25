import CityServicePage from '@/components/pages/CityServicePage';
import { CITY_SLUGS, getCity, matchesCity, locationToSlug } from '@/lib/cities';

const SITE_URL = 'https://shrivastavaseelevate.com';
const API_URL  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const revalidate = 3600;

export async function generateStaticParams() {
  const coreSlugs = new Set(CITY_SLUGS);

  // Also discover cities from real project locations
  try {
    const res = await fetch(`${API_URL}/api/project/list`, { next: { revalidate: 3600 } });
    const json = await res.json();
    if (json.success) {
      for (const project of json.data) {
        const slug = locationToSlug(project.location);
        if (slug) coreSlugs.add(slug);
      }
    }
  } catch {}

  return [...coreSlugs].map(city => ({ city }));
}

export async function generateMetadata({ params }) {
  const { city: slug } = await params;
  const city = getCity(slug);
  const title = `Interior Designer in ${city.name} | Shrivastavas Elevate`;
  const description = `Premium interior design services in ${city.name}, ${city.state} — modular kitchens, bedrooms, bathrooms, commercial spaces, 3D visualization and turnkey execution by Shrivastavas Elevate. Free consultation available.`;

  return {
    title,
    description,
    keywords: [
      `interior designer ${city.name}`,
      `interior design ${city.name}`,
      `modular kitchen ${city.name}`,
      `bedroom interior design ${city.name}`,
      `home interior ${city.name}`,
      `commercial interior designer ${city.name}`,
      `3D visualization ${city.name}`,
      `turnkey interior ${city.name}`,
      `interior designer ${city.state}`,
      `Shrivastavas Elevate ${city.name}`,
    ],
    alternates: { canonical: `${SITE_URL}/interior-designer/${slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/interior-designer/${slug}`,
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: `Interior Designer in ${city.name} — Shrivastavas Elevate` }],
    },
    twitter: {
      title,
      description,
      images: [`${SITE_URL}/og-image.png`],
    },
  };
}

export default async function Page({ params }) {
  const { city: slug } = await params;
  const city = getCity(slug);

  let allProjects = [];
  try {
    const res = await fetch(`${API_URL}/api/project/list`, { next: { revalidate: 3600 } });
    const json = await res.json();
    if (json.success) allProjects = json.data ?? [];
  } catch {}

  const cityProjects = allProjects.filter(p => matchesCity(p.location, slug));

  // ── Schemas ──────────────────────────────────────────────────
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',                   item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Interior Designer',      item: `${SITE_URL}/interior-designer/${slug}` },
      { '@type': 'ListItem', position: 3, name: `${city.name} Interiors`, item: `${SITE_URL}/interior-designer/${slug}` },
    ],
  };

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'InteriorDesigner'],
    name: 'Shrivastavas Elevate',
    description: `Premium interior design services in ${city.name}, ${city.state} — residential and commercial interiors, modular kitchens, 3D visualization and turnkey execution.`,
    url: `${SITE_URL}/interior-designer/${slug}`,
    telephone: '+918962053372',
    areaServed: [
      { '@type': 'City', name: city.name },
      { '@type': 'AdministrativeArea', name: city.state },
    ],
    serviceType: 'Interior Design',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `Interior Design Services in ${city.name}`,
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: `Residential Interior Design ${city.name}`, description: `Bespoke home interiors in ${city.name}, ${city.state}` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: `Modular Kitchen Design ${city.name}`,     description: `Modern modular kitchen design in ${city.name}` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: `Commercial Interior Design ${city.name}`, description: `Office and retail interior design in ${city.name}` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: `3D Interior Visualization ${city.name}`,  description: `Photorealistic 3D rendering for ${city.name} projects` } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: `Interior Renovation ${city.name}`,       description: `Home and office renovation in ${city.name}, ${city.state}` } },
      ],
    },
  };

  const imageGallerySchema = cityProjects.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: `Interior Design Projects in ${city.name} — Shrivastavas Elevate`,
    url: `${SITE_URL}/interior-designer/${slug}`,
    image: cityProjects
      .filter(p => p.images?.[0])
      .map(p => ({
        '@type': 'ImageObject',
        contentUrl: p.images[0],
        name: p.name,
        description: `${p.name} — interior design project in ${city.name}, ${city.state} by Shrivastavas Elevate`,
      })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }} />
      {imageGallerySchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(imageGallerySchema) }} />
      )}
      <CityServicePage
        cityName={city.name}
        stateName={city.state}
        citySlug={slug}
        projects={cityProjects}
      />
    </>
  );
}

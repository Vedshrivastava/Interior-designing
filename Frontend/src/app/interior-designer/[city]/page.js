import CityServicePage from '@/components/pages/CityServicePage';
import { getAllCitySlugs, getCity } from '@/lib/cities';
import { getCityFAQs } from '@/lib/cityFaqs';

const SITE_URL = 'https://www.shrivastavaselevate.com';
const API_URL  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const revalidate = 60;

export async function generateStaticParams() {
  // Core + admin-added city slugs — new cities are also discovered at revalidation
  const slugs = await getAllCitySlugs();
  return slugs.map(city => ({ city }));
}

export async function generateMetadata({ params }) {
  const { city: slug } = await params;
  const city = await getCity(slug);
  const title = `Interior Designer in ${city.name} | Shrivastavas Elevate`;
  const description = `Premium interior design services in ${city.name}, ${city.state}: modular kitchens, bedrooms, bathrooms, commercial spaces, 3D visualization and turnkey execution by Shrivastavas Elevate. Free consultation available.`;

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
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1536, height: 1024, alt: `Interior Designer in ${city.name}, by Shrivastavas Elevate` }],
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
  const city = await getCity(slug);

  let allProjects = [];
  try {
    const res = await fetch(`${API_URL}/api/project/list`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    if (json.success) allProjects = json.data ?? [];
  } catch {}

  const cityProjects = allProjects.filter(p => p.cityPage === slug);

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
    description: `Premium interior design services in ${city.name}, ${city.state}: residential and commercial interiors, modular kitchens, 3D visualization and turnkey execution.`,
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

  const cityFaqs = getCityFAQs(city.name, city.state);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: cityFaqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };

  const imageGallerySchema = cityProjects.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: `Interior Design Projects in ${city.name} by Shrivastavas Elevate`,
    url: `${SITE_URL}/interior-designer/${slug}`,
    image: cityProjects
      .filter(p => p.images?.[0])
      .map(p => ({
        '@type': 'ImageObject',
        contentUrl: p.images[0],
        name: p.name,
        description: `${p.name}, interior design project in ${city.name}, ${city.state} by Shrivastavas Elevate`,
      })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      {imageGallerySchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(imageGallerySchema) }} />
      )}
      <CityServicePage
        cityName={city.name}
        stateName={city.state}
        citySlug={slug}
        projects={cityProjects}
        faqs={cityFaqs}
      />
    </>
  );
}

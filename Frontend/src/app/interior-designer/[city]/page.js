import CityServicePage from '@/components/pages/CityServicePage';
import { CITY_SLUGS, getCity, matchesCity, locationToSlug } from '@/lib/cities';

const SITE_URL = 'https://www.shrivastavaselevate.com';
const API_URL  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const revalidate = 60;

export async function generateStaticParams() {
  // Only use core slugs at build time — new cities discovered at revalidation
  return CITY_SLUGS.map(city => ({ city }));
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
      images: [{ url: `${SITE_URL}/og-image.png`, width: 1536, height: 1024, alt: `Interior Designer in ${city.name} — Shrivastavas Elevate` }],
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

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Who is the best interior designer in ${city.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Shrivastavas Elevate is a premium interior design studio serving ${city.name}, ${city.state}. Founded by Ved and Shubh Shrivastava, the studio has delivered 50+ projects across India and offers residential and commercial interior design, 3D visualization and full turnkey execution for clients in ${city.name}.`,
        },
      },
      {
        '@type': 'Question',
        name: `What interior design services do you offer in ${city.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Shrivastavas Elevate offers modular kitchen design, bedroom interiors, bathroom design, living room and lounge design, TV unit design, kids room design, commercial and office interiors, 3D visualization, space planning, lighting design and complete turnkey execution for clients in ${city.name}, ${city.state}.`,
        },
      },
      {
        '@type': 'Question',
        name: `Do you offer a free consultation for interior design in ${city.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. Shrivastavas Elevate offers a free initial consultation for all interior design projects in ${city.name}. The consultation fee, if any, is fully adjusted against your project cost when you proceed. You can book by calling +91 89620 53372 or filling the consultation form on our website.`,
        },
      },
      {
        '@type': 'Question',
        name: `How much does interior design cost in ${city.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Interior design costs in ${city.name} vary based on scope, materials and space size. Shrivastavas Elevate provides a fully itemised quote upfront with no hidden costs — covering materials, labour and logistics. Contact us for a free estimate specific to your ${city.name} project.`,
        },
      },
      {
        '@type': 'Question',
        name: `Do you provide 3D visualization before starting work in ${city.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. Every project includes photorealistic 3D visualization before any execution begins. You see your space in full detail — materials, lighting, furniture and finishes — and approve it before a single wall is touched. For clients who proceed with the full project, 3D design is included at no extra charge.`,
        },
      },
      {
        '@type': 'Question',
        name: `Do you travel to ${city.name} for interior design projects?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. While our studio is based in Satna, Madhya Pradesh, we travel to ${city.name} for site visits, measurements, milestone reviews and execution oversight. Virtual consultations and shared design boards keep clients in the loop between visits. Distance has never been a reason to say no.`,
        },
      },
    ],
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
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

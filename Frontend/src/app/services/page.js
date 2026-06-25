import ServicesPage from '@/components/pages/ServicesPage';

const SITE_URL = 'https://shrivastavaseelevate.com';

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home',     item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Services', item: `${SITE_URL}/services` },
  ],
};

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  provider: {
    '@type': 'LocalBusiness',
    name: 'Shrivastavas Elevate',
    telephone: '+918962053372',
    url: SITE_URL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Satna',
      addressRegion: 'Madhya Pradesh',
      addressCountry: 'IN',
    },
  },
  serviceType: 'Interior Design',
  areaServed: [
    { '@type': 'City',  name: 'Satna' },
    { '@type': 'City',  name: 'Nagod' },
    { '@type': 'AdministrativeArea', name: 'Madhya Pradesh' },
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Interior Design Services in Satna, MP',
    itemListElement: [
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Residential Interior Design Satna',
          description: 'Bespoke home interiors for apartments, villas and independent houses in Satna, Madhya Pradesh.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Modular Kitchen Design Satna',
          description: 'Modern modular kitchen design with premium fittings in Satna, MP.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Commercial Interior Design Satna',
          description: 'Office, retail and hospitality interior design in Satna, Madhya Pradesh.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: '3D Interior Visualization',
          description: 'Photorealistic 3D renders of your space before any work begins.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Turnkey Interior Execution Satna',
          description: 'Complete end-to-end interior project management and execution in Satna, MP.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Space Planning',
          description: 'Smart layout design maximising every square foot of your space.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Lighting Design',
          description: 'Ambient, accent and task lighting design for homes and commercial spaces.',
        },
      },
      {
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: 'Interior Renovation Satna',
          description: 'Complete home and office renovation services in Satna, Madhya Pradesh.',
        },
      },
    ],
  },
};

export const metadata = {
  title: 'Interior Design Services in Satna MP | Modular Kitchen, Bedroom, Commercial',
  description:
    'Complete interior design services in Satna, Madhya Pradesh — modular kitchens, bedrooms, bathrooms, commercial spaces, 3D visualization, space planning & renovation. Turnkey execution by Shrivastavas Elevate. Free consultation.',
  alternates: { canonical: `${SITE_URL}/services` },
  openGraph: {
    title: 'Interior Design Services in Satna MP | Shrivastavas Elevate',
    description:
      'Modular kitchens, bedrooms, bathrooms, commercial interiors, 3D visualization & turnkey execution in Satna, MP. Free consultation.',
    url: `${SITE_URL}/services`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Interior Design Services in Satna — Shrivastavas Elevate',
      },
    ],
  },
  twitter: {
    title: 'Interior Design Services in Satna MP | Shrivastavas Elevate',
    description: 'Modular kitchens, bedrooms, commercial spaces & 3D visualization in Satna, MP.',
    images: [`${SITE_URL}/og-image.png`],
  },
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <ServicesPage />
    </>
  );
}

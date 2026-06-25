import ServicesPage from '@/components/pages/ServicesPage';

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  provider: {
    '@type': 'LocalBusiness',
    name: 'Shrivastavas Elevate',
    telephone: '+918962053372',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Satna',
      addressRegion: 'Madhya Pradesh',
      addressCountry: 'IN',
    },
  },
  serviceType: 'Interior Design',
  areaServed: { '@type': 'State', name: 'Madhya Pradesh' },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Interior Design Services in Satna',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Residential Interior Design Satna', description: 'Bespoke home interiors for apartments and villas in Satna, MP' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Commercial Interior Design Satna', description: 'Office and retail interiors in Satna, Madhya Pradesh' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: '3D Interior Visualization', description: 'Photorealistic 3D renders before execution' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Modular Kitchen Design Satna', description: 'Modern modular kitchen design in Satna, MP' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Space Planning', description: 'Smart layout design maximising every square foot' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Lighting Design', description: 'Ambient, accent and task lighting design' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Interior Renovation Satna', description: 'Complete home renovation and makeovers in Satna' } },
    ],
  },
};

export const metadata = {
  title: 'Interior Design Services in Satna MP | Modular Kitchen, Bedroom, Commercial',
  description:
    'Complete interior design services in Satna, Madhya Pradesh — modular kitchens, bedrooms, bathrooms, commercial spaces, 3D visualization, space planning & renovation. Turnkey execution by Shrivastavas Elevate.',
  alternates: { canonical: 'https://shrivastavaseelevate.com/services' },
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }} />
      <ServicesPage />
    </>
  );
}

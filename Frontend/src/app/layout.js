import './globals.css';
import { ModalProvider } from '@/context/ModalContext';
import LayoutShell from '@/components/LayoutShell';

const SITE_URL = 'https://www.shrivastavaselevate.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Best Interior Designer in Satna, MP | Shrivastavas Elevate',
    template: '%s | Shrivastavas Elevate',
  },
  description:
    'Top-rated interior designer in Satna, Madhya Pradesh. Modular kitchens, bedrooms, bathrooms, commercial interiors & 3D visualization. Turnkey execution. Free consultation. 50+ projects delivered across MP.',
  keywords: [
    'interior designer Satna',
    'interior design Satna Madhya Pradesh',
    'interior designer Madhya Pradesh',
    'modular kitchen Satna',
    'bedroom interior design Satna',
    'bathroom interior design Satna',
    'commercial interior designer Satna',
    '3D visualization interior design',
    'turnkey interior contractor Satna',
    'luxury interior design India',
    'Shrivastavas Elevate',
    'interior design Nagod',
    'home interior design MP',
    'best interior designer Vindhya',
    'interior designer near me Satna',
    'home renovation Satna MP',
    'interior designer Indore',
    'interior design Indore Madhya Pradesh',
    'interior designer Mumbai',
    'interior design Mumbai Maharashtra',
    'interior designer Bhopal',
    'interior design services Madhya Pradesh',
    'interior designer Maharashtra',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'Shrivastavas Elevate',
    title: 'Best Interior Designer in Satna, MP | Shrivastavas Elevate',
    description:
      'Top-rated interior designer in Satna MP. Modular kitchens, bedrooms, 3D visualization & turnkey execution. 50+ projects. Free consultation.',
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1536,
        height: 1024,
        alt: 'Shrivastavas Elevate — Premium Interior Designer in Satna, Madhya Pradesh',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Interior Designer in Satna | Shrivastavas Elevate',
    description: 'Premium interiors crafted with luxury, precision and turnkey execution in Satna, Madhya Pradesh.',
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  alternates: {
    canonical: SITE_URL,
  },
  verification: {
    // Add Google Search Console verification token here when you get it:
    // google: 'your-verification-token',
  },
};

/* ── LocalBusiness + Organization JSON-LD ─────────────────────
   Appears on every page. Powers Google Maps knowledge panel,
   local pack, and rich results.
───────────────────────────────────────────────────────────── */
const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': ['InteriorDesigner', 'LocalBusiness'],
  name: 'Shrivastavas Elevate',
  alternateName: 'Shrivastava\'s Elevate Interior Design',
  description: 'Premium interior design and turnkey contracting studio in Satna, Madhya Pradesh. Specialising in residential and commercial interiors, modular kitchens, 3D visualization, and complete home makeovers.',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  image: `${SITE_URL}/og-image.png`,
  telephone: '+918962053372',
  email: 'shrivastavaselevatepvt.ltd@gmail.com',
  priceRange: '₹₹₹',
  foundingDate: '2024',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Shree Ganga Inn, Lakshmi Bai Marg, Gandhi Chowk, Nagod',
    addressLocality: 'Nagod',
    addressRegion: 'Madhya Pradesh',
    postalCode: '486775',
    addressCountry: 'IN',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: '24.5751',
    longitude: '80.5947',
  },
  areaServed: [
    { '@type': 'City', name: 'Satna'    },
    { '@type': 'City', name: 'Nagod'    },
    { '@type': 'City', name: 'Indore'   },
    { '@type': 'City', name: 'Mumbai'   },
    { '@type': 'City', name: 'Bhopal'   },
    { '@type': 'City', name: 'Jabalpur' },
    { '@type': 'AdministrativeArea', name: 'Madhya Pradesh' },
    { '@type': 'AdministrativeArea', name: 'Maharashtra'    },
  ],
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Interior Design Services',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Residential Interior Design' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Modular Kitchen Design' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Bedroom Interior Design' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Commercial Interior Design' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: '3D Visualization' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Turnkey Interior Execution' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Space Planning' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Lighting Design' } },
    ],
  },
  // aggregateRating: add this back once you have verified Google Business Profile reviews
  // '@type': 'AggregateRating', ratingValue: '4.9', reviewCount: '<actual count>'
  sameAs: [
    'https://www.instagram.com/shrivastavaselevatepvtltd',
    'https://www.facebook.com/shrivastavaselevatepvtltd',
  ],
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    opens: '09:00',
    closes: '18:00',
  },
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Shrivastavas Elevate',
  url: SITE_URL,
  description: 'Premium interior design studio in Satna, Madhya Pradesh — modular kitchens, bedrooms, commercial spaces, 3D visualization and turnkey execution.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/design/kitchen-designs`,
    },
    'query-input': 'required name=search_term_string',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Shrivastavas Elevate',
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/logo.png`,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to external origins used on every page */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body>
        <ModalProvider>
          <LayoutShell>{children}</LayoutShell>
        </ModalProvider>
      </body>
    </html>
  );
}

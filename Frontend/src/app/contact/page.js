import ContactPage from '@/components/pages/ContactPage';

const SITE_URL = 'https://shrivastavaseelevate.com';

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home',    item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Contact', item: `${SITE_URL}/contact` },
  ],
};

const contactPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact Shrivastavas Elevate — Interior Designer in Satna',
  url: `${SITE_URL}/contact`,
  description: 'Book a free consultation with Shrivastavas Elevate, interior designers in Satna, Madhya Pradesh. Call +91 89620 53372 or fill the form.',
  mainEntity: {
    '@type': 'LocalBusiness',
    name: 'Shrivastavas Elevate',
    telephone: '+918962053372',
    email: 'shrivastavaselevatepvt.ltd@gmail.com',
    url: SITE_URL,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Shree Ganga Inn, Lakshmi Bai Marg, Gandhi Chowk, Nagod',
      addressLocality: 'Nagod',
      addressRegion: 'Madhya Pradesh',
      postalCode: '486775',
      addressCountry: 'IN',
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '18:00',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+918962053372',
      contactType: 'customer service',
      availableLanguage: ['Hindi', 'English'],
    },
  },
};

export const metadata = {
  title: 'Contact Interior Designer in Satna | Free Consultation | +91 89620 53372',
  description:
    'Contact Shrivastavas Elevate — interior designer in Satna, Madhya Pradesh. Book a free consultation, call +91 89620 53372, or WhatsApp us. We respond within 24 hours. Office open Mon–Sat 9AM–6PM.',
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: 'Contact Interior Designer in Satna | Free Consultation | Shrivastavas Elevate',
    description:
      'Book a free interior design consultation in Satna, MP. Call +91 89620 53372. Mon–Sat 9AM–6PM.',
    url: `${SITE_URL}/contact`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Contact Shrivastavas Elevate — Interior Designer in Satna MP',
      },
    ],
  },
  twitter: {
    title: 'Contact Interior Designer in Satna | Free Consultation',
    description: 'Book a free interior design consultation in Satna, MP. Call +91 89620 53372.',
    images: [`${SITE_URL}/og-image.png`],
  },
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPageSchema) }} />
      <ContactPage />
    </>
  );
}

import { preload } from 'react-dom';
import AboutPage from '@/components/pages/AboutPage';
import bgimg from '@/assets/home-img.png';

const SITE_URL = 'https://shrivastavaseelevate.com';

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home',     item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'About Us', item: `${SITE_URL}/about` },
  ],
};

const aboutPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About Shrivastavas Elevate — Interior Designers in Satna',
  url: `${SITE_URL}/about`,
  description: 'Shrivastavas Elevate is a premium interior design studio in Satna, Madhya Pradesh, founded by Ved and Shubh Shrivastava. 7+ years of experience, 50+ projects delivered.',
  mainEntity: {
    '@type': 'Organization',
    name: 'Shrivastavas Elevate',
    foundingDate: '2024',
    founder: [
      { '@type': 'Person', name: 'Ved Shrivastava',  jobTitle: 'Co-Founder & Interior Designer' },
      { '@type': 'Person', name: 'Shubh Shrivastava', jobTitle: 'Co-Founder & Interior Designer' },
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Satna',
      addressRegion: 'Madhya Pradesh',
      addressCountry: 'IN',
    },
    url: SITE_URL,
  },
};

export const metadata = {
  title: 'About Us | Interior Designers in Satna MP | Shrivastavas Elevate',
  description:
    'Meet the team behind Shrivastavas Elevate — Satna\'s premium interior design studio. 7+ years of experience, 50+ projects in Madhya Pradesh. Luxury interiors, turnkey execution, and a free consultation for every client.',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'About Shrivastavas Elevate — Interior Designers in Satna, MP',
    description:
      'Meet the founders of Shrivastavas Elevate. Premium interior design studio in Satna, MP with 7+ years experience and 50+ projects across Madhya Pradesh.',
    url: `${SITE_URL}/about`,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Shrivastavas Elevate Team — Interior Designers in Satna MP',
      },
    ],
  },
  twitter: {
    title: 'About Shrivastavas Elevate — Interior Designers in Satna MP',
    description: 'Premium interior design studio in Satna MP. 7+ years experience, 50+ projects.',
    images: [`${SITE_URL}/og-image.png`],
  },
};

export default function Page() {
  preload(bgimg.src, { as: 'image', fetchPriority: 'high' });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageSchema) }} />
      <AboutPage />
    </>
  );
}

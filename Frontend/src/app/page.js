import { preload } from 'react-dom';
import HomePage from '@/components/pages/HomePage';
import bgimg from '@/assets/home-img.png';

const SITE_URL = 'https://www.shrivastavaselevate.com';

export const metadata = {
  title: 'Best Interior Designer in Satna MP | Free Consultation | Shrivastavas Elevate',
  description:
    'Looking for an interior designer in Satna, Madhya Pradesh? Shrivastavas Elevate offers premium modular kitchens, bedroom, bathroom & commercial interiors with free consultation. 50+ projects. Turnkey execution. Call +91 89620 53372.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'Best Interior Designer in Satna MP | Free Consultation | Shrivastavas Elevate',
    description:
      'Premium modular kitchens, bedrooms, bathrooms & commercial interiors in Satna, MP. 50+ projects. Free consultation. Call +91 89620 53372.',
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1536,
        height: 1024,
        alt: 'Shrivastavas Elevate — Interior Designer in Satna, Madhya Pradesh',
      },
    ],
  },
  twitter: {
    title: 'Best Interior Designer in Satna MP | Shrivastavas Elevate',
    description: 'Premium modular kitchens, bedrooms & commercial interiors in Satna MP. Free consultation.',
    images: [`${SITE_URL}/og-image.png`],
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Who is the best interior designer in Satna, Madhya Pradesh?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Shrivastavas Elevate is widely regarded as one of the top interior design studios in Satna, MP. Founded by Ved and Shubh Shrivastava, the studio has delivered 50+ projects across residential and commercial spaces in Satna and surrounding areas of Madhya Pradesh.',
      },
    },
    {
      '@type': 'Question',
      name: 'What interior design services do you offer in Satna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Shrivastavas Elevate offers a full range of interior design services in Satna, MP — including modular kitchen design, bedroom interiors, bathroom design, living room and lounge area design, TV unit design, kids room design, commercial and office interiors, 3D visualization, space planning, lighting design, and complete turnkey execution.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do you offer a free consultation for interior design in Satna?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Shrivastavas Elevate offers a free initial consultation for all interior design projects in Satna and Madhya Pradesh. The consultation fee, if any, is fully adjusted against your project cost. You can book by calling +91 89620 53372 or filling the consultation form on our website.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does interior design cost in Satna, MP?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Interior design costs in Satna vary based on scope, materials, and size. Shrivastavas Elevate offers tailored packages for every budget — from single-room makeovers to full-home turnkey projects. Contact us for a free estimate specific to your space.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do you provide 3D visualization before starting the interior design work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Shrivastavas Elevate provides photorealistic 3D interior visualization before any execution begins. This allows you to see exactly how your space will look, approve materials and layouts, and make changes before any construction or installation starts.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which areas near Satna do you serve?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Shrivastavas Elevate primarily serves Satna and Nagod in Madhya Pradesh. We also take projects across the Vindhya region and other parts of MP. Contact us to check availability for your location.',
      },
    },
  ],
};

export const revalidate = 60;

export default function Page() {
  preload(bgimg.src, { as: 'image', fetchPriority: 'high' });
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <HomePage />
    </>
  );
}

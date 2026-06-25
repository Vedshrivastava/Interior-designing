import DesignDisplayPage from '@/components/pages/DesignDisplayPage';
import { SLUG_TO_CATEGORY, CATEGORY_SLUGS } from '@/lib/categories';

export const revalidate = 60;

const SITE_URL = 'https://shrivastavaseelevate.com';
const PAGE_LIMIT = 20;

const CATEGORY_META = {
  'kitchen-designs':     {
    desc: 'Modern modular kitchen designs in Satna, Madhya Pradesh — L-shaped, U-shaped, island kitchens with premium fittings.',
    keywords: 'modular kitchen design Satna, kitchen interior Satna MP, modular kitchen Madhya Pradesh',
  },
  'bedroom-designs':     {
    desc: 'Elegant bedroom interior designs for homes in Satna, MP — master bedrooms, kids rooms, guest rooms with luxury finishes.',
    keywords: 'bedroom interior design Satna, luxury bedroom Satna MP, bedroom design Madhya Pradesh',
  },
  'bathroom-designs':    {
    desc: 'Premium bathroom interior designs in Satna, MP — modern, minimalist and luxury bathrooms.',
    keywords: 'bathroom interior design Satna, bathroom renovation Satna MP',
  },
  'lounge-area-designs': {
    desc: 'Luxury living room and lounge area interior designs in Satna, Madhya Pradesh.',
    keywords: 'living room interior design Satna, lounge design Satna MP',
  },
  'tv-unit-designs':     {
    desc: 'Modern TV unit and entertainment wall designs in Satna — wall-mounted, floor-standing and floating units.',
    keywords: 'TV unit design Satna, entertainment wall Satna MP',
  },
  'kids-room-designs':   {
    desc: 'Creative and safe kids room interior designs in Satna, MP — playful themes, study zones, storage solutions.',
    keywords: 'kids room interior design Satna, children room design Satna MP',
  },
  'commercial-designs':  {
    desc: 'Commercial office, retail and hospitality interior designs in Satna, Madhya Pradesh.',
    keywords: 'commercial interior designer Satna, office interior design Satna MP',
  },
  'house-exterior':      {
    desc: 'House exterior and facade designs in Satna, Madhya Pradesh — modern, contemporary and traditional styles.',
    keywords: 'house exterior design Satna, facade design Satna MP, house front design Madhya Pradesh',
  },
  'mandir-designs':      {
    desc: 'Beautiful mandir and pooja room designs in Satna, MP — marble, wood and contemporary styles.',
    keywords: 'mandir design Satna, pooja room interior Satna MP',
  },
  'garden-designs':      {
    desc: 'Garden and outdoor landscape designs in Satna, Madhya Pradesh — terrace gardens, courtyards, vertical gardens.',
    keywords: 'garden design Satna, landscape design Satna MP',
  },
};

export async function generateStaticParams() {
  return CATEGORY_SLUGS.map(slug => ({ category: slug }));
}

export async function generateMetadata({ params }) {
  const { category: slug } = await params;
  const categoryName = SLUG_TO_CATEGORY[slug] || slug;
  const meta = CATEGORY_META[slug] || {};
  const desc = meta.desc || `${categoryName} in Satna, Madhya Pradesh — premium designs by Shrivastavas Elevate.`;
  const title = `${categoryName} in Satna MP | Shrivastavas Elevate`;

  return {
    title,
    description: `${desc} Browse our portfolio and request a free quote. Call +91 89620 53372.`,
    keywords: meta.keywords || `${categoryName.toLowerCase()} Satna, interior design Satna MP`,
    alternates: { canonical: `${SITE_URL}/design/${slug}` },
    openGraph: {
      title,
      description: `${desc} View our portfolio and get a free quote.`,
      url: `${SITE_URL}/design/${slug}`,
      type: 'website',
      images: [
        {
          url: `${SITE_URL}/og-image.jpg`,
          width: 1200,
          height: 630,
          alt: `${categoryName} — Shrivastavas Elevate, Satna MP`,
        },
      ],
    },
    twitter: {
      title,
      description: `${desc} Free quote available.`,
      images: [`${SITE_URL}/og-image.jpg`],
    },
  };
}

export default async function Page({ params }) {
  const { category: slug } = await params;
  const categoryName = SLUG_TO_CATEGORY[slug] || slug;
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  let initialDesigns = [];
  let initialTotal   = 0;

  try {
    const res = await fetch(
      `${API_URL}/api/design/list?category=${encodeURIComponent(categoryName)}&page=1&limit=${PAGE_LIMIT}`,
      { next: { revalidate: 60 } }
    );
    const json = await res.json();
    if (json.success) {
      initialDesigns = json.data;
      initialTotal   = json.total ?? json.data.length;
    }
  } catch {
    // fail silently — client will fetch on mount
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',    item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Designs', item: `${SITE_URL}/design/kitchen-designs` },
      { '@type': 'ListItem', position: 3, name: categoryName, item: `${SITE_URL}/design/${slug}` },
    ],
  };

  const imageGallerySchema = initialDesigns.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: `${categoryName} Portfolio — Shrivastavas Elevate, Satna`,
    description: `Portfolio of ${categoryName.toLowerCase()} designed by Shrivastavas Elevate in Satna, Madhya Pradesh.`,
    url: `${SITE_URL}/design/${slug}`,
    provider: {
      '@type': 'LocalBusiness',
      name: 'Shrivastavas Elevate',
      url: SITE_URL,
    },
    image: initialDesigns
      .filter(d => d.images?.[0])
      .slice(0, 10)
      .map(d => ({
        '@type': 'ImageObject',
        contentUrl: d.images[0],
        name: d.name,
        description: d.description || `${d.name} — ${categoryName} by Shrivastavas Elevate, Satna`,
        creator: {
          '@type': 'Organization',
          name: 'Shrivastavas Elevate',
        },
      })),
  } : null;

  const itemListSchema = initialDesigns.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${categoryName} in Satna — Shrivastavas Elevate`,
    url: `${SITE_URL}/design/${slug}`,
    numberOfItems: initialTotal,
    itemListElement: initialDesigns.slice(0, 10).map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: d.name,
      description: d.description || `${d.name} — ${categoryName} in Satna, MP`,
      image: d.images?.[0] || undefined,
    })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {imageGallerySchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(imageGallerySchema) }} />
      )}
      {itemListSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      )}
      <DesignDisplayPage
        slug={slug}
        initialDesigns={initialDesigns}
        initialTotal={initialTotal}
        pageLimit={PAGE_LIMIT}
      />
    </>
  );
}

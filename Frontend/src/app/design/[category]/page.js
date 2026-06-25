import DesignDisplayPage from '@/components/pages/DesignDisplayPage';
import { SLUG_TO_CATEGORY, CATEGORY_SLUGS } from '@/lib/categories';

export const revalidate = 60;

const SITE_URL = 'https://shrivastavaseelevate.com';
const PAGE_LIMIT = 20;

const CATEGORY_META = {
  'kitchen-designs':      { desc: 'Modern modular kitchen designs in Satna, Madhya Pradesh' },
  'bedroom-designs':      { desc: 'Elegant bedroom interior designs for Satna homes' },
  'bathroom-designs':     { desc: 'Premium bathroom interior designs in Satna, MP' },
  'lounge-area-designs':  { desc: 'Luxury living room and lounge area designs in Satna' },
  'tv-unit-designs':      { desc: 'Modern TV unit and entertainment wall designs in Satna' },
  'kids-room-designs':    { desc: 'Creative and safe kids room interior designs in Satna, MP' },
  'commercial-designs':   { desc: 'Commercial office and retail interior designs in Satna, MP' },
  'house-exterior':       { desc: 'House exterior and facade designs in Satna, Madhya Pradesh' },
  'mandir-designs':       { desc: 'Beautiful mandir and pooja room designs in Satna, MP' },
  'garden-designs':       { desc: 'Garden and outdoor landscape designs in Satna, Madhya Pradesh' },
};

export async function generateStaticParams() {
  return CATEGORY_SLUGS.map(slug => ({ category: slug }));
}

export async function generateMetadata({ params }) {
  const { category: slug } = await params;
  const categoryName = SLUG_TO_CATEGORY[slug] || slug;
  const meta = CATEGORY_META[slug] || {};
  const desc = meta.desc || `${categoryName} in Satna, Madhya Pradesh`;

  return {
    title: `${categoryName} in Satna MP | ${categoryName} Designs | Shrivastavas Elevate`,
    description: `${desc} — crafted with premium materials, precision and timeless elegance. Browse our portfolio and request a free quote. Shrivastavas Elevate, Satna.`,
    alternates: { canonical: `${SITE_URL}/design/${slug}` },
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <DesignDisplayPage
        slug={slug}
        initialDesigns={initialDesigns}
        initialTotal={initialTotal}
        pageLimit={PAGE_LIMIT}
      />
    </>
  );
}

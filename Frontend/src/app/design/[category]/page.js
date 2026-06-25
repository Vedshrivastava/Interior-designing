import DesignDisplayPage from '@/components/pages/DesignDisplayPage';

export const revalidate = 60;

const CATEGORIES = [
  'Kitchen Designs', 'Bedroom Designs', 'Bathroom Designs',
  'Lounge area Designs', 'TV Unit Designs', 'Kids Room Designs',
  'Commercial Designs', 'House Exterior', 'Mandir Designs', 'Garden Designs',
];

const PAGE_LIMIT = 20;

export async function generateStaticParams() {
  return CATEGORIES.map(cat => ({ category: encodeURIComponent(cat) }));
}

export async function generateMetadata({ params }) {
  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory);
  return {
    title: `${category} — Premium Interior Designs`,
    description: `Browse our curated ${category.toLowerCase()} — crafted with premium materials, precision and timeless elegance. Request a quote for any design.`,
  };
}

export default async function Page({ params }) {
  const { category: rawCategory } = await params;
  const category = decodeURIComponent(rawCategory);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  let initialDesigns = [];
  let initialTotal   = 0;

  try {
    const res = await fetch(
      `${API_URL}/api/design/list?category=${encodeURIComponent(category)}&page=1&limit=${PAGE_LIMIT}`,
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

  return (
    <DesignDisplayPage
      category={rawCategory}
      initialDesigns={initialDesigns}
      initialTotal={initialTotal}
      pageLimit={PAGE_LIMIT}
    />
  );
}

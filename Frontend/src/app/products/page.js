import ProductsPage from '@/components/pages/ProductsPage';

const SITE_URL = 'https://shrivastavaseelevate.com';
const API_URL  = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const revalidate = 60;

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home',     item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Products', item: `${SITE_URL}/products` },
  ],
};

export const metadata = {
  title: 'Interior Products & Materials Satna MP | Breeze Blocks, Louvers, WPC Panels',
  description:
    'Premium architectural products and materials in Satna, Madhya Pradesh — breeze blocks, jaali walls, louvers, WPC panels, PVC cladding, flooring and more. Used by Shrivastavas Elevate in all projects across MP.',
  alternates: { canonical: `${SITE_URL}/products` },
  openGraph: {
    title: 'Interior Products & Materials Satna MP | Shrivastavas Elevate',
    description:
      'Breeze blocks, jaali walls, louvers, WPC panels & more — premium architectural products used in interior projects across Satna, MP.',
    url: `${SITE_URL}/products`,
    images: [{ url: `${SITE_URL}/og-image.jpg`, width: 1200, height: 630, alt: 'Interior Products — Shrivastavas Elevate, Satna MP' }],
  },
  twitter: {
    title: 'Interior Products & Materials Satna MP | Shrivastavas Elevate',
    description: 'Breeze blocks, louvers, WPC panels & more. Premium architectural products in Satna, MP.',
    images: [`${SITE_URL}/og-image.jpg`],
  },
};

export default async function Page() {
  let initialProducts = [];

  try {
    const res = await fetch(`${API_URL}/api/product/list`, { next: { revalidate: 60 } });
    const json = await res.json();
    if (json.success) initialProducts = json.data ?? [];
  } catch {
    // fail silently — client will fetch on mount
  }

  const productCatalogSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Architectural Interior Products — Satna, Madhya Pradesh',
    url: `${SITE_URL}/products`,
    description: 'Premium architectural products used in interior design projects in Satna, MP — breeze blocks, jaali walls, louvers, WPC panels, PVC cladding and more.',
    provider: { '@type': 'LocalBusiness', name: 'Shrivastavas Elevate', url: SITE_URL },
    about: initialProducts.slice(0, 20).map(p => ({
      '@type': 'Product',
      name: p.name,
      description: p.description || p.name,
      image: p.images?.[0] || undefined,
      brand: { '@type': 'Brand', name: 'Shrivastavas Elevate' },
    })),
  };

  const imageGallerySchema = initialProducts.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: 'Interior Products Portfolio — Shrivastavas Elevate, Satna MP',
    description: 'Architectural products and materials used in interior design projects in Satna, Madhya Pradesh.',
    url: `${SITE_URL}/products`,
    provider: { '@type': 'LocalBusiness', name: 'Shrivastavas Elevate', url: SITE_URL },
    image: initialProducts
      .filter(p => p.images?.[0])
      .slice(0, 15)
      .map(p => ({
        '@type': 'ImageObject',
        contentUrl: p.images[0],
        name: p.name,
        description: `${p.name} — architectural product by Shrivastavas Elevate, Satna MP`,
        creator: { '@type': 'Organization', name: 'Shrivastavas Elevate' },
      })),
  } : null;

  const itemListSchema = initialProducts.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Interior Products — Shrivastavas Elevate, Satna MP',
    url: `${SITE_URL}/products`,
    numberOfItems: initialProducts.length,
    itemListElement: initialProducts.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      description: p.description || p.name,
      image: p.images?.[0] || undefined,
    })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productCatalogSchema) }} />
      {imageGallerySchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(imageGallerySchema) }} />
      )}
      {itemListSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      )}
      <ProductsPage initialProducts={initialProducts} />
    </>
  );
}

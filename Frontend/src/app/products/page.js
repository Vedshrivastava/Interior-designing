import ProductsPage from '@/components/pages/ProductsPage';

export const metadata = {
  title: 'Interior Products & Materials in Satna MP | Breeze Blocks, Louvers, WPC',
  description:
    'Premium architectural products and materials in Satna, Madhya Pradesh — breeze blocks, jaali walls, louvers, WPC panels, PVC panels, flooring and more. Used by Shrivastavas Elevate in all projects.',
  alternates: { canonical: 'https://shrivastavaseelevate.com/products' },
};

export const revalidate = 60;

export default function Page() {
  return <ProductsPage />;
}

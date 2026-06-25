import ProductsPage from '@/components/pages/ProductsPage';

export const metadata = {
  title: 'Products Catalogue — Architectural & Design Materials',
  description:
    'Explore our curated range of architectural products: breeze blocks, louvers, jaali walls, PVC panels, WPC, flooring, and more. Premium quality. Satna, India.',
};

export const revalidate = 60;

export default function Page() {
  return <ProductsPage />;
}

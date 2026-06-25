import HomePage from '@/components/pages/HomePage';

export const metadata = {
  title: 'Luxury Interior Design Studio — Satna, India',
  description:
    'Shrivastavas Elevate crafts timeless interiors with luxury, precision and turnkey execution. Kitchen, bedroom, bathroom & commercial designs. Free consultation.',
};

export const revalidate = 60;

export default function Page() {
  return <HomePage />;
}

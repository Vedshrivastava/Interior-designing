import HomePage from '@/components/pages/HomePage';

export const metadata = {
  title: 'Best Interior Designer in Satna MP | Free Consultation | Shrivastavas Elevate',
  description:
    'Looking for an interior designer in Satna, Madhya Pradesh? Shrivastavas Elevate offers premium modular kitchens, bedroom, bathroom & commercial interiors with free consultation. 50+ projects. Turnkey execution. Call +91 89620 53372.',
  alternates: { canonical: 'https://shrivastavaseelevate.com/' },
};

export const revalidate = 60;

export default function Page() {
  return <HomePage />;
}

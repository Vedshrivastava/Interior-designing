import TestimonialsPage from '@/components/pages/TestimonialsPage';

export const revalidate = 60;

export const metadata = {
  title: 'Client Reviews | Shrivastavas Elevate, Interior Design Studio Satna',
  description: 'Read what our clients say about Shrivastavas Elevate, luxury interior design studio in Satna, Madhya Pradesh. Real reviews from homeowners across India.',
};

export default function Page() {
  return <TestimonialsPage />;
}

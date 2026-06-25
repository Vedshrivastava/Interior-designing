import ProjectsPage from '@/components/pages/ProjectsPage';

export const metadata = {
  title: 'Projects Portfolio — Completed Interior Design Work',
  description:
    'Browse 50+ completed residential and commercial interior design projects by Shrivastavas Elevate. Kitchens, bedrooms, living rooms, and full-home makeovers.',
};

export const revalidate = 60;

export default function Page() {
  return <ProjectsPage />;
}

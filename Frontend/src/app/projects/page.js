import ProjectsPage from '@/components/pages/ProjectsPage';

export const metadata = {
  title: 'Interior Design Projects in Satna MP | Portfolio | Shrivastavas Elevate',
  description:
    '50+ completed interior design projects in Satna and Madhya Pradesh — modular kitchens, luxury bedrooms, living rooms, commercial spaces and full-home makeovers. View our portfolio.',
  alternates: { canonical: 'https://shrivastavaseelevate.com/projects' },
};

export const revalidate = 60;

export default function Page() {
  return <ProjectsPage />;
}

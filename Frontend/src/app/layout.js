import './globals.css';
import { ModalProvider } from '@/context/ModalContext';
import LayoutShell from '@/components/LayoutShell';

export const metadata = {
  metadataBase: new URL('https://shrivastavaseelevate.com'),
  title: {
    default: 'Shrivastavas Elevate — Luxury Interior Design Studio, Satna',
    template: '%s | Shrivastavas Elevate',
  },
  description:
    'Premium interior design and turnkey contracting in Satna, India. Kitchen, bedroom, bathroom, commercial & residential interiors. Free consultation. 50+ projects delivered.',
  keywords: [
    'interior design Satna',
    'luxury interior design India',
    'modular kitchen design',
    'bedroom interior Satna',
    'interior designer Madhya Pradesh',
    'Shrivastavas Elevate',
    'turnkey interior contractor',
    '3D visualization interior',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'Shrivastavas Elevate',
    title: 'Shrivastavas Elevate — Luxury Interior Design Studio',
    description:
      'Premium interior design and turnkey contracting in Satna, India. 50+ projects. Free consultation.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shrivastavas Elevate — Luxury Interior Design',
    description: 'Premium interiors crafted with luxury, precision and turnkey execution.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ModalProvider>
          <LayoutShell>{children}</LayoutShell>
        </ModalProvider>
      </body>
    </html>
  );
}

export default function robots() {
  return {
    rules: [
      {
        // Main rule — allow all crawlers on all public pages
        userAgent: '*',
        allow: '/',
        disallow: [
          '/_next/',       // Next.js internal build assets — no SEO value
          '/api/',         // API routes — not meant for indexing
        ],
      },
      {
        // Explicitly allow Googlebot to crawl images — critical for Image Search
        userAgent: 'Googlebot-Image',
        allow: '/',
      },
      {
        // Block known bandwidth-wasting scrapers that provide zero SEO benefit
        userAgent: [
          'MJ12bot',
          'DotBot',
          'BLEXBot',
          'SputnikImageBot',
          'AhrefsBot',
        ],
        disallow: '/',
      },
    ],
    sitemap: 'https://www.shrivastavaselevate.com/sitemap.xml',
  };
}

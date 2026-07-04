/**
 * Shared FAQ content for /interior-designer/[city] pages.
 * Single source of truth for both the visible FAQ accordion
 * (CityServicePage.jsx) and the FAQPage JSON-LD schema (page.js) —
 * Google's FAQ rich-result eligibility requires the schema to match
 * content actually visible on the page.
 */
export function getCityFAQs(cityName, stateName) {
  return [
    {
      question: `Who is the best interior designer in ${cityName}?`,
      answer: `Shrivastavas Elevate is a premium interior design studio serving ${cityName}, ${stateName}. Founded by Ved and Shubh Shrivastava, the studio has delivered 50+ projects across India and offers residential and commercial interior design, 3D visualization and full turnkey execution for clients in ${cityName}.`,
    },
    {
      question: `What interior design services do you offer in ${cityName}?`,
      answer: `Shrivastavas Elevate offers modular kitchen design, bedroom interiors, bathroom design, living room and lounge design, TV unit design, kids room design, commercial and office interiors, 3D visualization, space planning, lighting design and complete turnkey execution for clients in ${cityName}, ${stateName}.`,
    },
    {
      question: `Do you offer a free consultation for interior design in ${cityName}?`,
      answer: `Yes. Shrivastavas Elevate offers a free initial consultation for all interior design projects in ${cityName}. The consultation fee, if any, is fully adjusted against your project cost when you proceed. You can book by calling +91 89620 53372 or filling the consultation form on our website.`,
    },
    {
      question: `How much does interior design cost in ${cityName}?`,
      answer: `Interior design costs in ${cityName} vary based on scope, materials and space size. Shrivastavas Elevate provides a fully itemised quote upfront with no hidden costs, covering materials, labour and logistics. Contact us for a free estimate specific to your ${cityName} project.`,
    },
    {
      question: `Do you provide 3D visualization before starting work in ${cityName}?`,
      answer: `Yes. Every project includes photorealistic 3D visualization before any execution begins. You see your space in full detail (materials, lighting, furniture and finishes) and approve it before a single wall is touched. For clients who proceed with the full project, 3D design is included at no extra charge.`,
    },
    {
      question: `Do you travel to ${cityName} for interior design projects?`,
      answer: `Yes. While our studio is based in Satna, Madhya Pradesh, we travel to ${cityName} for site visits, measurements, milestone reviews and execution oversight. Virtual consultations and shared design boards keep clients in the loop between visits. Distance has never been a reason to say no.`,
    },
  ];
}

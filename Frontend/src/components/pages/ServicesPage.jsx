'use client';
import '@/styles/services.css';
import Link from 'next/link';
import { IconCalendar, IconArrowRight, IconCrown, IconComments, IconEye, IconKey, IconLightbulb, IconHouseChimney, IconBuilding, IconScrewdriverWrench, IconRuler, IconStar, IconStarFilled, IconLayerGroup, IconClock, IconShield, IconPenRuler, IconGem, IconQuoteLeft, IconHandshake, IconXMark } from '@/components/Icons';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import Footer from '@/components/Footer';
import { useModal } from '@/context/ModalContext';

import bgimg  from '@/assets/home-img.png';
import design from '@/assets/refund-design.png';

const testimonials = [
  { name: 'Rahul Mehta',    location: 'Mumbai',    text: 'Exceptional execution and luxurious finishing. The team transformed our home beyond expectations — every material, every proportion, every detail was considered. What impressed me most was how accurately the final result matched the 3D render they had shown us months earlier.',                                                                               rating: 5, image: design },
  { name: 'Priya Sharma',   location: 'Delhi',     text: 'Their design sense is outstanding. Every corner of our apartment feels premium and thoughtfully designed, as if the space were always meant to look this way. They listened carefully to how we live and the final design reflects our lifestyle perfectly — not a catalogue look.',                                                                            rating: 5 },
  { name: 'Aman Verma',     location: 'Bangalore', text: 'Professional, transparent, and highly skilled. The 3D model matched the final output perfectly — I could see every finish and furniture placement before work started, which gave me complete confidence. There were no surprises during execution, only a flawless result.',                                                                                   rating: 5 },
  { name: 'Neha Joshi',     location: 'Pune',      text: 'From consultation to handover, the entire process was smooth and completely stress-free. Truly turnkey — they handled every contractor, every delivery and every site decision. I just showed up on handover day and walked into a finished home. Could not have asked for more.',                                                                              rating: 5 },
  { name: 'Vikram Singh',   location: 'Indore',    text: 'We got a luxury home interior within our budget. Absolutely no compromise on quality or aesthetics — the materials are premium and the craftsmanship is immaculate. I had been quoted more by two other designers for a noticeably lower standard of finish.',                                                                                                 rating: 5 },
  { name: 'Sunita Agarwal', location: 'Bhopal',    text: 'The 3D renders were spot-on. We knew exactly what we were getting before a single nail was hammered, which made the whole process remarkably stress-free. The finished space is identical to what we approved in the render — a rare and genuinely reassuring experience.',                                                                                   rating: 5 },
];
const marqueeItems = [...testimonials, ...testimonials];

const services = [
  {
    Icon: IconHouseChimney,
    title: 'Residential Interiors',
    description: 'We specialise in full-home and room-by-room interior design for apartments, independent houses, villas and penthouses. Every project begins with a thorough lifestyle brief — how you cook, how you entertain, how much storage you need — and results in a completely bespoke design that no other home will share. From modular kitchens and wardrobes to living rooms, bedrooms and home offices, we cover every space with equal care.',
    features: ['100% custom — no templates or catalogues', 'Apartments, villas and independent houses', 'All rooms: kitchen, bedroom, living, bathroom', 'Full-home or single-room scope available', 'Trusted partners: Kajaria, Asian Paints, CenturyPly'],
    link: '/design/bedroom-designs',
  },
  {
    Icon: IconBuilding,
    title: 'Commercial Spaces',
    description: 'Offices, retail outlets and hospitality spaces that go beyond aesthetics — every commercial interior we design is engineered to reflect your brand identity, support your team\'s workflow and make a lasting impression on clients and visitors. We balance form with function and ensure durability under daily commercial use, delivering turnkey execution from concept to fit-out.',
    features: ['Offices, retail, showrooms and hospitality', 'Brand-aligned visual identity', 'Ergonomic layouts for team performance', 'Durable materials suited to commercial use', 'Turnkey fit-out from concept to completion'],
    link: '/design/commercial-designs',
  },
  {
    Icon: IconEye,
    title: '3D Visualization',
    description: 'Before any physical work begins, you see your space in exact, photorealistic 3D — with correct proportions, real material textures, furniture placement and lighting. You review and approve every detail at this stage, eliminating mid-project surprises and costly changes. The 3D model we produce is not a mood board or a rough concept — it is an accurate digital twin of what will be built.',
    features: ['Exact-scale photorealistic renders', 'Real material and finish textures applied', 'Furniture and lighting placement shown', 'Full client approval before execution starts', 'Revision rounds included until satisfied'],
    link: null,
  },
  {
    Icon: IconRuler,
    title: 'Space Planning',
    description: 'A well-planned space is the foundation of every great interior. We analyse your floor plan for traffic flow, natural light, ventilation, storage requirements and functional zones — then optimise the layout before any visual design choices are made. Good space planning makes a home feel larger, more liveable and more intuitive without changing its square footage.',
    features: ['Floor plan optimisation before visual design', 'Traffic flow and functional zoning', 'Storage maximisation throughout every room', 'Natural light and ventilation considered', 'Modular kitchen and wardrobe layout planning'],
    link: '/design/kitchen-designs',
  },
  {
    Icon: IconLightbulb,
    title: 'Lighting Design',
    description: 'Lighting transforms how a space feels — a well-lit room looks larger, warmer and more luxurious than the same room with poor lighting. We design layered schemes combining ambient, accent and task lighting for every room, balancing artificial sources with natural light to create the right atmosphere at every time of day. Lighting design is included in full-home projects and available as a standalone service.',
    features: ['Three-layer lighting: ambient, accent, task', 'Natural light maximisation strategy', 'Mood-appropriate zoning per room', 'Energy-efficient fixture recommendations', 'Coordinated with 3D visualisation'],
    link: '/design/lounge-area-designs',
  },
  {
    Icon: IconScrewdriverWrench,
    title: 'Renovation Services',
    description: 'Renovation is more complex than new build — it requires a precise assessment of what exists before recommending what to change. We begin every renovation with a thorough audit of your current space, identify structural constraints and opportunities, then redesign around them. Civil, electrical, plumbing-coordination and finishing are managed together so you never juggle multiple contractors and timelines.',
    features: ['Full audit of existing space before any work', 'Partial or full-scale renovation scope', 'Civil, electrical and finishing coordinated', 'Structural constraints identified upfront', 'Minimal disruption scheduling and management'],
    link: '/projects',
  },
];

const CountUp = ({ endValue, duration = 2300 }) => {
  const [count, setCount]       = useState(0);
  const [isVisible, setVisible] = useState(false);
  const ref = useRef(null);
  const match        = String(endValue).match(/^(\D*)(\d+(?:\.\d+)?)(\D*)$/);
  const prefix       = match ? match[1] : '';
  const targetNumber = match ? parseFloat(match[2]) : null;
  const suffix       = match ? match[3] : '';
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); o.disconnect(); } }, { threshold: 0.1 });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    if (!isVisible || targetNumber === null) return;
    let ts = null;
    const step = (t) => { if (!ts) ts = t; const p = Math.min((t - ts) / duration, 1); const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); setCount(e * targetNumber); if (p < 1) window.requestAnimationFrame(step); else setCount(targetNumber); };
    window.requestAnimationFrame(step);
  }, [isVisible, targetNumber, duration]);
  if (targetNumber === null) return <span ref={ref}>{endValue}</span>;
  const d = Number.isInteger(targetNumber) ? Math.round(count) : count.toFixed(1);
  return <span ref={ref}>{prefix}<span className="hp-prof-num">{d}</span>{suffix}</span>;
};

export default function ServicesPage() {
  const router = useRouter();
  const { openConsult } = useModal();
  const revealRefs = useRef([]);
  const [activeService, setActiveService] = useState(null);

  useEffect(() => {
    const o = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); o.unobserve(e.target); } }), { threshold: 0.1 });
    revealRefs.current.forEach(el => el && o.observe(el));
    return () => o.disconnect();
  }, []);
  const addRef = el => { if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el); };

  useEffect(() => {
    if (activeService) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [activeService]);

  return (
    <div className="services-page">

      {/* ── Service detail modal ── */}
      {activeService && (
        <div className="svc-modal-backdrop" onClick={() => setActiveService(null)}>
          <div className="svc-modal" onClick={e => e.stopPropagation()}>
            <div className="svc-modal-header">
              <div className="svc-modal-icon"><activeService.Icon /></div>
              <h3 className="svc-modal-title">{activeService.title}</h3>
              <button className="svc-modal-close" onClick={() => setActiveService(null)} aria-label="Close">
                <IconXMark />
              </button>
            </div>
            <p className="svc-modal-desc">{activeService.description}</p>
            {activeService.features?.length > 0 && (
              <ul className="svc-modal-features">
                {activeService.features.map((f, i) => (
                  <li key={i}><span className="svc-feat-dot" />{f}</li>
                ))}
              </ul>
            )}
            {activeService.link && (
              <Link
                href={activeService.link}
                className="svc-modal-link"
                onClick={() => setActiveService(null)}
              >
                View designs <IconArrowRight />
              </Link>
            )}
          </div>
        </div>
      )}
      <section className="hp-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bgimg.src} alt="Luxury interior design services in Satna, Madhya Pradesh — Shrivastavas Elevate" className="hp-hero-bg" />
        <div className="hp-hero-overlay" />
        <div className="hp-hero-inner">
          <div className="hp-hero-eyebrow">
            <span className="hp-eyebrow-line" />
            <span>Luxury Interior Design Studio</span>
            <span className="hp-eyebrow-line" />
          </div>
          <h1 className="hp-hero-title">
            Crafted<br /><span className="hp-highlight">Interiors</span>
          </h1>
          <p className="hp-hero-sub">
            Bespoke interior design and contracting solutions<br />crafted for modern lifestyles and timeless elegance.
          </p>
          <div className="hp-hero-actions">
            <button onClick={openConsult} className="hp-btn-primary">
              Book Consultation <IconCalendar />
            </button>
            <button onClick={() => router.push('/projects')} className="hp-btn-ghost">
              View Projects <IconArrowRight />
            </button>
          </div>
          <p className="hp-hero-caption">
            <IconBuilding /> Interior Designers &amp; Contractors · Satna
          </p>
        </div>
        <div className="hp-scroll-hint"><span className="hp-scroll-line" /><span>Scroll</span></div>
      </section>

      <section className="services-stats">
        {[{ val: '50+', label: 'Projects Completed' }, { val: '5+', label: 'Years Experience' }, { val: '100%', label: 'Client Satisfaction' }, { val: '24hr', label: 'Response Time' }].map((s, i) => (
          <div className="services-stat-box" key={i}>
            <h2><CountUp endValue={s.val} />{s.star && <IconStarFilled className="stat-star" />}</h2>
            <p>{s.label}</p>
          </div>
        ))}
      </section>

      <section className="services-main-section hp-advantages">
        <div className="services-heading reveal-item" ref={addRef}>
          <div className="services-heading-left">
            <span className="svc-section-tag"><IconCrown /> Our Craft</span>
            <h2>Every Service.<br />One Vision.</h2>
          </div>
          <div className="services-heading-right">
            <p>From residential retreats to commercial landmarks across India — every interior design brief handled from the first sketch to the final handover.</p>
          </div>
        </div>
        <div className="svc-grid">
          {services.map((svc, i) => (
            <div
              className="svc-grid-card reveal-item"
              ref={addRef}
              key={i}
              data-num={String(i + 1).padStart(2, '0')}
              style={{ '--delay': `${i * 80}ms` }}
              onClick={() => setActiveService(svc)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setActiveService(svc)}
            >
              <div className="svc-card-accent" />
              <div className="svc-card-body">
                <div className="svc-icon-wrap"><svc.Icon /></div>
                <h3>{svc.title}</h3>
                <p>{svc.description}</p>
                <ul className="svc-card-features">
                  {svc.features.map((f, idx) => <li key={idx}><span className="svc-feat-dot" />{f}</li>)}
                </ul>
                {svc.link && (
                  <Link
                    href={svc.link}
                    className="svc-card-link"
                    onClick={e => e.stopPropagation()}
                  >
                    <span>View designs</span>
                    <span className="svc-card-link-arrow"><IconArrowRight /></span>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="svc-why-section">
        <div className="svc-why-head reveal-item" ref={addRef}>
          <span className="svc-section-tag"><IconShield /> Why Choose Us</span>
          <h2>The Advantages<br />Our Clients Get</h2>
        </div>
        <div className="svc-why-grid">
          {[
            { Icon: IconGem,      title: 'Affordable Luxury',   desc: 'Every project begins with a fully itemised quote — materials, labour and logistics — so you know exactly where every rupee goes before work starts. We source premium materials directly from trusted partners like Kajaria, Asian Paints and CenturyPly, cutting out middlemen and passing the savings to you. The result is a luxury finish at a price that is honest and fair.' },
            { Icon: IconShield,   title: 'Consultation Refund', desc: 'Our initial design consultation is not a cost — it is an investment. The full consultation fee is credited back against your project cost the moment you confirm. This means if you proceed with us, the consultation was completely free. We offer this because we are confident in our work and want you to experience our process without financial risk.' },
            { Icon: IconPenRuler, title: '100% Bespoke',        desc: 'We do not work from templates or reuse catalogue layouts. Every design begins with a conversation about how you actually live — your daily routines, storage needs, aesthetic preferences and family. From that we build a design that is unique to your space and your life. Whether it is a compact apartment or a sprawling villa, every detail is conceived specifically for you.' },
            { Icon: IconKey,      title: 'Turnkey Execution',   desc: 'From design sign-off to the day you walk in with your keys, we manage everything. Vendor selection, material procurement, skilled labour coordination, site supervision, quality checks at every phase, and a formal punch-list before handover — all handled by our team. You do not need to chase contractors, follow up on deliveries, or make a single site decision.' },
          ].map((item, i) => (
            <div className="svc-why-card reveal-item" ref={addRef} key={i} style={{ '--delay': `${i * 80}ms` }}>
              <div className="svc-why-icon"><item.Icon /></div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="svc-stats-section">
        <div className="svc-stats-strip reveal-item" ref={addRef}>
          {[{ Icon: IconLayerGroup, val: '50+', label: 'Projects Delivered' }, { Icon: IconKey, val: '100%', label: 'Turnkey Execution' }, { Icon: IconClock, val: '24hr', label: 'Response Time' }].map((s, i) => (
            <div className="svc-stat-item" key={i}>
              <div className="svc-stat-icon"><s.Icon /></div>
              <span className="svc-stat-val"><CountUp endValue={s.val} /></span>
              <span className="svc-stat-lbl">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="svc-start-section">
        <div className="svc-start-head reveal-item" ref={addRef}>
          <span className="svc-section-tag"><IconComments /> How It Works</span>
          <h2>Get Started in<br />3 Simple Steps</h2>
          <p>From your first message to a fully transformed space — here&apos;s the journey.</p>
        </div>
        <div className="svc-start-grid">
          {[
            { num: '01', Icon: IconCalendar, title: 'Book a Free Consultation',   desc: 'Tell us about your space, vision and budget in a relaxed conversation — no obligation, no pressure. We ask the questions that matter: how you live, what frustrates you about your current space, and what your dream version looks like. This session is the foundation for everything that follows.', cta: true  },
            { num: '02', Icon: IconEye,      title: 'Approve Your 3D Design',    desc: 'We translate your brief into a photorealistic 3D render of your exact space — every material, finish, furniture piece and lighting effect shown to scale. You review and request changes until the design is exactly right. Nothing moves to execution until you have explicitly signed off.', cta: false },
            { num: '03', Icon: IconKey,      title: 'Move Into Your Dream Space', desc: 'Once you approve the design, our team handles everything — material procurement, vendor coordination, on-site execution, quality checks at each milestone and a formal handover walkthrough. You walk in when it is finished, exactly as designed. No site visits, no contractor chasing, no stress.', cta: false },
          ].map((s, i) => (
            <div className="svc-start-card reveal-item" key={i} ref={addRef} style={{ '--delay': `${i * 100}ms` }}>
              <div className="svc-start-card-top">
                <span className="svc-start-num hp-prof-num">{s.num}</span>
                <div className="svc-start-icon"><s.Icon /></div>
              </div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              {s.cta && <button className="svc-start-cta" onClick={openConsult}>Book Now <IconArrowRight /></button>}
            </div>
          ))}
        </div>
      </section>

      <section className="svc-testimonial-section">
        <div className="svc-t-heading reveal-item" ref={addRef}>
          <span className="svc-section-tag"><IconQuoteLeft /> Testimonials</span>
          <h2>What Our Clients Say</h2>
          <p className="testimonial-subtitle">Trusted by homeowners across India for luxury interiors and seamless execution.</p>
        </div>
        <div className="marquee-track-wrapper">
          <div className="marquee-track">
            <div className="marquee-inner scroll-left">
              {marqueeItems.map((t, i) => (
                <div className="t-card" key={`a${i}`}>
                  <div className="t-card-stars">{Array.from({ length: t.rating }).map((_, s) => <IconStarFilled key={s} />)}</div>
                  <p className="t-card-text">{t.text}</p>
                  <div className="t-card-author">
                    <div className="t-card-avatar">{t.image ? <img src={t.image.src} alt={t.name} /> : t.name.charAt(0)}</div>
                    <div className="t-card-author-info"><strong>{t.name}</strong><span>{t.location}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="marquee-track">
            <div className="marquee-inner scroll-right">
              {[...marqueeItems].reverse().map((t, i) => (
                <div className="t-card" key={`b${i}`}>
                  <div className="t-card-stars">{Array.from({ length: t.rating }).map((_, s) => <IconStarFilled key={s} />)}</div>
                  <p className="t-card-text">{t.text}</p>
                  <div className="t-card-author">
                    <div className="t-card-avatar">{t.image ? <img src={t.image.src} alt={t.name} /> : t.name.charAt(0)}</div>
                    <div className="t-card-author-info"><strong>{t.name}</strong><span>{t.location}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="services-cta reveal-item" ref={addRef}>
        <div className="cta-inner">
          <span className="svc-section-tag"><IconCrown /> Begin Your Journey</span>
          <h2>Let&apos;s Create Your<br />Dream Interior</h2>
          <p>Elegant spaces crafted with precision, premium materials and timeless modern aesthetics.</p>
          <button className="services-cta-btn" onClick={openConsult}>Book Free Consultation <IconCalendar /></button>
        </div>
      </section>

      <Footer />
    </div>
  );
}

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
  { name: 'Rahul Mehta',    location: 'Mumbai',    text: 'Exceptional execution and genuinely luxurious finishing. Every material, proportion and detail was considered, and the finished space matched the 3D render they showed us months earlier almost exactly. That kind of accuracy is rare.',                                                         rating: 5, image: design },
  { name: 'Priya Sharma',   location: 'Delhi',     text: 'Their design sense is outstanding. Every corner of our apartment feels premium and considered, like the space was always meant to look this way. They listened carefully to how we actually live and you can see that in the result.',                                                             rating: 5 },
  { name: 'Aman Verma',     location: 'Bangalore', text: 'Professional, transparent and highly skilled. I could see every finish and furniture placement in the 3D before work started, which gave me real confidence going in. The execution matched it perfectly with no surprises at all.',                                                               rating: 5 },
  { name: 'Neha Joshi',     location: 'Pune',      text: 'From the first consultation to handover, the whole process was smooth and genuinely stress-free. They handled every contractor, delivery and site call. I just showed up on handover day and walked into a finished home.',                                                                       rating: 5 },
  { name: 'Vikram Singh',   location: 'Indore',    text: 'We got a genuinely luxurious interior within our budget, with no compromise on quality or finish. The materials are premium and the craftsmanship is immaculate. Two other designers had quoted us more for a noticeably lower standard of work.',                                                rating: 5 },
  { name: 'Sunita Agarwal', location: 'Bhopal',    text: 'The 3D renders were absolutely spot-on. We knew exactly what we were getting before any work started, which took away all the usual anxiety. The finished space is identical to what we approved in the render. That level of accuracy is rare.',                                                 rating: 5 },
];
const marqueeItems = [...testimonials, ...testimonials];
const truncate = (text) => text.length > 100 ? text.slice(0, 97).trimEnd() + '…' : text;

const services = [
  {
    Icon: IconHouseChimney,
    title: 'Residential Interiors',
    description: 'Full-home and room-by-room interiors for apartments, houses, villas and penthouses. Every project starts with a detailed lifestyle brief: how you cook, how you entertain, how much storage you actually need. The result is a completely bespoke design that belongs to your home and no one else\'s.',
    features: ['100% custom, nothing from a template or catalogue', 'Apartments, villas and independent houses', 'Kitchens, bedrooms, living spaces, bathrooms, home offices', 'Full-home or single-room scope available', 'Sourced from Kajaria, Asian Paints and CenturyPly'],
    link: '/design/bedroom-designs',
  },
  {
    Icon: IconBuilding,
    title: 'Commercial Spaces',
    description: 'Commercial interiors need to do more than look good. Every office, retail or hospitality space we design is built around your brand, your team\'s workflow and the impression you want visitors to walk away with. Materials and finishes are chosen for durability under daily use.',
    features: ['Offices, retail, showrooms and hospitality spaces', 'Brand-aligned design throughout', 'Ergonomic layouts that support daily team performance', 'Materials chosen for commercial durability', 'Turnkey delivery from concept to fit-out'],
    link: '/design/commercial-designs',
  },
  {
    Icon: IconEye,
    title: '3D Visualization',
    description: 'Before any physical work begins, you see your space in precise, photorealistic 3D. This isn\'t a rough concept or a mood board. It\'s an accurate replica of what will actually be built, with real proportions, real textures and real lighting.',
    features: ['Every room modelled to exact scale', 'Real material textures and furniture placement shown', 'Lighting design visualised in the render', 'Client approval required before any execution starts', 'Revision rounds until you\'re fully satisfied'],
    link: null,
  },
  {
    Icon: IconRuler,
    title: 'Space Planning',
    description: 'A well-planned layout is the foundation of every great interior. We study the floor plan before any visual decisions are made, so everything that follows is grounded in how the space actually works, not just how it looks.',
    features: ['Traffic flow and functional zoning optimised first', 'Natural light and ventilation factored into the layout', 'Storage built into the plan from the start', 'Kitchen and wardrobe layouts planned to exact dimensions', 'Makes the space feel larger without changing square footage'],
    link: '/design/kitchen-designs',
  },
  {
    Icon: IconLightbulb,
    title: 'Lighting Design',
    description: 'Lighting changes how a space feels completely. A well-lit room looks larger, warmer and more considered than the same room with poor lighting. We design layered schemes for each room, balanced against natural light throughout the day.',
    features: ['Three-layer scheme: ambient, accent and task lighting', 'Natural light maximised and balanced with artificial sources', 'Room-by-room zoning for different moods and uses', 'Energy-efficient fixtures recommended throughout', 'Included in full-home projects, also available standalone'],
    link: '/design/lounge-area-designs',
  },
  {
    Icon: IconScrewdriverWrench,
    title: 'Renovation Services',
    description: 'Renovation is more complex than starting fresh. We audit what exists before recommending anything, identify structural constraints early, and coordinate all trades under one managed project so you\'re never dealing with multiple contractors pulling in different directions.',
    features: ['Full audit of existing space before any work is recommended', 'Partial or full-scale renovation scope', 'Civil, electrical and finishing managed as one project', 'Structural constraints identified upfront, no surprises', 'Scheduled around your routine to minimise disruption'],
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
  const [activeService,  setActiveService]  = useState(null);
  const [activeTCard,    setActiveTCard]    = useState(null);
  const [activeInfoCard, setActiveInfoCard] = useState(null);

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

      {/* ── Why Choose Us / How It Works modal ── */}
      {activeInfoCard && (
        <div className="svc-modal-backdrop" onClick={() => setActiveInfoCard(null)}>
          <div className="svc-modal" onClick={e => e.stopPropagation()}>
            <div className="svc-modal-header">
              {activeInfoCard.num
                ? <span className="hp-prof-num svc-modal-num">{activeInfoCard.num}</span>
                : <div className="svc-modal-icon"><activeInfoCard.Icon /></div>
              }
              <h3 className="svc-modal-title">{activeInfoCard.title}</h3>
              <button className="svc-modal-close" onClick={() => setActiveInfoCard(null)} aria-label="Close"><IconXMark /></button>
            </div>
            <p className="svc-modal-desc">{activeInfoCard.desc}</p>
            {activeInfoCard.cta && (
              <button className="svc-start-cta" style={{ marginTop: '8px' }} onClick={() => { setActiveInfoCard(null); openConsult(); }}>
                Book Now <IconArrowRight />
              </button>
            )}
          </div>
        </div>
      )}

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
          <div className="hp-hero-tag-box">Our Services</div>
          <h1 className="hp-hero-title">
            <span>Crafted</span>
            <span>Interiors</span>
          </h1>
          <div className="hp-hero-rule" />
          <p className="hp-hero-sub">
            Bespoke interior design and contracting solutions<br />crafted for modern lifestyles and timeless elegance.
          </p>
          <div className="hp-hero-actions">
            <button onClick={openConsult} className="hp-btn-primary">
              Book Consultation
            </button>
            <button onClick={() => router.push('/projects')} className="hp-btn-ghost">
              View Projects
            </button>
          </div>

          <div className="hp-hero-bottom">
            <div className="hp-hero-bottom-left">
              <div className="hp-hero-loc-item">
                <span className="hp-loc-label">Location</span>
                <span className="hp-loc-val">Satna</span>
              </div>
              <div className="hp-hero-loc-divider" />
              <div className="hp-hero-loc-item">
                <span className="hp-loc-label">Category</span>
                <span className="hp-loc-val">Interior Design</span>
              </div>
            </div>
            <span className="hp-est">Since 2019</span>
          </div>
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
                <p>{truncate(svc.description)}</p>
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
            { Icon: IconGem,      title: 'Affordable Luxury',   desc: 'Fully itemised quote upfront, direct sourcing from Kajaria, Asian Paints and CenturyPly with no middlemen, and no hidden costs added mid-project. You get a luxury finish at a price that\'s transparent from day one.'                                                },
            { Icon: IconShield,   title: 'Consultation Refund', desc: 'The consultation fee gets credited back against your project the moment you confirm. If you go ahead with us, it was essentially free. We do this because we\'re confident in the work.'                                                                                              },
            { Icon: IconPenRuler, title: '100% Bespoke',        desc: 'No templates, no catalogue layouts and nothing reused from another project. Every design starts with a real conversation about how you live and ends with something built specifically for your space.'                                                                                },
            { Icon: IconKey,      title: 'Turnkey Execution',   desc: 'From sign-off to handover we manage vendors, materials, labour, site supervision and quality checks. You don\'t chase a single contractor or make a site decision yourself.'                                                                                                          },
          ].map((item, i) => (
            <div
              className="svc-why-card reveal-item" ref={addRef} key={i}
              style={{ '--delay': `${i * 80}ms`, cursor: 'pointer' }}
              onClick={() => setActiveInfoCard(item)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setActiveInfoCard(item)}
            >
              <div className="svc-why-icon"><item.Icon /></div>
              <h3>{item.title}</h3>
              <p>{truncate(item.desc)}</p>
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
            { num: '01', Icon: IconCalendar, title: 'Book a Free Consultation',   desc: 'A straightforward conversation about your space, vision and budget. No obligation, no sales pitch. We ask how you live, what bothers you about your current space and what your ideal version looks like. Everything that follows is built from this.',                                                   cta: true  },
            { num: '02', Icon: IconEye,      title: 'Approve Your 3D Design',    desc: 'Your brief becomes a photorealistic 3D render with real materials, finishes, furniture and lighting shown to scale. You review it, ask for changes and we refine until it\'s exactly right. Nothing goes to execution until you\'ve signed off on every detail.',                                                cta: false },
            { num: '03', Icon: IconKey,      title: 'Move Into Your Dream Space', desc: 'Once the design is approved, we take over completely: material procurement, vendor coordination, site execution, quality checks and a final handover walkthrough. You walk in when it\'s done, exactly as designed. No site visits, no chasing, no stress.',                                                   cta: false },
          ].map((s, i) => (
            <div
              className="svc-start-card reveal-item" key={i} ref={addRef}
              style={{ '--delay': `${i * 100}ms`, cursor: 'pointer' }}
              onClick={() => setActiveInfoCard(s)}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setActiveInfoCard(s)}
            >
              <div className="svc-start-card-top">
                <span className="svc-start-num hp-prof-num">{s.num}</span>
                <div className="svc-start-icon"><s.Icon /></div>
              </div>
              <h3>{s.title}</h3>
              <p>{truncate(s.desc)}</p>
            </div>
          ))}
        </div>
      </section>

      {activeTCard && (
        <div className="t-modal-backdrop" onClick={() => setActiveTCard(null)}>
          <div className="t-modal t-modal--light" onClick={e => e.stopPropagation()}>
            <button className="t-modal-close" onClick={() => setActiveTCard(null)} aria-label="Close"><IconXMark /></button>
            <div className="t-modal-stars">{Array.from({ length: activeTCard.rating }).map((_, i) => <IconStarFilled key={i} />)}</div>
            <p className="t-modal-text">{activeTCard.text}</p>
            <div className="t-modal-author">
              <div className="t-modal-avatar">{activeTCard.image ? <img src={activeTCard.image.src} alt={activeTCard.name} /> : activeTCard.name.charAt(0)}</div>
              <div className="t-modal-author-info"><strong>{activeTCard.name}</strong><span>{activeTCard.location}</span></div>
            </div>
          </div>
        </div>
      )}

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
                <div className="t-card" key={`a${i}`} onClick={() => setActiveTCard(t)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setActiveTCard(t)}>
                  <div className="t-card-stars">{Array.from({ length: t.rating }).map((_, s) => <IconStarFilled key={s} />)}</div>
                  <p className="t-card-text">{truncate(t.text)}</p>
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
                <div className="t-card" key={`b${i}`} onClick={() => setActiveTCard(t)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setActiveTCard(t)}>
                  <div className="t-card-stars">{Array.from({ length: t.rating }).map((_, s) => <IconStarFilled key={s} />)}</div>
                  <p className="t-card-text">{truncate(t.text)}</p>
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

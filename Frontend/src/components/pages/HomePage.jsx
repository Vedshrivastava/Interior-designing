'use client';
import '@/styles/home.css';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconCrown, IconLayerGroup, IconBuilding, IconArrowRight, IconCalendar,
  IconShield, IconUtensils, IconBed, IconBath, IconCouch, IconTv,
  IconComments, IconRuler, IconEye, IconSwatchbook, IconHelmet, IconKey,
  IconHouseChimney, IconQuoteLeft, IconIndustry, IconStar, IconStarFilled,
  IconGem, IconPenRuler, IconXMark,
} from '@/components/Icons';
import Footer from '@/components/Footer';
import { useModal } from '@/context/ModalContext';

import bgimg        from '@/assets/home-img.png';
import kitchen_img  from '@/assets/kitchen.png';
import bathroom_img from '@/assets/bathroom.png';
import TV_unit_img  from '@/assets/TV-unit.png';
import lounge_img   from '@/assets/lounge.png';
import bedroom_img  from '@/assets/bedroom.png';
import kajaria      from '@/assets/kajaria.png';
import saint_gobain from '@/assets/Saint-Gobain.jpg';
import asian_paints from '@/assets/asian-paints.jpeg';
import centuryply   from '@/assets/centuryply.png';
import design       from '@/assets/refund-design.png';

const FALLBACK_TESTIMONIALS = [
  { name: 'Rahul Mehta',    location: 'Mumbai',    text: 'Exceptional execution and genuinely luxurious finishing. Every material, proportion and detail was considered, and the finished space matched the 3D render they showed us months earlier almost exactly. That kind of accuracy is rare.',                                                         rating: 5, image: design },
  { name: 'Priya Sharma',   location: 'Delhi',     text: 'Their design sense is outstanding. Every corner of our apartment feels premium and considered, like the space was always meant to look this way. They listened carefully to how we actually live and you can see that in the result.',                                                             rating: 5 },
  { name: 'Aman Verma',     location: 'Bangalore', text: 'Professional, transparent and highly skilled. I could see every finish and furniture placement in the 3D before work started, which gave me real confidence going in. The execution matched it perfectly with no surprises at all.',                                                               rating: 5 },
  { name: 'Neha Joshi',     location: 'Pune',      text: 'From the first consultation to handover, the whole process was smooth and genuinely stress-free. They handled every contractor, delivery and site call. I just showed up on handover day and walked into a finished home.',                                                                       rating: 5 },
  { name: 'Vikram Singh',   location: 'Indore',    text: 'We got a genuinely luxurious interior within our budget, with no compromise on quality or finish. The materials are premium and the craftsmanship is immaculate. Two other designers had quoted us more for a noticeably lower standard of work.',                                                rating: 5 },
  { name: 'Sunita Agarwal', location: 'Bhopal',    text: 'The 3D renders were absolutely spot-on. We knew exactly what we were getting before any work started, which took away all the usual anxiety. The finished space is identical to what we approved in the render. That level of accuracy is rare.',                                                 rating: 5 },
];

function useDraggableMarquee({ speed = 0.55, reverse = false } = {}) {
  const innerRef = useRef(null);
  const stateRef = useRef({ pos: 0, dragging: false, startX: 0, startPos: 0, moved: false });
  const rafRef = useRef(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const half = el.scrollWidth / 2;
    stateRef.current.pos = reverse ? -half : 0;
    el.style.transform = `translateX(${stateRef.current.pos}px)`;

    function tick() {
      const s = stateRef.current;
      if (!s.dragging) {
        const h = el.scrollWidth / 2;
        s.pos += reverse ? speed : -speed;
        if (!reverse && s.pos <= -h) s.pos += h;
        if (reverse  && s.pos >= 0)  s.pos -= h;
        el.style.transform = `translateX(${s.pos}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function onWindowMove(e) {
      const s = stateRef.current;
      if (!s.dragging) return;
      if (Math.abs(e.clientX - s.startX) > 8) s.moved = true;
      const h = el.scrollWidth / 2;
      let newPos = s.startPos + (e.clientX - s.startX);
      if (newPos > 0) newPos -= h;
      if (newPos < -h) newPos += h;
      s.pos = newPos;
      el.style.transform = `translateX(${newPos}px)`;
    }

    function onWindowUp() {
      stateRef.current.dragging = false;
    }

    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup',   onWindowUp);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup',   onWindowUp);
    };
  }, [speed, reverse]);

  function handlePointerDown(e) {
    const s = stateRef.current;
    s.dragging = true;
    s.moved    = false;
    s.startX   = e.clientX;
    s.startPos = s.pos;
  }

  return {
    innerRef,
    onPointerDown: handlePointerDown,
    wasDragged: () => stateRef.current.moved,
  };
}

const brandLogos = [
  { src: kajaria.src,      alt: 'Kajaria'      },
  { src: saint_gobain.src, alt: 'Saint-Gobain' },
  { src: asian_paints.src, alt: 'Asian Paints' },
  { src: centuryply.src,   alt: 'CenturyPly'   },
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
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || targetNumber === null) return;
    let ts = null;
    const step = (t) => {
      if (!ts) ts = t;
      const p = Math.min((t - ts) / duration, 1);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setCount(e * targetNumber);
      if (p < 1) window.requestAnimationFrame(step);
      else setCount(targetNumber);
    };
    window.requestAnimationFrame(step);
  }, [isVisible, targetNumber, duration]);

  if (targetNumber === null) return <span ref={ref}>{endValue}</span>;
  const d = Number.isInteger(targetNumber) ? Math.round(count) : count.toFixed(1);
  return <span ref={ref}>{prefix}<span className="hp-prof-num">{d}</span>{suffix}</span>;
};

export default function HomePage() {
  const router = useRouter();
  const { openConsult } = useModal();
  const [activeCard, setActiveCard] = useState(null);

  const trackA = useDraggableMarquee({ speed: 0.55, reverse: false });
  const trackB = useDraggableMarquee({ speed: 0.55, reverse: true });

  const revealRefs = useRef([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('sr-visible'); io.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    revealRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const sr = el => { if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el); };

  const [activeTCard, setActiveTCard] = useState(null);
  const [testimonials, setTestimonials] = useState(FALLBACK_TESTIMONIALS);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/testimonial/list?activeOnly=true`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setTestimonials(d.data?.length > 0 ? d.data : FALLBACK_TESTIMONIALS);
      })
      .catch(() => {});
  }, []);

  const marqueeItems = [...testimonials, ...testimonials];

  useEffect(() => {
    if (activeCard || activeTCard) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [activeCard, activeTCard]);

  useEffect(() => {
    if (!activeTCard) return;
    const handler = e => { if (e.key === 'Escape') setActiveTCard(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTCard]);

  return (
    <div className="home-page">

      {/* ── Card detail modal — process + advantages ── */}
      {activeCard && (
        <div className="svc-modal-backdrop" onClick={() => setActiveCard(null)}>
          <div className="svc-modal" onClick={e => e.stopPropagation()}>
            <div className="svc-modal-header">
              <div className="svc-modal-icon"><activeCard.Icon /></div>
              <h3 className="svc-modal-title">
                {activeCard.num && (
                  <span style={{ color: 'var(--gold)', fontVariantNumeric: 'lining-nums', marginRight: 8 }}>
                    {activeCard.num}
                  </span>
                )}
                {activeCard.title}
              </h3>
              <button className="svc-modal-close" onClick={() => setActiveCard(null)} aria-label="Close">
                <IconXMark />
              </button>
            </div>
            <p className="svc-modal-desc">{activeCard.desc}</p>
            {activeCard.points?.length > 0 && (
              <ul className="svc-modal-features">
                {activeCard.points.map((pt, i) => <li key={i}><span className="svc-feat-dot" />{pt}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Testimonial detail modal ── */}
      {activeTCard && (
        <div className="t-modal-backdrop" onClick={() => setActiveTCard(null)}>
          <div className="t-modal" onClick={e => e.stopPropagation()}>
            <button className="t-modal-close" onClick={() => setActiveTCard(null)} aria-label="Close">
              <IconXMark />
            </button>
            <div className="t-modal-stars">
              {Array.from({ length: activeTCard.rating }).map((_, i) => <IconStarFilled key={i} />)}
            </div>
            <p className="t-modal-text">{activeTCard.text}</p>
            <div className="t-modal-author">
              <div className="t-modal-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {activeTCard.image ? <img src={activeTCard.image.src} alt={activeTCard.name} /> : activeTCard.name.charAt(0)}
              </div>
              <div className="t-modal-author-info">
                <strong>{activeTCard.name}</strong>
                <span>{activeTCard.location}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          HERO
      ══════════════════════════════ */}
      <section className="hp-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bgimg.src} alt="" className="hp-hero-bg" fetchPriority="high" loading="eager" />
        <div className="hp-hero-overlay" />
        <div className="hp-hero-grid-lines"><span /><span /><span /><span /></div>

        <div className="hp-hero-inner">
          <div className="hp-hero-tag-box">Interior Design Studio</div>
          <h1 className="hp-hero-title">
            <span>Shrivastava&apos;s</span>
            <span>Elevate</span>
          </h1>
          <div className="hp-hero-rule" />
          <p className="hp-hero-sub">
            Crafting timeless interiors with luxury,<br />precision and turnkey execution.
          </p>
          <div className="hp-hero-actions">
            <button onClick={() => router.push('/projects')} className="hp-btn-primary">
              Explore Projects
            </button>
            <button onClick={openConsult} className="hp-btn-ghost">
              Book Consultation
            </button>
          </div>

          {/* Bottom bar */}
          <div className="hp-hero-bottom">
            <div className="hp-hero-bottom-left">
              <div className="hp-hero-loc-item">
                <span className="hp-loc-label">Location</span>
                <span className="hp-loc-val">Satna</span>
              </div>
              <div className="hp-hero-loc-divider" />
              <div className="hp-hero-loc-item">
                <span className="hp-loc-label">Region</span>
                <span className="hp-loc-val">Madhya Pradesh</span>
              </div>
            </div>
            <span className="hp-est">Est. 2024</span>
          </div>
        </div>

        <div className="hp-scroll-hint">
          <span className="hp-scroll-line" />
          <span>Scroll</span>
        </div>
      </section>

      {/* ══════════════════════════════
          STATS BAR
      ══════════════════════════════ */}
      <section className="hp-stats">
        {[
          { num: '50+',  label: 'Projects Completed', sub: 'Across residential & commercial' },
          { num: '7+',   label: 'Years Experienced Team',   sub: 'Serving discerning clients'       },
          { num: '100%', label: 'Custom Design',       sub: 'No templates, ever'               },
          { num: '100%', label: 'Client Satisfaction',  sub: 'Zero compromises, always'            },
        ].map((s, i) => (
          <div className="hp-stat-item" key={i} ref={sr} style={{ '--sr-delay': `${i * 80}ms` }}>
            <span className="hp-stat-rule" />
            <h2>
              <CountUp endValue={s.num} />
              {s.star && <IconStarFilled className="stat-star" />}
            </h2>
            <p className="hp-stat-label">{s.label}</p>
            <p className="hp-stat-sub">{s.sub}</p>
          </div>
        ))}
      </section>

      {/* ══════════════════════════════
          DESIGNS
      ══════════════════════════════ */}
      <section className="hp-designs">
        <div className="hp-section-head sr-item" ref={sr}>
          <div className="hp-sh-left">
            <span className="hp-overline"><IconLayerGroup /> Our Expertise</span>
            <h2>Choose From<br />Our Designs</h2>
          </div>
          <div className="hp-sh-right">
            <p>Explore thoughtfully crafted interiors designed for luxury, comfort and enduring functionality.</p>
          </div>
        </div>

        <div className="hp-designs-grid">
          {[
            { img: kitchen_img,  Icon: IconUtensils, label: 'Kitchen',  desc: 'Modern modular concepts', slug: 'kitchen-designs',     alt: 'Modular kitchen interior design in Satna, Madhya Pradesh'          },
            { img: bedroom_img,  Icon: IconBed,      label: 'Bedroom',  desc: 'Elegant & luxurious',     slug: 'bedroom-designs',     alt: 'Luxury bedroom interior design in Satna, MP'                        },
            { img: bathroom_img, Icon: IconBath,     label: 'Bathroom', desc: 'Minimal & premium',       slug: 'bathroom-designs',    alt: 'Premium bathroom interior design in Satna, Madhya Pradesh'          },
            { img: lounge_img,   Icon: IconCouch,    label: 'Lounge',   desc: 'Luxury living spaces',    slug: 'lounge-area-designs', alt: 'Luxury lounge and living room interior design in Satna, MP'         },
            { img: TV_unit_img,  Icon: IconTv,       label: 'TV Unit',  desc: 'Entertainment walls',     slug: 'tv-unit-designs',     alt: 'Modern TV unit and entertainment wall design in Satna, Madhya Pradesh' },
          ].map((d, i) => (
            <div
              className={`hp-design-card sr-item${i === 0 ? ' hp-design-card--featured' : ''}`}
              key={i}
              ref={sr}
              style={{ '--sr-delay': `${i * 60}ms` }}
              onClick={() => router.push(`/design/${d.slug}`)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && router.push(`/design/${d.slug}`)}
            >
              <div className="hp-dc-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.img.src} alt={d.alt} />
                <div className="hp-dc-overlay" />
              </div>
              <div className="hp-dc-info">
                <span className="hp-dc-icon"><d.Icon /></span>
                <div>
                  <h4>{d.label}</h4>
                  <p>{d.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
          <button onClick={() => router.push('/design/kitchen-designs')} className="hp-text-btn">
            View more designs <IconArrowRight />
          </button>
        </div>
      </section>

      {/* ══════════════════════════════
          PROCESS
      ══════════════════════════════ */}
      <section className="hp-process">
        <div className="hp-process-head sr-item" ref={sr}>
          <span className="hp-overline"><IconComments /> Our Process</span>
          <h2>How We Transform<br />Your Space</h2>
          <p>Six seamless steps — from your first idea to a finished, furnished dream home.</p>
        </div>
        <div className="hp-process-grid">
          {[
            { Icon: IconComments,   num: '01', title: 'Consultation',       desc: 'We start with a real conversation about how you live, what you want and what your space needs to do.',       points: ['In-person or virtual, whichever suits you', 'We cover routines, storage, aesthetics and budget', 'We listen more than we talk at this stage', 'Everything that follows is shaped by this session'] },
            { Icon: IconRuler,      num: '02', title: 'Space Planning',     desc: 'Before any visual design begins, we study the floor plan.',                                                  points: ['Traffic flow, natural light and ventilation assessed first', 'Functional zones laid out to match how you use the space', 'Storage maximised within the existing footprint', 'Gets the layout right before anything is made to look pretty'] },
            { Icon: IconEye,        num: '03', title: '3D Visualization',   desc: 'You see your space in photorealistic 3D before any work starts.',                                            points: ['Every room modelled to exact scale', 'Real material textures, furniture and lighting applied', 'You review and approve everything before execution begins', 'What you see in the render is what gets built'] },
            { Icon: IconSwatchbook, num: '04', title: 'Material Selection', desc: 'Every material is curated from trusted partners, within your budget.',                                       points: ['Sourced from Kajaria, Asian Paints and CenturyPly', 'All options presented within your approved budget', 'Physical samples available to touch before committing', 'Nothing specified without your sign-off'] },
            { Icon: IconHelmet,     num: '05', title: 'Execution',          desc: 'Our team executes the approved design with a project manager on site throughout.',                           points: ['Civil work, electrical, joinery, painting and installation coordinated together', 'Quality checks at every milestone', 'Regular progress updates throughout the build', 'No surprises, everything done to the approved design'] },
            { Icon: IconKey,        num: '06', title: 'Final Handover',     desc: `We don't hand over until everything is done properly.`,                                                      points: ['Formal walkthrough against the original design', 'Every outstanding item cleared before handover', 'Space delivered clean and fully furnished as designed', 'Warranty documentation for all installed products'] },
          ].map((s, i) => (
            <div
              className="hp-process-card sr-item"
              key={i}
              ref={sr}
              style={{ '--sr-delay': `${i * 80}ms` }}
              onClick={() => setActiveCard(s)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setActiveCard(s)}
            >
              <div className="hp-pc-top">
                <div className="hp-pc-icon"><s.Icon /></div>
                <span className="hp-pc-num hp-prof-num">{s.num}</span>
              </div>
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
              <div className="hp-pc-line" />
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          ADVANTAGES
      ══════════════════════════════ */}
      <section className="hp-advantages">
        <div className="hp-advantages-head sr-item" ref={sr}>
          <span className="hp-overline"><IconHouseChimney /> Client Benefits</span>
          <h2>Advantages<br />Our Clients Get</h2>
          <p>Every decision is designed to give you more confidence, more value and a smoother journey.</p>
        </div>

        <div className="hp-adv-grid">
          {[
            { Icon: IconGem,      title: 'Affordable Luxury',   desc: `Premium interiors shouldn't come with financial surprises.`,                               points: ['Fully itemised quote upfront covering materials, labour and logistics', 'Direct sourcing from Kajaria, Asian Paints and CenturyPly, no middlemen', 'No hidden costs added at any stage', "Luxury finish at a price that's honest and transparent"] },
            { Icon: IconShield,   title: 'Consultation Refund', desc: `The initial consultation fee isn't a cost, it's a credit.`,                                    points: ['Full fee adjusted against your project cost when you confirm', 'If you proceed with us, the consultation was essentially free', 'No financial risk to experiencing what we do', 'Reflects our confidence in the work'] },
            { Icon: IconEye,      title: '3D Before Build',     desc: `Before a single wall is touched, you see your space exactly as it'll look.`,                     points: ['Every room modelled to exact scale in photorealistic 3D', 'Real material textures and lighting applied throughout', 'Full approval required before execution starts', "What's in the render is exactly what gets built"] },
            { Icon: IconKey,      title: 'Turnkey Execution',   desc: `From sign-off to handover, we handle everything.`,                                               points: ['Vendor selection, materials and labour all coordinated by us', 'Site supervision and quality checks at every stage', 'Formal walkthrough before handover', "You don't make a single site decision yourself"] },
            { Icon: IconPenRuler, title: '100% Bespoke',        desc: `No templates, no catalogues, nothing reused from another project.`,                              points: ['Starts with a real conversation about how you live', 'Covers routines, storage needs, tastes and family', 'Every detail conceived specifically for your space', 'No two projects from us look the same'] },
            { Icon: IconBuilding, title: 'We Travel to You',    desc: `Our studio is in Satna, MP, but we work across India.`,                                          points: ['We travel for site visits, milestone reviews and handover', 'Virtual check-ins keep you in the loop between visits', 'Same standards and process as our local Satna projects', 'Distance has never been a reason to say no'] },
          ].map((adv, i) => (
            <div
              className="hp-adv-card sr-item"
              key={i}
              ref={sr}
              style={{ '--sr-delay': `${i * 70}ms` }}
              onClick={() => setActiveCard(adv)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setActiveCard(adv)}
            >
              <div className="hp-adv-icon"><adv.Icon /></div>
              <h3>{adv.title}</h3>
              <p>{adv.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          TESTIMONIALS
      ══════════════════════════════ */}
      <section className="hp-testimonials">
        <div className="hp-testimonials-head sr-item" ref={sr}>
          <span className="hp-overline"><IconQuoteLeft /> Testimonials</span>
          <h2>What Our Clients Say</h2>
          <p>Trusted by homeowners across India for luxury interiors and seamless execution.</p>
        </div>
        <div className="marquee-track-wrapper">
          <div className="marquee-track">
            <div
              className="marquee-inner scroll-left"
              ref={trackA.innerRef}
              onPointerDown={trackA.onPointerDown}
            >
              {marqueeItems.map((t, i) => (
                <div className="t-card" key={`a${i}`} onClick={() => { if (!trackA.wasDragged()) setActiveTCard(t); }} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setActiveTCard(t)}>
                  <div className="t-card-stars">{Array.from({ length: t.rating }).map((_, s) => <IconStarFilled key={s} />)}</div>
                  <p className="t-card-text">{t.text}</p>
                  <div className="t-card-author">
                    <div className="t-card-avatar">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {t.image ? <img src={t.image.src} alt={t.name} /> : t.name.charAt(0)}
                    </div>
                    <div className="t-card-author-info">
                      <strong>{t.name}</strong>
                      <span>{t.location}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="marquee-track">
            <div
              className="marquee-inner scroll-right"
              ref={trackB.innerRef}
              onPointerDown={trackB.onPointerDown}
            >
              {[...marqueeItems].reverse().map((t, i) => (
                <div className="t-card" key={`b${i}`} onClick={() => { if (!trackB.wasDragged()) setActiveTCard(t); }} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setActiveTCard(t)}>
                  <div className="t-card-stars">{Array.from({ length: t.rating }).map((_, s) => <IconStarFilled key={s} />)}</div>
                  <p className="t-card-text">{t.text}</p>
                  <div className="t-card-author">
                    <div className="t-card-avatar">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {t.image ? <img src={t.image.src} alt={t.name} /> : t.name.charAt(0)}
                    </div>
                    <div className="t-card-author-info">
                      <strong>{t.name}</strong>
                      <span>{t.location}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════
          BRANDS
      ══════════════════════════════ */}
      <section className="hp-brands">
        <div className="hp-brands-head sr-item" ref={sr}>
          <span className="hp-overline"><IconIndustry /> Premium Materials</span>
          <h2>Trusted Material Partners</h2>
          <p>We source exclusively from India&apos;s most respected material brands.</p>
        </div>
        <div className="hp-brands-row">
          {brandLogos.map((b, i) => (
            <div className="hp-brand-card sr-item" key={i} ref={sr} style={{ '--sr-delay': `${i * 70}ms` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.src} alt={b.alt} />
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          CTA
      ══════════════════════════════ */}
      <section className="hp-cta">
        <div className="hp-cta-grid-texture" />
        <div className="hp-cta-inner sr-item" ref={sr}>
          <span className="hp-overline light"><IconCrown /> Begin Your Journey</span>
          <h2>Ready to Transform<br />Your Space?</h2>
          <p>Let&apos;s craft an interior that reflects your personality, lifestyle and aspirations.</p>
          <div className="hp-cta-actions">
            <button onClick={openConsult} className="hp-cta-btn-primary">
              Get Free Consultation <IconCalendar />
            </button>
            <button onClick={() => router.push('/projects')} className="hp-cta-btn-ghost">
              See Our Work <IconArrowRight />
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

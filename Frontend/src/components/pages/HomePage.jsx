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

const testimonials = [
  { name: 'Rahul Mehta',    location: 'Mumbai',    text: 'Exceptional execution and luxurious finishing. The team transformed our home beyond expectations — every material, every proportion, every detail was considered. What impressed me most was how accurately the final result matched the 3D render they had shown us months earlier.',                                                                               rating: 5, image: design },
  { name: 'Priya Sharma',   location: 'Delhi',     text: 'Their design sense is outstanding. Every corner of our apartment feels premium and thoughtfully designed, as if the space were always meant to look this way. They listened carefully to how we live and the final design reflects our lifestyle perfectly — not a catalogue look.',                                                                            rating: 5 },
  { name: 'Aman Verma',     location: 'Bangalore', text: 'Professional, transparent, and highly skilled. The 3D model matched the final output perfectly — I could see every finish and furniture placement before work started, which gave me complete confidence. There were no surprises during execution, only a flawless result.',                                                                                   rating: 5 },
  { name: 'Neha Joshi',     location: 'Pune',      text: 'From consultation to handover, the entire process was smooth and completely stress-free. Truly turnkey — they handled every contractor, every delivery and every site decision. I just showed up on handover day and walked into a finished home. Could not have asked for more.',                                                                              rating: 5 },
  { name: 'Vikram Singh',   location: 'Indore',    text: 'We got a luxury home interior within our budget. Absolutely no compromise on quality or aesthetics — the materials are premium and the craftsmanship is immaculate. I had been quoted more by two other designers for a noticeably lower standard of finish.',                                                                                                 rating: 5 },
  { name: 'Sunita Agarwal', location: 'Bhopal',    text: 'The 3D renders were spot-on. We knew exactly what we were getting before a single nail was hammered, which made the whole process remarkably stress-free. The finished space is identical to what we approved in the render — a rare and genuinely reassuring experience.',                                                                                   rating: 5 },
];
const marqueeItems = [...testimonials, ...testimonials];

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

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [speed, reverse]);

  function handlePointerDown(e) {
    const el = innerRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    const s = stateRef.current;
    s.dragging = true;
    s.moved = false;
    s.startX = e.clientX;
    s.startPos = s.pos;
  }

  function handlePointerMove(e) {
    const s = stateRef.current;
    if (!s.dragging) return;
    if (Math.abs(e.clientX - s.startX) > 5) s.moved = true;
    const el = innerRef.current;
    const half = el.scrollWidth / 2;
    let newPos = s.startPos + (e.clientX - s.startX);
    if (newPos > 0) newPos -= half;
    if (newPos < -half) newPos += half;
    s.pos = newPos;
    el.style.transform = `translateX(${newPos}px)`;
  }

  function handlePointerUp() {
    stateRef.current.dragging = false;
  }

  return {
    innerRef,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
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
          <div className="hp-hero-eyebrow">
            <span className="hp-eyebrow-line" />
            <span>Luxury Interior Design Studio</span>
            <span className="hp-eyebrow-line" />
          </div>
          <h1 className="hp-hero-title">
            <span className="hp-highlight">Shrivastavas</span><br />Elevate
          </h1>
          <p className="hp-hero-sub">
            Crafting timeless interiors with luxury,<br />precision and turnkey execution.
          </p>
          <div className="hp-hero-actions">
            <button onClick={() => router.push('/projects')} className="hp-btn-primary">
              Explore Projects <IconArrowRight />
            </button>
            <button onClick={openConsult} className="hp-btn-ghost">
              Book Consultation <IconCalendar />
            </button>
          </div>
          <p className="hp-hero-caption">
            <IconBuilding /> Interior Designers &amp; Contractors · Satna
          </p>
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
          { num: '5+',   label: 'Years Experience',   sub: 'Serving discerning clients'       },
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
          <button onClick={() => router.push('/projects')} className="hp-text-btn">
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
            { Icon: IconComments,   num: '01', title: 'Consultation',      desc: 'We start every project with an in-depth conversation about how you live, what you love, and what your space needs to do. We ask about your daily routines, storage requirements, preferred aesthetics and budget — then we listen. This session shapes everything that follows and ensures the design is built around your real life, not a generic brief.' },
            { Icon: IconRuler,      num: '02', title: 'Space Planning',    desc: 'Before any visual design begins, we analyse your floor plan for traffic flow, natural light, structural constraints and functional zones. We optimise the layout to extract every usable inch — positioning rooms, furniture zones and storage so the space feels larger, more comfortable and more intuitive to live in.' },
            { Icon: IconEye,        num: '03', title: '3D Visualization',  desc: 'We model your space to exact scale and apply real material finishes, furniture and lighting in a photorealistic 3D render. You review every detail — colours, textures, proportions, furniture layout — and nothing moves to execution until you have given explicit approval. What you see in 3D is what you will receive in reality.' },
            { Icon: IconSwatchbook, num: '04', title: 'Material Selection', desc: 'We curate every material — from flooring and wall finishes to hardware and fixtures — from our network of trusted partners including Kajaria, Asian Paints and CenturyPly. All selections are presented within your approved budget, with physical samples available for review so you can touch and feel each choice before it is committed to your space.' },
            { Icon: IconHelmet,     num: '05', title: 'Execution',         desc: 'Our skilled craftsmen execute the approved design with precision. A dedicated project manager supervises every phase — civil work, electrical, joinery, painting and installation — performing quality checks at each milestone. You receive regular updates and have full visibility over progress throughout the build.' },
            { Icon: IconKey,        num: '06', title: 'Final Handover',    desc: 'Before we hand over your space, we conduct a thorough walkthrough against the original design specifications and punch-list every outstanding item. Once everything meets our quality standards, we hand over a completely finished, cleaned and furnished home — along with warranty documentation for all installed products.' },
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
            { Icon: IconGem,      title: 'Affordable Luxury',   desc: 'Every project begins with a fully itemised quote — materials, labour and logistics — so you know exactly where every rupee goes before work starts. We source premium materials directly from trusted partners like Kajaria, Asian Paints and CenturyPly, cutting out middlemen and passing the savings to you. The result is a luxury finish at a price that is honest and fair.' },
            { Icon: IconShield,   title: 'Consultation Refund', desc: 'Our initial design consultation is not a cost — it is an investment. The full consultation fee is credited back against your project cost the moment you confirm. This means if you proceed with us, the consultation was completely free. We offer this because we are confident in our work and want you to experience our design process without financial risk.' },
            { Icon: IconEye,      title: '3D Before Build',     desc: 'Before a single wall is painted or fixture is installed, you will see your space exactly as it will look — in photorealistic 3D. We model every room to scale, apply real material textures, and adjust lighting so you can virtually walk through your future home. You approve every detail at this stage. No guesswork, no mid-project regret, no costly changes after execution begins.' },
            { Icon: IconKey,      title: 'Turnkey Execution',   desc: 'From design sign-off to the day you walk in with your keys, we manage everything. Vendor selection, material procurement, skilled labour coordination, site supervision, quality checks at every phase, and a formal punch-list before handover — all handled by our team. You do not need to chase contractors, follow up on deliveries, or make a single site decision.' },
            { Icon: IconPenRuler, title: '100% Bespoke',        desc: 'We do not work from templates or reuse catalogue layouts. Every design begins with a conversation about how you actually live — your daily routines, storage needs, aesthetic preferences and family. From that we build a design that is unique to your space and your life. Whether it is a compact apartment or a sprawling villa, every detail is conceived specifically for you.' },
            { Icon: IconBuilding, title: 'We Travel to You',    desc: 'Our studio is based in Satna, MP, but we take on projects across India. For clients outside Satna, our team travels for the initial site visit, key milestone reviews and final handover inspection. We also offer virtual progress check-ins between visits — so no matter where you are in the country, you stay in full control of your project.' },
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
              onPointerMove={trackA.onPointerMove}
              onPointerUp={trackA.onPointerUp}
              onPointerCancel={trackA.onPointerCancel}
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
              onPointerMove={trackB.onPointerMove}
              onPointerUp={trackB.onPointerUp}
              onPointerCancel={trackB.onPointerCancel}
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

'use client';
import '@/styles/about.css';
import { IconCalendar, IconArrowRight, IconGem, IconCrown, IconHouseChimney, IconSwatchbook, IconShield, IconComments, IconEye, IconHelmet, IconKey, IconBuilding, IconWand, IconQuoteLeft, IconStar, IconStarFilled, IconXMark } from '@/components/Icons';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import Footer from '@/components/Footer';
import { useModal } from '@/context/ModalContext';

import materials  from '@/assets/materials-2.png';
import services   from '@/assets/services.png';
import commitment from '@/assets/commitment.png';
import bgimg      from '@/assets/home-img.png';
import storyImg   from '@/assets/story.png';
import designImg  from '@/assets/refund-design.png';

const testimonials = [
  { name: 'Rahul Mehta',    location: 'Mumbai',    text: 'Exceptional execution and luxurious finishing. The team transformed our home beyond expectations.',          rating: 5, image: designImg },
  { name: 'Priya Sharma',   location: 'Delhi',     text: 'Their design sense is outstanding. Every corner of our apartment feels premium and thoughtfully designed.', rating: 5 },
  { name: 'Aman Verma',     location: 'Bangalore', text: 'Professional, transparent, and highly skilled. The 3D design matched the final output perfectly.',          rating: 5 },
  { name: 'Neha Joshi',     location: 'Pune',      text: 'From consultation to handover, the entire process was smooth and stress-free. Truly turnkey.',              rating: 5 },
  { name: 'Vikram Singh',   location: 'Indore',    text: 'We got a luxury home interior within our budget. Absolutely no compromise on quality or aesthetics.',       rating: 5 },
  { name: 'Sunita Agarwal', location: 'Bhopal',    text: 'The 3D renders were spot-on. We knew exactly what we were getting before a single nail was hammered.',     rating: 5 },
];
const marqueeItems = [...testimonials, ...testimonials];

const founders = [
  { initial: 'V', name: 'Ved Shrivastava',  role: 'Founder, Managing Director & Full Stack Developer',  quote: 'Building this studio has always been about more than design — it\'s about creating a seamless experience for every client, from the first conversation to the final handover.' },
  { initial: 'S', name: 'Shubh Shrivastava',role: 'Founder, Director, Designer & Consultant',           quote: 'Every space I design is a reflection of the person who lives in it. Great design isn\'t just beautiful — it\'s deeply personal and completely functional.'                  },
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
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); observer.disconnect(); } }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
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

export default function AboutPage() {
  const router = useRouter();
  const { openConsult } = useModal();
  const [activeCard, setActiveCard] = useState(null);

  const revealRefs = useRef([]);
  useEffect(() => {
    const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } }), { threshold: 0.1 });
    revealRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const sr = el => { if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el); };

  useEffect(() => {
    if (activeCard) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [activeCard]);

  return (
    <div className="about-page">

      {/* ── Process step detail modal ── */}
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

      <section className="about-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bgimg.src} alt="Luxury interior design by Shrivastavas Elevate — premium interior designers in Satna, Madhya Pradesh" className="about-hero-bg" />
        <div className="about-overlay" />
        <div className="about-hero-content">
          <div className="abt-eyebrow">
            <span className="abt-eyebrow-line" />
            <span>About Shrivastavas Elevate</span>
            <span className="abt-eyebrow-line" />
          </div>
          <h1>Designing Timeless<br /><span className="abt-highlight">Luxury Spaces</span></h1>
          <p>Transforming residential and commercial interiors with elegance, precision, and premium craftsmanship — tailored entirely to you.</p>
          <div className="abt-hero-actions">
            <button className="abt-btn-primary" onClick={openConsult}>Book Consultation <IconCalendar /></button>
            <button className="abt-btn-ghost" onClick={() => router.push('/projects')}>See Our Work <IconArrowRight /></button>
          </div>
        </div>
        <div className="abt-scroll-hint"><span className="abt-scroll-line" /><span>Scroll</span></div>
      </section>

      <section className="about-stats">
        {[{ val: '50+', label: 'Projects Completed' }, { val: '5+', label: 'Years Experience' }, { val: 'Turnkey', label: 'End-to-End Delivery' }, { val: '100%', label: 'Client Satisfaction' }].map((s, i) => (
          <div className="about-stat-box" key={i}><h2><CountUp endValue={s.val} /></h2><p>{s.label}</p></div>
        ))}
      </section>

      <section className="abt-who">
        <div className="abt-who-head abt-reveal" ref={sr}>
          <div className="abt-who-head-left">
            <span className="section-tag"><IconGem /> Who We Are</span>
            <h2>Elevating Spaces<br />With Purpose</h2>
          </div>
          <div className="abt-who-head-right">
            <p>Shrivastavas Elevate is a premium interior design and contracting studio headquartered in Satna, Madhya Pradesh — founded on one belief: that every home deserves to feel extraordinary. Serving residential and commercial clients across India, we unite elite artistry with completely transparent project execution.</p>
            <div className="abt-founders">
              <div className="abt-founder-pill"><span className="abt-founder-pill-avatar">V</span>Ved Shrivastava</div>
              <div className="abt-founder-pill"><span className="abt-founder-pill-avatar">S</span>Shubh Shrivastava</div>
            </div>
          </div>
        </div>

        <div className="abt-who-layout">
          <div className="abt-feat-card abt-reveal" ref={sr}>
            <div className="abt-feat-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={storyImg.src} alt="Shrivastavas Elevate interior design studio — founded by Ved and Shubh Shrivastava in Satna, MP" />
              <div className="abt-feat-img-overlay" />
              <div className="abt-feat-tag"><IconCrown /> Our Story</div>
            </div>
            <div className="abt-feat-body">
              <h3>Welcome to Shrivastavas Elevate</h3>
              <p>A premium interior design and contracting studio in Satna, Madhya Pradesh — focused on creating elegant, functional, and timeless spaces built entirely around the way you live. From modular kitchens to full-home makeovers, we bring luxury interiors to homes across MP.</p>
              <ul className="abt-card-list">
                <li><span className="abt-card-dot" />Led by Ved &amp; Shubh Shrivastava</li>
                <li><span className="abt-card-dot" />Residential &amp; commercial expertise</li>
                <li><span className="abt-card-dot" />Luxury-focused, fully turnkey execution</li>
                <li><span className="abt-card-dot" />Based in Satna, serving pan-India</li>
              </ul>
            </div>
          </div>

          <div className="abt-stack">
            {[
              { src: services,   alt: 'Interior design services by Shrivastavas Elevate in Satna, Madhya Pradesh', Tag: IconHouseChimney, tagLabel: 'Services',  href: '/services', title: 'Premium Interior Services',   desc: 'Complete interior solutions from a single room to an entire home.', points: ['Customised residential interiors', 'Refundable consultation fee'] },
              { src: materials,  alt: 'Premium architectural materials and products used in interior design projects in Satna, MP', Tag: IconSwatchbook, tagLabel: 'Products', href: '/products', title: 'Premium Products & Materials', desc: 'Architectural products selected from India\'s most trusted brands.',  points: ['Breeze blocks, jaali walls, louvers…', 'Kajaria, Asian Paints, CenturyPly…'] },
              { src: commitment, alt: 'Quality commitment by Shrivastavas Elevate interior designers in Satna, Madhya Pradesh', Tag: IconShield, tagLabel: 'Commitment', href: null, title: 'Our Commitment To Quality', desc: 'Every project executed with precision, transparency and uncompromised detail.', points: ['Premium craftsmanship standards', 'Long-lasting client relationships'] },
            ].map((c, i) => (
              <div key={i} className="abt-stack-card abt-reveal" ref={sr} style={{ '--abt-delay': `${(i + 1) * 60}ms`, cursor: c.href ? 'pointer' : 'default' }} onClick={c.href ? () => router.push(c.href) : undefined}>
                <div className="abt-stack-img">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.src.src} alt={c.alt} />
                  <div className="abt-stack-img-overlay" />
                  <div className="abt-stack-tag"><c.Tag /> {c.tagLabel}</div>
                </div>
                <div className="abt-stack-body">
                  <h4>{c.title}</h4>
                  <p>{c.desc}</p>
                  <ul className="abt-card-list">{c.points.map((pt, j) => <li key={j}><span className="abt-card-dot" />{pt}</li>)}</ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="abt-founders-section">
        <div className="abt-founders-head abt-reveal" ref={sr}>
          <span className="section-tag"><IconCrown /> The People Behind It</span>
          <h2>Meet Our Founders</h2>
          <p>Two brothers based in Satna, MP — united by a shared passion for luxury design and a commitment to making every residential and commercial space extraordinary.</p>
        </div>
        <div className="abt-founders-grid">
          {founders.map((f, i) => (
            <div className="abt-founder-card abt-reveal" key={i} ref={sr} style={{ '--abt-delay': `${i * 120}ms` }}>
              <div className="abt-founder-avatar-wrap">
                <div className="abt-founder-avatar-circle"><span>{f.initial}</span></div>
                <div className="abt-founder-avatar-ring" />
              </div>
              <div className="abt-founder-info">
                <h3 className="abt-founder-name">{f.name}</h3>
                <span className="abt-founder-role">{f.role}</span>
                <div className="abt-founder-divider" />
                <blockquote className="abt-founder-quote">
                  <IconQuoteLeft className="abt-founder-quote-icon" />
                  {f.quote}
                </blockquote>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="about-process-section">
        <div className="abt-section-head abt-reveal" ref={sr}>
          <span className="section-tag"><IconComments /> Our Approach</span>
          <h2>How We Bring<br />Spaces To Life</h2>
          <p>Four seamless phases — from your first idea to a finished, furnished dream home.</p>
        </div>
        <div className="about-process-grid">
          {[
            { num: '01', Icon: IconComments,     title: 'Consultation',   desc: 'We understand your vision, budget and lifestyle before anything else.'  },
            { num: '02', Icon: IconEye,          title: 'Concept & 3D',   desc: 'Smart space planning plus photo-realistic renders for your approval.'     },
            { num: '03', Icon: IconHelmet, title: 'Execution',      desc: 'Expert craftsmen bring your design to life with precision and care.'      },
            { num: '04', Icon: IconKey,          title: 'Final Handover', desc: 'A complete walkthrough and handover of your transformed dream space.'     },
          ].map((s, i) => (
            <div
              className="process-box"
              key={i}
              onClick={() => setActiveCard(s)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setActiveCard(s)}
            >
              <div className="process-box-top">
                <div className="process-box-icon"><s.Icon /></div>
                <span className="process-num hp-prof-num">{s.num}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="abt-testimonials">
        <div className="abt-testimonials-head abt-reveal" ref={sr}>
          <span className="section-tag"><IconQuoteLeft /> Testimonials</span>
          <h2>What Our Clients Say</h2>
          <p>Trusted by homeowners across India for luxury interiors and seamless execution.</p>
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

      <section className="about-cta">
        <div className="about-cta-inner abt-reveal" ref={sr}>
          <span className="section-tag"><IconWand /> Begin Your Journey</span>
          <h2>Let&apos;s Design A Space<br />That Reflects You</h2>
          <p>Elegant interiors crafted with premium materials, modern aesthetics, and timeless sophistication — built entirely around your life.</p>
          <div className="abt-cta-actions">
            <button className="about-cta-btn" onClick={openConsult}>Book Free Consultation <IconCalendar /></button>
            <button className="about-cta-btn-ghost" onClick={() => router.push('/projects')}>See Our Work <IconBuilding /></button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

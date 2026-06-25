'use client';
import '@/styles/home.css';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconCrown, IconLayerGroup, IconBuilding, IconArrowRight, IconCalendar,
  IconShield, IconUtensils, IconBed, IconBath, IconCouch, IconTv,
  IconComments, IconRuler, IconEye, IconSwatchbook, IconHelmet, IconKey,
  IconHouseChimney, IconQuoteLeft, IconIndustry, IconStar, IconStarFilled, IconTag,
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
import rates        from '@/assets/rates.png';
import visualization3D from '@/assets/3D-visualization.png';

const testimonials = [
  { name: 'Rahul Mehta',    location: 'Mumbai',    text: 'Exceptional execution and luxurious finishing. The team transformed our home beyond expectations.',          rating: 5, image: design },
  { name: 'Priya Sharma',   location: 'Delhi',     text: 'Their design sense is outstanding. Every corner of our apartment feels premium and thoughtfully designed.', rating: 5 },
  { name: 'Aman Verma',     location: 'Bangalore', text: 'Professional, transparent, and highly skilled. The 3D design matched the final output perfectly.',          rating: 5 },
  { name: 'Neha Joshi',     location: 'Pune',      text: 'From consultation to handover, the entire process was smooth and stress-free. Truly turnkey.',              rating: 5 },
  { name: 'Vikram Singh',   location: 'Indore',    text: 'We got a luxury home interior within our budget. Absolutely no compromise on quality or aesthetics.',       rating: 5 },
  { name: 'Sunita Agarwal', location: 'Bhopal',    text: 'The 3D renders were spot-on. We knew exactly what we were getting before a single nail was hammered.',     rating: 5 },
];
const marqueeItems = [...testimonials, ...testimonials];

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

  return (
    <div className="home-page">

      {/* ══════════════════════════════
          HERO
      ══════════════════════════════ */}
      <section className="hp-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bgimg.src} alt="" className="hp-hero-bg" />
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
          { num: '5',    label: 'Average Rating',      sub: 'Consistently top-rated', star: true },
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
            { img: kitchen_img,  Icon: IconUtensils, label: 'Kitchen',  desc: 'Modern modular concepts', category: 'Kitchen Designs'     },
            { img: bedroom_img,  Icon: IconBed,      label: 'Bedroom',  desc: 'Elegant & luxurious',     category: 'Bedroom Designs'     },
            { img: bathroom_img, Icon: IconBath,     label: 'Bathroom', desc: 'Minimal & premium',       category: 'Bathroom Designs'    },
            { img: lounge_img,   Icon: IconCouch,    label: 'Lounge',   desc: 'Luxury living spaces',    category: 'Lounge area Designs' },
            { img: TV_unit_img,  Icon: IconTv,       label: 'TV Unit',  desc: 'Entertainment walls',     category: 'TV Unit Designs'     },
          ].map((d, i) => (
            <div
              className={`hp-design-card sr-item${i === 0 ? ' hp-design-card--featured' : ''}`}
              key={i}
              ref={sr}
              style={{ '--sr-delay': `${i * 60}ms` }}
              onClick={() => router.push(`/design/${encodeURIComponent(d.category)}`)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && router.push(`/design/${encodeURIComponent(d.category)}`)}
            >
              <div className="hp-dc-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.img.src} alt={d.label} />
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
            { Icon: IconComments, num: '01', title: 'Consultation',     desc: 'We understand your vision, budget, and lifestyle before anything else.'   },
            { Icon: IconRuler,    num: '02', title: 'Space Planning',    desc: 'Smart layouts designed to maximise every square foot of your space.'        },
            { Icon: IconEye,      num: '03', title: '3D Visualization',  desc: 'Photo-realistic renders so you approve the look before execution begins.'   },
            { Icon: IconSwatchbook,num: '04', title: 'Material Selection',desc: 'Premium materials curated from trusted partners within your budget.'       },
            { Icon: IconHelmet,   num: '05', title: 'Execution',         desc: 'Expert craftsmen bring your design to life with precision and care.'       },
            { Icon: IconKey,      num: '06', title: 'Final Handover',    desc: 'A complete walkthrough and handover of your transformed dream space.'      },
          ].map((s, i) => (
            <div className="hp-process-card sr-item" key={i} ref={sr} style={{ '--sr-delay': `${i * 80}ms` }}>
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

        <div className="hp-adv-layout">
          <div className="hp-adv-feature sr-item" ref={sr}>
            <div className="hp-adv-feature-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={rates.src} alt="Affordable Rates" />
              <div className="hp-adv-feature-overlay" />
              <div className="hp-adv-feature-tag"><IconTag /> Pricing</div>
            </div>
            <div className="hp-adv-feature-body">
              <h3>Affordable Luxury</h3>
              <p>Premium interiors with transparent pricing and zero hidden costs — luxury made genuinely accessible.</p>
              <ul>
                <li><span className="hp-adv-dot" />No hidden charges, ever</li>
                <li><span className="hp-adv-dot" />Premium materials within budget</li>
                <li><span className="hp-adv-dot" />Detailed cost breakdown upfront</li>
              </ul>
            </div>
          </div>

          <div className="hp-adv-stack">
            <div className="hp-adv-card sr-item" ref={sr} style={{ '--sr-delay': '80ms' }}>
              <div className="hp-adv-card-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={design.src} alt="Consultation Refund" />
                <div className="hp-adv-card-img-overlay" />
                <div className="hp-adv-card-tag"><IconShield /> Risk-Free</div>
              </div>
              <div className="hp-adv-card-body">
                <h4>Consultation Refund</h4>
                <p>Your consultation fee is fully adjusted against project cost — zero financial risk.</p>
                <ul>
                  <li><span className="hp-adv-dot" />Fee adjusted on confirmation</li>
                  <li><span className="hp-adv-dot" />No obligation to proceed</li>
                </ul>
              </div>
            </div>

            <div className="hp-adv-card sr-item" ref={sr} style={{ '--sr-delay': '160ms' }}>
              <div className="hp-adv-card-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={visualization3D.src} alt="3D Visualization" />
                <div className="hp-adv-card-img-overlay" />
                <div className="hp-adv-card-tag"><IconEye /> 3D Design</div>
              </div>
              <div className="hp-adv-card-body">
                <h4>See It In 3D First</h4>
                <p>We render your exact space in photorealistic 3D — you approve every detail before we build.</p>
                <ul>
                  <li><span className="hp-adv-dot" />No surprises on execution day</li>
                  <li><span className="hp-adv-dot" />Changes made before costs are locked</li>
                </ul>
              </div>
            </div>
          </div>
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
            <div className="marquee-inner scroll-left">
              {marqueeItems.map((t, i) => (
                <div className="t-card" key={`a${i}`}>
                  <div className="t-card-top">
                    <div className="t-card-quote-icon"><IconQuoteLeft /></div>
                    <div className="t-card-stars">{Array.from({ length: t.rating }).map((_, s) => <IconStarFilled key={s} />)}</div>
                  </div>
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
            <div className="marquee-inner scroll-right">
              {[...marqueeItems].reverse().map((t, i) => (
                <div className="t-card" key={`b${i}`}>
                  <div className="t-card-top">
                    <div className="t-card-quote-icon"><IconQuoteLeft /></div>
                    <div className="t-card-stars">{Array.from({ length: t.rating }).map((_, s) => <IconStarFilled key={s} />)}</div>
                  </div>
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

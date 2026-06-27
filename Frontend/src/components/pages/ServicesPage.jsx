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
  { name: 'Rahul Mehta',    location: 'Mumbai',    text: 'Exceptional execution and luxurious finishing. The team transformed our home beyond expectations.',          rating: 5, image: design },
  { name: 'Priya Sharma',   location: 'Delhi',     text: 'Their design sense is outstanding. Every corner of our apartment feels premium and thoughtfully designed.', rating: 5 },
  { name: 'Aman Verma',     location: 'Bangalore', text: 'Professional, transparent, and highly skilled. The 3D design matched the final output perfectly.',          rating: 5 },
  { name: 'Neha Joshi',     location: 'Pune',      text: 'From consultation to handover, the entire process was smooth and stress-free. Truly turnkey.',              rating: 5 },
  { name: 'Vikram Singh',   location: 'Indore',    text: 'We got a luxury home interior within our budget. Absolutely no compromise on quality or aesthetics.',       rating: 5 },
  { name: 'Sunita Agarwal', location: 'Bhopal',    text: 'The 3D renders were spot-on. We knew exactly what we were getting before a single nail was hammered.',     rating: 5 },
];
const marqueeItems = [...testimonials, ...testimonials];

const services = [
  { Icon: IconHouseChimney,     title: 'Residential Interiors', description: 'Bespoke home interiors for apartments and villas across India — designed entirely around how you actually live.',                       features: ['100% custom, no templates', 'Apartment & villa specialists'],     link: '/design/bedroom-designs'    },
  { Icon: IconBuilding,         title: 'Commercial Spaces',     description: 'Office and retail interiors that reflect your brand identity and keep your team performing at their best.',                              features: ['Brand-centric design', 'Ergonomic, turnkey execution'],           link: '/design/commercial-designs' },
  { Icon: IconEye,              title: '3D Visualization',      description: 'Photorealistic 3D renders of your exact space — see and approve every detail before a single nail is hammered.',                        features: ['Photo-realistic accuracy', 'Approved before a nail is hammered'], link: null                         },
  { Icon: IconRuler,            title: 'Space Planning',        description: 'Smart layouts that extract every usable inch from your home or office without sacrificing flow or comfort.',                             features: ['Floor plan optimisation', 'Flow & functionality focused'],         link: '/design/kitchen-designs'    },
  { Icon: IconLightbulb,        title: 'Lighting Design',       description: 'Ambient, accent and task lighting for homes and commercial spaces — defining mood, character and atmosphere.',                           features: ['Mood-enhancing concepts', 'Natural & artificial balance'],         link: '/design/lounge-area-designs'},
  { Icon: IconScrewdriverWrench,title: 'Renovation Services',   description: 'Complete home and office makeovers — targeted upgrades or full interior renovations delivered with minimal disruption.',                 features: ['Partial or full overhauls', 'Minimal disruption approach'],       link: '/projects'                  },
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
      <section className="services-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bgimg.src} alt="Luxury interior design services in Satna, Madhya Pradesh — Shrivastavas Elevate" className="services-hero-bg" />
        <div className="services-overlay" />
        <div className="services-hero-content">
          <div className="svc-hero-eyebrow">
            <span className="svc-eyebrow-line" />
            <span>Luxury Interior Design Studio</span>
            <span className="svc-eyebrow-line" />
          </div>
          <h1>Crafted<br /><span className="svc-highlight">Interiors</span></h1>
          <div className="hero-cta-row">
            <button className="svc-btn-primary" onClick={openConsult}>Book Consultation <IconCalendar /></button>
            <button onClick={() => router.push('/projects')} className="svc-btn-ghost">View Projects <IconArrowRight /></button>
          </div>
        </div>
        <div className="svc-scroll-hint"><span className="svc-scroll-line" /><span>Scroll</span></div>
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
            { Icon: IconGem,           title: 'Affordable Luxury',      desc: 'Premium interiors at transparent pricing — no hidden costs, ever.'                              },
            { Icon: IconShield,  title: 'Consultation Refund',     desc: 'Your consultation fee is fully adjusted against the final project cost.'                       },
            { Icon: IconPenRuler,      title: '100% Bespoke',            desc: 'Every design built from scratch around your life — never from a catalogue.'                    },
            { Icon: IconKey,           title: 'Turnkey Execution',       desc: 'We handle sourcing, build and handover. You just walk in.'                                     },
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
            { num: '01', Icon: IconCalendar, title: 'Book a Free Consultation',  desc: 'Tell us about your space, vision and budget. Our team listens — no obligation, no pressure.', cta: true  },
            { num: '02', Icon: IconEye,      title: 'Approve Your 3D Design',   desc: 'We create a photorealistic render of your space for your approval before a single nail is hammered.', cta: false },
            { num: '03', Icon: IconKey,      title: 'Move Into Your Dream Space',desc: 'Our team handles everything — sourcing, execution, quality checks and final handover.', cta: false },
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

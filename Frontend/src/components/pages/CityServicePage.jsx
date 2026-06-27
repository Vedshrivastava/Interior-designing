'use client';
import '@/styles/cityService.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import { useModal } from '@/context/ModalContext';
import bgimg from '@/assets/home-img.png';
import {
  IconCalendar, IconArrowRight, IconBuilding, IconHouseChimney,
  IconEye, IconRuler, IconLightbulb, IconScrewdriverWrench,
  IconLocation, IconKey, IconShield, IconGem, IconPenRuler, IconXMark,
} from '@/components/Icons';

export default function CityServicePage({ cityName, stateName, citySlug, projects }) {
  const router   = useRouter();
  const { openConsult } = useModal();

  /* ── Scroll reveal ─────────────────────────────────────────── */
  const revealRefs = useRef([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('cs-visible'); io.unobserve(e.target); }
      }),
      { threshold: 0.08 }
    );
    revealRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  const sr = el => { if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el); };

  /* ── Advantage card modal ─────────────────────────────────── */
  const [activeAdv, setActiveAdv] = useState(null);
  useEffect(() => {
    if (activeAdv) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [activeAdv]);
  useEffect(() => {
    if (!activeAdv) return;
    const h = e => { if (e.key === 'Escape') setActiveAdv(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [activeAdv]);

  /* ── Lightbox ───────────────────────────────────────────────── */
  const [lb, setLb] = useState({ open: false, images: [], idx: 0, name: '' });

  const openLb = useCallback((images, idx, name) => {
    setLb({ open: true, images, idx, name });
    document.body.style.overflow = 'hidden';
  }, []);
  const closeLb = useCallback(() => {
    setLb(p => ({ ...p, open: false }));
    document.body.style.overflow = '';
  }, []);

  useEffect(() => {
    if (!lb.open) return;
    const h = (e) => {
      if (e.key === 'Escape') closeLb();
      if (e.key === 'ArrowLeft')  setLb(p => ({ ...p, idx: (p.idx - 1 + p.images.length) % p.images.length }));
      if (e.key === 'ArrowRight') setLb(p => ({ ...p, idx: (p.idx + 1) % p.images.length }));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lb.open, closeLb]);

  /* ── Data ───────────────────────────────────────────────────── */
  const advantages = [
    {
      Icon: IconGem,
      title: 'Affordable Luxury',
      desc: `Premium interiors shouldn't come with financial surprises.`,
      points: [
        `Fully itemised quote upfront covering materials, labour and logistics`,
        `Direct sourcing from Kajaria, Asian Paints and CenturyPly, no middlemen`,
        `No hidden costs added at any stage of the project`,
        `Luxury finish at a price that's honest and transparent`,
      ],
    },
    {
      Icon: IconShield,
      title: 'Consultation Refund',
      desc: `The initial consultation fee isn't a cost, it's a credit.`,
      points: [
        `Full fee adjusted against your project cost when you confirm`,
        `If you proceed with us, the consultation was essentially free`,
        `No financial hesitation to experiencing what we do`,
        `Reflects our confidence in the work we deliver`,
      ],
    },
    {
      Icon: IconEye,
      title: '3D Before Build',
      desc: `Before a single wall is touched, you see your ${cityName} space exactly as it'll look.`,
      points: [
        `Every room modelled to scale in photorealistic 3D`,
        `Real material textures and lighting applied throughout`,
        `Full approval required before execution starts`,
        `What's in the render is exactly what gets built`,
      ],
    },
    {
      Icon: IconPenRuler,
      title: '100% Bespoke Design',
      desc: `We don't use templates or pull from a catalogue.`,
      points: [
        `Starts with a real conversation about how you live`,
        `Covers routines, storage needs, tastes and your family`,
        `Every detail conceived specifically for your space`,
        `Compact apartment in ${cityName} or large villa, the process is the same`,
      ],
    },
    {
      Icon: IconKey,
      title: 'Turnkey Execution',
      desc: `From design sign-off to handover, we manage everything.`,
      points: [
        `Vendor selection and material procurement handled by us`,
        `Skilled labour coordination and on-site supervision`,
        `Quality checks at every phase of the build`,
        `Formal walkthrough before handover, no outstanding items`,
      ],
    },
    {
      Icon: IconBuilding,
      title: 'We Travel to You',
      desc: `Our studio is in Satna, MP, but we work across India.`,
      points: [
        `Site visit to ${cityName} for measurements and assessment`,
        `Milestone reviews and execution oversight on location`,
        `Video walkthroughs and shared design boards between visits`,
        `Same standards and attention as our local Satna projects`,
      ],
    },
    {
      Icon: IconHouseChimney,
      title: 'Residential Specialists',
      desc: `We do full-home interiors for all residential property types in ${cityName}, ${stateName}.`,
      points: [
        `Apartments, independent houses, villas and penthouses`,
        `Modular kitchens, bedrooms, living and dining spaces`,
        `TV units, wardrobes, pooja rooms, balconies and home offices`,
        `Every space gets equal care, not just the rooms you show guests`,
      ],
    },
    {
      Icon: IconScrewdriverWrench,
      title: 'Renovation Services',
      desc: `An outdated space doesn't mean starting over.`,
      points: [
        `Full audit of existing space before recommending any changes`,
        `Reconfiguring layouts, updating finishes, replacing fixtures`,
        `Civil, electrical and finishing managed under one project`,
        `Scheduled around your routine to minimise disruption`,
      ],
    },
    {
      Icon: IconRuler,
      title: 'Space Planning',
      desc: `Good design starts with the layout, before any material is chosen.`,
      points: [
        `Traffic flow, natural light, ventilation and functional zones studied first`,
        `Layout optimised for how you actually move through the space`,
        `Better storage built into the plan from the beginning`,
        `Makes the home feel more spacious without touching the square footage`,
      ],
    },
  ];

  return (
    <div className="cs-page">

      {/* ── Advantage card modal ────────────────────────────── */}
      {activeAdv && (
        <div className="cs-adv-modal-backdrop" onClick={() => setActiveAdv(null)}>
          <div className="cs-adv-modal" onClick={e => e.stopPropagation()}>
            <div className="cs-adv-modal-header">
              <div className="cs-adv-modal-icon"><activeAdv.Icon /></div>
              <h3 className="cs-adv-modal-title">{activeAdv.title}</h3>
              <button className="cs-adv-modal-close" onClick={() => setActiveAdv(null)} aria-label="Close">
                <IconXMark />
              </button>
            </div>
            <p className="cs-adv-modal-desc">{activeAdv.desc}</p>
            {activeAdv.points?.length > 0 && (
              <ul className="cs-adv-modal-points">
                {activeAdv.points.map((pt, i) => <li key={i}><span className="cs-adv-dot" />{pt}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────────── */}
      {lb.open && (
        <div className="cs-lb-overlay" onClick={closeLb}>
          <button className="lb-close" onClick={closeLb} aria-label="Close">✕</button>
          {lb.images.length > 1 && (
            <button className="lb-arrow lb-arrow--prev" aria-label="Previous"
              onClick={e => { e.stopPropagation(); setLb(p => ({ ...p, idx: (p.idx - 1 + p.images.length) % p.images.length })); }}>
              &#8249;
            </button>
          )}
          <div className="lb-img-wrap" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lb.images[lb.idx]}
              alt={`${lb.name} — interior design project in ${cityName} by Shrivastavas Elevate`}
              className="lb-img"
            />
            <div className="lb-caption">
              <span className="lb-name">{lb.name}</span>
              {lb.images.length > 1 && <span className="lb-counter">{lb.idx + 1} / {lb.images.length}</span>}
            </div>
          </div>
          {lb.images.length > 1 && (
            <button className="lb-arrow lb-arrow--next" aria-label="Next"
              onClick={e => { e.stopPropagation(); setLb(p => ({ ...p, idx: (p.idx + 1) % p.images.length })); }}>
              &#8250;
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════
          HERO — homepage-identical design
      ══════════════════════════════ */}
      <section className="cs-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bgimg.src} alt="" className="cs-hero-bg" fetchPriority="high" loading="eager" />
        <div className="cs-hero-overlay" />
        <div className="cs-hero-inner">
          <div className="cs-hero-eyebrow">
            <span className="cs-eyebrow-line" />
            <span>Interior Designer in {cityName}, {stateName}</span>
            <span className="cs-eyebrow-line" />
          </div>
          <h1 className="cs-hero-title">
            Premium Interiors<br />
            <span className="cs-hero-highlight">in {cityName}</span>
          </h1>
          <p className="cs-hero-sub">
            Shrivastavas Elevate brings luxury residential and commercial interior design to {cityName}, {stateName} — modular kitchens, bedrooms, living rooms, commercial offices and full-home makeovers, all with 3D visualization and turnkey execution.
          </p>
          <div className="cs-hero-actions">
            <button onClick={openConsult} className="cs-btn-primary">
              Book Free Consultation <IconCalendar />
            </button>
            <button onClick={() => router.push('/projects')} className="cs-btn-ghost">
              View All Projects <IconArrowRight />
            </button>
          </div>
          <p className="cs-hero-caption">
            <IconBuilding /> Serving {cityName}, {stateName} · Studio based in Satna, MP
          </p>
        </div>
      </section>

      {/* ══════════════════════════════
          STATS BAR
      ══════════════════════════════ */}
      <section className="cs-stats">
        {[
          { num: '50+',  label: 'Projects Completed',  sub: 'Across India'               },
          { num: '7+',   label: 'Years Experienced Team',     sub: 'Since 2024'                  },
          { num: '100%', label: 'Turnkey Execution',    sub: 'End-to-end delivery'         },
          { num: '3D',   label: 'Before Any Build',     sub: 'You approve before we begin' },
        ].map((s, i) => (
          <div className="cs-stat-item" key={i}>
            <span className="cs-stat-rule" />
            <strong>{s.num}</strong>
            <span className="cs-stat-label">{s.label}</span>
            <span className="cs-stat-sub">{s.sub}</span>
          </div>
        ))}
      </section>

      {/* ══════════════════════════════
          PROJECTS
      ══════════════════════════════ */}
      <section className="cs-projects">
        <div className="cs-section-head cs-sr" ref={sr}>
          <span className="cs-overline">
            {projects.length > 0 ? `Our Work in ${cityName}` : `Expanding to ${cityName}`}
          </span>
          <h2>
            {projects.length > 0
              ? `Interior Design Projects in ${cityName}`
              : `Coming to ${cityName}, ${stateName}`}
          </h2>
          <p>
            {projects.length > 0
              ? `${projects.length} project${projects.length !== 1 ? 's' : ''} completed in ${cityName}. Each one crafted with premium materials, precision and timeless design.`
              : `We are actively accepting interior design projects in ${cityName}. Be among our first clients in the city — and receive our complete, undivided focus from consultation to handover.`}
          </p>
        </div>

        {projects.length > 0 ? (
          <div className="cs-proj-grid">
            {projects.map((p, i) => (
              <div
                key={p._id}
                className="cs-proj-card cs-sr"
                ref={sr}
                style={{ '--cs-delay': `${i * 70}ms` }}
                onClick={() => p.images?.length > 0 && openLb(p.images, 0, p.name)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && p.images?.length > 0 && openLb(p.images, 0, p.name)}
                aria-label={`View ${p.name} project`}
              >
                <div className="cs-proj-img-wrap">
                  {p.images?.[0] ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.images[0]}
                      alt={`${p.name} — interior design project in ${cityName}, ${stateName} by Shrivastavas Elevate`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="cs-proj-img-placeholder" />
                  )}
                  {p.images?.length > 1 && (
                    <div className="cs-proj-count">+{p.images.length - 1}</div>
                  )}
                  <div className="cs-proj-overlay"><span>View Images</span></div>
                </div>
                <div className="cs-proj-info">
                  <p className="cs-proj-name">{p.name}</p>
                  <div className="cs-proj-meta">
                    {p.category && <span className="cs-proj-cat">{p.category}</span>}
                    {p.projectType && <span className="cs-proj-type">{p.projectType}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="cs-no-projects cs-sr" ref={sr}>
            <div className="cs-no-proj-inner">
              <h3>Be Our First Client in {cityName}</h3>
              <p>
                Shrivastavas Elevate is now accepting interior design projects in {cityName}, {stateName}. Our team travels to client locations for site visits, measurements and execution oversight — distance is never an obstacle to premium design.
              </p>
              <ul className="cs-no-proj-list">
                <li><span className="cs-dot" />Free initial consultation — in-person or virtual</li>
                <li><span className="cs-dot" />Full 3D visualization before any work begins</li>
                <li><span className="cs-dot" />Dedicated project manager for {cityName} clients</li>
                <li><span className="cs-dot" />Consultation fee fully adjusted against project cost</li>
              </ul>
              <button className="cs-btn-primary" onClick={openConsult}>
                Book Your Free Consultation <IconCalendar />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════
          WHY US — dark card grid (same visual as services)
      ══════════════════════════════ */}
      <section className="cs-why">
        <div className="cs-section-head cs-sr" ref={sr}>
          <span className="cs-overline">Why Choose Us</span>
          <h2>Why {cityName} Clients Choose Shrivastavas Elevate</h2>
          <p>Every advantage we offer in Satna is equally available to clients in {cityName} — same design standards, same team, same results.</p>
        </div>
        <div className="cs-why-grid">
          {advantages.map((a, i) => (
            <div
              className="cs-why-card cs-sr"
              key={i}
              ref={sr}
              style={{ '--cs-delay': `${i * 55}ms` }}
              onClick={() => setActiveAdv(a)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setActiveAdv(a)}
            >
              <div className="cs-why-icon"><a.Icon /></div>
              <h3>{a.title}</h3>
              <p>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          CTA
      ══════════════════════════════ */}
      <section className="cs-cta">
        <div className="cs-cta-inner cs-sr" ref={sr}>
          <span className="cs-overline light">Begin Your Journey</span>
          <h2>Ready to Transform Your {cityName} Space?</h2>
          <p>
            Get a free consultation with our design team. We&apos;ll discuss your vision, budget and timeline for your {cityName} project — no obligation, no pressure.
          </p>
          <div className="cs-cta-actions">
            <button onClick={openConsult} className="cs-cta-btn-primary">
              Get Free Consultation <IconCalendar />
            </button>
            <button onClick={() => router.push('/services')} className="cs-cta-btn-ghost">
              Our Services <IconArrowRight />
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

import React, { useEffect, useRef } from 'react';
import '../styles/about.css';

import Footer from '../components/Footer';

import materials   from '../assets/materials-2.png';
import services   from '../assets/services.png';
import commitment from '../assets/commitment.png';
import logo       from '../assets/logo.png';
import bgimg      from '../assets/home-img.webp';

import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCrown, faArrowRight, faCalendarCheck,
  faDraftingCompass, faCube, faCubes, faHandshake,
  faMedal, faRulerCombined, faShieldAlt, faStar,
  faWandMagicSparkles, faBuilding, faHome, faClock
} from '@fortawesome/free-solid-svg-icons';

const pillars = [
  { icon: faMedal,        title: "Premium Quality",       desc: "We source only top-tier materials from India's most trusted brands — no shortcuts, ever." },
  { icon: faRulerCombined,title: "100% Custom Design",    desc: "Every project is built around your lifestyle, not a template. Truly bespoke interiors." },
  { icon: faShieldAlt,    title: "Risk-Free Start",       desc: "Your consultation fee is fully refunded when you proceed. Zero financial risk to get started." },
  { icon: faCube,         title: "3D Before Execution",   desc: "See a photorealistic render of your space before a single wall is touched." },
  { icon: faHandshake,    title: "Turnkey Delivery",      desc: "We handle everything — design, sourcing, execution, handover. One team, zero stress." },
  { icon: faStar,         title: "5★ Satisfaction",       desc: "Consistently rated 5 stars for quality, transparency and on-time delivery." },
];

const processSteps = [
  { num: '01', icon: faDraftingCompass, title: 'Consultation',       desc: 'We understand your vision, budget and lifestyle before anything else.' },
  { num: '02', icon: faCube,            title: 'Concept & 3D Design', desc: 'Smart space planning plus photo-realistic renders for your approval.' },
  { num: '03', icon: faCubes,           title: 'Execution',           desc: 'Expert craftsmen bring your design to life with precision and care.' },
  { num: '04', icon: faHandshake,       title: 'Final Handover',      desc: 'A complete walkthrough and handover of your transformed dream space.' },
];

const About = ({ setShowLogin }) => {
  const navigate = useNavigate();
  const revealRefs = useRef([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      }),
      { threshold: 0.1 }
    );
    revealRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const sr = el => { if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el); };

  const handleButtonClick = id => {
    navigate('/', { replace: true });
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="about-page">

      {/* ══════════════════════════════
          HERO
      ══════════════════════════════ */}
      <section className="about-hero">
        <img src={bgimg} alt="Luxury Interior" className="about-hero-bg" />
        <div className="about-overlay" />

        <div className="about-hero-content">
          <div className="abt-eyebrow">
            <span className="abt-eyebrow-line" />
            <span>About Shrivastavas Elevate</span>
            <span className="abt-eyebrow-line" />
          </div>

          <h1>
            Designing Timeless<br />
            <span className="abt-highlight">Luxury Spaces</span>
          </h1>

          <p>
            Transforming residential and commercial interiors with elegance,
            precision, and premium craftsmanship — tailored entirely to you.
          </p>

          <div className="abt-hero-actions">
            <button className="abt-btn-primary" onClick={() => setShowLogin(true)}>
              Book Consultation <FontAwesomeIcon icon={faCalendarCheck} />
            </button>
            <button className="abt-btn-ghost" onClick={() => navigate('/projects')}>
              See Our Work <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>
        </div>

        <div className="abt-scroll-hint">
          <span className="abt-scroll-line" />
          <span>Scroll</span>
        </div>
      </section>

      {/* ══════════════════════════════
          STATS BAR
      ══════════════════════════════ */}
      <section className="about-stats">
        {[
          { val: '50+',     label: 'Projects Completed'  },
          { val: '5+',      label: 'Years Experience'    },
          { val: 'Turnkey', label: 'End-to-End Delivery' },
          { val: '100%',    label: 'Client Satisfaction' },
        ].map((s, i) => (
          <div className="about-stat-box" key={i}>
            <h2>{s.val}</h2>
            <p>{s.label}</p>
          </div>
        ))}
      </section>

      {/* ══════════════════════════════
          WHO WE ARE — editorial intro
      ══════════════════════════════ */}
 <section className="abt-who">

{/* ── Section header ── */}
<div className="abt-who-head abt-reveal" ref={sr}>
  <div className="abt-who-head-left">
    <span className="section-tag">
      <FontAwesomeIcon icon={faCrown} /> Who We Are
    </span>
    <h2>Elevating Spaces<br />With Purpose</h2>
  </div>

  <div className="abt-who-head-right">
    <p>
      Shrivastavas Elevate is a premium interior design and contracting
      firm founded on one belief — that every home deserves to feel
      extraordinary. We unite elite artistry with completely transparent
      project execution.
    </p>
    <div className="abt-founders">
      <div className="abt-founder-pill">
        <span className="abt-founder-pill-avatar">V</span>
        Ved Shrivastava
      </div>
      <div className="abt-founder-pill">
        <span className="abt-founder-pill-avatar">S</span>
        Shubh Shrivastava
      </div>
    </div>
  </div>
</div>

{/* ── Asymmetric card layout ── */}
<div className="abt-who-layout">

  {/* LEFT — tall featured card */}
  <div className="abt-feat-card abt-reveal" ref={sr}>
    <div className="abt-feat-img">
      <img src={logo} alt="Shrivastavas Elevate" />
      <div className="abt-feat-img-overlay" />
      <div className="abt-feat-tag">
        <FontAwesomeIcon icon={faCrown} /> Our Story
      </div>
    </div>

    <div className="abt-feat-body">
      <h3>Welcome to Shrivastavas Elevate</h3>
      <p>
        A premium interior design and contracting firm focused on creating
        elegant, functional, and timeless spaces — built entirely around
        the way you live.
      </p>
      <ul className="abt-card-list">
        <li><span className="abt-card-dot" />Led by Ved &amp; Shubh Shrivastava</li>
        <li><span className="abt-card-dot" />Residential &amp; commercial expertise</li>
        <li><span className="abt-card-dot" />Luxury-focused, fully turnkey execution</li>
        <li><span className="abt-card-dot" />Based in Indore, serving pan-India</li>
      </ul>
    </div>
  </div>

  {/* RIGHT — 3 stacked horizontal cards */}
  <div className="abt-stack">

    {/* Card 2 — Services */}
    <div className="abt-stack-card abt-reveal" ref={sr} style={{ '--abt-delay': '80ms', cursor: 'pointer' }} onClick={() => navigate('/services')}>
      <div className="abt-stack-img">
        <img src={services} alt="Interior Services" />
        <div className="abt-stack-img-overlay" />
        <div className="abt-stack-tag">
          <FontAwesomeIcon icon={faHome} /> Services
        </div>
      </div>
      <div className="abt-stack-body">
        <h4>Premium Interior Services</h4>
        <p>
          Complete interior solutions — from a single room to an entire home —
          tailored to your lifestyle, aesthetics and budget.
        </p>
        <ul className="abt-card-list">
          <li><span className="abt-card-dot" />Customised residential interiors</li>
          <li><span className="abt-card-dot" />Consultation with refundable fee</li>
        </ul>
      </div>
    </div>

    {/* Card 3 — Materials */}
    <div className="abt-stack-card abt-reveal" ref={sr} style={{ '--abt-delay': '140ms', cursor: 'pointer' }} onClick={() => navigate('/design/Bedroom%20Designs')}>
      <div className="abt-stack-img">
        <img src={materials} alt="Premium Materials" />
        <div className="abt-stack-img-overlay" />
        <div className="abt-stack-tag">
          <FontAwesomeIcon icon={faCubes} /> Materials
        </div>
      </div>
      <div className="abt-stack-body">
        <h4>Premium Materials &amp; Designs</h4>
        <p>
          Carefully selected materials from India's most trusted brands —
          ensuring durability, luxury and long-term value.
        </p>
        <ul className="abt-card-list">
          <li><span className="abt-card-dot" />PVC &amp; WPC louvers, marble sheets...</li>
          <li><span className="abt-card-dot" />Kajaria, Asian Paints, CenturyPly...</li>
        </ul>
      </div>
    </div>

    {/* Card 4 — Commitment */}
    <div className="abt-stack-card abt-reveal" ref={sr} style={{ '--abt-delay': '200ms' }}>
      <div className="abt-stack-img">
        <img src={commitment} alt="Our Commitment" />
        <div className="abt-stack-img-overlay" />
        <div className="abt-stack-tag">
          <FontAwesomeIcon icon={faHandshake} /> Commitment
        </div>
      </div>
      <div className="abt-stack-body">
        <h4>Our Commitment To Quality</h4>
        <p>
          Every project executed with precision, transparency and
          uncompromised attention to detail — from first sketch to final nail.
        </p>
        <ul className="abt-card-list">
          <li><span className="abt-card-dot" />Premium craftsmanship standards</li>
          <li><span className="abt-card-dot" />Long-lasting client relationships</li>
        </ul>
      </div>
    </div>

  </div>
</div>

{/* ── Mini stat strip ── */}
<div className="abt-who-stats abt-reveal" ref={sr}>
  {[
    { icon: faStar,      val: '50+',  lbl: 'Projects Delivered' },
    { icon: faHandshake, val: '100%', lbl: 'Turnkey Execution'  },
    { icon: faClock,     val: '5★',   lbl: 'Average Rating'     },
  ].map((s, i) => (
    <div className="abt-who-stat" key={i}>
      <div className="abt-who-stat-icon"><FontAwesomeIcon icon={s.icon} /></div>
      <span className="abt-who-stat-val">{s.val}</span>
      <span className="abt-who-stat-lbl">{s.lbl}</span>
    </div>
  ))}
</div>

</section>

      {/* ══════════════════════════════
          PROCESS — blush bg
      ══════════════════════════════ */}
      <section className="about-process-section">
        <div className="abt-section-head abt-reveal" ref={sr}>
          <span className="section-tag">
            <FontAwesomeIcon icon={faDraftingCompass} /> Our Approach
          </span>
          <h2>How We Bring<br />Spaces To Life</h2>
          <p>Four seamless phases — from your first idea to a finished, furnished dream home.</p>
        </div>

        <div className="about-process-grid">
          {processSteps.map((s, i) => (
            <div className="process-box" key={i}>
              <div className="process-box-top">
                <div className="process-box-icon">
                  <FontAwesomeIcon icon={s.icon} />
                </div>
                <span className="process-box-num">{s.num}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          PILLARS OF EXCELLENCE
      ══════════════════════════════ */}
      <section className="abt-pillars">
        <div className="abt-section-head abt-reveal" ref={sr} style={{ marginBottom: '48px' }}>
          <span className="section-tag">
            <FontAwesomeIcon icon={faCrown} /> Why Choose Us
          </span>
          <h2>Our Pillars Of<br />Excellence</h2>
          <p>
            We eliminate the stress of residential construction by uniting elite
            artistry with completely transparent project execution.
          </p>
        </div>

        <div className="abt-pillars-grid">
          {pillars.map((p, i) => (
            <div
              className="abt-pillar-card abt-reveal"
              key={i}
              ref={sr}
              style={{ '--abt-delay': `${i * 70}ms` }}
            >
              <div className="abt-pillar-icon">
                <FontAwesomeIcon icon={p.icon} />
              </div>
              <div>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          CTA
      ══════════════════════════════ */}
      <section className="about-cta">
        <div className="about-cta-inner abt-reveal" ref={sr}>
          <span className="section-tag">
            <FontAwesomeIcon icon={faWandMagicSparkles} /> Begin Your Journey
          </span>
          <h2>Let's Design A Space<br />That Reflects You</h2>
          <p>
            Elegant interiors crafted with premium materials, modern aesthetics,
            and timeless sophistication — built entirely around your life.
          </p>
          <div className="abt-cta-actions">
            <button className="about-cta-btn" onClick={() => setShowLogin(true)}>
              Book Free Consultation <FontAwesomeIcon icon={faCalendarCheck} />
            </button>
            <button className="about-cta-btn-ghost" onClick={() => navigate('/projects')}>
              See Our Work <FontAwesomeIcon icon={faBuilding} />
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;

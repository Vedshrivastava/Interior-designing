import React, { useEffect, useRef } from 'react';
import '../styles/services.css';

import bgimg from '../assets/home-img.webp';
import Footer from '../components/Footer';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCrown,
  faArrowRight,
  faCalendarCheck,
  faDraftingCompass,
  faCube,
  faCubes,
  faHandshake,
  faLightbulb,
  faHome,
  faBuilding,
  faWrench,
  faStar,
  faLock,
  faRulerCombined,
  faPalette,
  faLayerGroup,
  faQuoteLeft,
  faBoxes,
  faHammer,
} from '@fortawesome/free-solid-svg-icons';

const testimonials = [
  { name: "Rahul Mehta",    location: "Mumbai, IN",    text: "Exceptional execution and luxurious finishing. The team transformed our home beyond expectations.",           rating: 5 },
  { name: "Priya Sharma",   location: "Delhi, IN",     text: "Their design sense is outstanding. Every corner of our apartment feels premium and thoughtfully designed.", rating: 5 },
  { name: "Aman Verma",     location: "Bangalore, IN", text: "Professional, transparent, and highly skilled team. The 3D design matched the final output perfectly.",     rating: 5 },
  { name: "Neha Joshi",     location: "Pune, IN",      text: "From consultation to handover, the entire process was smooth and stress-free. Truly turnkey execution.",    rating: 5 },
  { name: "Vikram Singh",   location: "Indore, IN",    text: "We got a luxury home interior within our budget. Absolutely no compromise on quality or aesthetics.",       rating: 5 },
  { name: "Sunita Agarwal", location: "Bhopal, IN",    text: "The 3D renders were spot-on. We knew exactly what we were getting before a single nail was hammered.",     rating: 5 },
];
const marqueeItems = [...testimonials, ...testimonials];

const services = [
  {
    icon: faStar,
    title: "Affordable Luxury",
    description: "Premium interiors with transparent pricing and zero hidden costs — luxury made accessible.",
  },
  {
    icon: faLock,
    title: "Refundable Consultation",
    description: "Your consultation fee is fully adjusted when you proceed with execution. Completely risk-free.",
  },
  {
    icon: faHome,
    title: "Residential Interiors",
    description: "Custom home interiors for apartments and villas — designed around your lifestyle and comfort.",
  },
  {
    icon: faBuilding,
    title: "Commercial Spaces",
    description: "Inspiring offices and retail interiors that boost productivity and reflect your brand identity.",
  },
  {
    icon: faWrench,
    title: "Renovation Services",
    description: "Complete makeovers or targeted upgrades — we breathe fresh life into any outdated space.",
  },
  {
    icon: faRulerCombined,
    title: "Space Planning",
    description: "Smart layouts that maximize every inch of your space for both function and visual flow.",
  },
  {
    icon: faLightbulb,
    title: "Lighting Design",
    description: "Ambient, accent, and task lighting concepts that define mood and elevate every room.",
  },
  {
    icon: faPalette,
    title: "Material Selection",
    description: "We source and curate premium materials from trusted partners like Kajaria, Asian Paints & more.",
  },
  {
    icon: faLayerGroup,
    title: "3D Visualization",
    description: "Photo-realistic 3D renders so you see exactly how your space will look before execution begins.",
  },
];

const processSteps = [
  { num: "01", label: "Consultation & Planning", icon: faDraftingCompass },
  { num: "02", label: "Concept & 3D Design",     icon: faCube },
  { num: "03", label: "Execution & Supervision", icon: faCubes },
  { num: "04", label: "Final Styling & Delivery", icon: faHandshake },
];

const Services = ({ setShowLogin }) => {

  const revealRefs = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    revealRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const addRef = (el) => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  };

  return (
    <div className="services-page">

      {/* ── HERO ── */}
      <div className="services-hero">
        <img src={bgimg} alt="Luxury Interior" className="services-hero-bg" />
        <div className="services-overlay" />
        <div className="services-hero-content">
          <span className="svc-section-tag">
            <FontAwesomeIcon icon={faCrown} /> Premium Interior Services
          </span>
          <h1>
            Crafted Interiors<br />
            Designed To Elevate
          </h1>
          <p>
            Luxury interior design and contracting solutions tailored to modern
            lifestyles, functionality, and timeless elegance.
          </p>
          <div className="hero-cta-row">
            <button className="svc-btn-primary" onClick={() => setShowLogin(true)}>
              Book Consultation <FontAwesomeIcon icon={faCalendarCheck} />
            </button>
            <button className="svc-btn-ghost">
              View Projects <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <section className="services-stats">
        {[
          { val: "150+", label: "Projects Completed" },
          { val: "10+",  label: "Years Warranty" },
          { val: "100%", label: "Client Satisfaction" },
          { val: "5★",   label: "Average Rating" },
        ].map((s, i) => (
          <div className="services-stat-box" key={i}>
            <h2>{s.val}</h2>
            <p>{s.label}</p>
          </div>
        ))}
      </section>

      {/* ── SERVICE CARDS GRID ── */}
      <section className="services-main-section">

        <div className="services-heading reveal-item" ref={addRef}>
          <span className="svc-section-tag">What We Offer</span>
          <h1>Interior Services<br />Tailored For You</h1>
          <p>From concept to completion — every service crafted with precision and luxury.</p>
        </div>

        <div className="svc-grid">
          {services.map((svc, i) => (
            <div
              className="svc-grid-card reveal-item"
              key={i}
              ref={addRef}
              style={{ '--delay': `${(i % 3) * 100}ms` }}
            >
              {/* top accent line */}
              <div className="svc-card-accent" />

              <div className="svc-icon-wrap">
                <FontAwesomeIcon icon={svc.icon} />
              </div>

              <h3>{svc.title}</h3>
              <p>{svc.description}</p>

              <button className="svc-card-link">
                Learn More <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>
          ))}
        </div>

      </section>

{/* ── PROCESS SECTION — paste this into Home.jsx replacing the existing process-section ── */}

<section className='process-section'>

  <div className='contents process-header' ref={/* add to your revealRefs if you add IntersectionObserver to Home.jsx */ null}>
    <span className='section-tag'>
      <FontAwesomeIcon icon={faDraftingCompass} /> Our Process
    </span>
    <h1>How We Transform Your Space</h1>
    <p className='process-subtitle'>
      Six seamless steps — from your first idea to a finished, furnished home.
    </p>
  </div>

  <div className='process-grid'>

    <div className='process-card'>
      <div className='process-icon-badge'>
        <FontAwesomeIcon icon={faDraftingCompass} />
      </div>
      <span className='process-num'>01</span>
      <h3>Consultation</h3>
      <p>We understand your vision, budget, and lifestyle before anything else.</p>
      <div className='process-connector' />
    </div>

    <div className='process-card'>
      <div className='process-icon-badge'>
        <FontAwesomeIcon icon={faCube} />
      </div>
      <span className='process-num'>02</span>
      <h3>Space Planning</h3>
      <p>Smart layouts designed to maximise every square foot of your space.</p>
      <div className='process-connector' />
    </div>

    <div className='process-card'>
      <div className='process-icon-badge'>
        <FontAwesomeIcon icon={faCubes} />
      </div>
      <span className='process-num'>03</span>
      <h3>3D Visualization</h3>
      <p>Photo-realistic renders so you approve the look before execution begins.</p>
      <div className='process-connector' />
    </div>

    <div className='process-card'>
      <div className='process-icon-badge'>
        <FontAwesomeIcon icon={faBoxes} />
      </div>
      <span className='process-num'>04</span>
      <h3>Material Selection</h3>
      <p>We curate premium materials from trusted partners within your budget.</p>
      <div className='process-connector' />
    </div>

    <div className='process-card'>
      <div className='process-icon-badge'>
        <FontAwesomeIcon icon={faHammer} />
      </div>
      <span className='process-num'>05</span>
      <h3>Execution</h3>
      <p>Expert craftsmen bring your design to life with precision and care.</p>
      <div className='process-connector' />
    </div>

    <div className='process-card process-card-last'>
      <div className='process-icon-badge'>
        <FontAwesomeIcon icon={faHandshake} />
      </div>
      <span className='process-num'>06</span>
      <h3>Final Handover</h3>
      <p>A complete walkthrough and handover of your transformed dream space.</p>
    </div>

  </div>

</section>


      {/* ── TESTIMONIALS MARQUEE ── */}
      <section className='svc-testimonial-section'>
        <div className='svc-t-heading reveal-item' ref={addRef}>
          <span className='svc-section-tag'><FontAwesomeIcon icon={faQuoteLeft} /> Testimonials</span>
          <h1>What Our Clients Say</h1>
          <p className='testimonial-subtitle'>Trusted by homeowners and businesses across India.</p>
        </div>
        <div className='marquee-track-wrapper'>
          <div className='marquee-track'>
            <div className='marquee-inner scroll-left'>
              {marqueeItems.map((t, i) => (
                <div className='t-card' key={`top-${i}`}>
                  <div className='t-card-stars'>{Array.from({ length: t.rating }).map((_, s) => <FontAwesomeIcon icon={faStar} key={s} />)}</div>
                  <p className='t-card-text'>"{t.text}"</p>
                  <div className='t-card-author'>
                    <div className='t-card-avatar'>{t.name.charAt(0)}</div>
                    <div><strong>{t.name}</strong><span>{t.location}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className='marquee-track'>
            <div className='marquee-inner scroll-right'>
              {[...marqueeItems].reverse().map((t, i) => (
                <div className='t-card' key={`bot-${i}`}>
                  <div className='t-card-stars'>{Array.from({ length: t.rating }).map((_, s) => <FontAwesomeIcon icon={faStar} key={s} />)}</div>
                  <p className='t-card-text'>"{t.text}"</p>
                  <div className='t-card-author'>
                    <div className='t-card-avatar'>{t.name.charAt(0)}</div>
                    <div><strong>{t.name}</strong><span>{t.location}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="services-cta reveal-item" ref={addRef}>
        <div className="cta-inner">
          <span className="svc-section-tag">Get Started</span>
          <h1>Let's Create Your<br />Dream Interior</h1>
          <p>
            Elegant spaces crafted with precision, premium materials,
            and timeless modern aesthetics.
          </p>
          <button className="services-cta-btn" onClick={() => setShowLogin(true)}>
            Book Free Consultation <FontAwesomeIcon icon={faCalendarCheck} />
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Services;

import React, { useEffect, useRef } from 'react';
import '../styles/why-choose-us.css';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMedal,
  faRulerCombined,
  faShieldAlt,
  faCube,
  faHandshake,
  faStar,
} from '@fortawesome/free-solid-svg-icons';

const reasons = [
  {
    icon: faMedal,
    title: "Premium Quality",
    desc: "We source only top-tier materials from India's most trusted brands — no shortcuts, ever.",
  },
  {
    icon: faRulerCombined,
    title: "100% Custom",
    desc: "Every design is built around your lifestyle, not a template. Truly bespoke interiors.",
  },
  {
    icon: faShieldAlt,
    title: "Risk-Free Consultation",
    desc: "Your consultation fee is fully refunded when you proceed. Zero risk to get started.",
  },
  {
    icon: faCube,
    title: "3D Before Execution",
    desc: "See a photorealistic 3D render of your space before a single wall is touched.",
  },
  {
    icon: faHandshake,
    title: "Turnkey Delivery",
    desc: "We handle everything — design, sourcing, execution, and final handover. One team, zero stress.",
  },
  {
    icon: faStar,
    title: "5★ Client Satisfaction",
    desc: "Consistently rated 5 stars by our clients for quality, transparency and on-time delivery.",
  },
];

const WhyChooseUs = () => {
  const cardRefs = useRef([]);
  const headerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('wcu-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (headerRef.current) observer.observe(headerRef.current);
    cardRefs.current.forEach((el) => el && observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const addCardRef = (el) => {
    if (el && !cardRefs.current.includes(el)) cardRefs.current.push(el);
  };

  return (
    <section className="why-choose-section">
      
      {/* Subtle grid pattern background to match your premium design theme */}
      <div className="wcu-grid-texture" />

      {/* ── HEADER ── */}
      <div className="why-choose-header wcu-reveal" ref={headerRef}>
        <span className="wcu-section-tag">
          <FontAwesomeIcon icon={faStar} /> Why Choose Us
        </span>
        <h1>Crafted Spaces With<br />Timeless Elegance</h1>
        <p>
          We combine luxury aesthetics, smart functionality, and expert
          execution to create interiors that truly elevate your lifestyle.
        </p>
      </div>

      {/* ── MAIN LAYOUT (Symmetrical Premium Grid) ── */}
      <div className="wcu-container">
        <div className="wcu-cards-grid">
          {reasons.map((r, i) => (
            <div
              className="wcu-card wcu-reveal"
              key={i}
              ref={addCardRef}
              style={{ '--wcu-delay': `${i * 70}ms` }}
            >
              <div className="wcu-card-icon">
                <FontAwesomeIcon icon={r.icon} />
              </div>
              <div className="wcu-card-body">
                <h3>{r.title}</h3>
                <p>{r.desc}</p>
              </div>
              {/* Subtle architectural gold sweep line on hover */}
              <div className="wcu-card-line" />
            </div>
          ))}
        </div>
      </div>

    </section>
  );
};

export default WhyChooseUs;
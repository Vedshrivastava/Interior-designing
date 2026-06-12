import React, { useEffect, useRef, useState } from 'react';
import '../styles/home.css';
import bgimg from '../assets/home-img.png';
import kitchen_img from '../assets/kitchen.png';
import bathroom_img from '../assets/bathroom.png';
import TV_unit_img from '../assets/TV-unit.png';
import lounge_img from '../assets/lounge.png';
import bedroom_img from '../assets/bedroom.png';
import kajaria from '../assets/kajaria.png';
import saint_gobain from '../assets/Saint-Gobain.jpg';
import asian_paints from '../assets/asian-paints.jpeg';
import centuryply from '../assets/centuryply.png';
import residence from '../assets/residence.png';
import design from '../assets/refund-design.png';
import rates from '../assets/rates.png';
import Footer from '../components/Footer';

import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCrown, faPalette, faBuilding, faArrowRight, faCalendarCheck,
  faCheck, faCubes, faUtensils, faBed, faBath, faCouch, faTv,
  faChild, faDraftingCompass, faCube, faBoxes, faHammer, faHandshake,
  faHome, faQuoteLeft, faIndustry, faStar, faClock,
  faWandMagicSparkles, faMedal, faRulerCombined, faShieldAlt
} from '@fortawesome/free-solid-svg-icons';


/* ── data ── */
const testimonials = [
  { name: "Rahul Mehta", location: "Mumbai", text: "Exceptional execution and luxurious finishing. The team transformed our home beyond expectations.", rating: 5, image: design },
  { name: "Priya Sharma", location: "Delhi", text: "Their design sense is outstanding. Every corner of our apartment feels premium and thoughtfully designed.", rating: 5 },
  { name: "Aman Verma", location: "Bangalore", text: "Professional, transparent, and highly skilled. The 3D design matched the final output perfectly.", rating: 5 },
  { name: "Neha Joshi", location: "Pune", text: "From consultation to handover, the entire process was smooth and stress-free. Truly turnkey.", rating: 5 },
  { name: "Vikram Singh", location: "Indore", text: "We got a luxury home interior within our budget. Absolutely no compromise on quality or aesthetics.", rating: 5 },
  { name: "Sunita Agarwal", location: "Bhopal", text: "The 3D renders were spot-on. We knew exactly what we were getting before a single nail was hammered.", rating: 5 },
];
const marqueeItems = [...testimonials, ...testimonials];

const brandLogos = [
  { src: kajaria, alt: "Kajaria" },
  { src: saint_gobain, alt: "Saint-Gobain" },
  { src: asian_paints, alt: "Asian Paints" },
  { src: centuryply, alt: "CenturyPly" },
];

const Home = ({ setShowLogin }) => {
  const navigate = useNavigate();
  const handleProjects = () => navigate('/projects');

  /* scroll reveal */
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

  const CountUp = ({ endValue, duration = 2300 }) => {
    const [count, setCount] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef(null);

    // Separate prefix, number, and suffix (e.g., "50+" -> "", "50", "+")
    const match = String(endValue).match(/^(\D*)(\d+(?:\.\d+)?)(\D*)$/);
    const prefix = match ? match[1] : '';
    const targetNumber = match ? parseFloat(match[2]) : null;
    const suffix = match ? match[3] : '';

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      if (ref.current) observer.observe(ref.current);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (!isVisible || targetNumber === null) return;

      let startTimestamp = null;
      const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // easeOut function for smooth deceleration
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setCount(easeProgress * targetNumber);

        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          setCount(targetNumber);
        }
      };
      window.requestAnimationFrame(step);
    }, [isVisible, targetNumber, duration]);

    // Fallback if the string contains no numbers
    if (targetNumber === null) return <span ref={ref}>{endValue}</span>;

    // Render integer or keep 1 decimal based on the target value
    const displayCount = Number.isInteger(targetNumber) ? Math.round(count) : count.toFixed(1);

    return <span ref={ref}>{prefix}<span className="hp-prof-num">{displayCount}</span>{suffix}</span>;
  };

  return (
    <div className='home-page'>

      {/* ══════════════════════════════
          HERO
      ══════════════════════════════ */}
      <section className='hp-hero'>
        <img src={bgimg} alt="" className='hp-hero-bg' />
        <div className='hp-hero-overlay' />

        {/* editorial grid lines */}
        <div className='hp-hero-grid-lines'>
          <span /><span /><span /><span />
        </div>

        <div className='hp-hero-inner'>
          <div className='hp-hero-eyebrow'>
            <span className='hp-eyebrow-line' />
            <span>Luxury Interior Design Studio</span>
            <span className='hp-eyebrow-line' />
          </div>

          <h1 className='hp-hero-title'>
            <span className="hp-highlight">Shrivastavas</span>            <br />Elevate
          </h1>

          <p className='hp-hero-sub'>
            Crafting timeless interiors with luxury,<br />
            precision and turnkey execution.
          </p>

          <div className='hp-hero-actions'>
            <button onClick={handleProjects} className='hp-btn-primary'>
              Explore Projects <FontAwesomeIcon icon={faArrowRight} />
            </button>
            <button onClick={() => setShowLogin(true)} className='hp-btn-ghost'>
              Book Consultation <FontAwesomeIcon icon={faCalendarCheck} />
            </button>
          </div>

          <p className='hp-hero-caption'>
            <FontAwesomeIcon icon={faBuilding} /> Interior Designers &amp; Contractors · Satna
          </p>
        </div>

        {/* scroll indicator */}
        <div className='hp-scroll-hint'>
          <span className='hp-scroll-line' />
          <span>Scroll</span>
        </div>
      </section>

      {/* ══════════════════════════════
          STATS BAR — single dark accent band
      ══════════════════════════════ */}
      <section className='hp-stats'>
        {[
          { num: '50+', label: 'Projects Completed', sub: 'Across residential & commercial' },
          { num: '5+', label: 'Years Experience', sub: 'Serving discerning clients' },
          { num: '100%', label: 'Custom Design', sub: 'No templates, ever' },
          { num: 'Turnkey', label: 'Execution', sub: 'Design to handover, one team' },
        ].map((s, i) => (
          <div className='hp-stat-item' key={i} ref={sr} style={{ '--sr-delay': `${i * 80}ms` }}>
            <span className='hp-stat-rule' />
            <h2><CountUp endValue={s.num} /></h2>
            <p className='hp-stat-label'>{s.label}</p>
            <p className='hp-stat-sub'>{s.sub}</p>
          </div>
        ))}
      </section>

      {/* ══════════════════════════════
          DESIGNS — editorial card grid
      ══════════════════════════════ */}
      <section className='hp-designs'>
        <div className='hp-section-head sr-item' ref={sr}>
          <div className='hp-sh-left'>
            <span className='hp-overline'>
              <FontAwesomeIcon icon={faPalette} /> Our Expertise
            </span>

            <h2>
              Choose From<br />Our Designs
            </h2>
          </div>

          <div className='hp-sh-right'>
            <p>
              Explore thoughtfully crafted interiors designed for luxury,
              comfort and enduring functionality.
            </p>

            {/* ORIGINAL BUTTON KEPT HERE */}
            <button onClick={handleProjects} className='hp-text-btn'>
              View all projects <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>
        </div>

        <div className='hp-designs-grid'>
          {[
            { img: kitchen_img, icon: faUtensils, label: 'Kitchen', desc: 'Modern modular concepts', category: 'Kitchen Designs' },
            { img: bedroom_img, icon: faBed, label: 'Bedroom', desc: 'Elegant & luxurious', category: 'Bedroom Designs' },
            { img: bathroom_img, icon: faBath, label: 'Bathroom', desc: 'Minimal & premium', category: 'Bathroom Designs' },
            { img: lounge_img, icon: faCouch, label: 'Lounge', desc: 'Luxury living spaces', category: 'Lounge area Designs' },
            { img: TV_unit_img, icon: faTv, label: 'TV Unit', desc: 'Entertainment walls', category: 'TV Unit Designs' },
          ].map((d, i) => (
            <div
              className={`hp-design-card sr-item ${i === 0 ? 'hp-design-card--featured' : ''}`}
              key={i}
              ref={sr}
              style={{ '--sr-delay': `${i * 60}ms` }}
              onClick={() => navigate(`/design/${encodeURIComponent(d.category)}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate(`/design/${encodeURIComponent(d.category)}`);
                }
              }}
            >
              <div className='hp-dc-img'>
                <img src={d.img} alt={d.label} />
                <div className='hp-dc-overlay' />
              </div>

              <div className='hp-dc-info'>
                <span className='hp-dc-icon'>
                  <FontAwesomeIcon icon={d.icon} />
                </span>

                <div>
                  <h4>{d.label}</h4>
                  <p>{d.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* NEW BUTTON ADDED AT THE BOTTOM */}
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
          <button onClick={() => navigate('/design/Bedroom%20Designs')} className='hp-text-btn'>
            View more designs <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </section>

      {/* ══════════════════════════════
          WHY CHOOSE US — REDESIGNED SERVICES SECTION
      ══════════════════════════════ */}
      <section className='hp-why-choose'>
        <div className='hp-section-head sr-item' ref={sr}>
          <div className='hp-sh-left'>
            <span className='hp-overline'>
              <FontAwesomeIcon icon={faCrown} /> Why Shrivastavas
            </span>
            <h2>Our Pillars Of<br />Excellence</h2>
          </div>
          <div className='hp-sh-right'>
            <p>
              We eliminate the stress of residential construction by uniting elite
              artistry with completely transparent project execution management.
            </p>
          </div>
        </div>

        <div className='hp-why-choose-grid'>
          {[
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
          ].map((item, i) => (
            <div
              className='hp-wc-card sr-item'
              key={i}
              ref={sr}
              style={{ '--sr-delay': `${i * 80}ms` }}
            >
              <div className='hp-wc-icon'>
                <FontAwesomeIcon icon={item.icon} />
              </div>

              <div className='hp-wc-content'>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          PROCESS — CLEAN ARCHITECTURAL EDITS
      ══════════════════════════════ */}
      <section className='hp-process'>
        <div className='hp-process-head sr-item' ref={sr}>
          <span className='hp-overline'><FontAwesomeIcon icon={faDraftingCompass} /> Our Process</span>
          <h2>How We Transform<br />Your Space</h2>
          <p>Six seamless steps — from your first idea to a finished, furnished dream home.</p>
        </div>

        <div className='hp-process-grid'>
          {[
            { icon: faDraftingCompass, num: '01', title: 'Consultation', desc: 'We understand your vision, budget, and lifestyle before anything else.' },
            { icon: faCube, num: '02', title: 'Space Planning', desc: 'Smart layouts designed to maximise every square foot of your space.' },
            { icon: faCubes, num: '03', title: '3D Visualization', desc: 'Photo-realistic renders so you approve the look before execution begins.' },
            { icon: faBoxes, num: '04', title: 'Material Selection', desc: 'Premium materials curated from trusted partners within your budget.' },
            { icon: faHammer, num: '05', title: 'Execution', desc: 'Expert craftsmen bring your design to life with precision and care.' },
            { icon: faHandshake, num: '06', title: 'Final Handover', desc: 'A complete walkthrough and handover of your transformed dream space.' },
          ].map((s, i) => (
            <div className='hp-process-card sr-item' key={i} ref={sr} style={{ '--sr-delay': `${i * 80}ms` }}>
              <div className='hp-pc-top'>
                <div className='hp-pc-icon'><FontAwesomeIcon icon={s.icon} /></div>
                <span className='hp-pc-num hp-prof-num'>{s.num}</span>
              </div>
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
              <div className='hp-pc-line' />
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          ADVANTAGES
      ══════════════════════════════ */}
      <section className='hp-advantages'>
        <div className='hp-advantages-head sr-item' ref={sr}>
          <span className='hp-overline'><FontAwesomeIcon icon={faHome} /> Client Benefits</span>
          <h2>Advantages<br />Our Clients Get</h2>
          <p>Every decision is designed to give you more confidence, more value and a smoother journey.</p>
        </div>

        <div className='hp-adv-layout'>

          {/* left — tall feature card */}
          <div className='hp-adv-feature sr-item' ref={sr}>
            <div className='hp-adv-feature-img'>
              <img src={rates} alt="Affordable Rates" />
              <div className='hp-adv-feature-overlay' />
              <div className='hp-adv-feature-tag'>
                <FontAwesomeIcon icon={faCubes} /> Pricing
              </div>
            </div>
            <div className='hp-adv-feature-body'>
              <h3>Affordable Luxury</h3>
              <p>Premium interiors with transparent pricing and zero hidden costs — luxury made genuinely accessible.</p>
              <ul>
                <li><span className='hp-adv-dot' />No hidden charges, ever</li>
                <li><span className='hp-adv-dot' />Premium materials within budget</li>
                <li><span className='hp-adv-dot' />Detailed cost breakdown upfront</li>
              </ul>
            </div>
          </div>

          {/* right — stacked cards */}
          <div className='hp-adv-stack'>

            <div className='hp-adv-card sr-item' ref={sr} style={{ '--sr-delay': '80ms' }}>
              <div className='hp-adv-card-img'>
                <img src={design} alt="Consultation Refund" />
                <div className='hp-adv-card-img-overlay' />
                <div className='hp-adv-card-tag'><FontAwesomeIcon icon={faCheck} /> Risk-Free</div>
              </div>
              <div className='hp-adv-card-body'>
                <h4>Consultation Refund</h4>
                <p>Your consultation fee is fully adjusted against project cost — zero financial risk.</p>
                <ul>
                  <li><span className='hp-adv-dot' />Fee adjusted on confirmation</li>
                  <li><span className='hp-adv-dot' />No obligation to proceed</li>
                </ul>
              </div>
            </div>

            <div className='hp-adv-card sr-item' ref={sr} style={{ '--sr-delay': '160ms' }}>
              <div className='hp-adv-card-img'>
                <img src={residence} alt="Custom Residential" />
                <div className='hp-adv-card-img-overlay' />
                <div className='hp-adv-card-tag'><FontAwesomeIcon icon={faHome} /> Residential</div>
              </div>
              <div className='hp-adv-card-body'>
                <h4>Custom Residential</h4>
                <p>Every home is designed from scratch around your lifestyle — not from a catalogue.</p>
                <ul>
                  <li><span className='hp-adv-dot' />100% bespoke designs</li>
                  <li><span className='hp-adv-dot' />End-to-end execution</li>
                </ul>
              </div>
            </div>

          </div>
        </div>

        {/* mini stat strip */}
        <div className='hp-adv-stats sr-item' ref={sr}>
          {[
            { icon: faStar, val: '50+', label: 'Projects Delivered' },
            { icon: faHandshake, val: '100%', label: 'Turnkey Execution' },
            { icon: faClock, val: '5★', label: 'Average Rating' },
          ].map((s, i) => (
            <div className='hp-adv-stat' key={i}>
              <div className='hp-adv-stat-icon'><FontAwesomeIcon icon={s.icon} /></div>
              <span className='hp-adv-stat-val'><CountUp endValue={s.val} /></span>
              <span className='hp-adv-stat-lbl'>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          TESTIMONIALS MARQUEE
      ══════════════════════════════ */}
      <section className='hp-testimonials'>
        <div className='hp-testimonials-head sr-item' ref={sr}>
          <span className='hp-overline'><FontAwesomeIcon icon={faQuoteLeft} /> Testimonials</span>
          <h2>What Our Clients Say</h2>
          <p>Trusted by homeowners across India for luxury interiors and seamless execution.</p>
        </div>

        <div className='marquee-track-wrapper'>
          <div className='marquee-track'>
            <div className='marquee-inner scroll-left'>
              {marqueeItems.map((t, i) => (
                <div className='t-card' key={`a${i}`}>
                  <div className='t-card-stars'>{Array.from({ length: t.rating }).map((_, s) => <FontAwesomeIcon icon={faStar} key={s} />)}</div>
                  <p className='t-card-text'>"{t.text}"</p>
                  <div className='t-card-author'>
                    <div className='t-card-avatar'>
                      {t.image ? (
                        <img src={t.image} alt={t.name} />
                      ) : (
                        t.name.charAt(0)
                      )}
                    </div>                    <div><strong>{t.name}</strong><span>{t.location}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className='marquee-track'>
            <div className='marquee-inner scroll-right'>
              {[...marqueeItems].reverse().map((t, i) => (
                <div className='t-card' key={`b${i}`}>
                  <div className='t-card-stars'>{Array.from({ length: t.rating }).map((_, s) => <FontAwesomeIcon icon={faStar} key={s} />)}</div>
                  <p className='t-card-text'>"{t.text}"</p>
                  <div className='t-card-author'>
                    <div className='t-card-avatar'>
                      {t.image ? (
                        <img src={t.image} alt={t.name} />
                      ) : (
                        t.name.charAt(0)
                      )}
                    </div>                    <div><strong>{t.name}</strong><span>{t.location}</span></div>
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
      <section className='hp-brands'>
        <div className='hp-brands-head sr-item' ref={sr}>
          <span className='hp-overline'><FontAwesomeIcon icon={faIndustry} /> Premium Materials</span>
          <h2>Trusted Material Partners</h2>
          <p>We source exclusively from India's most respected material brands.</p>
        </div>
        <div className='hp-brands-row'>
          {brandLogos.map((b, i) => (
            <div className='hp-brand-card sr-item' key={i} ref={sr} style={{ '--sr-delay': `${i * 70}ms` }}>
              <img src={b.src} alt={b.alt} />
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          CTA
      ══════════════════════════════ */}
      <section className='hp-cta'>
        <div className='hp-cta-grid-texture' />
        <div className='hp-cta-inner sr-item' ref={sr}>
          <span className='hp-overline light'><FontAwesomeIcon icon={faWandMagicSparkles} /> Begin Your Journey</span>
          <h2>Ready to Transform<br />Your Space?</h2>
          <p>Let's craft an interior that reflects your personality, lifestyle and aspirations.</p>
          <div className='hp-cta-actions'>
            <button onClick={() => setShowLogin(true)} className='hp-cta-btn-primary'>
              Get Free Consultation <FontAwesomeIcon icon={faCalendarCheck} />
            </button>
            <button onClick={handleProjects} className='hp-cta-btn-ghost'>
              See Our Work <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;
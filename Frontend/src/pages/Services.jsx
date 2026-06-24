import React, { useEffect, useRef, useState } from 'react';
import '../styles/services.css';
import { useNavigate } from 'react-router-dom';
import bgimg from '../assets/home-img.png';
import Footer from '../components/Footer';
import residence from '../assets/residence.png';
import design from '../assets/refund-design.png';
import rates from '../assets/rates.png';
import renovation from '../assets/renovation.jpeg';
import commercial from '../assets/commercial.png';
import space_planning from '../assets/space-planning.png';
import lighting from '../assets/lighting.png';
import materials from '../assets/materials.png';
import Visualization_3D from '../assets/3D-visualization.png';


import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCrown, faArrowRight, faCalendarCheck,
    faDraftingCompass, faCube, faCubes, faHandshake,
    faLightbulb, faHome, faBuilding, faWrench,
    faStar, faLock, faRulerCombined,
    faLayerGroup, faQuoteLeft, faBoxes, faHammer,
    faClock,
} from '@fortawesome/free-solid-svg-icons';

const testimonials = [
    { name: "Rahul Mehta", location: "Mumbai", text: "Exceptional execution and luxurious finishing. The team transformed our home beyond expectations.", rating: 5, image: design },
    { name: "Priya Sharma", location: "Delhi", text: "Their design sense is outstanding. Every corner of our apartment feels premium and thoughtfully designed.", rating: 5 },
    { name: "Aman Verma", location: "Bangalore", text: "Professional, transparent, and highly skilled. The 3D design matched the final output perfectly.", rating: 5 },
    { name: "Neha Joshi", location: "Pune", text: "From consultation to handover, the entire process was smooth and stress-free. Truly turnkey.", rating: 5 },
    { name: "Vikram Singh", location: "Indore", text: "We got a luxury home interior within our budget. Absolutely no compromise on quality or aesthetics.", rating: 5 },
    { name: "Sunita Agarwal", location: "Bhopal", text: "The 3D renders were spot-on. We knew exactly what we were getting before a single nail was hammered.", rating: 5 },
];
const marqueeItems = [...testimonials, ...testimonials];

// type: 'residential' | 'commercial' | 'both'
const services = [
    {
        icon: faStar, title: "Affordable Luxury", type: 'both',
        description: "Premium interiors with transparent pricing and zero hidden costs — luxury made genuinely accessible.",
        img: rates,
        features: ["Transparent Pricing", "Zero Hidden Costs", "Luxury aesthetic within budget"]
    },
    { icon: faLock, title: "Refundable Consultation", type: 'both', description: "Your consultation fee is fully adjusted when you proceed with execution. Completely risk-free.", img: design, features: ["Fee adjusted on project confirmation", "No obligation to proceed"] },
    { icon: faHome, title: "Residential Interiors", type: 'residential', description: "Custom home interiors for apartments and villas — designed around your lifestyle and comfort.", img: residence, features: ["100% bespoke, no templates", "Apartment & villa specialists"] },

    {
        icon: faBuilding, title: "Commercial Spaces", type: 'commercial',
        description: "Inspiring offices and retail interiors that boost productivity and reflect your brand identity.",
        img: commercial,
        features: ["Brand-Centric Design", "Ergonomic Layouts", "Turnkey office & retail execution"]
    },
    { icon: faWrench, title: "Renovation Services", type: 'both', description: "Complete makeovers or targeted upgrades — we breathe fresh life into any outdated space.", img: renovation, features: ["Partial or full space overhauls", "Minimal disruption approach"] },
    { icon: faRulerCombined, title: "Space Planning", type: 'both', description: "Smart layouts that maximise every inch of your space for both function and visual flow.", img: space_planning, features: ["Floor plan optimisation", "Flow & functionality focused"] },

    {
        icon: faLightbulb, title: "Lighting Design", type: 'both',
        description: "Ambient, accent, and task lighting concepts that define mood and elevate every room.",
        img: lighting,
        features: ["Mood-Enhancing Concepts", "Energy-Efficient Solutions", "Natural & artificial light balance"]
    },
    { icon: faLayerGroup, title: "Material Selection", type: 'both', description: "We source premium materials from trusted partners like Kajaria, Asian Paints & more.", img: materials, features: ["Trusted brands, curated choices", "Budget-conscious premium picks"] },
    { icon: faLayerGroup, title: "3D Visualization", type: 'both', description: "Photo-realistic 3D renders so you see exactly how your space will look before execution begins.", img: Visualization_3D, features: ["Photo-realistic renders", "Approved before execution begins"] },
];

const processSteps = [
    { num: '01', icon: faDraftingCompass, title: 'Consultation', desc: 'We understand your vision, budget, and lifestyle before anything else.' },
    { num: '02', icon: faCube, title: 'Space Planning', desc: 'Smart layouts designed to maximise every square foot of your space.' },
    { num: '03', icon: faCubes, title: '3D Visualization', desc: 'Photo-realistic renders so you approve the look before execution begins.' },
    { num: '04', icon: faBoxes, title: 'Material Selection', desc: 'Premium materials curated from trusted partners within your budget.' },
    { num: '05', icon: faHammer, title: 'Execution', desc: 'Expert craftsmen bring your design to life with precision and care.' },
    { num: '06', icon: faHandshake, title: 'Final Handover', desc: 'A complete walkthrough and handover of your transformed dream space.' },
];

// Reusable CountUp Component for numbers
const CountUp = ({ endValue, duration = 2300 }) => {
    const [count, setCount] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef(null);

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

    if (targetNumber === null) return <span ref={ref}>{endValue}</span>;

    const displayCount = Number.isInteger(targetNumber) ? Math.round(count) : count.toFixed(1);

    return <span ref={ref}>{prefix}<span className="hp-prof-num">{displayCount}</span>{suffix}</span>;
};


const Services = ({ setShowLogin }) => {
    const revealRefs = useRef([]);
    const navigate = useNavigate();
    const handleProjects = () => navigate('/projects');
    const [activeFilter, setActiveFilter] = useState('all');

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
            }),
            { threshold: 0.1 }
        );
        revealRefs.current.forEach(el => el && observer.observe(el));
        return () => observer.disconnect();
    }, []);

    const addRef = el => { if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el); };

    return (
        <div className="services-page">

            {/* ── HERO ── */}
            <section className="services-hero">
                <img src={bgimg} alt="Luxury Interior" className="services-hero-bg" />
                <div className="services-overlay" />

                <div className="services-hero-content">
                    <div className="svc-hero-eyebrow">
                        <span className="svc-eyebrow-line" />
                        <span>Luxury Interior Design Studio</span>
                        <span className="svc-eyebrow-line" />
                    </div>

                    <h1>
                        Crafted Interiors<br />
                        <span className="svc-highlight">Designed To Elevate</span>
                    </h1>

                    <p>
                        Luxury interior design and contracting solutions tailored to modern
                        lifestyles, functionality, and timeless elegance.
                    </p>

                    <div className="hero-cta-row">
                        <button className="svc-btn-primary" onClick={() => setShowLogin(true)}>
                            Book Consultation <FontAwesomeIcon icon={faCalendarCheck} />
                        </button>
                        <button onClick={handleProjects} className="svc-btn-ghost">
                            View Projects <FontAwesomeIcon icon={faArrowRight} />
                        </button>
                    </div>
                </div>

                <div className="svc-scroll-hint">
                    <span className="svc-scroll-line" />
                    <span>Scroll</span>
                </div>
            </section>

            {/* ── STATS BAR ── */}
            <section className="services-stats">
                {[
                    { val: '50+', label: 'Projects Completed', sub: 'Across residential & commercial' },
                    { val: '5+', label: 'Years Experience', sub: 'Serving discerning clients' },
                    { val: '100%', label: 'Client Satisfaction', sub: 'No compromise, ever' },
                    { val: '5★', label: 'Average Rating', sub: 'Consistently top rated' },
                ].map((s, i) => (
                    <div className="services-stat-box" key={i}>
                        <h2><CountUp endValue={s.val} /></h2>
                        <p>{s.label}</p>
                    </div>
                ))}
            </section>

            {/* ── SERVICE CARDS (Dynamic Asymmetric Blocks) ── */}
            <section className="services-main-section hp-advantages">

                {/* Editorial Header */}
                <div className="services-heading reveal-item" ref={addRef}>
                    <div className="services-heading-left">
                        <span className="svc-section-tag">
                            <FontAwesomeIcon icon={faCrown} /> What We Offer
                        </span>
                        <h2>Interior Services<br />Tailored For You</h2>
                    </div>
                    <div className="services-heading-right">
                        <p>
                            From concept to completion — every service crafted with
                            precision, premium materials and a luxury finish.
                        </p>
                    </div>
                </div>

                {/* ── Filter bar ── */}
                <div className="svc-filter-bar reveal-item" ref={addRef}>
                    {[
                        { key: 'all',         label: 'All Services'   },
                        { key: 'residential', label: 'Residential'    },
                        { key: 'commercial',  label: 'Commercial'     },
                    ].map(f => (
                        <button
                            key={f.key}
                            className={`svc-filter-btn${activeFilter === f.key ? ' active' : ''}`}
                            onClick={() => setActiveFilter(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                    <span className="svc-filter-count">
                        {activeFilter === 'all' ? services.length : services.filter(s => s.type === activeFilter || s.type === 'both').length} services
                    </span>
                </div>

                {/* This loops through your 9 services in groups of 3.
  Row 1: Services 1, 2, 3
  Row 2: Services 4, 5, 6
  Row 3: Services 7, 8, 9
*/}
                {/* Safely chunk the filtered services array into groups of 3 */}
                {(() => {
                    const filtered = activeFilter === 'all'
                        ? services
                        : services.filter(s => s.type === activeFilter || s.type === 'both');
                    return Array.from({ length: Math.ceil(filtered.length / 3) }).map((_, rowIndex) => {
                    const chunk = filtered.slice(rowIndex * 3, rowIndex * 3 + 3);

                    return (
                        /* DYNAMIC CLASS LOGIC:
                           If rowIndex is 1 (the middle 3 cards), it adds 'hp-adv-layout-alt' to flip the grid. 
                        */
                        <div
                            className={`hp-adv-layout ${rowIndex % 2 !== 0 ? 'hp-adv-layout-alt' : ''}`}
                            key={rowIndex}
                        >

                            {/* CARD 1 (TALL FEATURE) — Will sit Left on Even rows, Right on Odd rows */}
                            {chunk[0] && (
                                <div className='hp-adv-feature reveal-item' ref={addRef}>
                                    <div className='hp-adv-feature-img'>
                                        <img src={chunk[0].img} alt={chunk[0].title} />
                                        <div className='hp-adv-feature-overlay' />
                                        <div className='hp-adv-feature-tag'>
                                            <FontAwesomeIcon icon={chunk[0].icon} /> {chunk[0].title}
                                        </div>
                                    </div>
                                    <div className='hp-adv-feature-body'>
                                        <h3>{chunk[0].title}</h3>
                                        <p>{chunk[0].description}</p>

                                        {/* Check if the card has features, then map them */}
                                        {chunk[0].features && (
                                            <ul>
                                                {chunk[0].features.map((featureText, idx) => (
                                                    <li key={idx}><span className='hp-adv-dot' />{featureText}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* STACKED CARDS (Contains Card 2 & 3) — Will sit Right on Even rows, Left on Odd rows */}
                            <div className='hp-adv-stack'>

                                {/* CARD 2 (TOP) */}
                                {chunk[1] && (
                                    <div className='hp-adv-card reveal-item' ref={addRef} style={{ '--delay': '80ms' }}>
                                        <div className='hp-adv-card-img'>
                                            <img src={chunk[1].img} alt={chunk[1].title} />
                                            <div className='hp-adv-card-img-overlay' />
                                            <div className='hp-adv-card-tag'>
                                                <FontAwesomeIcon icon={chunk[1].icon} /> {chunk[1].title}
                                            </div>
                                        </div>
                                        <div className='hp-adv-card-body'>
                                            <h4>{chunk[1].title}</h4>
                                            <p>{chunk[1].description}</p>
                                            {chunk[1].features && (
                                                <ul>
                                                    {chunk[1].features.map((featureText, idx) => (
                                                        <li key={idx}><span className='hp-adv-dot' />{featureText}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* CARD 3 (BOTTOM) */}
                                {chunk[2] && (
                                    <div className='hp-adv-card reveal-item' ref={addRef} style={{ '--delay': '160ms' }}>
                                        <div className='hp-adv-card-img'>
                                            <img src={chunk[2].img} alt={chunk[2].title} />
                                            <div className='hp-adv-card-img-overlay' />
                                            <div className='hp-adv-card-tag'>
                                                <FontAwesomeIcon icon={chunk[2].icon} /> {chunk[2].title}
                                            </div>
                                        </div>
                                        <div className='hp-adv-card-body'>
                                            <h4>{chunk[2].title}</h4>
                                            <p>{chunk[2].description}</p>
                                            {chunk[2].features && (
                                                <ul>
                                                    {chunk[2].features.map((featureText, idx) => (
                                                        <li key={idx}><span className='hp-adv-dot' />{featureText}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    );
                    });
                    })()
                }

                {/* Bottom Stat Strip */}
                <div className='hp-adv-stats reveal-item' ref={addRef}>
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

            </section >

            {/* ── GET STARTED — replaces the repeated 6-step process ── */}
            <section className="svc-start-section">
                <div className="svc-start-head reveal-item" ref={addRef}>
                    <span className="svc-section-tag">
                        <FontAwesomeIcon icon={faDraftingCompass} /> How It Works
                    </span>
                    <h2>Get Started in<br />3 Simple Steps</h2>
                    <p>From your first message to a fully transformed space — here's the journey.</p>
                </div>

                <div className="svc-start-grid">
                    {[
                        {
                            num: '01',
                            icon: faCalendarCheck,
                            title: 'Book a Free Consultation',
                            desc: 'Tell us about your space, vision and budget. Our team listens — no obligation, no pressure.',
                            cta: true,
                        },
                        {
                            num: '02',
                            icon: faCube,
                            title: 'Approve Your 3D Design',
                            desc: 'We create a photorealistic render of your space for your approval before a single nail is hammered.',
                            cta: false,
                        },
                        {
                            num: '03',
                            icon: faHandshake,
                            title: 'Move Into Your Dream Space',
                            desc: 'Our team handles everything — sourcing, execution, quality checks and final handover. You just arrive.',
                            cta: false,
                        },
                    ].map((s, i) => (
                        <div className="svc-start-card reveal-item" key={i} ref={addRef} style={{ '--delay': `${i * 100}ms` }}>
                            <div className="svc-start-card-top">
                                <span className="svc-start-num hp-prof-num">{s.num}</span>
                                <div className="svc-start-icon">
                                    <FontAwesomeIcon icon={s.icon} />
                                </div>
                            </div>
                            <h3>{s.title}</h3>
                            <p>{s.desc}</p>
                            {s.cta && (
                                <button className="svc-start-cta" onClick={() => setShowLogin(true)}>
                                    Book Now <FontAwesomeIcon icon={faArrowRight} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* ── TESTIMONIALS ── */}
            < section className="svc-testimonial-section" >
                <div className="svc-t-heading reveal-item" ref={addRef}>
                    <span className="svc-section-tag">
                        <FontAwesomeIcon icon={faQuoteLeft} /> Testimonials
                    </span>
                    <h1>What Our Clients Say</h1>
                    <p className="testimonial-subtitle">
                        Trusted by homeowners across India for luxury interiors and seamless execution.
                    </p>
                </div>

                <div className="marquee-track-wrapper">
                    <div className="marquee-track">
                        <div className="marquee-inner scroll-left">
                            {marqueeItems.map((t, i) => (
                                <div className="t-card" key={`a${i}`}>
                                    <div className="t-card-top">
                                        <div className="t-card-quote-icon"><FontAwesomeIcon icon={faQuoteLeft} /></div>
                                        <div className="t-card-stars">{Array.from({ length: t.rating }).map((_, s) => <FontAwesomeIcon icon={faStar} key={s} />)}</div>
                                    </div>
                                    <p className="t-card-text">{t.text}</p>
                                    <div className="t-card-author">
                                        <div className="t-card-avatar">
                                            {t.image ? <img src={t.image} alt={t.name} /> : t.name.charAt(0)}
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
                                        <div className="t-card-quote-icon"><FontAwesomeIcon icon={faQuoteLeft} /></div>
                                        <div className="t-card-stars">{Array.from({ length: t.rating }).map((_, s) => <FontAwesomeIcon icon={faStar} key={s} />)}</div>
                                    </div>
                                    <p className="t-card-text">{t.text}</p>
                                    <div className="t-card-author">
                                        <div className="t-card-avatar">
                                            {t.image ? <img src={t.image} alt={t.name} /> : t.name.charAt(0)}
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
            </section >

            {/* ── CTA ── */}
            < section className="services-cta reveal-item" ref={addRef} >
                <div className="cta-inner">
                    <span className="svc-section-tag">
                        <FontAwesomeIcon icon={faCrown} /> Begin Your Journey
                    </span>
                    <h1>Let's Create Your<br />Dream Interior</h1>
                    <p>
                        Elegant spaces crafted with precision, premium materials
                        and timeless modern aesthetics.
                    </p>
                    <button className="services-cta-btn" onClick={() => setShowLogin(true)}>
                        Book Free Consultation <FontAwesomeIcon icon={faCalendarCheck} />
                    </button>
                </div>
            </section >

            <Footer />
        </div >
    );
};

export default Services;
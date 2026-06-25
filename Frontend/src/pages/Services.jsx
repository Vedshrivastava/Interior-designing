import React, { useEffect, useRef, useState } from 'react';
import '../styles/services.css';
import { useNavigate } from 'react-router-dom';
import bgimg from '../assets/home-img.png';
import Footer from '../components/Footer';
import design from '../assets/refund-design.png';


import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCrown, faArrowRight, faCalendarCheck,
    faDraftingCompass, faCube, faHandshake,
    faLightbulb, faHome, faBuilding, faWrench,
    faStar, faRulerCombined,
    faQuoteLeft, faClock,
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

const services = [
    {
        icon: faHome, title: "Residential Interiors",
        description: "Bespoke home interiors for apartments and villas — designed around how you actually live.",
        features: ["100% custom, no templates", "Apartment & villa specialists"]
    },
    {
        icon: faBuilding, title: "Commercial Spaces",
        description: "Offices and retail interiors that reflect your brand and keep your team performing at their best.",
        features: ["Brand-centric design", "Ergonomic, turnkey execution"]
    },
    {
        icon: faCube, title: "3D Visualization",
        description: "Photorealistic renders of your space — see and approve every detail before execution begins.",
        features: ["Photo-realistic accuracy", "Approved before a nail is hammered"]
    },
    {
        icon: faRulerCombined, title: "Space Planning",
        description: "Smart layouts that extract every usable inch from your space without sacrificing flow or comfort.",
        features: ["Floor plan optimisation", "Flow & functionality focused"]
    },
    {
        icon: faLightbulb, title: "Lighting Design",
        description: "Ambient, accent and task lighting that defines the mood and character of every room.",
        features: ["Mood-enhancing concepts", "Natural & artificial balance"]
    },
    {
        icon: faWrench, title: "Renovation Services",
        description: "Complete makeovers or targeted upgrades — we breathe fresh life into any tired space.",
        features: ["Partial or full overhauls", "Minimal disruption approach"]
    },
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
                            <FontAwesomeIcon icon={faCrown} /> Our Craft
                        </span>
                        <h2>Every Service.<br />One Vision.</h2>
                    </div>
                    <div className="services-heading-right">
                        <p>
                            Residential retreats to commercial landmarks — every brief
                            handled from the first sketch to the final handover.
                        </p>
                    </div>
                </div>

                {/* 6-card service grid */}
                <div className="svc-grid">
                    {services.map((svc, i) => (
                        <div
                            className="svc-grid-card reveal-item"
                            ref={addRef}
                            key={i}
                            data-num={String(i + 1).padStart(2, '0')}
                            style={{ '--delay': `${i * 80}ms` }}
                        >
                            <div className="svc-card-accent" />
                            <div className="svc-card-body">
                                <div className="svc-icon-wrap">
                                    <FontAwesomeIcon icon={svc.icon} />
                                </div>
                                <h3>{svc.title}</h3>
                                <p>{svc.description}</p>
                                {svc.features && (
                                    <ul className="svc-card-features">
                                        {svc.features.map((f, idx) => (
                                            <li key={idx}>
                                                <span className="svc-feat-dot" />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

            </section>

            {/* ── WHY US ── */}
            <section className="svc-why-section">
                <div className="svc-why-head reveal-item" ref={addRef}>
                    <span className="svc-section-tag">
                        <FontAwesomeIcon icon={faHandshake} /> Why Choose Us
                    </span>
                    <h2>The Advantages<br />Our Clients Get</h2>
                </div>
                <div className="svc-why-grid">
                    {[
                        {
                            icon: faCrown,
                            title: "Affordable Luxury",
                            desc: "Premium interiors at transparent pricing — no hidden costs, ever.",
                        },
                        {
                            icon: faCalendarCheck,
                            title: "Consultation Refund",
                            desc: "Your consultation fee is fully adjusted against the final project cost.",
                        },
                        {
                            icon: faDraftingCompass,
                            title: "100% Bespoke",
                            desc: "Every design built from scratch around your life — never from a catalogue.",
                        },
                        {
                            icon: faHandshake,
                            title: "Turnkey Execution",
                            desc: "We handle sourcing, build and handover. You just walk in.",
                        },
                    ].map((item, i) => (
                        <div className="svc-why-card reveal-item" ref={addRef} key={i} style={{ '--delay': `${i * 80}ms` }}>
                            <div className="svc-why-icon">
                                <FontAwesomeIcon icon={item.icon} />
                            </div>
                            <h3>{item.title}</h3>
                            <p>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── STAT STRIP ── */}
            <section className="svc-stats-section">
                <div className="svc-stats-strip reveal-item" ref={addRef}>
                    {[
                        { icon: faStar, val: '50+', label: 'Projects Delivered' },
                        { icon: faHandshake, val: '100%', label: 'Turnkey Execution' },
                        { icon: faClock, val: '5★', label: 'Average Rating' },
                    ].map((s, i) => (
                        <div className="svc-stat-item" key={i}>
                            <div className="svc-stat-icon"><FontAwesomeIcon icon={s.icon} /></div>
                            <span className="svc-stat-val"><CountUp endValue={s.val} /></span>
                            <span className="svc-stat-lbl">{s.label}</span>
                        </div>
                    ))}
                </div>
            </section>

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
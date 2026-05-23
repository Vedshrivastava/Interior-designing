import React from 'react';
import '../styles/about.css';

import MainNavbar from '../components/mainNavbar';
import Footer from '../components/Footer';

import products from '../assets/products-img.jpg';
import services from '../assets/services-img.jpg';
import commitment from '../assets/commitment.jpg';
import logo from '../assets/logo.jpg';
import bgimg from '../assets/home-img.webp';

import { useNavigate } from 'react-router-dom';

const About = ({ setShowLogin }) => {

    const navigate = useNavigate();

    const handleButtonClick = (id) => {

        navigate('/', { replace: true });

        setTimeout(() => {

            const element = document.getElementById(id);

            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }

        }, 100);
    };

    return (

        <div className="about-page">

            {/* HERO SECTION */}

            <div className="about-hero">

                <img
                    src={bgimg}
                    alt="Luxury Interior"
                    className="about-hero-bg"
                />

                <div className="about-overlay"></div>

                <MainNavbar setShowLogin={setShowLogin} />

                <div className="about-hero-content">

                    <span className="section-tag">
                        ABOUT SHRIVASTAVAS ELEVATE
                    </span>

                    <h1>
                        Designing Timeless
                        <br />
                        Luxury Spaces
                    </h1>

                    <p>
                        Transforming residential and commercial interiors
                        with elegance, precision, and premium craftsmanship.
                    </p>

                </div>

            </div>

            {/* STATS SECTION */}

            <section className="about-stats">

                <div className="about-stat-box">
                    <h2>150+</h2>
                    <p>Projects Completed</p>
                </div>

                <div className="about-stat-box">
                    <h2>10+</h2>
                    <p>Years Warranty</p>
                </div>

                <div className="about-stat-box">
                    <h2>Premium</h2>
                    <p>Materials & Finishes</p>
                </div>

                <div className="about-stat-box">
                    <h2>100%</h2>
                    <p>Client Satisfaction</p>
                </div>

            </section>

            {/* MAIN ABOUT SECTION */}

            <section className="about-main-section">

                <div className="about-heading">

                    <span className="section-tag">
                        WHO WE ARE
                    </span>

                    <h1>
                        Elevating Spaces
                        <br />
                        With Purpose
                    </h1>

                </div>

                {/* SECTION 1 */}

                <div className="luxury-about-card">

                    <div className="luxury-about-image">
                        <img src={logo} alt="Shrivastavas Elevate" />
                    </div>

                    <div className="luxury-about-content">

                        <span className="about-number">
                            01
                        </span>

                        <h2>
                            Welcome to Shrivastavas Elevate
                        </h2>

                        <p>
                            Shrivastavas Elevate is a premium interior
                            design and contracting firm focused on creating
                            elegant, functional, and timeless spaces.
                        </p>

                        <ul>
                            <li>
                                Led by Ved Shrivastava and Shubh Shrivastava
                            </li>

                            <li>
                                Residential & commercial interior expertise
                            </li>

                            <li>
                                Luxury-focused design execution
                            </li>
                        </ul>

                    </div>

                </div>

                {/* SECTION 2 */}

                <div className="luxury-about-card reverse">

                    <div className="luxury-about-image">
                        <img src={services} alt="Interior Services" />
                    </div>

                    <div className="luxury-about-content">

                        <span className="about-number">
                            02
                        </span>

                        <h2>
                            Premium Interior Services
                        </h2>

                        <p>
                            We provide complete interior solutions tailored
                            to modern lifestyles, aesthetics, and functionality.
                        </p>

                        <ul>
                            <li>
                                Customized residential interiors
                            </li>

                            <li>
                                Commercial & workspace design
                            </li>

                            <li>
                                Consultation with refundable design fee
                            </li>

                            <li>
                                End-to-end project execution
                            </li>
                        </ul>

                        <button
                            className="about-btn"
                            onClick={() => navigate('/services')}
                        >
                            View Services
                        </button>

                    </div>

                </div>

                {/* SECTION 3 */}

                <div className="luxury-about-card">

                    <div className="luxury-about-image">
                        <img src={products} alt="Premium Materials" />
                    </div>

                    <div className="luxury-about-content">

                        <span className="about-number">
                            03
                        </span>

                        <h2>
                            Premium Materials & Products
                        </h2>

                        <p>
                            We use carefully selected premium materials to
                            ensure durability, luxury aesthetics, and long-term value.
                        </p>

                        <ul>
                            <li>
                                PVC & WPC louvers
                            </li>

                            <li>
                                Premium marble sheets
                            </li>

                            <li>
                                Decorative panels & finishes
                            </li>

                            <li>
                                High-quality modern materials
                            </li>
                        </ul>

                        <button
                            className="about-btn"
                            onClick={() => handleButtonClick('design-materials')}
                        >
                            Explore Products
                        </button>

                    </div>

                </div>

                {/* SECTION 4 */}

                <div className="luxury-about-card reverse">

                    <div className="luxury-about-image">
                        <img src={commitment} alt="Commitment" />
                    </div>

                    <div className="luxury-about-content">

                        <span className="about-number">
                            04
                        </span>

                        <h2>
                            Our Commitment To Quality
                        </h2>

                        <p>
                            Every project is executed with precision,
                            transparency, and uncompromised attention to detail.
                        </p>

                        <ul>
                            <li>
                                Premium craftsmanship standards
                            </li>

                            <li>
                                Trusted branded materials
                            </li>

                            <li>
                                Elegant & timeless execution
                            </li>

                            <li>
                                Long-lasting client relationships
                            </li>
                        </ul>

                    </div>

                </div>

            </section>

            {/* PROCESS SECTION */}

            <section className="about-process-section">

                <div className="about-heading">

                    <span className="section-tag">
                        OUR APPROACH
                    </span>

                    <h1>
                        How We Bring
                        <br />
                        Spaces To Life
                    </h1>

                </div>

                <div className="about-process-grid">

                    <div className="process-box">
                        <h2>01</h2>
                        <p>Consultation & Vision Planning</p>
                    </div>

                    <div className="process-box">
                        <h2>02</h2>
                        <p>Concept Design & Material Selection</p>
                    </div>

                    <div className="process-box">
                        <h2>03</h2>
                        <p>Execution & Site Supervision</p>
                    </div>

                    <div className="process-box">
                        <h2>04</h2>
                        <p>Luxury Finishing & Delivery</p>
                    </div>

                </div>

            </section>

            {/* CTA SECTION */}

            <section className="about-cta">

                <h1>
                    Let’s Design A Space
                    <br />
                    That Reflects You
                </h1>

                <p>
                    Elegant interiors crafted with premium materials,
                    modern aesthetics, and timeless sophistication.
                </p>

                <button
                    className="about-cta-btn"
                    onClick={() => setShowLogin(true)}
                >
                    Get Started
                </button>

            </section>

            <Footer />

        </div>
    );
};

export default About;

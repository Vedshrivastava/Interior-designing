import React from 'react';
import '../styles/services.css';

import rates from '../assets/rates.png';
import design from '../assets/refund-design.jpg';
import residence from '../assets/residence.webp';
import commercial from '../assets/commercial.webp';
import renovation from '../assets/renovation.webp';
import bgimg from '../assets/home-img.webp';
import Footer from '../components/Footer';

const services = [
  {
    title: "Unbeatable Rates, Uncompromised Quality",
    image: rates,
    description:
      "We combine affordability with premium craftsmanship to deliver elegant interiors without compromising quality.",
    points: [
      "Transparent pricing with no hidden costs",
      "Premium materials & expert execution",
      "Luxury finishes within your budget"
    ]
  },

  {
    title: "Design Consultation with Refund Option",
    image: design,
    description:
      "Our consultation process helps us deeply understand your vision, lifestyle, and spatial requirements.",
    points: [
      "Professional planning & design guidance",
      "Refundable consultation on project confirmation",
      "Personalized interior recommendations"
    ]
  },

  {
    title: "Custom Residential Design & Contracting",
    image: residence,
    description:
      "From apartments to luxury villas, we design homes that blend functionality, comfort, and timeless aesthetics.",
    points: [
      "Modern luxury interior concepts",
      "End-to-end project execution",
      "Tailored designs for your lifestyle"
    ]
  },

  {
    title: "Innovative Commercial Design",
    image: commercial,
    description:
      "We create inspiring commercial spaces that improve productivity, branding, and customer experience.",
    points: [
      "Office & retail interior solutions",
      "Brand-focused design approach",
      "Efficient layouts & elegant finishes"
    ]
  },

  {
    title: "Comprehensive Renovation Services",
    image: renovation,
    description:
      "Whether it’s a minor makeover or complete transformation, we bring fresh life into outdated spaces.",
    points: [
      "Complete renovation planning",
      "Structural & aesthetic upgrades",
      "On-time project delivery"
    ]
  },

  {
    title: "Space Planning & Layout Optimization",
    image: residence,
    description:
      "We maximize every inch of your space with thoughtful layouts that improve functionality and flow.",
    points: [
      "Efficient space utilization",
      "Furniture & lighting planning",
      "Balanced aesthetics & usability"
    ]
  },

  {
    title: "Lighting Design & Installation",
    image: residence,
    description:
      "Lighting defines mood and atmosphere. We create elegant lighting setups tailored to your interiors.",
    points: [
      "Ambient, accent & task lighting",
      "Luxury modern lighting concepts",
      "Energy-efficient solutions"
    ]
  }
];

const Services = ({ setShowLogin }) => {

  return (
    <div className="services-page">

      {/* HERO SECTION */}

      <div className="services-hero">

        <img
          src={bgimg}
          alt="Luxury Interior"
          className="services-hero-bg"
        />

        <div className="services-overlay"></div>

        <div className="services-hero-content">

          <span className="section-tag">
            PREMIUM INTERIOR SERVICES
          </span>

          <h1>
            Crafted Interiors
            <br />
            Designed To Elevate
          </h1>

          <p>
            We deliver luxury interior design and contracting solutions
            tailored to modern lifestyles, functionality, and timeless elegance.
          </p>

        </div>
      </div>

      {/* TRUST STATS */}

      <section className="services-stats">

        <div className="services-stat-box">
          <h2>150+</h2>
          <p>Projects Completed</p>
        </div>

        <div className="services-stat-box">
          <h2>10+</h2>
          <p>Years Warranty</p>
        </div>

        <div className="services-stat-box">
          <h2>100%</h2>
          <p>Client Satisfaction</p>
        </div>

        <div className="services-stat-box">
          <h2>Premium</h2>
          <p>Materials & Finishes</p>
        </div>

      </section>

      {/* SERVICES SECTION */}

      <section className="services-main-section">

        <div className="services-heading">

          <span className="section-tag">
            WHAT WE OFFER
          </span>

          <h1>
            Interior Services
            <br />
            Tailored For You
          </h1>

        </div>

        {services.map((service, index) => (

          <div
            className={`luxury-service-card ${
              index % 2 !== 0 ? 'reverse' : ''
            }`}
            key={index}
          >

            <div className="luxury-service-image">

              <img
                src={service.image}
                alt={service.title}
              />

            </div>

            <div className="luxury-service-content">

              <span className="service-number">
                0{index + 1}
              </span>

              <h2>{service.title}</h2>

              <p>{service.description}</p>

              <ul>

                {service.points.map((point, idx) => (
                  <li key={idx}>{point}</li>
                ))}

              </ul>

            </div>

          </div>

        ))}

      </section>

      {/* PROCESS SECTION */}

      <section className="services-process-section">

        <div className="services-heading">

          <span className="section-tag">
            OUR PROCESS
          </span>

          <h1>
            How We Transform
            <br />
            Your Space
          </h1>

        </div>

        <div className="services-process-grid">

          <div className="process-box">
            <h2>01</h2>
            <p>Consultation & Planning</p>
          </div>

          <div className="process-box">
            <h2>02</h2>
            <p>Concept & 3D Design</p>
          </div>

          <div className="process-box">
            <h2>03</h2>
            <p>Execution & Supervision</p>
          </div>

          <div className="process-box">
            <h2>04</h2>
            <p>Final Styling & Delivery</p>
          </div>

        </div>

      </section>

      {/* CTA SECTION */}

      <section className="services-cta">

        <h1>
          Let’s Create Your
          <br />
          Dream Interior
        </h1>

        <p>
          Elegant spaces crafted with precision, premium materials,
          and timeless modern aesthetics.
        </p>

        <button
          className="services-cta-btn"
          onClick={() => setShowLogin(true)}
        >
          Get Started
        </button>

      </section>

      <Footer />

    </div>
  );
};

export default Services;
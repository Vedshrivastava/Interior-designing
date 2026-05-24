import React from 'react';
import '../styles/home.css';
import '../styles/lux-pattern.css';
import bgimg from '../assets/home-img.webp';
import kitchen_img from '../assets/kitchen-img.jpg';
import bathroom_img from '../assets/bathroom-img.jpg';
import kids_img from '../assets/kids-room-img.jpg';
import house_img from '../assets/house-exterior-img.png';
import projects_50 from '../assets/50+projects.jpg';
import experience_5 from '../assets/5+experience.png';
import custom_100 from '../assets/100_custom.png';
import turnkey from '../assets/turnkey.png';
import TV_unit_img from '../assets/TV-unit-img.png';
import lounge_img from '../assets/lounge-img.jpg';
import bedroom_img from '../assets/bedroom-image.png';
import shop_img from '../assets/shop-img.jpeg';
import kajaria from '../assets/kajaria.png';
import saint_gobain from '../assets/Saint-Gobain.jpg';
import asian_paints from '../assets/asian-paints.jpeg';
import centuryply from '../assets/centuryply.png';

import residence from '../assets/residence.png';
import commercial from '../assets/commercial.webp';
import mandir from '../assets/mandir-img.png';
import garden from '../assets/garden-img.png';

import design from '../assets/refund-design.png';
import rates from '../assets/rates.png';

import Card from '../components/card';
import WhyChooseUs from '../components/why-choose-us';
import Footer from '../components/Footer';

import { useNavigate } from 'react-router-dom';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCrown,
  faPalette,
  faBuilding,
  faArrowRight,
  faCalendarCheck,
  faRocket,
  faClock,
  faCheck,
  faCubes,
  faUtensils,
  faBed,
  faBath,
  faCouch,
  faTv,
  faChild,
  faDraftingCompass,
  faCube,
  faBoxes,
  faHammer,
  faHandshake,
  faHome,
  faStore,
  faQuoteLeft,
  faCheckCircle,
  faIndustry,
  faStar,
  faWandMagicSparkles
} from '@fortawesome/free-solid-svg-icons';

const Home = ({ setShowLogin }) => {

  const navigate = useNavigate();

  const handleProjects = () => {
    navigate('/projects');
  };

  return (
    <div className='home-page'>

      {/* HERO SECTION */}
      <div className="home-container">

        <img src={bgimg} alt="Background" className="background-image" />
        <div className="overlay"></div>


        <header className="hero-section">

          <div className="hero-content">

            <span className='premium-tag'>
              <FontAwesomeIcon icon={faCrown} /> Luxury Interior Design Studio
            </span>

            <h1>
              Shrivastavas Elevate
            </h1>

            <p className='hero-description'>
              Crafting timeless interiors with luxury, precision and turnkey execution.
            </p>

            <p className='underline'>
              <FontAwesomeIcon icon={faBuilding} /> Interior Designers & Contractors
            </p>

            <div className='hero-buttons'>

              <button onClick={handleProjects} className="hero-button">
                Explore Projects <FontAwesomeIcon icon={faArrowRight} />
              </button>

              <button onClick={() => setShowLogin(true)} className="secondary-hero-button">
                Book Consultation <FontAwesomeIcon icon={faCalendarCheck} />
              </button>

            </div>

          </div>

        </header>
      </div>

      {/* TRUST STATS */}
      <section className='stats-section'>

        <div className='stat-box image-box'>
          <img src={projects_50} />
        </div>

        <div className='stat-box image-box'>
          <img src={experience_5} />
        </div>

        <div className='stat-box image-box'>
          <img src={custom_100} />
        </div>

        <div className='stat-box image-box'>
          <img src={turnkey} />
        </div>

      </section>

      {/* DESIGN SECTION */}
      <section className='card-area'>

        <div className='contents'>
          <span className='section-tag'>
            <FontAwesomeIcon icon={faPalette} /> Our Expertise
          </span>

          <h1>Choose From Our Designs</h1>

          <p>
            Explore thoughtfully crafted interiors designed
            for luxury, comfort and functionality.
          </p>
        </div>

        <div className="cards">

          <Card
            image={kitchen_img}
            category="Kitchen Designs"
            heading={<><FontAwesomeIcon icon={faUtensils} /> Kitchen Designs</>}
            description="Modern modular kitchen concepts"
          />

          <Card
            image={bedroom_img}
            category="Bedroom Designs"
            heading={<><FontAwesomeIcon icon={faBed} /> Bedroom Designs</>}
            description="Elegant and luxurious bedroom interiors"
          />

          <Card
            image={bathroom_img}
            category="Bathroom Designs"
            heading={<><FontAwesomeIcon icon={faBath} /> Bathroom Designs</>}
            description="Minimal and premium bathroom aesthetics"
          />

          <Card
            image={lounge_img}
            category="Lounge area Designs"
            heading={<><FontAwesomeIcon icon={faCouch} /> Lounge Designs</>}
            description="Luxury lounge and living spaces"
          />

          <Card
            image={TV_unit_img}
            category="TV Unit Designs"
            heading={<><FontAwesomeIcon icon={faTv} /> TV Unit Designs</>}
            description="Modern entertainment wall concepts"
          />

          <Card
            image={kids_img}
            category="Kids Room Designs"
            heading={<><FontAwesomeIcon icon={faChild} /> Kids Room Designs</>}
            description="Creative and functional spaces"
          />

        </div>

        <div className="view-more-container">
          <button onClick={handleProjects} className='view-project-btn'>
            View More Designs <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>

      </section>

      {/* WHY CHOOSE US (UNCHANGED COMPONENT) */}
      <WhyChooseUs />

      {/* PROCESS SECTION */}
      <section className='process-section'>

        <div className='contents'>
          <span className='section-tag'>
            <FontAwesomeIcon icon={faDraftingCompass} /> Our Process
          </span>

          <h1>How We Transform Your Space</h1>
        </div>

        <div className='process-grid'>

          <div className='process-card'><h2>01</h2><p><FontAwesomeIcon icon={faDraftingCompass} /> Consultation</p></div>
          <div className='process-card'><h2>02</h2><p><FontAwesomeIcon icon={faCube} /> Space Planning</p></div>
          <div className='process-card'><h2>03</h2><p><FontAwesomeIcon icon={faCubes} /> 3D Visualization</p></div>
          <div className='process-card'><h2>04</h2><p><FontAwesomeIcon icon={faBoxes} /> Material Selection</p></div>
          <div className='process-card'><h2>05</h2><p><FontAwesomeIcon icon={faHammer} /> Execution</p></div>
          <div className='process-card'><h2>06</h2><p><FontAwesomeIcon icon={faHandshake} /> Final Handover</p></div>

        </div>

      </section>

      {/* SERVICES */}
      <section className='services-section'>

        <div className='contents'>
          <span className='section-tag'>
            <FontAwesomeIcon icon={faHome} /> Client Benefits
          </span>

          <h1>Advantages Our Clients Get</h1>
        </div>

        {/* SERVICE 1 */}
        <div className="service-item luxury-frame">

          <div className="service-image">
            <div className="image-frame">
              <div className="pattern-bar left"></div>
              <img src={rates} alt="" />
              <div className="pattern-bar right"></div>
            </div>
          </div>

          <div className="service-content">
            <div className="luxury-divider top"></div>

            <h3>
              <FontAwesomeIcon icon={faCubes} /> Affordable Luxury
            </h3>

            <p>
              Premium interiors with transparent pricing and zero hidden costs,
              ensuring luxury stays accessible.
            </p>

            <div className="luxury-divider bottom"></div>
          </div>

        </div>

        {/* SERVICE 2 */}
        <div className="service-item reverse luxury-frame">

          <div className="service-image">
            <div className="image-frame">
              <div className="pattern-bar left"></div>
              <img src={design} alt="" />
              <div className="pattern-bar right"></div>
            </div>
          </div>

          <div className="service-content">

            <div className="luxury-divider top"></div>

            <h3>
              <FontAwesomeIcon icon={faCheck} /> Design Consultation Refund
            </h3>

            <p>
              Your consultation fee is fully adjusted when you proceed with execution,
              making the design process risk-free.
            </p>

            <div className="luxury-divider bottom"></div>

          </div>

        </div>

        {/* SERVICE 3 */}
        <div className="service-item luxury-frame">

          <div className="service-image">
            <div className="image-frame">
              <div className="pattern-bar left"></div>
              <img src={residence} alt="" />
              <div className="pattern-bar right"></div>
            </div>
          </div>

          <div className="service-content">

            <div className="luxury-divider top"></div>

            <h3>
              <FontAwesomeIcon icon={faHome} /> Custom Residential Interiors
            </h3>

            <p>
              Tailor-made home interiors designed around your lifestyle, comfort,
              and daily functionality needs.
            </p>

            <div className="luxury-divider bottom"></div>

          </div>

        </div>

      </section>

      {/* TESTIMONIALS */}
      <section className='testimonial-section'>

        <div className='contents'>
          <span className='section-tag'>
            <FontAwesomeIcon icon={faQuoteLeft} /> Testimonials
          </span>
          <h1>What Our Clients Say</h1>
        </div>

        <div className='testimonial-grid'>

          {/* Card 1 */}
          <div className='testimonial-card'>
            <div className='avatar-container'>
              <img src="https://via.placeholder.com/100" alt="Rahul Mehta" />
            </div>

            <div className='client-info'>
              <h4>Rahul Mehta</h4>
              <span className='client-company'>Mumbai, IN</span>
            </div>

            <p>
              “Exceptional execution and luxurious finishing. The team transformed our home beyond expectations.”
            </p>

            <div className='bottom-badge'>
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
          </div>

          {/* Card 2 */}
          <div className='testimonial-card'>
            <div className='avatar-container'>
              <img src="https://via.placeholder.com/100" alt="Priya Sharma" />
            </div>

            <div className='client-info'>
              <h4>Priya Sharma</h4>
              <span className='client-company'>Delhi, IN</span>
            </div>

            <p>
              “Their design sense is outstanding. Every corner of our apartment feels premium and thoughtfully designed.”
            </p>

            <div className='bottom-badge'>
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
          </div>

          {/* Card 3 */}
          <div className='testimonial-card'>
            <div className='avatar-container'>
              <img src="https://via.placeholder.com/100" alt="Aman Verma" />
            </div>

            <div className='client-info'>
              <h4>Aman Verma</h4>
              <span className='client-company'>Bangalore, IN</span>
            </div>

            <p>
              “Professional, transparent, and highly skilled team. The 3D design matched the final output perfectly.”
            </p>

            <div className='bottom-badge'>
              <FontAwesomeIcon icon={faCheckCircle} />
            </div>
          </div>

        </div>
      </section>

      {/* BRANDS */}
      <section className='brands-section'>

        <div className='contents'>
          <span className='section-tag'>
            <FontAwesomeIcon icon={faIndustry} /> Premium Materials
          </span>

          <h1>Trusted Material Partners</h1>
        </div>

        <div className='brands-grid'>

          <img src={kajaria} alt="CenturyPly" />
          <img src={saint_gobain} alt="CenturyPly" />
          <img src={asian_paints} alt="CenturyPly" />
          <img src={centuryply} alt="CenturyPly" />
          <img src="https://via.placeholder.com/100" alt="CenturyPly" />
          <img src="https://via.placeholder.com/100" alt="CenturyPly" />
          <img src="https://via.placeholder.com/100" alt="CenturyPly" />
          <img src="https://via.placeholder.com/100" alt="CenturyPly" />
          <img src="https://via.placeholder.com/100" alt="CenturyPly" />
          <img src="https://via.placeholder.com/100" alt="CenturyPly" />
          <img src="https://via.placeholder.com/100" alt="CenturyPly" />
          <img src="https://via.placeholder.com/100" alt="CenturyPly" />
          <img src="https://via.placeholder.com/100" alt="CenturyPly" />
          <img src="https://via.placeholder.com/100" alt="CenturyPly" />
        </div>

      </section>

      {/* CTA */}
      <section className='cta-section'>

        <h1>
          <FontAwesomeIcon icon={faWandMagicSparkles} /> Ready to Transform Your Space?
        </h1>

        <button onClick={() => setShowLogin(true)} className='hero-button'>
          Get Free Consultation <FontAwesomeIcon icon={faCalendarCheck} />
        </button>

      </section>

      <Footer />

    </div>
  );
};

export default Home;
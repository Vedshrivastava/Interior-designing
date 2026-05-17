import React from 'react';
import '../styles/home.css'
import bgimg from '../assets/home-img.webp';
import kitchen_img from '../assets/kitchen-img.jpg'
import bathroom_img from '../assets/bathroom-img.jpg'
import kids_img from '../assets/kids-room-img.jpg'
import house_img from '../assets/house-exterior-img.png'
import TV_unit_img from '../assets/TV-unit-img.png'
import lounge_img from '../assets/lounge-img.jpg'
import bedroom_img from '../assets/bedroom-image.png'
import shop_img from '../assets/shop-img.jpeg'
import pvc_louver from '../assets/pvc-louver.webp'
import wpc_louver from '../assets/wpc-louver.webp'
import charcoal_louver from '../assets/charcoal-louver.webp'
import pvc_panels from '../assets/pvc-sheets.jpg'
import acrylic_sheet from '../assets/acrylic.jpg'
import marble_sheet from '../assets/marble-sheet.webp'
import flooring from '../assets/flooring.jpg'
import residence from '../assets/residence.webp'
import commercial from '../assets/commercial.webp'
import mandir from '../assets/mandir-img.png'
import garden from '../assets/garden-img.png'
import renovation from '../assets/renovation.webp'
import design from '../assets/refund-design.jpg'
import rates from '../assets/rates.jpg'
import Card from '../components/card';
import WhyChooseUs from '../components/why-choose-us';
import Footer from '../components/Footer';
import MainNavbar from '../components/mainNavbar';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';

const Home = ({ setShowLogin }) => {

  const navigate = useNavigate();

  const handleButtonClick = () => {
    navigate('/projects');
  };

  return (
    <div>
      <div className="home-container">
        <img src={bgimg} alt="Background" className="background-image" />
        <MainNavbar setShowLogin={setShowLogin} />
        {/* Hero Section */}
        <header className="hero-section">
          <div className="hero-content">
            <h1>Shrivastavas Elevate</h1>
            <p>"Designing Space where your imagination meets reality."</p>
            <p className='underline'>Designers & Contractors</p>
            <button onClick={() => setShowLogin(true)} className="hero-button">Get Started</button>
          </div>
        </header>
      </div>

      <div className='card-area'>
        <div className='contents'>
          <h1>Choose from our Designs</h1>
          <p>You can either customise or can save time by choosing from a number of designs available here, from kitchens to bathrooms, you can find everything here at a reasonable rate.</p>
        </div>
        <div className="cards">
          <Card
            image={kitchen_img}
            heading="Kitchen Designs"
            description="Modular kitchens, simple kithchens and much more..."
          />
          <Card
            image={bedroom_img}
            heading="Bedroom Designs"
            description="Bedroom interiors, stylish furnishings, and much more..."
          />
          <Card
            image={bathroom_img}
            heading="Bathroom Designs"
            description="Bathroom interior, elegant designs, and much more.."
          />
          <Card
            image={lounge_img}
            heading="Lounge area Designs"
            description="Lounge interior, cozy designs, and much more.."
          />
          <Card
            image={TV_unit_img}
            heading="TV Unit Designs"
            description="Luxury, acoustic designs, and much more.."
          />
          <Card
            image={kids_img}
            heading="Kids Room Designs"
            description="playful functional themes, and much more.."
          />
          <Card
            image={shop_img}
            heading="Commercial Designs"
            description="Modern workspaces, retail designs, etc.."
          />
          <Card
            image={mandir}
            heading="Mandir Designs"
            description="Modern facades, landscaping designs, etc.."
          />
          <Card
            image={garden}
            heading="Garden Designs"
            description="Modern facades, landscaping designs, etc.."
          />
          <Card
            image={house_img}
            heading="House Exterior Designs"
            description="Modern facades, landscaping designs, etc.."
          />
        </div>
      </div>

      <WhyChooseUs />

      <main>
        <section id="services" className="services-section">
          <h2>Advantages our clients get</h2>

          <div className="service-item">
            <div className="service-image">
              <img src={rates} alt="Residential Design" />
            </div>
            <div className="service-content">
              <h3>Unbeatable Rates, Uncompromised Quality</h3>
              <p>
                We offer custom design and contracting services that are both cost-effective and high-quality, ensuring your project is completed on time and within budget. Our team is committed to delivering excellence in every detail, from initial design concepts to the final touches. We prioritize long-lasting solutions that not only fit your needs but also enhance the aesthetics and functionality of your space.
              </p>
              <p>
                By focusing on value, we help you get the best of both worlds: affordability and quality. Our relationships with trusted suppliers and contractors allow us to deliver top-tier results without breaking the bank, making exceptional design accessible for everyone.
              </p>
            </div>
          </div>

          <div className="service-item reverse">
            <div className="service-image">
              <img src={design} alt="Commercial Design" />
            </div>
            <div className="service-content">
              <h3>Design Consultation with Refund Option</h3>
              <p>
                Pay for your design consultation and have it refunded once you proceed with the project. We believe in full transparency and value your commitment to creating something great. Our design consultation is more than just an hour-long meeting; it’s an opportunity for us to understand your vision, needs, and the specifics of your space, ensuring that we can offer the best solutions possible.
              </p>
              <p>
                We believe that building trust starts early in the process, which is why we offer this refund option. We want you to feel confident in your decision to move forward with us, knowing that we’re dedicated to bringing your ideas to life with professionalism and passion.
              </p>
            </div>
          </div>

          <div className="service-item">
            <div className="service-image">
              <img src={residence} alt="Residential Design" />
            </div>
            <div className="service-content">
            <h3>Custom Residential Design & Contracting</h3>
                    <p>
                        Whether it's a cozy apartment or a sprawling estate, our residential design services are crafted to suit your vision. We blend comfort, functionality, and aesthetics to create spaces that feel like home. Our team takes into account not just the layout and style, but also the flow of space, light, and how it adapts to your lifestyle.
                    </p>
                    <p>
                        From concept to construction, we’re with you every step of the way, providing detailed plans, material selections, and project management to ensure your vision is realized. Whether you're renovating or building from scratch, we create spaces that reflect your personal taste while maximizing comfort and efficiency.
                    </p>
            </div>
          </div>
          {/* Add more project items here as needed */}
          <div className="view-more-container">
            <a href="/projects" className="view-more-link">View Projects<FontAwesomeIcon icon={faChevronRight} /></a>
          </div>
        </section>
      </main>
      <Footer />

    </div>
  )
};

export default Home;

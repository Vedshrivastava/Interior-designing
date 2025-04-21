import React from 'react';
import '../styles/home.css'
import bgimg from '../assets/home-img.webp';
import kitchen_img from '../assets/kitchen-img.jpg'
import bathroom_img from '../assets/bathroom-img.jpg'
import kids_img from '../assets/kids-room-img.jpg'
import house_img from '../assets/house-exterior-img.jpg'
import cinema_img from '../assets/cinema-img.avif'
import lounge_img from '../assets/lounge-img.jpg'
import bedroom_img from '../assets/bedroom-img.jpeg'
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
            <h1>Shrivastava's Elevate</h1>
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
            image={cinema_img}
            heading="Home Cinema Designs"
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
            image={house_img}
            heading="House Exterior"
            description="Modern facades, landscaping designs, etc.."
          />
        </div>
        <div className='contents' id='design-materials'>
          <h1>Choose from our Design Materials</h1>
          <p>You can customise your place by selecting through a number of quality products available here at best price.</p>
        </div>
        <div className='cards'>
          <Card
            image={pvc_louver}
            heading="PVC Louvers"
            description="PVC louvers, stylish, durable, and versatile."
          />
          <Card
            image={wpc_louver}
            heading="WPC Louvers"
            description="WPC louvers, eco-friendly, sturdy, and elegant."
          />
          <Card
            image={charcoal_louver}
            heading="Charcoal Louvers"
            description="Charcoal louvers, sleek, modern, and durable."
          />
          <Card
            image=""
            heading="Five G Louvers"
            description="Efficient, innovative, and modern Louvers."
          />
          <Card
            image={marble_sheet}
            heading="Marble sheets"
            description="Marble sheets, elegant, durable, and luxurious."
          />
          <Card
            image={acrylic_sheet}
            heading="Acrylic Sheets"
            description="Lightweight, versatile, and durable."
          />
          <Card
            image={flooring}
            heading="Flooring"
            description="Floor panels, Stylish, Efficient and durable."
          />
          <Card
            image={pvc_panels}
            heading="PVC Panels"
            description="Lightweight, durable, and versatile Panels."
          />
        </div>
      </div>

      <WhyChooseUs />

      {/* Main Content */}
      <main>
        <section id="services" className="services-section">
          <h2>Our Services</h2>

          <div className="service-item">
            <div className="service-image">
              <img src={rates} alt="Residential Design" />
            </div>
            <div className="service-content">
              <h3>Exceptional Craftsmanship at Unbeatable Rates</h3>
              <p>
                At VS Interiors, we pride ourselves on delivering top-quality interior design and contracting services at competitive prices. Our team of experts is committed to transforming your vision into reality, combining creativity, precision, and attention to detail. Whether it's residential or commercial projects, we ensure that our clients receive the best value for their investment without compromising on quality. Experience luxury and functionality, all within your budget, and let us create spaces that inspire and elevate your everyday living.
              </p>
            </div>
          </div>

          <div className="service-item reverse">
            <div className="service-image">
              <img src={design} alt="Commercial Design" />
            </div>
            <div className="service-content">
              <h3>Refundable Design</h3>
              <p>
                If the Contract is finalized and awarded to us after the design fee has been paid, we will gladly refund the design fees in full. This policy ensures that you have the flexibility to move forward with your project with confidence, knowing that your initial investment is safeguarded. Please note that this refund policy is applicable only if the contract is signed and the project progresses as planned. If there are any additional terms or conditions related to the refund, they will be outlined in the contract agreement to ensure transparency and mutual understanding.              </p>
            </div>
          </div>

          <div className="service-item">
            <div className="service-image">
              <img src={residence} alt="Residential Design" />
            </div>
            <div className="service-content">
              <h3>Residential Design and Contract</h3>
              <p>
                Create your dream home with our customized interior solutions, tailored to meet your unique style and functional needs. Whether you prefer a modern, minimalist design or a cozy, traditional feel, our expert designers work closely with you to craft spaces that reflect your personality. From selecting the perfect color palettes to choosing high-quality materials, we ensure every detail contributes to a harmonious and comfortable living environment that you'll love coming home to every day.
              </p>
            </div>
          </div>

          <div className="service-item reverse">
            <div className="service-image">
              <img src={commercial} alt="Commercial Design" />
            </div>
            <div className="service-content">
              <h3>Commercial Design and Contract</h3>
              <p>
                Enhance your business space to reflect your brand identity and create an environment that resonates with both your clients and employees. Our team specializes in designing functional, aesthetically pleasing commercial spaces that not only look great but also optimize productivity and flow. Whether it's a sleek office, a welcoming retail store, or a dynamic workspace, we tailor every element to align with your brand's vision and values, ensuring that your business makes a lasting impression.
              </p>
            </div>
          </div>

          <div className="service-item">
            <div className="service-image">
              <img src={renovation} alt="Renovation" />
            </div>
            <div className="service-content">
              <h3>Renovation</h3>
              <p>
                Modernize and upgrade your space with our comprehensive renovation services, designed to breathe new life into your home or business. Whether you're looking to refresh a single room or undertake a full-scale transformation, our experienced team will guide you through every step of the process. From reimagining layouts to incorporating the latest trends in design and technology, we ensure that your newly renovated space is both stylish and functional, enhancing its value and appeal for years to come.
              </p>
            </div>
          </div>
        </section>
        </main>


        <main>
        <section id="services" className="services-section">
          <h2>Our Projects</h2>

          <div className="service-item">
            <div className="service-image">
              <img src={rates} alt="Residential Design" />
            </div>
            <div className="service-content">
              <h3>Exceptional Craftsmanship at Unbeatable Rates</h3>
              <p>
                At VS Interiors, we pride ourselves on delivering top-quality interior design and contracting services at competitive prices. Our team of experts is committed to transforming your vision into reality, combining creativity, precision, and attention to detail. Whether it's residential or commercial projects, we ensure that our clients receive the best value for their investment without compromising on quality. Experience luxury and functionality, all within your budget, and let us create spaces that inspire and elevate your everyday living.
              </p>
            </div>
          </div>

          <div className="service-item reverse">
            <div className="service-image">
              <img src={design} alt="Commercial Design" />
            </div>
            <div className="service-content">
              <h3>Refundable Design</h3>
              <p>
                If the Contract is finalized and awarded to us after the design fee has been paid, we will gladly refund the design fees in full. This policy ensures that you have the flexibility to move forward with your project with confidence, knowing that your initial investment is safeguarded. Please note that this refund policy is applicable only if the contract is signed and the project progresses as planned. If there are any additional terms or conditions related to the refund, they will be outlined in the contract agreement to ensure transparency and mutual understanding.              </p>
            </div>
          </div>

          <div className="service-item">
            <div className="service-image">
              <img src={residence} alt="Residential Design" />
            </div>
            <div className="service-content">
              <h3>Residential Design and Contract</h3>
              <p>
                Create your dream home with our customized interior solutions, tailored to meet your unique style and functional needs. Whether you prefer a modern, minimalist design or a cozy, traditional feel, our expert designers work closely with you to craft spaces that reflect your personality. From selecting the perfect color palettes to choosing high-quality materials, we ensure every detail contributes to a harmonious and comfortable living environment that you'll love coming home to every day.
              </p>
            </div>
          </div>

          <div className="service-item reverse">
            <div className="service-image">
              <img src={commercial} alt="Commercial Design" />
            </div>
            <div className="service-content">
              <h3>Commercial Design and Contract</h3>
              <p>
                Enhance your business space to reflect your brand identity and create an environment that resonates with both your clients and employees. Our team specializes in designing functional, aesthetically pleasing commercial spaces that not only look great but also optimize productivity and flow. Whether it's a sleek office, a welcoming retail store, or a dynamic workspace, we tailor every element to align with your brand's vision and values, ensuring that your business makes a lasting impression.
              </p>
            </div>
          </div>

          <div className="service-item">
            <div className="service-image">
              <img src={renovation} alt="Renovation" />
            </div>
            <div className="service-content">
              <h3>Renovation</h3>
              <p>
                Modernize and upgrade your space with our comprehensive renovation services, designed to breathe new life into your home or business. Whether you're looking to refresh a single room or undertake a full-scale transformation, our experienced team will guide you through every step of the process. From reimagining layouts to incorporating the latest trends in design and technology, we ensure that your newly renovated space is both stylish and functional, enhancing its value and appeal for years to come.
              </p>
            </div>
          </div>
          {/* Add more project items here as needed */}
          <div className="view-more-container">
            <a href="/projects" className="view-more-link">View More Projects<FontAwesomeIcon icon={faChevronRight} /></a>
          </div>
        </section>
      </main>
      <Footer />

    </div>
  )
};

export default Home;

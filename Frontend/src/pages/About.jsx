// frontend/src/components/About.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/about.css';
import MainNavbar from '../components/mainNavbar';
import products from '../assets/products-img.jpg';
import services from '../assets/services-img.jpg';
import commitment from '../assets/commitment.jpg';
import Footer from '../components/Footer';
import '../styles/footer.css';
import logo from '../assets/logo.jpg'
import { useNavigate } from 'react-router-dom';

const About = ({ setShowLogin }) => {
    const [data, setData] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        axios.get('/api/about')
            .then(response => {
                setData(response.data);
            })
            .catch(error => {
                console.error('There was an error fetching the about data!', error);
            });
    }, []);

    if (!data) {
        return <div>Loading...</div>;
    }

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
        <div className="about-container">
            <MainNavbar setShowLogin={setShowLogin} />

            <h1>About Shrivastavas Elevate</h1>

            <section className="about-section">
                <img src={logo} alt="Welcome to Shrivastavas Elevate" className="about-image" />
                <div className="about-text">
                    <h2>Welcome to Shrivastavas Elevate</h2>
                    <p>
                        Shrivastavas Elevate is a dynamic interior design company committed to transforming spaces with elegance and precision. Our leadership includes <strong>Ved Shrivastava</strong> as the Director, <strong>Shubh Shrivastava</strong> as the Designer, Creative Head and the head consultant, and <strong>Pranjay Gautam</strong> as the CEO.
                    </p>
                    <p>
                        Backed by the <strong>Indian Corporation Group Of Companies Builders and Developers</strong> through strategic joint ventures, we proudly lead the design execution for many of their prestigious interior projects. This collaboration reflects our trusted reputation in the industry and our capacity to handle large-scale commercial designs while maintaining attention to detail in residential projects.
                    </p>
                </div>
            </section>

            <section className="about-section">
                <img src={services} alt="Our Services" className="about-image" />
                <div className="about-text">
                    <h2>Our Services</h2>
                    <p>We offer a comprehensive suite of interior design services, including:</p>
                    <p>- Customized interior design contracts for residential and commercial projects.</p>
                    <p>- Professional design consultations to bring your vision to life.</p>
                    <p>- Refund of the design fee if you choose to proceed with our contract.</p>
                    <p>- Competitive pricing due to our minimal margin approach, providing you the best rates for interior design projects.</p>
                    <button className='about-services' onClick={() => handleButtonClick('services')} >Services</button>
                </div>
            </section>

            <section className="about-section">
                <img src={products} alt="Quality Products" className="about-image" />
                <div className="about-text">
                    <h2>Quality Products</h2>
                    <p>We pride ourselves on using only the finest materials in our designs. Our products include:</p>
                    <p>- PVC louvers for durable and stylish ventilation solutions.</p>
                    <p>- Panels that offer both aesthetic appeal and functionality.</p>
                    <p>- Marble sheets from renowned brands for a luxurious finish.</p>
                    <p>- And many more...</p>
                    <button className='see-products' onClick={() => handleButtonClick('design-materials')} >See Products</button>
                </div>
            </section>

            <section className="about-section">
                <img src={commitment} alt="Our Commitment" className="about-image" />
                <div className="about-text">
                    <h2>Our Commitment</h2>
                    <p>
                        At Shrivastavas Elevate, we are dedicated to providing the highest quality interior design solutions. We exclusively use products from Decostar, a renowned brand known for its exceptional quality and reliability. Our focus on quality ensures that every project we undertake meets the highest standards.
                    </p>
                </div>
            </section>

            <div className="footer-wrapper">
                <Footer />
            </div>
        </div>
    );
};

export default About;

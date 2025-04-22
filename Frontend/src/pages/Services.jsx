import React from 'react';
import '../styles/services.css';
import rates from '../assets/rates.jpg';
import design from '../assets/refund-design.jpg';
import residence from '../assets/residence.webp';
import commercial from '../assets/commercial.webp';
import renovation from '../assets/renovation.webp';
import MainNavbar from '../components/mainNavbar';
import Footer from '../components/Footer';

const Services = ({setShowLogin}) => {
    return (
        <div className="new-services-container">
            <MainNavbar setShowLogin={setShowLogin} />

            <h1 className="new-services-title">Our Interior Design Services</h1>

            <div className="new-services-section">
                <div className="new-services-text">
                    <h2>Unbeatable Rates, Uncompromised Quality</h2>
                    <p>
                        We offer custom design and contracting services that are both cost-effective and high-quality, ensuring your project is completed on time and within budget. Our team is committed to delivering excellence in every detail, from initial design concepts to the final touches. We prioritize long-lasting solutions that not only fit your needs but also enhance the aesthetics and functionality of your space.
                    </p>
                    <p>
                        By focusing on value, we help you get the best of both worlds: affordability and quality. Our relationships with trusted suppliers and contractors allow us to deliver top-tier results without breaking the bank, making exceptional design accessible for everyone.
                    </p>
                </div>
                <img src={rates} alt="Affordable Rates" className="new-services-image" />
            </div>

            <div className="new-services-section">
                <div className="new-services-text">
                    <h2>Design Consultation with Refund Option</h2>
                    <p>
                        Pay for your design consultation and have it refunded once you proceed with the project. We believe in full transparency and value your commitment to creating something great. Our design consultation is more than just an hour-long meeting; it’s an opportunity for us to understand your vision, needs, and the specifics of your space, ensuring that we can offer the best solutions possible.
                    </p>
                    <p>
                        We believe that building trust starts early in the process, which is why we offer this refund option. We want you to feel confident in your decision to move forward with us, knowing that we’re dedicated to bringing your ideas to life with professionalism and passion.
                    </p>
                </div>
                <img src={design} alt="Refundable Design" className="new-services-image" />
            </div>

            <div className="new-services-section">
                <div className="new-services-text">
                    <h2>Custom Residential Design & Contracting</h2>
                    <p>
                        Whether it's a cozy apartment or a sprawling estate, our residential design services are crafted to suit your vision. We blend comfort, functionality, and aesthetics to create spaces that feel like home. Our team takes into account not just the layout and style, but also the flow of space, light, and how it adapts to your lifestyle.
                    </p>
                    <p>
                        From concept to construction, we’re with you every step of the way, providing detailed plans, material selections, and project management to ensure your vision is realized. Whether you're renovating or building from scratch, we create spaces that reflect your personal taste while maximizing comfort and efficiency.
                    </p>
                </div>
                <img src={residence} alt="Residential Services" className="new-services-image" />
            </div>

            <div className="new-services-section">
                <div className="new-services-text">
                    <h2>Innovative Commercial Design</h2>
                    <p>
                        Your workspace should reflect your business’s personality and values. We specialize in creating commercial interiors that enhance your brand, boost employee productivity, and leave a lasting impression on clients. Whether it's a small office, a large retail space, or an expansive corporate headquarters, we ensure that your space supports your business objectives.
                    </p>
                    <p>
                        Our commercial design services are focused on functionality, with a keen eye for brand identity and client experience. We integrate thoughtful design elements that foster collaboration, creativity, and comfort while aligning with your company's image and values. The right commercial space can elevate your business, and we are here to make that happen.
                    </p>
                </div>
                <img src={commercial} alt="Commercial Spaces" className="new-services-image" />
            </div>

            <div className="new-services-section">
                <div className="new-services-text">
                    <h2>Comprehensive Renovation Services</h2>
                    <p>
                        Whether it’s a minor update or a full renovation, our team is here to transform your space. We approach every project with creativity and precision to breathe new life into your property. Whether it’s updating outdated features, repurposing rooms, or changing the entire layout, we take the time to understand your goals and deliver exceptional results.
                    </p>
                    <p>
                        Renovation projects require a blend of creative vision and technical expertise, and that’s exactly what our team brings. We handle everything from structural changes to the finishing touches, ensuring your renovation is completed on time, within budget, and to the highest standards of craftsmanship.
                    </p>
                </div>
                <img src={renovation} alt="Renovation Work" className="new-services-image" />
            </div>

            <div className="new-services-section">
                <div className="new-services-text">
                    <h2>Space Planning & Layout Optimization</h2>
                    <p>
                        Effective space planning is the cornerstone of great interior design. Our experts analyze every inch of your space to ensure it’s being utilized to its fullest potential. We prioritize functionality, flow, and aesthetics, ensuring that your space is optimized for your lifestyle, whether you’re designing a home, office, or commercial space.
                    </p>
                    <p>
                        We consider factors like traffic patterns, furniture arrangement, and lighting placement to create a cohesive layout that enhances the overall experience of your space. With our space planning services, we maximize the potential of every room to create functional and comfortable areas.
                    </p>
                </div>
                <img src={residence} alt="Space Planning" className="new-services-image" />
            </div>

            <div className="new-services-section">
                <div className="new-services-text">
                    <h2>Lighting Design & Installation</h2>
                    <p>
                        Lighting can transform the entire ambiance of a room, and it plays a key role in enhancing the functionality of your space. Our lighting design services focus on creating the right atmosphere while ensuring practical lighting solutions that meet your needs. Whether it’s accent lighting, ambient lighting, or task lighting, we carefully select and place each light fixture to complement your interior design.
                    </p>
                    <p>
                        We also specialize in energy-efficient lighting solutions, so your space remains bright and welcoming without compromising sustainability. From modern LED setups to more traditional fixtures, we tailor the lighting design to fit your space’s style and your personal preferences.
                    </p>
                </div>
                <img src={residence} alt="Lighting Design" className="new-services-image" />
            </div>
            <Footer/>
        </div>
    );
};

export default Services;

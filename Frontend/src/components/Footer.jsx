import React from 'react';
import '../styles/footer.css';
import { assets } from '../assets/frontend_assets/assets';

const Footer = () => {
  return (
    <div className='footer' id='footer'>
        <div className="footer-content">
            <div className="footer-content-left">
                <img src="" alt="VS Interiors Logo" className="footer-logo" />
                <p>Thank you for visiting VS Interiors! We specialize in creating stunning interior spaces and providing top-notch contracting services. Whether you're looking to design your dream home or renovate your commercial space, our team is here to help. Contact us for consultations or inquiries, and follow us on social media to stay updated with our latest projects and offers. We look forward to working with you!</p>
                <div className="footer-social-icons">
                    <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
                      <img src={assets.facebook_icon} alt="Facebook" />
                    </a>
                    <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                      <img src={assets.twitter_icon} alt="Twitter" />
                    </a>
                    <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
                      <img src={assets.linkedin_icon} alt="LinkedIn" />
                    </a>
                </div>
            </div>
            <div className="footer-content-center">
                <h2>Company</h2>
                <ul>
                    <li><a href="#home">Home</a></li>
                    <li><a href="#about">About Us</a></li>
                    <li><a href="#services">Services</a></li>
                    <li><a href="#contact">Contact</a></li>
                </ul>
            </div>
            <div className="footer-content-right">
                <h2>Contact Us</h2>
                <ul>
                    <li>+1-34-56-3463</li>
                    <li>info@vsinteriors.com</li>
                </ul>
            </div>
        </div>
        <hr />
        <p className="footer-copyright">© 2024 VS Interiors. All rights reserved.</p>
    </div>
  )
}

export default Footer;

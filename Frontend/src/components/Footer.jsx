import React from 'react';
import '../styles/footer.css';
import logo from '../assets/logo.jpg';

const Footer = () => {
  return (
    <div className='footer' id='footer'>
      <div className="footer-content">
        <div className="footer-content-left">
          <img src={logo} alt="Shrivastava's Elevate Logo" className="footer-logo" />
          <p>
            Thank you for visiting Shrivastava's Elevate! We specialize in creating stunning interior spaces and providing top-notch contracting services. Whether you're looking to design your dream home or renovate your commercial space, our team is here to help. Contact us for consultations or inquiries, and follow us on social media to stay updated with our latest projects and offers. We look forward to working with you!
          </p>
          <div className="footer-social-icons">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="#d5b697" viewBox="0 0 24 24">
                <path d="M22.675 0h-21.35C.595 0 0 .593 0 1.326v21.348C0 23.407.595 24 1.326 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.098 2.794.142v3.24l-1.918.001c-1.504 0-1.794.715-1.794 1.762v2.311h3.588l-.467 3.622h-3.121V24h6.116c.73 0 1.325-.593 1.325-1.326V1.326C24 .593 23.405 0 22.675 0z" />
              </svg>
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="#d5b697" viewBox="0 0 24 24">
                <path d="M24 4.557a9.93 9.93 0 0 1-2.828.775A4.932 4.932 0 0 0 23.337 3.1a9.864 9.864 0 0 1-3.127 1.196 4.918 4.918 0 0 0-8.384 4.482A13.94 13.94 0 0 1 1.671 3.149 4.918 4.918 0 0 0 3.195 9.723a4.903 4.903 0 0 1-2.229-.616c-.054 2.281 1.581 4.415 3.949 4.89a4.935 4.935 0 0 1-2.224.084 4.925 4.925 0 0 0 4.598 3.417A9.867 9.867 0 0 1 0 19.54a13.936 13.936 0 0 0 7.548 2.213c9.051 0 14.002-7.496 14.002-13.986 0-.213-.005-.425-.014-.636A9.935 9.935 0 0 0 24 4.557z" />
              </svg>
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="social-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="#d5b697" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554V14.79c0-1.345-.024-3.078-1.879-3.078-1.88 0-2.168 1.464-2.168 2.976v5.764H9.293V9h3.414v1.561h.048c.476-.899 1.637-1.848 3.37-1.848 3.602 0 4.267 2.368 4.267 5.452v6.287zM5.337 7.433c-1.144 0-2.07-.926-2.07-2.07 0-1.143.926-2.07 2.07-2.07 1.143 0 2.07.927 2.07 2.07 0 1.144-.927 2.07-2.07 2.07zM6.765 20.452H3.911V9h2.854v11.452zM22.225 0H1.771C.792 0 0 .771 0 1.729v20.542C0 23.23.792 24 1.771 24h20.451C23.2 24 24 23.23 24 22.271V1.729C24 .771 23.2 0 22.225 0z" />
              </svg>
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
            <li>info@shrivastavaselevate.com</li>
          </ul>
        </div>
      </div>
      <hr />
      <p className="footer-copyright">© 2024 Shrivastava's Elevate. All rights reserved.</p>
    </div>
  );
};

export default Footer;

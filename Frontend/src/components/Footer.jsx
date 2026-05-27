import React from 'react';
import '../styles/footer.css';
import logo from '../assets/logo.jpg';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPhone, faEnvelope, faLocationDot,
} from '@fortawesome/free-solid-svg-icons';

const Footer = () => {
  return (
    <footer className="footer" id="footer">

      {/* top gradient rule */}
      <div className="footer-rule" />

      <div className="footer-content">

        {/* ── LEFT — brand block ── */}
        <div className="footer-content-left">
          <img
            src={logo}
            alt="Shrivastava's Elevate Logo"
            className="footer-logo"
          />

          <p className="footer-brand-name">Shrivastava's Elevate</p>

          <p>
            Transforming residential and commercial spaces into elegant, functional
            interiors. End-to-end contracting solutions delivered with precision,
            creativity and premium craftsmanship.
          </p>

          <div className="footer-social-icons">

            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="social-icon"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M22.675 0h-21.35C.595 0 0 .593 0 1.326v21.348C0 23.407.595 24 1.326 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.098 2.794.142v3.24l-1.918.001c-1.504 0-1.794.715-1.794 1.762v2.311h3.588l-.467 3.622h-3.121V24h6.116c.73 0 1.325-.593 1.325-1.326V1.326C24 .593 23.405 0 22.675 0z"/>
              </svg>
            </a>

            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Twitter / X"
              className="social-icon"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M24 4.557a9.93 9.93 0 0 1-2.828.775A4.932 4.932 0 0 0 23.337 3.1a9.864 9.864 0 0 1-3.127 1.196 4.918 4.918 0 0 0-8.384 4.482A13.94 13.94 0 0 1 1.671 3.149 4.918 4.918 0 0 0 3.195 9.723a4.903 4.903 0 0 1-2.229-.616c-.054 2.281 1.581 4.415 3.949 4.89a4.935 4.935 0 0 1-2.224.084 4.925 4.925 0 0 0 4.598 3.417A9.867 9.867 0 0 1 0 19.54a13.936 13.936 0 0 0 7.548 2.213c9.051 0 14.002-7.496 14.002-13.986 0-.213-.005-.425-.014-.636A9.935 9.935 0 0 0 24 4.557z"/>
              </svg>
            </a>

            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="social-icon"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
              </svg>
            </a>

            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="social-icon"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554V14.79c0-1.345-.024-3.078-1.879-3.078-1.88 0-2.168 1.464-2.168 2.976v5.764H9.293V9h3.414v1.561h.048c.476-.899 1.637-1.848 3.37-1.848 3.602 0 4.267 2.368 4.267 5.452v6.287zM5.337 7.433c-1.144 0-2.07-.926-2.07-2.07 0-1.143.926-2.07 2.07-2.07 1.143 0 2.07.927 2.07 2.07 0 1.144-.927 2.07-2.07 2.07zM6.765 20.452H3.911V9h2.854v11.452zM22.225 0H1.771C.792 0 0 .771 0 1.729v20.542C0 23.23.792 24 1.771 24h20.451C23.2 24 24 23.23 24 22.271V1.729C24 .771 23.2 0 22.225 0z"/>
              </svg>
            </a>

          </div>
        </div>

        {/* ── CENTER — navigation ── */}
        <div className="footer-content-center">
          <h2>Company</h2>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/services">Services</Link></li>
            <li><Link to="/projects">Projects</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </div>

        {/* ── RIGHT — contact ── */}
        <div className="footer-content-right">
          <h2>Contact</h2>
          <ul>
            <li>
              <FontAwesomeIcon icon={faPhone} className="footer-contact-icon" />
              +91 98765 43210
            </li>
            <li>
              <FontAwesomeIcon icon={faEnvelope} className="footer-contact-icon" />
              info@shrivastavaselevate.com
            </li>
            <li>
              <FontAwesomeIcon icon={faLocationDot} className="footer-contact-icon" />
              Huzurganj, Indore, India
            </li>
          </ul>
        </div>

      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="footer-bottom">
        <p className="footer-copyright">
          © {new Date().getFullYear()} Shrivastava's Elevate. All rights reserved.
        </p>
        <div className="footer-bottom-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Use</a>
        </div>
      </div>

    </footer>
  );
};

export default Footer;

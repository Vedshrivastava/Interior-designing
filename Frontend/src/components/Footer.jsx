import React from 'react';
import '../styles/footer.css';
import logo from '../assets/logo.jpg';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify'; // Imported toast
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPhone, faEnvelope, faLocationDot, faCopy
} from '@fortawesome/free-solid-svg-icons'; // Added faCopy

const FOOTER_CONTACT_INFO = [
  {
    icon: faPhone,
    label: 'Phone',
    value: '+91 89620 53372',
    href: 'tel:+918962053372'
  },
  {
    icon: faEnvelope,
    label: 'Email',
    value: 'shrivastavaselevatepvt.ltd@gmail.com',
    href: 'mailto:shrivastavaselevatepvt.ltd@gmail.com'
  },
  {
    icon: faLocationDot,
    label: 'Address',
    value: 'Shree Ganga Inn, Lakshmi Bai Marg, Gandhi Chowk, Nagod (M.P.)'
  }
];

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
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (formerly Twitter)"
              className="social-icon"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.264 5.633 5.9-5.633Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a
              href="https://wa.me/918962053372"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="social-icon"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
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
          <ul className="footer-contact-list">
            {FOOTER_CONTACT_INFO.map(({ icon, label, value, href }) => (
              <li key={label} className="footer-contact-item">
                <div className="footer-contact-details">
                  <FontAwesomeIcon icon={icon} className="footer-contact-icon" />
                  {href ? (
                    <a href={href} className="footer-contact-link">{value}</a>
                  ) : (
                    <span className="footer-contact-text">{value}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="footer-copy-btn"
                  title={`Copy ${label}`}
                  onClick={() => {
                    navigator.clipboard.writeText(value);
                    toast.success(`${label} copied to clipboard!`);
                  }}
                >
                  <FontAwesomeIcon icon={faCopy} />
                </button>
              </li>
            ))}
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
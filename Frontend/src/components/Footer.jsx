'use client';
import '@/styles/footer.css';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { useState } from 'react';

import { IconPhone, IconEnvelope, IconLocation, IconCopy } from "@/components/Icons";
import logo from '@/assets/logo.png';

const FOOTER_CONTACT_INFO = [
  { Icon: IconPhone,       label: 'Phone',   value: '+91 89620 53372',                           href: 'tel:+918962053372'  },
  { Icon: IconEnvelope,    label: 'Email',   value: 'shrivastavaselevatepvt.ltd@gmail.com',       href: 'mailto:shrivastavaselevatepvt.ltd@gmail.com' },
  { Icon: IconLocation, label: 'Address', value: 'Shree Ganga Inn, Lakshmi Bai Marg, Gandhi Chowk, Nagod (M.P.)' },
];

const SOCIAL_PLATFORMS = [
  { label: 'Facebook',   aria: 'Facebook',              icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M22.675 0h-21.35C.595 0 0 .593 0 1.326v21.348C0 23.407.595 24 1.326 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.098 2.794.142v3.24l-1.918.001c-1.504 0-1.794.715-1.794 1.762v2.311h3.588l-.467 3.622h-3.121V24h6.116c.73 0 1.325-.593 1.325-1.326V1.326C24 .593 23.405 0 22.675 0z"/></svg> },
  { label: 'X',          aria: 'X (formerly Twitter)',  icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.264 5.633 5.9-5.633Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  { label: 'Instagram',  aria: 'Instagram',             icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg> },
  { label: 'LinkedIn',   aria: 'LinkedIn',              icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554V14.79c0-1.345-.024-3.078-1.879-3.078-1.88 0-2.168 1.464-2.168 2.976v5.764H9.293V9h3.414v1.561h.048c.476-.899 1.637-1.848 3.37-1.848 3.602 0 4.267 2.368 4.267 5.452v6.287zM5.337 7.433c-1.144 0-2.07-.926-2.07-2.07 0-1.143.926-2.07 2.07-2.07 1.143 0 2.07.927 2.07 2.07 0 1.144-.927 2.07-2.07 2.07zM6.765 20.452H3.911V9h2.854v11.452zM22.225 0H1.771C.792 0 0 .771 0 1.729v20.542C0 23.23.792 24 1.771 24h20.451C23.2 24 24 23.23 24 22.271V1.729C24 .771 23.2 0 22.225 0z"/></svg> },
];

export default function Footer() {
  const [comingSoon, setComingSoon] = useState(null);

  return (
    <footer className="footer" id="footer">
      <div className="footer-rule" />

      <div className="footer-content">
        <div className="footer-content-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo.src} alt="Shrivastava's Elevate Logo" className="footer-logo" />
          <p className="footer-brand-name">Shrivastava&apos;s Elevate</p>
          <p>
            Transforming residential and commercial spaces into elegant, functional
            interiors. End-to-end contracting solutions delivered with precision,
            creativity and premium craftsmanship.
          </p>

          <div className="footer-social-icons" style={{ position: 'relative' }}>
            {SOCIAL_PLATFORMS.map(({ label, aria, icon }) => (
              <button
                key={label}
                className="social-icon"
                aria-label={aria}
                onClick={() => setComingSoon(label === comingSoon ? null : label)}
              >
                {icon}
              </button>
            ))}

            {/* Coming soon popup */}
            {comingSoon && (
              <div className="footer-social-popup" onClick={() => setComingSoon(null)}>
                <div className="footer-social-popup-inner" onClick={e => e.stopPropagation()}>
                  <span className="footer-social-popup-icon">🚧</span>
                  <div>
                    <p className="footer-social-popup-title">{comingSoon} — Coming Soon</p>
                    <p className="footer-social-popup-sub">We&apos;re building our social presence. Stay tuned!</p>
                  </div>
                  <button className="footer-social-popup-close" onClick={() => setComingSoon(null)}>✕</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="footer-content-center">
          <h2>Company</h2>
          <ul>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/about">About Us</Link></li>
            <li><Link href="/services">Services</Link></li>
            <li><Link href="/projects">Projects</Link></li>
            <li><Link href="/products">Products</Link></li>
            <li><Link href="/contact">Contact</Link></li>
          </ul>
        </div>

        <div className="footer-content-cities">
          <h2>Cities We Serve</h2>
          <ul>
            <li><Link href="/interior-designer/satna">Interior Designer Satna</Link></li>
            <li><Link href="/interior-designer/indore">Interior Designer Indore</Link></li>
            <li><Link href="/interior-designer/mumbai">Interior Designer Mumbai</Link></li>
            <li><Link href="/interior-designer/bhopal">Interior Designer Bhopal</Link></li>
            <li><Link href="/interior-designer/jabalpur">Interior Designer Jabalpur</Link></li>
            <li><Link href="/interior-designer/nagod">Interior Designer Nagod</Link></li>
          </ul>
        </div>

        <div className="footer-content-right">
          <h2>Contact</h2>
          <ul className="footer-contact-list">
            {FOOTER_CONTACT_INFO.map(({ Icon, label, value, href }) => (
              <li key={label} className="footer-contact-item">
                <div className="footer-contact-details">
                  <Icon className="footer-contact-icon" />
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
                  <IconCopy />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="footer-copyright">
          © {new Date().getFullYear()} Shrivastava&apos;s Elevate. All rights reserved.
        </p>
        <div className="footer-bottom-links">
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Use</a>
        </div>
      </div>
    </footer>
  );
}

import React, { useState } from 'react';
import '../styles/contact.css';
import Footer from '../components/Footer';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPhone, faEnvelope, faLocationDot, faClock,
  faPaperPlane, faMessage, faCopy
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

const INFO_ITEMS = [
  {
    icon: faLocationDot,
    label: 'Address',
    value: 'Shree Ganga Inn, Lakshmi Bai Marg, Gandhi Chowk, Nagod (M.P.)',
  },
  {
    icon: faPhone,
    label: 'Phone',
    value: '+91 89620 53372',
    href: 'tel:+918962053372'
  },
  {
    icon: faWhatsapp,
    label: 'WhatsApp',
    value: '+91 89620 53372',
    href: 'https://wa.me/918962053372',
  },
  {
    icon: faEnvelope,
    label: 'Email',
    value: 'shrivastavaselevatepvt.ltd@gmail.com',
    href: 'mailto:shrivastavaselevatepvt.ltd@gmail.com' // Added mailto link
  },
  {
    icon: faClock,
    label: 'Office Hours',
    value: 'Mon – Sat, 9 AM – 6 PM',
  },
];

const Contact = ({ setShowLogin }) => {
  const [formData, setFormData] = useState({
    name: '', email: '', phoneNumber: '', message: '',
  });
  const [loading, setLoading] = useState(false);
  const url = 'http://localhost:3000';

  const onChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${url}/api/appointment/add`, {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        message: formData.message,
        address: 'No Address Provided',
      });
      toast.success('Message sent! We\'ll get back to you shortly.');
      setFormData({ name: '', email: '', phoneNumber: '', message: '' });
    } catch (err) {
      console.error(err);
      toast.error('Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-page">

      {/* ── HERO ── */}
      <section className="contact-hero">
        <div className="contact-hero-inner">
          <div className="contact-eyebrow">
            <span className="contact-eyebrow-line" />
            <span>Get In Touch</span>
            <span className="contact-eyebrow-line" />
          </div>

          <h1>
            Let's Start Your<br />
            <span>Dream Project</span>
          </h1>

          <p>
            Tell us about your space — we'll get back to you within 24 hours
            with a tailored plan and transparent pricing.
          </p>
        </div>
      </section>

      {/* ── BODY ── */}
      <div className="contact-body">
        <div className="contact-container">

          {/* ── LEFT — info card ── */}
          <div className="contact-details">
            <div className="contact-details-rule" />
            <div className="contact-details-inner">

              <h1>Contact Us</h1>
              <p className="contact-details-tagline">
                Shrivastavas Elevate — luxury interior design and contracting,
                crafted around your lifestyle and vision.
              </p>

              <div className="contact-info-list">
                {INFO_ITEMS.map(({ icon, label, value, href }) => (
                  <div className="contact-info-item" key={label}>
                    <div
                      className={`contact-info-icon ${label === 'WhatsApp' ? 'whatsapp-icon' : ''
                        }`}
                    >
                      <FontAwesomeIcon icon={icon} />
                    </div>
                    <div className="contact-info-text">
                      <strong>{label}</strong>
                      <div className="contact-info-action-row">

                        {/* If it has an href, make it a clickable link; otherwise, normal text */}
                        {href ? (
                          <a href={href} className="contact-action-link">{value}</a>
                        ) : (
                          <span className="contact-action-text">{value}</span>
                        )}

                        {/* Render a Copy button for everything except Office Hours */}
                        {label !== 'Office Hours' && (
                          <button
                            type="button"
                            className="contact-copy-btn"
                            title={`Copy ${label}`}
                            onClick={() => {
                              navigator.clipboard.writeText(value);
                              toast.success(`${label} copied to clipboard!`);
                            }}
                          >
                            <FontAwesomeIcon icon={faCopy} />
                          </button>
                        )}

                      </div>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* ── RIGHT — form card ── */}
          <div className="contact-form-card">
            <div className="contact-form-inner">

              <h2>Send Us a Message</h2>
              <p className="contact-form-subtitle">
                Fill in your details and we'll reach out to discuss your project.
              </p>

              <form className="contact-form" onSubmit={onSubmit}>

                {/* name + phone on same row */}
                <div className="contact-field-row">
                  <div className="contact-field">
                    <label htmlFor="name">Full Name</label>
                    <input
                      id="name" name="name" type="text"
                      placeholder="Your full name"
                      value={formData.name}
                      onChange={onChange} required
                    />
                  </div>
                  <div className="contact-field">
                    <label htmlFor="phoneNumber">Phone</label>
                    <input
                      id="phoneNumber" name="phoneNumber" type="tel"
                      placeholder="+91 XXXXX XXXXX"
                      value={formData.phoneNumber}
                      onChange={onChange} required
                    />
                  </div>
                </div>

                <div className="contact-field">
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email" name="email" type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={onChange} required
                  />
                </div>

                <div className="contact-field">
                  <label htmlFor="message">Message <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></label>
                  <textarea
                    id="message" name="message"
                    placeholder="Tell us about your project, space size, budget range…"
                    value={formData.message}
                    onChange={onChange}
                    rows="5"
                  />
                </div>

                <button type="submit" className="contact-submit" disabled={loading}>
                  {loading
                    ? 'Sending…'
                    : <><FontAwesomeIcon icon={faPaperPlane} /> Send Message</>
                  }
                </button>

              </form>
            </div>
          </div>

        </div>
      </div>

      <Footer />

      <ToastContainer
        position="bottom-center"
        autoClose={3000}
        theme="dark"
        toastStyle={{
          background: '#102525',
          color: '#f0e6d3',
          border: '1px solid rgba(201,168,124,0.25)',
        }}
      />
    </div>
  );
};

export default Contact;

'use client';
import '@/styles/contact.css';
import { IconPhone, IconEnvelope, IconLocation, IconClock, IconCopy, IconPaperPlane, IconWhatsApp } from '@/components/Icons';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

import Footer from '@/components/Footer';

const INFO_ITEMS = [
  { Icon: IconLocation, label: 'Address',      value: 'Shree Ganga Inn, Lakshmi Bai Marg, Gandhi Chowk, Nagod (M.P.)' },
  { Icon: IconPhone,       label: 'Phone',        value: '+91 89620 53372',                          href: 'tel:+918962053372'                              },
  { Icon: IconWhatsApp,    label: 'WhatsApp',     value: '+91 89620 53372',                          href: 'https://wa.me/918962053372'                     },
  { Icon: IconEnvelope,    label: 'Email',        value: 'shrivastavaselevatepvt.ltd@gmail.com',     href: 'mailto:shrivastavaselevatepvt.ltd@gmail.com'    },
  { Icon: IconClock,       label: 'Office Hours', value: 'Mon – Sat, 9 AM – 6 PM'                                                                          },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', phoneNumber: '', message: '' });
  const [loading, setLoading]   = useState(false);

  const onChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/appointment/add`, {
        name: formData.name, email: formData.email,
        phoneNumber: formData.phoneNumber, message: formData.message,
        address: 'No Address Provided',
      });
      toast.success('Message sent! We\'ll get back to you shortly.');
      setFormData({ name: '', email: '', phoneNumber: '', message: '' });
    } catch (err) {
      toast.error('Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-page">
      <section className="contact-hero">
        <div className="contact-hero-inner">
          <div className="contact-eyebrow">
            <span className="contact-eyebrow-line" />
            <span>Get In Touch</span>
            <span className="contact-eyebrow-line" />
          </div>
          <h1>Let&apos;s Start Your<br /><span>Dream Project</span></h1>
          <p>Tell us about your space — we&apos;ll get back to you within 24 hours with a tailored plan and transparent pricing.</p>
        </div>
      </section>

      <div className="contact-body">
        <div className="contact-container">
          <div className="contact-details">
            <div className="contact-details-rule" />
            <div className="contact-details-inner">
              <h1>Contact Us</h1>
              <p className="contact-details-tagline">
                Shrivastavas Elevate — luxury interior design and contracting, crafted around your lifestyle and vision.
              </p>
              <div className="contact-info-list">
                {INFO_ITEMS.map(({ Icon, label, value, href }) => (
                  <div className="contact-info-item" key={label}>
                    <div className={`contact-info-icon${label === 'WhatsApp' ? ' whatsapp-icon' : ''}`}>
                      <Icon />
                    </div>
                    <div className="contact-info-text">
                      <strong>{label}</strong>
                      <div className="contact-info-action-row">
                        {href ? (
                          <a href={href} className="contact-action-link">{value}</a>
                        ) : (
                          <span className="contact-action-text">{value}</span>
                        )}
                        {label !== 'Office Hours' && (
                          <button
                            type="button"
                            className="contact-copy-btn"
                            title={`Copy ${label}`}
                            onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied to clipboard!`); }}
                          >
                            <IconCopy />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="contact-form-card">
            <div className="contact-form-inner">
              <h2>Send Us a Message</h2>
              <p className="contact-form-subtitle">Fill in your details and we&apos;ll reach out to discuss your project.</p>
              <form className="contact-form" onSubmit={onSubmit}>
                <div className="contact-field-row">
                  <div className="contact-field">
                    <label htmlFor="name">Full Name</label>
                    <input id="name" name="name" type="text" placeholder="Your full name" value={formData.name} onChange={onChange} required />
                  </div>
                  <div className="contact-field">
                    <label htmlFor="phoneNumber">Phone</label>
                    <input id="phoneNumber" name="phoneNumber" type="tel" placeholder="+91 XXXXX XXXXX" value={formData.phoneNumber} onChange={onChange} required />
                  </div>
                </div>
                <div className="contact-field">
                  <label htmlFor="email">Email Address</label>
                  <input id="email" name="email" type="email" placeholder="your@email.com" value={formData.email} onChange={onChange} required />
                </div>
                <div className="contact-field">
                  <label htmlFor="message">Message <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></label>
                  <textarea id="message" name="message" placeholder="Tell us about your project, space size, budget range…" value={formData.message} onChange={onChange} rows="5" />
                </div>
                <button type="submit" className="contact-submit" disabled={loading}>
                  {loading ? 'Sending…' : <><IconPaperPlane /> Send Message</>}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

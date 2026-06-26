'use client';
import '@/styles/consult.css';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { IconXMark, IconCalendar } from '@/components/Icons';
import { useModal } from '@/context/ModalContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function Consult() {
  const { closeConsult } = useModal();
  const [data, setData]         = useState({ name: '', email: '', phone: '', address: '', message: '' });
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onChange = e => setData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/appointment/add`, {
        name: data.name, email: data.email,
        phoneNumber: data.phone, address: data.address,
        message: data.message,
      });
      setSubmitted(true);
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cm-backdrop" onClick={e => e.target === e.currentTarget && closeConsult()}>
      <div className="cm-modal">

        {submitted ? (
          /* ── Success state ── */
          <div className="cm-success">
            <div className="cm-success-icon">✓</div>
            <h3>Consultation Booked!</h3>
            <p>
              Thank you. Our design team will get back to you within 24 hours to
              schedule your free consultation.
            </p>
            <button className="cm-close-btn" onClick={closeConsult}>Done</button>
          </div>

        ) : (
          <>
            {/* ── Sticky header ── */}
            <div className="cm-header">
              <div className="cm-header-left">
                <span className="cm-badge">Free Consultation</span>
                <h2>Book Your Consultation</h2>
              </div>
              <button className="cm-close-x" onClick={closeConsult} aria-label="Close">✕</button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="cm-body">

              {/* Steps */}
              <div className="cm-steps">
                <div className="cm-step">
                  <span className="cm-step-num cm-step-num--active">1</span>
                  <span className="cm-step-label cm-step-label--active">Your Details</span>
                </div>
                <div className="cm-step-line" />
                <div className="cm-step">
                  <span className="cm-step-num">2</span>
                  <span className="cm-step-label">Confirmation</span>
                </div>
              </div>

              {/* Notice */}
              <div className="cm-notice">
                <span className="cm-notice-icon">✦</span>
                <p>
                  <strong>No commitment required.</strong> Consultation fee is fully
                  adjusted against your project cost upon confirmation.
                </p>
              </div>

              {/* Form */}
              <form className="cm-form" onSubmit={onSubmit}>
                <div className="cm-field-row">
                  <div className="cm-field">
                    <label htmlFor="c-name">Full Name</label>
                    <input id="c-name" name="name" type="text" placeholder="Your full name"
                      value={data.name} onChange={onChange} required autoComplete="off" />
                  </div>
                  <div className="cm-field">
                    <label htmlFor="c-email">Email</label>
                    <input id="c-email" name="email" type="email" placeholder="your@email.com"
                      value={data.email} onChange={onChange} required autoComplete="off" />
                  </div>
                </div>

                <div className="cm-field-row">
                  <div className="cm-field">
                    <label htmlFor="c-phone">Phone Number</label>
                    <input id="c-phone" name="phone" type="tel" placeholder="+91 XXXXX XXXXX"
                      value={data.phone} onChange={onChange} required autoComplete="off" />
                  </div>
                  <div className="cm-field">
                    <label htmlFor="c-address">City / Address</label>
                    <input id="c-address" name="address" type="text" placeholder="Your city / address"
                      value={data.address} onChange={onChange} required autoComplete="off" />
                  </div>
                </div>

                <div className="cm-field">
                  <label htmlFor="c-message">Message <span>(optional)</span></label>
                  <textarea id="c-message" name="message" rows={3}
                    placeholder="Tell us about your project — room type, budget, timeline..."
                    value={data.message} onChange={onChange} autoComplete="off" />
                </div>

                <button type="submit" className="cm-submit" disabled={loading}>
                  {loading ? 'Submitting…' : <><IconCalendar /> Book Consultation</>}
                </button>
              </form>

            </div>
          </>
        )}

      </div>
    </div>
  );
}

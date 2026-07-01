'use client';
import '@/styles/consult.css';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { IconXMark, IconCalendar } from '@/components/Icons';
import { useModal } from '@/context/ModalContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function QuotePopup() {
  const { closeQuote, consultData } = useModal();
  const [data, setData]           = useState({ name: '', email: '', phone: '', address: '', length: '', width: '', message: '', website: '' });
  const [loading, setLoading]     = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onChange = e => setData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const onSubmit = async e => {
    e.preventDefault();
    if (data.website) { setSubmitted(true); return; } // honeypot triggered
    setLoading(true);
    const formattedMeasurements = (data.length || data.width)
      ? `${data.length || 0} ft x ${data.width || 0} ft` : '';
    try {
      await axios.post(`${API_URL}/api/appointment/quote`, {
        name: data.name, email: data.email,
        phoneNumber: data.phone, address: data.address,
        measurements: formattedMeasurements,
        message: data.message,
        consultData, website: data.website,
      });
      setSubmitted(true);
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cm-backdrop" onClick={e => e.target === e.currentTarget && closeQuote()}>
      <div className="cm-modal">

        {submitted ? (
          /* ── Success state ── */
          <div className="cm-success">
            <div className="cm-success-icon">✓</div>
            <h3>Quote Requested!</h3>
            <p>
              We&apos;ve received your quote request. Our team will send you a
              personalised quote within 24 hours.
            </p>
            <button className="cm-close-btn" onClick={closeQuote}>Done</button>
          </div>

        ) : (
          <>
            {/* ── Design preview banner ── */}
            {consultData?.img && (
              <div className="cm-preview-banner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={consultData.img} alt={consultData.name || 'Design'} />
                <div className="cm-preview-overlay" />
                <div className="cm-preview-info">
                  {consultData.category && (
                    <span className="cm-preview-cat">{consultData.category}</span>
                  )}
                  <p className="cm-preview-name">{consultData.name}</p>
                </div>
              </div>
            )}

            {/* ── Sticky header ── */}
            <div className="cm-header">
              <div className="cm-header-left">
                <span className="cm-badge">Get a Quote</span>
                <h2>Request a Quote</h2>
              </div>
              <button className="cm-close-x" onClick={closeQuote} aria-label="Close">✕</button>
            </div>

            {/* ── Scrollable body ── */}
            <div className="cm-body">

              {/* Steps */}
              <div className="cm-steps">
                <div className="cm-step">
                  <span className="cm-step-num cm-step-num--done">✓</span>
                  <span className="cm-step-label">Choose Design</span>
                </div>
                <div className="cm-step-line cm-step-line--done" />
                <div className="cm-step">
                  <span className="cm-step-num cm-step-num--active">2</span>
                  <span className="cm-step-label cm-step-label--active">Your Details</span>
                </div>
              </div>

              {/* Form */}
              <form className="cm-form" onSubmit={onSubmit}>
                <div className="cm-field-row">
                  <div className="cm-field">
                    <label htmlFor="q-name">Full Name</label>
                    <input id="q-name" name="name" type="text" placeholder="Your full name"
                      value={data.name} onChange={onChange} required autoComplete="off" />
                  </div>
                  <div className="cm-field">
                    <label htmlFor="q-email">Email</label>
                    <input id="q-email" name="email" type="email" placeholder="your@email.com"
                      value={data.email} onChange={onChange} required autoComplete="off" />
                  </div>
                </div>

                <div className="cm-field-row">
                  <div className="cm-field">
                    <label htmlFor="q-phone">Phone Number</label>
                    <input id="q-phone" name="phone" type="tel" placeholder="+91 XXXXX XXXXX"
                      value={data.phone} onChange={onChange} required autoComplete="off" />
                  </div>
                  <div className="cm-field">
                    <label htmlFor="q-address">City / Address</label>
                    <input id="q-address" name="address" type="text" placeholder="Your city / address"
                      value={data.address} onChange={onChange} required autoComplete="off" />
                  </div>
                </div>

                {/* Dimensions */}
                <div className="cm-dimensions">
                  <p className="cm-dimensions-heading">
                    Your Space Dimensions <span>(optional)</span>
                  </p>
                  <div className="cm-field-row">
                    <div className="cm-field">
                      <label htmlFor="q-length">Length (ft)</label>
                      <input id="q-length" name="length" type="number" placeholder="e.g. 12"
                        value={data.length} onChange={onChange} autoComplete="off" />
                    </div>
                    <div className="cm-field">
                      <label htmlFor="q-width">Width (ft)</label>
                      <input id="q-width" name="width" type="number" placeholder="e.g. 15"
                        value={data.width} onChange={onChange} autoComplete="off" />
                    </div>
                  </div>
                </div>

                <div className="cm-field">
                  <label htmlFor="q-message">Message <span>(optional)</span></label>
                  <textarea id="q-message" name="message" rows={2}
                    placeholder="Any specific requirements or questions..."
                    value={data.message} onChange={onChange} autoComplete="off" />
                </div>

                {/* Honeypot — invisible to humans, bots fill it */}
                <div style={{ position: 'absolute', left: '-9999px', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
                  <input name="website" type="text" value={data.website} onChange={onChange} tabIndex={-1} autoComplete="off" />
                </div>

                <button type="submit" className="cm-submit" disabled={loading}>
                  {loading ? 'Submitting…' : <><IconCalendar /> Request Quote</>}
                </button>
                <p className="cm-note">Your details are secure · We&apos;ll respond within 24 hours</p>
              </form>

            </div>
          </>
        )}

      </div>
    </div>
  );
}

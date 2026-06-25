'use client';
import '@/styles/consult.css';
import { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

import {
  IconXMark, IconCalendar, IconUser, IconEnvelope,
  IconPhone, IconLocation, IconCommentDots,
} from '@/components/Icons';
import { useModal } from '@/context/ModalContext';
import logo from '@/assets/logo.png';

const FIELDS = [
  { name: 'name',    label: 'Full Name',    type: 'text',  placeholder: 'Your full name',     Icon: IconUser        },
  { name: 'email',   label: 'Email',        type: 'email', placeholder: 'your@email.com',      Icon: IconEnvelope    },
  { name: 'phone',   label: 'Phone Number', type: 'tel',   placeholder: '+91 XXXXX XXXXX',     Icon: IconPhone       },
  { name: 'address', label: 'Address',      type: 'text',  placeholder: 'Your city / address', Icon: IconLocation },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function QuotePopup() {
  const { closeQuote, consultData } = useModal();
  const [data, setData]     = useState({ name: '', email: '', phone: '', address: '', length: '', width: '', message: '' });
  const [loading, setLoading] = useState(false);

  const onChange = e => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    let formattedMeasurements = '';
    if (data.length || data.width) {
      formattedMeasurements = `${data.length || 0} ft x ${data.width || 0} ft`;
    }
    try {
      await axios.post(`${API_URL}/api/appointment/quote`, {
        name: data.name, email: data.email,
        phoneNumber: data.phone, address: data.address,
        measurements: formattedMeasurements,
        message: data.message,
        consultData,
      });
      toast.success('Quote requested successfully!');
      setTimeout(() => closeQuote(), 2000);
    } catch (err) {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login" onClick={e => e.target === e.currentTarget && closeQuote()}>
      <form onSubmit={onSubmit} className="login-container quote-popup-container">
        <div className="login-rule" />

        {consultData?.img && (
          <div className="quote-preview-banner">
            <img src={consultData.img} alt={consultData.name} />
            <div className="quote-preview-overlay" />
            <div className="quote-preview-info">
              <span className="quote-preview-cat">{consultData.category}</span>
              <p className="quote-preview-name">{consultData.name}</p>
            </div>
          </div>
        )}

        <div className="login-inner">
          <div className="login-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.src} alt="Shrivastava's Elevate" className="login-logo" />
            <div className="login-header-text">
              <h2>Request a Quote</h2>
              <p>Get a personalised quote for this design</p>
            </div>
            <button type="button" className="login-close" onClick={closeQuote} aria-label="Close">
              <IconXMark />
            </button>
          </div>

          <div className="login-divider" />

          <div className="login-inputs">
            {FIELDS.map(({ name, label, type, placeholder, Icon }) => (
              <div className="login-field" key={name}>
                <label htmlFor={`quote-${name}`}>{label}</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon"><Icon /></span>
                  <input
                    id={`quote-${name}`} name={name} type={type} placeholder={placeholder}
                    value={data[name]} onChange={onChange} required autoComplete="off"
                  />
                </div>
              </div>
            ))}

            <div className="quote-dimensions-group">
              <p className="quote-dimensions-heading">
                Your Space Dimensions <span className="login-field-opt">optional</span>
              </p>
              <div className="quote-measure-row">
                <div className="login-field">
                  <label htmlFor="quote-length">Length (ft)</label>
                  <input
                    id="quote-length" name="length" type="number"
                    placeholder="e.g. 12" value={data.length}
                    onChange={onChange} autoComplete="off"
                  />
                </div>
                <div className="login-field">
                  <label htmlFor="quote-width">Width (ft)</label>
                  <input
                    id="quote-width" name="width" type="number"
                    placeholder="e.g. 15" value={data.width}
                    onChange={onChange} autoComplete="off"
                  />
                </div>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="quote-message">
                Message <span className="login-field-opt">optional</span>
              </label>
              <div className="login-input-wrap">
                <span className="login-input-icon login-input-icon--top">
                  <IconCommentDots />
                </span>
                <textarea
                  id="quote-message"
                  name="message"
                  placeholder="Any specific requirements or questions..."
                  value={data.message}
                  onChange={onChange}
                  rows={2}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Submitting…' : <><IconCalendar /> Request Quote</>}
          </button>
          <p className="login-note">Your details are secure · We&apos;ll respond with a detailed quote within 24 hours</p>
        </div>
      </form>
    </div>
  );
}

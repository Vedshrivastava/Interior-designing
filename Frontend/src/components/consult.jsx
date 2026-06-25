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

export default function Consult() {
  const { closeConsult } = useModal();
  const [data, setData]     = useState({ name: '', email: '', phone: '', address: '', message: '' });
  const [loading, setLoading] = useState(false);

  const onChange = e => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/appointment/add`, {
        name: data.name, email: data.email,
        phoneNumber: data.phone, address: data.address,
        message: data.message,
      });
      toast.success('Consultation booked successfully!');
      setTimeout(() => closeConsult(), 2000);
    } catch (err) {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login" onClick={e => e.target === e.currentTarget && closeConsult()}>
      <form onSubmit={onSubmit} className="login-container">
        <div className="login-rule" />
        <div className="login-inner">

          <div className="login-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.src} alt="Shrivastava's Elevate" className="login-logo" />
            <div className="login-header-text">
              <h2>Free Consultation</h2>
              <p>We&apos;ll get back to you within 24 hours</p>
            </div>
            <button type="button" className="login-close" onClick={closeConsult} aria-label="Close">
              <IconXMark />
            </button>
          </div>

          <div className="login-divider" />

          <div className="login-inputs">
            {FIELDS.map(({ name, label, type, placeholder, Icon }) => (
              <div className="login-field" key={name}>
                <label htmlFor={`consult-${name}`}>{label}</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon"><Icon /></span>
                  <input
                    id={`consult-${name}`} name={name} type={type} placeholder={placeholder}
                    value={data[name]} onChange={onChange} required autoComplete="off"
                  />
                </div>
              </div>
            ))}
            <div className="login-field">
              <label htmlFor="consult-message">
                Message <span className="login-field-opt">optional</span>
              </label>
              <div className="login-input-wrap">
                <span className="login-input-icon login-input-icon--top">
                  <IconCommentDots />
                </span>
                <textarea
                  id="consult-message"
                  name="message"
                  placeholder="Tell us about your project — room type, budget, timeline..."
                  value={data.message}
                  onChange={onChange}
                  rows={3}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Submitting…' : <><IconCalendar /> Book Consultation</>}
          </button>
          <p className="login-note">No commitment required · Consultation fee refunded on project confirmation</p>
        </div>
      </form>
    </div>
  );
}

import React, { useState } from 'react';
import '../styles/consult.css';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import logo from '../assets/logo.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCalendarCheck, faUser, faEnvelope, faPhone, faLocationDot } from '@fortawesome/free-solid-svg-icons';

const FIELDS = [
  { name: 'name',    label: 'Full Name',    type: 'text',   placeholder: 'Your full name',       icon: faUser        },
  { name: 'email',   label: 'Email',        type: 'email',  placeholder: 'your@email.com',        icon: faEnvelope    },
  { name: 'phone',   label: 'Phone Number', type: 'number', placeholder: '+91 XXXXX XXXXX',       icon: faPhone       },
  { name: 'address', label: 'Address',      type: 'text',   placeholder: 'Your city / address',   icon: faLocationDot },
];

const Consult = ({ setShowLogin }) => {
  const [data, setData] = useState({ name: '', email: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);
  const url = 'http://localhost:3000';

  const onChange = e => {
    const { name, value } = e.target;
    setData(prev => ({ ...prev, [name]: value }));
  };

  const onSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${url}/api/appointment/add`, {
        name: data.name, email: data.email,
        phoneNumber: data.phone, address: data.address,
        message: '',
      });
      toast.success('Consultation booked successfully!');
      setTimeout(() => setShowLogin(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login" onClick={e => e.target === e.currentTarget && setShowLogin(false)}>
      <form onSubmit={onSubmit} className="login-container">
        <div className="login-rule" />
        <div className="login-inner">
          
          <div className="login-header">
            <img src={logo} alt="Shrivastava's Elevate" className="login-logo" />
            <div className="login-header-text">
              <h2>Free Consultation</h2>
              <p>We'll get back to you within 24 hours</p>
            </div>
            <button type="button" className="login-close" onClick={() => setShowLogin(false)} aria-label="Close">
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>

          <div className="login-divider" />

          <div className="login-inputs">
            {FIELDS.map(({ name, label, type, placeholder }) => (
              <div className="login-field" key={name}>
                <label htmlFor={`consult-${name}`}>{label}</label>
                <input
                  id={`consult-${name}`} name={name} type={type} placeholder={placeholder}
                  value={data[name]} onChange={onChange} required autoComplete="off"
                />
              </div>
            ))}
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Submitting…' : <><FontAwesomeIcon icon={faCalendarCheck} /> Book Consultation</>}
          </button>
          <p className="login-note">No commitment required · Consultation fee refunded on project confirmation</p>
        </div>
      </form>
      <ToastContainer position="bottom-center" autoClose={2500} theme="dark" toastStyle={{ background: '#102525', color: '#f0e6d3', border: '1px solid rgba(201,168,124,0.25)' }} />
    </div>
  );
};

export default Consult;
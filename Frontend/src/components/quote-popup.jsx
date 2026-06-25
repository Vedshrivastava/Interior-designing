import React, { useState } from 'react';
import '../styles/consult.css';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import logo from '../assets/logo.png';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faCalendarCheck, faUser, faEnvelope, faPhone, faLocationDot, faCommentDots } from '@fortawesome/free-solid-svg-icons';

const FIELDS = [
    { name: 'name', label: 'Full Name', type: 'text', placeholder: 'Your full name', icon: faUser },
    { name: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', icon: faEnvelope },
    { name: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+91 XXXXX XXXXX', icon: faPhone },
    { name: 'address', label: 'Address', type: 'text', placeholder: 'Your city / address', icon: faLocationDot },
];

const QuotePopup = ({ setShowQuotePopup, consultData, setConsultData }) => {
    const [data, setData] = useState({ name: '', email: '', phone: '', address: '', length: '', width: '', message: '' });
    const [loading, setLoading] = useState(false);
    const url = 'http://localhost:3000';

    const closePopup = () => {
        setShowQuotePopup(false);
        setConsultData(null);
    };

    const onChange = e => {
        const { name, value } = e.target;
        setData(prev => ({ ...prev, [name]: value }));
    };

    const onSubmit = async e => {
        e.preventDefault();
        setLoading(true);

        // Format the measurements string before sending
        let formattedMeasurements = "";
        if (data.length || data.width) {
            formattedMeasurements = `${data.length || 0} ft x ${data.width || 0} ft`;
        }

        try {
            await axios.post(`${url}/api/appointment/quote`, {
                name: data.name, email: data.email,
                phoneNumber: data.phone, address: data.address,
                measurements: formattedMeasurements,
                message: data.message,
                consultData,
            });
            toast.success('Quote requested successfully!');
            setTimeout(() => closePopup(), 2000);
        } catch (err) {
            console.error(err);
            toast.error('Failed to submit. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login" onClick={e => e.target === e.currentTarget && closePopup()}>
            {/* Added 'quote-popup-container' class here for targeted CSS scaling */}
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
                        <img src={logo} alt="Shrivastava's Elevate" className="login-logo" />
                        <div className="login-header-text">
                            <h2>Request a Quote</h2>
                            <p>Get a personalised quote for this design</p>
                        </div>
                        <button type="button" className="login-close" onClick={closePopup} aria-label="Close">
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                    </div>

                    <div className="login-divider" />

                    <div className="login-inputs">
                        {FIELDS.map(({ name, label, type, placeholder, icon }) => (
                            <div className="login-field" key={name}>
                                <label htmlFor={`quote-${name}`}>{label}</label>
                                <div className="login-input-wrap">
                                    <span className="login-input-icon"><FontAwesomeIcon icon={icon} /></span>
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
                                <span className="login-input-icon login-input-icon--top"><FontAwesomeIcon icon={faCommentDots} /></span>
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
                        {loading ? 'Submitting…' : <><FontAwesomeIcon icon={faCalendarCheck} /> Request Quote</>}
                    </button>
                    <p className="login-note">Your details are secure · We'll respond with a detailed quote within 24 hours</p>
                </div>
            </form>
            <ToastContainer position="bottom-center" autoClose={2500} theme="dark" toastStyle={{ background: '#102525', color: '#f0e6d3', border: '1px solid rgba(201,168,124,0.25)' }} />
        </div>
    );
};

export default QuotePopup;
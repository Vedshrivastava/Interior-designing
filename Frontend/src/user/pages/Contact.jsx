import React, { useState } from 'react';
import '../styles/contact.css';
import MainNavbar from '../components/mainNavbar';
import Footer from '../components/Footer';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Contact = ({ setShowLogin }) => {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phoneNumber: "",
        message: "",
    });

    const url = "http://localhost:3000";

    // Handle input change
    const onChangeHandler = (event) => {
        const { name, value } = event.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    };

    // Handle form submit
    const onSubmitHandler = async (event) => {
        event.preventDefault();

        try {
            // Send form data to backend to add appointment
            await axios.post(`${url}/api/appointment/add`, {
                name: formData.name,
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                message: formData.message,
                address: formData.address || "No Address Provided", // Use formData or a default
            });

            toast.success('Appointment added successfully!');
            setFormData({
                name: "",
                email: "",
                phoneNumber: "",
                message: "",
            }); // Reset form data
        } catch (error) {
            console.error(error);
            toast.error('Error adding appointment, please try again.');
        }
    };

    return (
        <div>
            <div className="contact-container">
                <MainNavbar setShowLogin={setShowLogin} />

                <div className="contact-details">
                    <h1>Contact Us</h1>
                    <p>
                        At <strong>Shrivastavas Elevate</strong>, we are passionate about turning your dream spaces into reality. We offer a range of interior design services, including customized designs, project management, and high-quality materials like PVC louvers, panels, and marble sheets.
                    </p>
                    <p>
                        <strong>Address:</strong> 123 Interior Avenue, Design City, DC 45678
                    </p>
                    <p>
                        <strong>Phone:</strong> (123) 456-7890
                    </p>
                    <p>
                        <strong>Email:</strong> contact@vsinteriors.com
                    </p>
                    <p>
                        <strong>Office Hours:</strong> Mon-Fri, 9 AM - 5 PM
                    </p>
                </div>

                <div className="contact-form">
                    <h2>Get in Touch</h2>
                    <form onSubmit={onSubmitHandler}>
                        <label htmlFor="name">Name:</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={onChangeHandler}
                            required
                        />

                        <label htmlFor="email">Email:</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={onChangeHandler}
                            required
                        />

                        <label htmlFor="phoneNumber">Phone Number:</label>
                        <input
                            type="tel"
                            id="phoneNumber"
                            name="phoneNumber"
                            value={formData.phoneNumber}
                            onChange={onChangeHandler}
                            required
                        />

                        <label htmlFor="message">Message (Optional):</label>
                        <textarea
                            id="message"
                            name="message"
                            value={formData.message}
                            onChange={onChangeHandler}
                            rows="5"
                        ></textarea>

                        <button type="submit">Send Message</button>
                    </form>
                </div>
            </div>
            <Footer />
            <ToastContainer /> {/* Toast notifications */}
        </div>
    );
};

export default Contact;

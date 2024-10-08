import React, { useEffect, useState } from 'react';
import '../styles/consult.css';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import cross from '../assets/cross_icon.png';

const Consult = ({ setShowLogin, consultData, setConsultData }) => {
    const [data, setData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "" // Add address field here
    });

    const url = "http://localhost:3000";
    const navigate = useNavigate();

    // Handles form data changes
    const onChangeHandler = (event) => {
        const { name, value } = event.target;
        setData((prevData) => ({ ...prevData, [name]: value }));
        console.log("consultData:--->", consultData);
    };

    // Handles form submission
    const onSubmitHandler = async (event) => {
        event.preventDefault(); // Prevent page reload

        try {
            // If consultData is not empty, send data to the /quote API

            console.log("consultData:--->", consultData)
            if (consultData) {
                const response = await axios.post(`${url}/api/appointment/quote`, {
                    name: data.name,
                    email: data.email,
                    phoneNumber: data.phone,
                    address: data.address, // Include the address here
                    consultData: consultData, // Include consultData
                });

                console.log(consultData);

                toast.success('Quote requested successfully!');
                setTimeout(() => {
                    setShowLogin(false); // Close the form
                }, 2000);
                
                // Reset consultData after successful submission
                setConsultData(null); // Reset consultData to null

            } else {
                // Make POST request to add appointment
                const response = await axios.post(`${url}/api/appointment/add`, {
                    name: data.name,
                    email: data.email,
                    phoneNumber: data.phone,
                    address: data.address, // Include the address here
                    message: "", // Optional message
                });

                toast.success('Appointment created successfully!');
                setTimeout(() => {
                    setShowLogin(false); // Close the form
                }, 2000);
            }

        } catch (error) {
            console.error(error);
            toast.error('Failed to create request. Please try again.');
        }
    };

    return (
        <div className='login'>
            <form onSubmit={onSubmitHandler} className='login-container'>
                <div className="login-title">
                    <h2>Get a Free Design Consultation</h2>
                    <img onClick={() => setShowLogin(false)} src={cross} alt="" />
                </div>
                <div className="login-inputs">
                    <input 
                        name='name' 
                        onChange={onChangeHandler} 
                        value={data.name} 
                        type='text' 
                        placeholder='Your name' 
                        required 
                    />
                    <input 
                        name='email' 
                        onChange={onChangeHandler} 
                        value={data.email} 
                        type='email' 
                        placeholder='Your Email' 
                        required 
                    />
                    <input 
                        name='phone' 
                        onChange={onChangeHandler} 
                        value={data.phone} 
                        type='number' 
                        placeholder='Enter your Phone no.' 
                        required 
                    />
                    <input 
                        name='address' // Add the address input field
                        onChange={onChangeHandler} 
                        value={data.address} 
                        type='text' 
                        placeholder='Your Address' 
                        required 
                    />
                </div>
                <button type='submit'>Submit</button>
                <div className="login-condition">
                    <input type="checkbox" required />
                    <p>By continuing, I agree to all the terms and conditions </p>
                </div>
            </form>
            <ToastContainer />
        </div>
    );
};

export default Consult;

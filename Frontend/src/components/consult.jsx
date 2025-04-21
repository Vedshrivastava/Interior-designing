import React, { useEffect, useState } from 'react';
import '../styles/consult.css';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import cross from '../assets/cross_icon.png';
import logo from '../assets/logo.jpg'; // ✅ Import your logo here

const Consult = ({ setShowLogin, consultData, setConsultData }) => {
    const [data, setData] = useState({
        name: "",
        email: "",
        phone: "",
        address: ""
    });

    const url = "http://localhost:3000";
    const navigate = useNavigate();

    const onChangeHandler = (event) => {
        const { name, value } = event.target;
        setData((prevData) => ({ ...prevData, [name]: value }));
    };

    const onSubmitHandler = async (event) => {
        event.preventDefault();

        try {
            if (consultData) {
                await axios.post(`${url}/api/appointment/quote`, {
                    name: data.name,
                    email: data.email,
                    phoneNumber: data.phone,
                    address: data.address,
                    consultData: consultData,
                });

                toast.success('Quote requested successfully!');
                setTimeout(() => setShowLogin(false), 2000);
                setConsultData(null);
            } else {
                await axios.post(`${url}/api/appointment/add`, {
                    name: data.name,
                    email: data.email,
                    phoneNumber: data.phone,
                    address: data.address,
                    message: "",
                });

                toast.success('Appointment created successfully!');
                setTimeout(() => setShowLogin(false), 2000);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to create request. Please try again.');
        }
    };

    return (
        <div className='login'>
            <form onSubmit={onSubmitHandler} className='login-container'>
                {/* ✅ Logo at the top center */}
                <img className="login-logo" src={logo} alt="Logo" />

                <div className="login-title">
                    <h2>Get a Free Design Consultation</h2>
                    <span
                        onClick={() => setShowLogin(false)}
                    >
                        X
                    </span>
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
                        name='address'
                        onChange={onChangeHandler}
                        value={data.address}
                        type='text'
                        placeholder='Your Address'
                        required
                    />
                </div>
                <button type='submit'>Submit</button>
            </form>
            <ToastContainer />
        </div>
    );
};

export default Consult;

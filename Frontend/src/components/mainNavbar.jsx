import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/mainNavbar.css';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpg'
import axios from 'axios';


const MainNavbar = ({ setShowLogin }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState(null);
    const navigate = useNavigate();


    useEffect(() => {
        axios.get('/api/about')
            .then(response => {
                setData(response.data);
            })
            .catch(error => {
                console.error('There was an error fetching the about data!', error);
            });
    }, []);

    if (!data) {
        return <div>Loading...</div>;
    }

    const handleButtonClick = (id) => {
        // Navigate to the Home page
        navigate('/', { replace: true });

        // Wait for navigation to complete and then scroll to the target section
        setTimeout(() => {
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100); // Small delay to ensure navigation has time to complete
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    return (
        <nav className="mainNavbar">
            <div className="mainNavbar-container">
                <div className="mainNavbar-logo">
                    <img src={logo} alt="" srcSet="" />
                </div>
                <div className={`mainNavbar-links-container ${isOpen ? 'open' : ''}`}>
                    <ul className="mainNavbar-links">
                        <li><Link to="/">Home</Link></li>
                        <li><Link to="/services">Services</Link></li>
                        <li><Link to="/projects">Recent Projects</Link></li>
                        <li><Link to="/about">About</Link></li>
                        <li><Link to="/contact">Contact</Link></li>
                        <button onClick={() => setShowLogin(true)} className="consult-online">Consult Online</button>
                    </ul>
                </div>
                <div className="hamburger" onClick={toggleDropdown}>
                    <span className={`bar ${isOpen ? 'bar1' : ''}`}></span>
                    <span className={`bar ${isOpen ? 'bar2' : ''}`}></span>
                    <span className={`bar ${isOpen ? 'bar3' : ''}`}></span>
                </div>

            </div>
        </nav>
    );
};

export default MainNavbar;

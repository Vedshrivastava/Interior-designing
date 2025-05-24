import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ProtectedRoute = ({ children, setShowLogin }) => {
    const navigate = useNavigate();

    // Function to get user data from local storage
    const getUserData = () => {
        const user = localStorage.getItem('user'); // Adjust the key if needed
        return user ? JSON.parse(user) : null;
    };

    const user = getUserData();
    const isLoggedIn = !!user; // Check if user exists
    const userRole = user?.role; // Get user role if user exists

    useEffect(() => {
        // Check if the user is not logged in or does not have admin role
        if (!isLoggedIn || userRole !== 'ADMIN') {
            setShowLogin(true); // Show the login modal
            navigate('/'); // Navigate to the home page
        }
    }, [isLoggedIn, userRole, navigate, setShowLogin]); // Add dependencies

    // Prevent rendering the child components if unauthorized
    if (!isLoggedIn || userRole !== 'ADMIN') {
        return null; // Render nothing while navigating
    }

    return children; // Render the child components if authorized
};

export default ProtectedRoute;

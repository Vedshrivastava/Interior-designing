import React, { useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // 1. Added useLocation
import { jwtDecode } from 'jwt-decode';
import { StoreContext } from '../context/StoreContext';

const ProtectedRoute = ({ children, setShowLogin }) => {
    const navigate = useNavigate();
    const location = useLocation(); // 2. Listen to route changes
    const { setToken, setIsLoggedIn } = useContext(StoreContext);

    const handleExpiryLogout = () => {
        ['token', 'userId', 'userName', 'userEmail', 'user'].forEach(k => localStorage.removeItem(k));
        if (setToken) setToken(null);
        if (setIsLoggedIn) setIsLoggedIn(false);
        window.location.replace('/?reason=expired');
    };

    // 3. REMOVED '|| token'. LocalStorage is now the absolute source of truth for the browser state.
    const storedToken = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const userRole = user ? JSON.parse(user)?.role : null;

    useEffect(() => {
        // 4. This will now run on EVERY single page navigation
        if (!storedToken || userRole !== 'ADMIN') {
            setShowLogin(true);
            navigate('/');
            return;
        }

        // Check JWT Expiration
        try {
            const decoded = jwtDecode(storedToken);
            if (decoded.exp && Date.now() >= decoded.exp * 1000) {
                handleExpiryLogout();
            }
        } catch (error) {
            handleExpiryLogout(); 
        }
    }, [location.pathname, storedToken, userRole, navigate, setShowLogin]); // 5. Added path & storage dependencies

    // Synchronous check to prevent flashing content before useEffect fires
    let isExpired = false;
    if (storedToken) {
        try {
            const decoded = jwtDecode(storedToken);
            if (decoded.exp && Date.now() >= decoded.exp * 1000) isExpired = true;
        } catch {
            isExpired = true;
        }
    }

    if (!storedToken || userRole !== 'ADMIN' || isExpired) {
        return null; 
    }

    return children;
};

export default ProtectedRoute;
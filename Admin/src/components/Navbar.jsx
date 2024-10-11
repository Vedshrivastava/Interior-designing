import React, { useContext } from 'react';
import '../styles/navbar.css';
import { assets } from '../assets/admin_assets/assets';
import { StoreContext } from '../context/StoreContext'; // Import the StoreContext

const Navbar = ({ setShowLogin }) => {
    const { token, setToken, setUserId, setUserEmail, setUserName } = useContext(StoreContext); // Removed cart-related values

    const logout = () => {
        setToken(null);
        setUserId(null);
        setUserEmail(null);
        setUserName(null);
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("user");
    };

    return (
        <div className='navbar'>
            <img className='logo' src={assets.logo} alt="Logo" />
            {!token ? (
                <button onClick={() => setShowLogin(true)}>Sign In</button> // Show Sign In button if not authenticated
            ) : (
                <div className='navbar-profile'>
                    <img src={assets.profile_image} alt="Profile" />
                    <ul className="nav-profile-dropdown">
                        <li onClick={logout}>Logout</li> // Show Logout option if authenticated
                    </ul>
                </div>
            )}
        </div>
    );
}

export default Navbar;

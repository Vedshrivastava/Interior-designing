import React from 'react';
import '../styles/sidebar.css';
import { assets } from '../assets/admin_assets/assets';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faIdBadge, faMessage } from '@fortawesome/free-regular-svg-icons'; // Correct import for faIdBadge

const Sidebar = () => {
    return (
        <>
            <div className='sidebar'>
                <div className="sidebar-options">
                    <NavLink to='/add' className="sidebar-option">
                        <img src={assets.add_icon} alt="Add" />
                        <p>Add Food Item</p>
                    </NavLink>
                    <NavLink to='/list' className="sidebar-option">
                        <img src={assets.order_icon} alt="List" />
                        <p>List Items</p>
                    </NavLink>
                    <NavLink to='/appointments' className="sidebar-option">
                        <FontAwesomeIcon icon={faIdBadge} size='2x' /> {/* Using faIdBadge */}
                        <p>Appointments</p>
                    </NavLink>
                    <NavLink to='/quotes' className="sidebar-option">
                        <FontAwesomeIcon icon={faMessage} size='2x' /> {/* Using faIdBadge */}
                        <p>Quotes</p>
                    </NavLink>
                </div>
            </div>
        </>
    );
};

export default Sidebar;

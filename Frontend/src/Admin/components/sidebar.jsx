import React from 'react';
import '../styles/sidebar.css';
import { NavLink } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faIdBadge, faMessage, faPlus, faList } from '@fortawesome/free-solid-svg-icons'; // Added faPlus and faList

const Sidebar = () => {
    return (
        <>
            <div className='sidebar'>
                <div className="sidebar-options">
                    <NavLink to='/add' className="sidebar-option">
                        <FontAwesomeIcon icon={faPlus} size='2x' />
                        <p>Add Food Item</p>
                    </NavLink>
                    <NavLink to='/list' className="sidebar-option">
                        <FontAwesomeIcon icon={faList} size='2x' />
                        <p>List Items</p>
                    </NavLink>
                    <NavLink to='/appointments' className="sidebar-option">
                        <FontAwesomeIcon icon={faIdBadge} size='2x' />
                        <p>Appointments</p>
                    </NavLink>
                    <NavLink to='/quotes' className="sidebar-option">
                        <FontAwesomeIcon icon={faMessage} size='2x' />
                        <p>Quotes</p>
                    </NavLink>
                </div>
            </div>
        </>
    );
};

export default Sidebar;

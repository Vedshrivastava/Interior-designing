import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlus, faList, faIdBadge, faMessage,
    faFolderPlus, faFolderOpen, faCubes, faBoxesStacked, faUsers, faTrash,
} from '@fortawesome/free-solid-svg-icons';
import '../styles/welcome.css';

const ALL_SHORTCUTS = [
    { icon: faPlus,         label: 'Add Design',      desc: 'Upload a new interior design',         path: '/add'            },
    { icon: faList,         label: 'Designs',          desc: 'View and manage all designs',           path: '/list'           },
    { icon: faFolderPlus,   label: 'Add Project',      desc: 'Showcase a completed project',          path: '/add-project'    },
    { icon: faFolderOpen,   label: 'Projects',         desc: 'Browse and edit your portfolio',        path: '/list-projects'  },
    { icon: faCubes,        label: 'Add Product',      desc: 'List a new product to the catalogue',   path: '/add-product'    },
    { icon: faBoxesStacked, label: 'Products',         desc: 'View and manage all products',          path: '/list-products'  },
    { icon: faIdBadge,      label: 'Appointments',     desc: 'Track and manage bookings',             path: '/appointments'   },
    { icon: faMessage,      label: 'Quotes',           desc: 'Review customer quote requests',        path: '/quotes'         },
];

const MASTER_SHORTCUTS = [
    { icon: faUsers, label: 'Admin Requests', desc: 'Manage admin access and user roles',        path: '/admin-requests' },
    { icon: faTrash, label: 'Recovery Bin',   desc: 'Restore or permanently delete items',       path: '/recovery-bin'   },
];

const WelcomeScreen = () => {
    const navigate = useNavigate();
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isMaster   = storedUser.role === 'MASTER';

    const shortcuts = isMaster ? [...ALL_SHORTCUTS, ...MASTER_SHORTCUTS] : ALL_SHORTCUTS;

    return (
        <div className="welcome-container">
            <span className="welcome-badge">{isMaster ? 'Master Control' : 'Admin Dashboard'}</span>
            <h1>Welcome back to <em>your</em> workspace</h1>
            <p>Everything you need to manage your business is just a click away.</p>
            <div className="welcome-divider">
                <span /><i className="ti ti-leaf" /><span />
            </div>
            <div className="welcome-cards">
                {shortcuts.map(({ icon, label, desc, path }) => (
                    <div key={path} className="welcome-card" onClick={() => navigate(path)}>
                        <div className="welcome-card-icon">
                            <FontAwesomeIcon icon={icon} />
                        </div>
                        <h3>{label}</h3>
                        <p>{desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WelcomeScreen;

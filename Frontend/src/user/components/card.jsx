import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom'; 
import DesignDisplay from '../pages/designDisplay';
import '../styles/card.css'; 

function Card({ image, heading, description}) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/design/${heading}`);
  };

  return (
    <div className="Card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      <img src={image} alt={heading} className="Card-image" />
      <div className="Card-content">
        <h2 className="Card-heading">{heading}</h2>
        <p className="Card-description">{description}</p>
      </div>
      <div className="Card-icon">
        <FontAwesomeIcon icon={faChevronRight} />
      </div>
    </div>
  );
}

Card.propTypes = {
  image: PropTypes.string.isRequired,
  heading: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
};

export default Card;

import React, { useState, useEffect } from 'react';
import Slider from 'react-slick';
import '../styles/design.css';
import 'slick-carousel/slick/slick.css'; // Import slick-carousel CSS
import 'slick-carousel/slick/slick-theme.css'; // Import slick-carousel theme CSS
import Consult from './consult';

const Design = ({ id, name, description, images, points, setShowLogin, setConsultData, consultData }) => {
  const [showMore, setShowMore] = useState(false);
  const [buttonAtBottom, setButtonAtBottom] = useState(false); // New state
  const hasMultipleImages = images.length > 1;

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: true,
  };

  const handleToggle = () => {
    setShowMore(!showMore);
    setButtonAtBottom(!buttonAtBottom);
  };

  // Adjusted handleGetQuote to accept name and image as parameters
  const handleGetQuote = (name, img) => {
    setShowLogin(true);
    setConsultData({ name, img });
    console.log({ name, img }); // Log the data being set
  };

  // Use effect to log consultData when it changes
  useEffect(() => {
    console.log("Updated consultData:", consultData);
  }, [consultData]); // Runs whenever consultData changes

  return (
    <div className="design-display">
      <div className="design-slider">
        {hasMultipleImages ? (
          <Slider {...settings}>
            {images.map((imageUrl, index) => (
              <div key={index} className="design-slide">
                <img src={imageUrl} alt={`Design ${index}`} />
              </div>
            ))}
          </Slider>
        ) : (
          <div className="design-slide">
            <img src={images[0]} alt={`Design 0`} />
          </div>
        )}
      </div>
      <div className={`design-info ${buttonAtBottom ? 'button-at-bottom' : ''}`}>
        <h2>{name}</h2>
        <h3>Description</h3>
        <p className={`description-text ${showMore ? 'expanded' : 'collapsed'}`}>
          {description}
        </p>
        <button className="see-more-button" onClick={handleToggle}>
          {showMore ? 'See Less ▲' : 'See More ▼'}
        </button>
        {showMore && (
          <>
            <h3>Features</h3>
            <ul className="design-points expanded">
              {points && points.length > 0 && points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </>
        )}
        {/* Pass the name and first image as arguments to handleGetQuote */}
        <button onClick={() => handleGetQuote(name, images[0])} className="get-quote-button">
          Get Quote
        </button>
      </div>
    </div>
  );
}

export default Design;

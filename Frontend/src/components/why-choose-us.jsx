import React from 'react';
import '../styles/why-choose-us.css';

import img1 from '../assets/quality.avif';
import img2 from '../assets/budget.avif';
import img3 from '../assets/designer1.jpg';
import img4 from '../assets/customer-satisfaction.avif';
import img5 from '../assets/warranty.avif';
import img6 from '../assets/quality.avif';
import mainImage from '../assets/designer1.jpg';

const smallImages = [
  img1,
  img2,
  img3,
  img4,
  img5,
  img6
];

const WhyChooseUs = () => {
  return (
    <section className="why-choose-section">

      <div className="why-choose-header">
        <span className="section-tag">WHY CHOOSE US</span>

        <h1>
          Crafted Spaces With
          <br />
          Timeless Elegance
        </h1>

        <p>
          We combine luxury aesthetics, smart functionality, and expert
          execution to create interiors that truly elevate your lifestyle.
        </p>
      </div>

      <div className="why-gallery-layout">

        {/* LEFT SIDE - 6 IMAGES */}

        <div className="why-gallery-grid">
          {smallImages.map((image, index) => (
            <div className="why-gallery-card" key={index}>
              <img
                src={image}
                alt={`Interior ${index + 1}`}
                className="why-gallery-image"
              />
            </div>
          ))}
        </div>

        {/* RIGHT SIDE - BIG IMAGE */}

        <div className="why-featured-image-wrapper">
          <img
            src={mainImage}
            alt="Luxury Interior"
            className="why-featured-image"
          />
        </div>

      </div>

    </section>
  );
};

export default WhyChooseUs;
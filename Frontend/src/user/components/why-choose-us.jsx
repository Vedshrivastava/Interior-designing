import React, { useState, useEffect } from 'react';
import '../styles/why-choose-us.css'; // Import the CSS file for styling
import warranty from '../assets/warranty.avif'
import quality from '../assets/quality.avif'
import customer_satisfaction from '../assets/customer-satisfaction.avif'
import designers from '../assets/designers.avif'
import budget from '../assets/budget.avif'

// Array of message objects with image and description
const messages = [
  {
    image: quality, // Image path for high-quality service
    description: "Top-notch quality."
  },
  {
    image: budget, // Image path for affordable pricing
    description: "Unbeatable cost"
  },
  {
    image: designers, // Image path for expert team
    description: "Experienced Designers."
  },
  {
    image: customer_satisfaction, // Image path for customer satisfaction
    description: "Clients satisfaction."
  },
  {
    image: warranty, // Image path for customer satisfaction
    description: "10 years plus warranty."
  }
];

const WhyChooseUs = () => {

  return (
    <div className="why-choose-us">
      <h2>Why Choose Us</h2>
      <div className="carousel">
        {messages.map((message, index) => (
          <div>
            <div className="card">
              <img src={message.image} className="card-image" /> {/* Image */}
              <p>{message.description}</p> {/* Description */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WhyChooseUs;

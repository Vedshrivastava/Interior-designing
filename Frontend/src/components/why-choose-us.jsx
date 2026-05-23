import React from 'react';
import '../styles/why-choose-us.css';

import warranty from '../assets/warranty.avif';
import quality from '../assets/quality.avif';
import customer_satisfaction from '../assets/customer-satisfaction.avif';
import designers from '../assets/designer1.jpg';
import budget from '../assets/budget.avif';

const messages = [
  {
    image: quality,
    title: "Premium Quality",
    description:
      "Luxury finishes, premium materials, and attention to every small detail."
  },
  {
    image: budget,
    title: "Transparent Pricing",
    description:
      "Elegant interiors designed within your budget without compromising quality."
  },
  {
    image: designers,
    title: "Experienced Designers",
    description:
      "Creative experts who blend aesthetics, comfort, and functionality beautifully."
  },
  {
    image: customer_satisfaction,
    title: "Client Satisfaction",
    description:
      "We prioritize trust, communication, and long-term relationships with clients."
  },
  {
    image: warranty,
    title: "10+ Years Warranty",
    description:
      "Reliable craftsmanship backed by long-lasting warranty support and service."
  }
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

      <div className="why-choose-grid">
        {messages.map((message, index) => (
          <div className="why-card" key={index}>

            <div className="why-card-image-wrapper">
              <img
                src={message.image}
                alt={message.title}
                className="why-card-image"
              />

              <div className="why-overlay"></div>
            </div>

            <div className="why-card-content">
              <h2>{message.title}</h2>
              <p>{message.description}</p>
            </div>

          </div>
        ))}
      </div>

    </section>
  );
};

export default WhyChooseUs;
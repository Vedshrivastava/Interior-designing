import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Slider from 'react-slick'; // Import react-slick
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css'; // Import slick-carousel CSS
import '../styles/designDisplay.css';
import Design from '../components/Design';
import MainNavbar from '../components/mainNavbar';
import Footer from '../components/Footer';

const DesignDisplay = ({ setShowLogin, setConsultData, consultData }) => {
  const url = "http://localhost:3000";
  const { category } = useParams();
  const [designList, setDesignList] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(category);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 780);

  useEffect(() => {
    const fetchDesignList = async () => {
      try {
        const response = await axios.get(`${url}/api/design/list?category=${currentCategory}`);
        setDesignList(response.data.data);
      } catch (error) {
        console.error("Error fetching design list:", error);
      }
    };
    fetchDesignList();
  }, [currentCategory, url]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 780);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleSliderClick = (newCategory) => {
    setCurrentCategory(newCategory);
  };

  const handleSelectChange = (e) => {
    const selectedCategory = e.target.value;
    handleSliderClick(selectedCategory);
  };

  const sliderSettings = {
    infinite: true,
    speed: 500,
    slidesToShow: 8,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2000,
    draggable: true,
  };


  return (
    <div>
      <div className='design-display-main' id='design-display'>

        {/* New Design Navbar */}
        <MainNavbar setShowLogin={setShowLogin} />

        <h2>{currentCategory}</h2>
        <p className='main-para'>
          Check out popular modular {currentCategory} amongst our various designs available.
        </p>

        {/* Conditional Rendering for Slider or Select */}
        <div className='select-window'>
          {isMobileView ? (
            <div className="category-slider">
              <div className="slider-container">
                <div className="slider-item" onClick={() => handleSliderClick('Kitchen Designs')}>
                  <p className={currentCategory === 'Kitchen Designs' ? 'selected-category' : ''}>Kitchen Designs</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('Bedroom Designs')}>
                  <p className={currentCategory === 'Bedroom Designs' ? 'selected-category' : ''}>Bedroom Designs</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('Bathroom Designs')}>
                  <p className={currentCategory === 'Bathroom Designs' ? 'selected-category' : ''}>Bathroom Designs</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('Lounge area Designs')}>
                  <p className={currentCategory === 'Lounge area Designs' ? 'selected-category' : ''}>Lounge area</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('Home Cinema Designs')}>
                  <p className={currentCategory === 'Home Cinema Designs' ? 'selected-category' : ''}>Home Cinema</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('TV Unit Designs')}>
                  <p className={currentCategory === 'TV Unit Designs' ? 'selected-category' : ''}>TV Unit</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('Commercial Designs')}>
                  <p className={currentCategory === 'Commercial Designs' ? 'selected-category' : ''}>Commercial Designs</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('House Exterior')}>
                  <p className={currentCategory === 'House Exterior' ? 'selected-category' : ''}>House Exterior</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('PVC Louvers')}>
                  <p className={currentCategory === 'PVC Louvers' ? 'selected-category' : ''}>PVC Louvers</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('WPC Louvers')}>
                  <p className={currentCategory === 'WPC Louvers' ? 'selected-category' : ''}>WPC Louvers</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('Charcoal Louvers')}>
                  <p className={currentCategory === 'Charcoal Louvers' ? 'selected-category' : ''}>Charcoal Louvers</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('Five G Louvers')}>
                  <p className={currentCategory === 'Five G Louvers' ? 'selected-category' : ''}>Five G Louvers</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('Marble sheets')}>
                  <p className={currentCategory === 'Marble sheets' ? 'selected-category' : ''}>Marble sheets</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('Acrylic Sheets')}>
                  <p className={currentCategory === 'Acrylic Sheets' ? 'selected-category' : ''}>Acrylic Sheets</p>
                </div>
                <div className="slider-item" onClick={() => handleSliderClick('Flooring')}>
                  <p className={currentCategory === 'Flooring' ? 'selected-category' : ''}>Flooring</p>
                </div>
              </div>
            </div>
          ) : (
            <Slider {...sliderSettings} className="design-slider-bar">
              <div onClick={() => handleSliderClick('Kitchen Designs')}>
                <p className={currentCategory === 'Kitchen Designs' ? 'selected-category' : ''}>Kitchen Designs</p>
              </div>
              <div onClick={() => handleSliderClick('Bedroom Designs')}>
                <p className={currentCategory === 'Bedroom Designs' ? 'selected-category' : ''}>Bedroom Designs</p>
              </div>
              <div onClick={() => handleSliderClick('Bathroom Designs')}>
                <p className={currentCategory === 'Bathroom Designs' ? 'selected-category' : ''}>Bathroom Designs</p>
              </div>
              <div onClick={() => handleSliderClick('Lounge area Designs')}>
                <p className={currentCategory === 'Lounge area Designs' ? 'selected-category' : ''}>Lounge area</p>
              </div>
              <div onClick={() => handleSliderClick('Home Cinema Designs')}>
                <p className={currentCategory === 'Home Cinema Designs' ? 'selected-category' : ''}>Home Cinema</p>
              </div>
              <div onClick={() => handleSliderClick('TV Unit Designs')}>
                <p className={currentCategory === 'Kids Room Designs' ? 'selected-category' : ''}>TV Unit</p>
              </div>
              <div onClick={() => handleSliderClick('Commercial Designs')}>
                <p className={currentCategory === 'Commercial Designs' ? 'selected-category' : ''}>Commercial Designs</p>
              </div>
              <div onClick={() => handleSliderClick('House Exterior')}>
                <p className={currentCategory === 'House Exterior' ? 'selected-category' : ''}>House Exterior</p>
              </div>
              <div onClick={() => handleSliderClick('PVC Louvers')}>
                <p className={currentCategory === 'PVC Louvers' ? 'selected-category' : ''}>PVC Louvers</p>
              </div>
              <div onClick={() => handleSliderClick('WPC Louvers')}>
                <p className={currentCategory === 'WPC Louvers' ? 'selected-category' : ''}>WPC Louvers</p>
              </div>
              <div onClick={() => handleSliderClick('Charcoal Louvers')}>
                <p className={currentCategory === 'Charcoal Louvers' ? 'selected-category' : ''}>Charcoal Louvers</p>
              </div>
              <div onClick={() => handleSliderClick('Five G Louvers')}>
                <p className={currentCategory === 'Five G Louvers' ? 'selected-category' : ''}>Five G Louvers</p>
              </div>
              <div onClick={() => handleSliderClick('Marble sheets')}>
                <p className={currentCategory === 'Marble sheets' ? 'selected-category' : ''}>Marble sheets</p>
              </div>
              <div onClick={() => handleSliderClick('Acrylic Sheets')}>
                <p className={currentCategory === 'Acrylic Sheets' ? 'selected-category' : ''}>Acrylic Sheets</p>
              </div>
              <div onClick={() => handleSliderClick('Flooring')}>
                <p className={currentCategory === 'Flooring' ? 'selected-category' : ''}>Flooring</p>
              </div>
            </Slider>
          )}
        </div>

        <div className="design-display-list">
          {designList.map((item) => {
            if (currentCategory === "All" || currentCategory === item.category) {
              return (
                <Design
                  key={item._id}
                  id={item._id}
                  name={item.name}
                  description={item.description}
                  images={item.images}
                  points={item.points}
                  setShowLogin={setShowLogin}
                  setConsultData={setConsultData}
                  consultData={consultData}
                />
              );
            }
            return null;
          })}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default DesignDisplay;

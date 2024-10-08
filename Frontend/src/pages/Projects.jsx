import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/projects.css';
import Design from '../components/Design';
import MainNavbar from '../components/mainNavbar';
import Footer from '../components/Footer';


const Projects = ({ setShowLogin }) => {
  const url = "http://localhost:3000";
  const [designList, setDesignList] = useState([]);

  useEffect(() => {
    const fetchDesignList = async () => {
      try {
        const response = await axios.get(`${url}/api/design/list?category=Projects`);
        console.log(response);
        setDesignList(response.data.data);
      } catch (error) {
        console.error("Error fetching design list:", error);
      }
    };
    fetchDesignList();
  }, [url]);

  return (
    <div>
      <div className='project-display' id='project-display'>

        {/* New Design Navbar */}
        <MainNavbar setShowLogin={setShowLogin}/>

        <h2 className='project-heading'>Recent Projects</h2>
        <p className='project-main-para'>
          Check out our Recent Projects designs available here.
        </p>

        <div className="project-display-list">
          {designList.map((item) => {
              return (
                <Design
                  key={item._id}
                  id={item._id}
                  name={item.name}
                  description={item.description}
                  images={item.images}
                  points={item.points}
                  setShowLogin={setShowLogin}
                />
              );
          })}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default Projects;

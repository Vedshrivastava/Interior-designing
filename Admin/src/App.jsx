import React from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/sidebar';
import { Routes, Route } from 'react-router-dom';
import Add from './pages/Add';
import List from './pages/List';
import './index.css'
import 'react-toastify/dist/ReactToastify.css'
import {ToastContainer, toast} from 'react-toastify'
import Orders from './pages/Orders';
import Quotes from './pages/Quotes';

const App = () => {

  const url = "http://localhost:3000";

  return (
    <div>
      <ToastContainer/>
      <Navbar />
      <div className="app-contents">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path='/add' element={<Add url={url} /> } />
            <Route path='/list' element={<List url={url} />} />
            < Route path='/appointments' element={<Orders url={url} />}/>
            <Route path='/quotes' element={<Quotes url={url} />}/>
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default App;

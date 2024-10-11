import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import StoreContextProvider from './context/StoreContext'; // Adjust path if necessary

ReactDOM.createRoot(document.getElementById('root')).render(
  <StoreContextProvider> {/* Wrap the app with StoreContextProvider */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StoreContextProvider>
);

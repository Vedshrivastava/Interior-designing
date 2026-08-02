import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Every raw <i className="fa fa-..."> icon across the app (date-picker nav
// chevrons, dropdown carets, etc. — anything not using the FontAwesomeIcon
// React component) depends on this actual icon font/CSS being loaded; the
// package was already a dependency but its stylesheet was never imported,
// so every one of those icons rendered invisible (near-zero-width, no
// visible glyph) everywhere in the app.
import '@fortawesome/fontawesome-free/css/all.min.css';
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

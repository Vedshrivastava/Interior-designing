// // src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { StoreContextProvider } from "./Admin/context/StoreContext.jsx"; // ✅ import the provider

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreContextProvider>
        {" "}
        {/* ✅ wrap your entire app here */}
        <App />
      </StoreContextProvider>
    </BrowserRouter>
  </React.StrictMode>
);

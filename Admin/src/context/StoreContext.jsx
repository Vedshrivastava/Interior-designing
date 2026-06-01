import { createContext, useState, useEffect } from "react";
import axios from "axios";

export const StoreContext = createContext(null);

const StoreContextProvider = (props) => {
  const url = "http://localhost:3000";

  // null instead of "" so !token checks work reliably everywhere
  const [token,     setToken]     = useState(() => localStorage.getItem("token")     || null);
  const [userId,    setUserId]    = useState(() => localStorage.getItem("userId")    || "");
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem("userEmail") || "");
  const [userName,  setUserName]  = useState(() => localStorage.getItem("userName")  || "");
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("token"));

  /* ── Global axios 401 interceptor ──
     Catches cases where the backend rejects the token before the
     Navbar's client-side timer fires (e.g. server clock drift, manual
     token revocation, or a tab that was offline when the token expired). */
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          ['token', 'userId', 'userName', 'userEmail', 'user'].forEach(k =>
            localStorage.removeItem(k)
          );
          window.location.replace('/?reason=expired');
        }
        return Promise.reject(error);
      }
    );

    // Clean up interceptor when provider unmounts (avoids duplicates in dev strict mode)
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const contextValue = {
    url,
    token,
    userId,
    userName,
    userEmail,
    isLoggedIn,
    setIsLoggedIn,
    setToken,
    setUserId,
    setUserEmail,
    setUserName,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {props.children}
    </StoreContext.Provider>
  );
};

export default StoreContextProvider;

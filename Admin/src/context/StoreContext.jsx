import { createContext, useState } from "react";

export const StoreContext = createContext(null);

const StoreContextProvider = (props) => {
  const url = "http://localhost:3000";

  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [userId, setUserId] = useState(() => localStorage.getItem("userId") || "");
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem("userEmail") || "");
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("token"));

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

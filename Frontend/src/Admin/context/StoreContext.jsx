import { createContext, useState } from "react";

export const StoreContext = createContext(null);

export const StoreContextProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);

  return (
    <StoreContext.Provider
      value={{
        token,
        setToken,
        userId,
        setUserId,
        userEmail,
        setUserEmail,
        userName,
        setUserName,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

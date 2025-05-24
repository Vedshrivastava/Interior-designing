import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminApp from "./Admin/AdminApp";
import UserApp from "./user/UserApp";

function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/*" element={<UserApp />} />
    </Routes>
  );
}

export default App;

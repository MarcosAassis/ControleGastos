import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { MonthProvider } from "./context/MonthContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <MonthProvider>
        <App />
      </MonthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

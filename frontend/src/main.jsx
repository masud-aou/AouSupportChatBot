// main.jsx — Entry point of the React application
// This file mounts the main <App /> component into the HTML DOM
// It ensures the entire app runs in React StrictMode for debugging and safety checks

import { StrictMode } from "react";              // Enables extra checks and warnings in development
import { createRoot } from "react-dom/client";   // React 18+ method for rendering the app
import "./index.css";                            // Global styles (Tailwind and custom CSS)
import App from "./App.jsx";                     // Import the main App component

// ------------------------------------------------------------
// Mount the React app to the HTML element with id="root"
// The <StrictMode> wrapper activates additional checks in development mode
// ------------------------------------------------------------
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />   {/* Main application component */}
  </StrictMode>
);
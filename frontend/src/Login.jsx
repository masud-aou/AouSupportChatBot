// Login.jsx — Login & Registration Component for AOUSupportBot
// Handles both login and user registration (signup)
// Communicates with Flask backend via RESTful API (http://localhost:8000)

import React, { useState } from "react";
import axios from "axios";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "https://aousupportchatbot.onrender.com";



function Login({ onLogin }) {
  // -----------------------------------------------
  // State Management — Track form inputs & messages
  // -----------------------------------------------
  const [username, setUsername] = useState(""); // Username for signup
  const [email, setEmail] = useState("");       // User email for both login/signup
  const [password, setPassword] = useState(""); // User password
  const [message, setMessage] = useState("");   // Feedback message to show success/error

  // ---------------------------------------------------
  // Function: handleLogin()
  // Sends login credentials to Flask backend and checks
  // whether the email/password combination is valid.
  // ---------------------------------------------------
  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent form from refreshing the page

    // Quick validation before sending request
    if (!email || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    try {
      // Send POST request to Flask API
      const res = await axios.post(`${API_BASE}/login`, {
        email,
        password,
      });

      // Backend returns { success: true/false, message: "..." }
      if (res.data.success) {
        setMessage("✅ Logged in successfully!");
        onLogin({ email }); // Notify parent component (App.jsx)
      } else {
        // If login failed (wrong credentials)
        setMessage("❌ " + res.data.message);
      }
    } catch (error) {
      // Network or backend connection issue
      setMessage("⚠️ Server error — could not connect to backend.");
    }
  };

  // ---------------------------------------------------
  // Function: handleRegister()
  // Registers a new user by sending name, email, password
  // to Flask API at endpoint /register
  // ---------------------------------------------------
  const handleRegister = async () => {
    // Simple validation
    if (!username || !email || !password) {
      setMessage("Please fill in all fields before signing up.");
      return;
    }

    try {
      // Send registration request
      const res = await axios.post(`${API_BASE}/register`, {
        username,
        email,
        password,
      });

      // Display response message from Flask (success or duplicate email)
      setMessage(res.data.message);
    } catch (error) {
      // Error in server connection or request
      setMessage("⚠️ Server error — could not complete registration.");
    }
  };

  // ---------------------------------------------------
  // UI Layout — Styled with TailwindCSS classes
  // ---------------------------------------------------
  return (
    <div className="p-6 bg-white text-gray-800 rounded-lg shadow-lg w-full">
      {/* Section Title */}
      <h2 className="text-2xl font-bold text-center mb-5 text-[#0a3866]">
        🔐 Log in / Sign up
      </h2>

      {/* ---------------------- Login & Signup Form ---------------------- */}
      <form onSubmit={handleLogin} className="flex flex-col gap-4">

        {/* Username Input (used only for registration) */}
        <input
          type="text"
          placeholder="Username (for sign up)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border border-gray-500 rounded-lg p-3 text-lg font-bold bg-[#0a3866] text-white 
                     placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#124c9c]"
        />

        {/* Email Input Field */}
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-gray-500 rounded-lg p-3 text-lg font-bold bg-[#0a3866] text-white 
                     placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#124c9c]"
        />

        {/* Password Input Field */}
        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-500 rounded-lg p-3 text-lg font-bold bg-[#0a3866] text-white 
                     placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#124c9c]"
        />

        {/* Login Button — triggers handleLogin() */}
        <button
          type="submit"
          className="bg-[#045c0b] text-white py-3 rounded-lg text-lg font-semibold hover:bg-[#124c9c] transition-all"
        >
          Log in
        </button>

        {/* Registration Button — triggers handleRegister() */}
        <button
          type="button"
          onClick={handleRegister}
          className="bg-[#b5092b] text-white py-3 rounded-lg text-lg font-semibold hover:bg-[#124c9c] transition-all"
        >
          Sign up
        </button>
      </form>

      {/* ---------------------- Feedback Message ---------------------- */}
      {/* Displays success or error message under the form */}
      {message && (
        <div className="mt-4 text-center text-red-500 font-semibold">
          {message}
        </div>
      )}
    </div>
  );
}

export default Login;
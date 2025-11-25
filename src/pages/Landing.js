import React from "react";
import { useNavigate } from "react-router-dom";
import "./Landing.css";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing-container">
      <div className="landing-slide">
        <h1>Welcome to CPH Balamban Connect</h1>
        <p>Your health, our priority. Sign up or log in to get started.</p>
        <button onClick={() => navigate("/auth")} className="btn-primary">
          Login / Register
        </button>
      </div>

      <div className="landing-slide secondary">
        <h2>Easy Access to Care</h2>
        <p>Manage appointments, lab results, and communications with ease.</p>
      </div>

      <div className="landing-slide tertiary">
        <h2>Secure & Fast</h2>
        <p>All your data is protected and synced in real-time.</p>
      </div>
    </div>
  );
}

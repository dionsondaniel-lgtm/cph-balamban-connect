// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import AuthForm from "./pages/AuthForm";
import StaffPanel from "./pages/StaffPanel";
import PatientPanel from "./pages/PatientPanel";
import Home from "./pages/Home";

export default function App() {
  return (
    <Router>
      <Routes>

        {/* Public pages */}
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<AuthForm />} />

        {/* Home (optional redirect logic inside Home page) */}
        <Route path="/home" element={<Home />} />

        {/* Panels (require profile passed via navigate state) */}
        <Route path="/staffpanel" element={<StaffPanel />} />
        <Route path="/patientpanel" element={<PatientPanel />} />

      </Routes>
    </Router>
  );
}

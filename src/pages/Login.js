// src/pages/Login.js
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [identifier, setIdentifier] = useState(""); // email or phone
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      let loginResponse;

      if (identifier.includes("@")) {
        loginResponse = await supabase.auth.signInWithPassword({
          email: identifier,
          password,
        });
      } else {
        loginResponse = await supabase.auth.signInWithPassword({
          phone: identifier,
          password,
        });
      }

      if (loginResponse.error) throw loginResponse.error;

      const userId = loginResponse.data.user.id;

      // Fetch profile from users table
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        setMessage("User not found in database.");
        setLoading(false);
        return;
      }

      // Navigate to panel and pass profile via state
      if (profile.role === "staff") {
        navigate("/staffpanel", { state: { profile } });
      } else {
        navigate("/patientpanel", { state: { profile } });
      }
    } catch (err) {
      setMessage(err.message);
    }

    setLoading(false);
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", fontFamily: "Arial, sans-serif" }}>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Phone number or Email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          style={{ width: "100%", marginBottom: "10px", padding: "8px" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", marginBottom: "10px", padding: "8px" }}
        />
        <button type="submit" disabled={loading} style={{ width: "100%", padding: "10px" }}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      {message && <p style={{ color: "red", marginTop: "10px" }}>{message}</p>}
    </div>
  );
}

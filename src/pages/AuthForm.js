// src/pages/AuthForm.js
import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import "./AuthForm.css";

export default function AuthForm() {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState("patient");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    position: "",
    secret: ""
  });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { first_name, last_name, email, password, position, secret } = form;

    try {
      // -----------------------
      // REGISTRATION
      // -----------------------
      if (isRegister) {
        if (!first_name || !last_name || !email || !password) {
          setMessage("First name, last name, email, and password are required.");
          setLoading(false);
          return;
        }

        if (role === "staff") {
          if (!position) {
            setMessage("Staff must provide position.");
            setLoading(false);
            return;
          }
          if (secret !== "1234") {
            setMessage("Invalid staff registration code!");
            setLoading(false);
            return;
          }
        }

        const { data: authData, error: authError } =
          await supabase.auth.signUp({ email, password });

        if (authError) throw authError;

        const userId = authData.user?.id;
        if (!userId) throw new Error("Signup failed: no user ID returned.");

        const { error: dbError } = await supabase.from("users").insert([
          {
            id: userId,
            first_name,
            last_name,
            email,
            role,
            position: role === "staff" ? position : null,
            verified: true
          }
        ]);

        if (dbError) throw dbError;

        setMessage("Registration successful! You can now log in.");
        setIsRegister(false);
        setForm({
          first_name: "",
          last_name: "",
          email: "",
          password: "",
          position: "",
          secret: ""
        });
      }

      // -----------------------
      // LOGIN
      // -----------------------
      else {
        if (!email || !password) {
          setMessage("Email and password are required.");
          setLoading(false);
          return;
        }

        const { data: loginData, error: loginError } =
          await supabase.auth.signInWithPassword({ email, password });

        if (loginError) throw loginError;

        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("*")
          .eq("id", loginData.user.id)
          .single();

        if (profileError || !profile) {
          setMessage("User not found.");
          setLoading(false);
          return;
        }

        // -----------------------
        // 🎯 FIXED: PASS PROFILE TO PANEL
        // -----------------------
        if (profile.role === "staff")
          navigate("/staffpanel", { state: { profile } });
        else
          navigate("/patientpanel", { state: { profile } });
      }
    } catch (err) {
      setMessage(err.message);
    }

    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isRegister ? "Register" : "Login"}</h2>

        {isRegister && (
          <div className="role-select">
            <label>Role:</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="patient">Patient</option>
              <option value="staff">Staff</option>
            </select>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <input name="first_name" placeholder="First Name"
                     value={form.first_name} onChange={handleChange} />
              <input name="last_name" placeholder="Last Name"
                     value={form.last_name} onChange={handleChange} />
            </>
          )}

          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />

          {role === "staff" && isRegister && (
            <>
              <select
                name="position"
                value={form.position}
                onChange={handleChange}
              >
                <option value="">Select Position</option>
                <option value="Doctor">Doctor</option>
                <option value="Nurse">Nurse</option>
                <option value="Midwife">Midwife</option>
                <option value="Laboratory">Laboratory Staff</option>
                <option value="Pharmacy">Pharmacy Staff</option>
                <option value="Admin">Admin</option>
              </select>

              <input
                name="secret"
                type="password"
                placeholder="Staff Registration Code"
                value={form.secret}
                onChange={handleChange}
              />
            </>
          )}

          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
          />

          <button disabled={loading}>
            {loading ? "Please wait..." : isRegister ? "Register" : "Login"}
          </button>
        </form>

        <p className="toggle-text">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <span onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? "Login here" : "Register here"}
          </span>
        </p>

        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
}

import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import "./Home.css";

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = location.state?.profile;

  useEffect(() => {
    if (!profile) return;  // prevent undefined

    if (profile.role === "staff") {
      navigate("/staffpanel", { state: { profile } });
    } else {
      navigate("/patientpanel", { state: { profile } });
    }
  }, [profile, navigate]);

  return <p>Loading...</p>;
}

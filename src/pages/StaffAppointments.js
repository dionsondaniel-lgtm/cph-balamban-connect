// src/pages/StaffAppointments.js
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import "./StaffPanel.css";

export default function StaffAppointments({ staffId }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch appointments for this staff
  const fetchAppointments = useCallback(async () => {
    if (!staffId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        status,
        patient:users (first_name,last_name,email)
      `)
      .eq("staff_id", staffId)
      .order("appointment_date", { ascending: true });

    if (!error) setAppointments(data || []);
    setLoading(false);
  }, [staffId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Update status
  const updateStatus = async (id, status) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert("Error updating appointment.");
      console.log(error);
      return;
    }

    fetchAppointments();
  };

  // Reschedule (staff suggests new time)
  const requestReschedule = async (id) => {
    const newDate = prompt("Enter suggested new time (YYYY-MM-DD HH:MM)");
    if (!newDate) return;

    const { error } = await supabase
      .from("appointments")
      .update({
        appointment_date: new Date(newDate).toISOString(),
        status: "reschedule_requested",
      })
      .eq("id", id);

    if (error) {
      alert("Error requesting reschedule.");
      console.log(error);
      return;
    }

    fetchAppointments();
  };

  if (!staffId) return <p>Loading staff data...</p>;
  if (loading) return <p>Loading appointments...</p>;

  return (
    <div className="staff-panel">
      <h3>Your Appointments</h3>

      {appointments.length === 0 ? (
        <p>No appointments found.</p>
      ) : (
        <table className="appointments-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Date & Time</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {appointments.map((appt) => (
              <tr key={appt.id}>
                <td>{appt.patient?.first_name} {appt.patient?.last_name}</td>

                <td>{new Date(appt.appointment_date).toLocaleString()}</td>

                <td className="status-col">{appt.status}</td>

                <td>
                  {/* APPROVE */}
                  <button
                    className="confirm-btn"
                    onClick={() => updateStatus(appt.id, "confirmed")}
                  >
                    Approve
                  </button>

                  {/* REJECT */}
                  <button
                    className="reject-btn"
                    onClick={() => updateStatus(appt.id, "rejected")}
                  >
                    Reject
                  </button>

                  {/* REQUEST RESCHEDULE */}
                  <button
                    className="schedule-btn"
                    onClick={() => requestReschedule(appt.id)}
                  >
                    Request Reschedule
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      )}
    </div>
  );
}

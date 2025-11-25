import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useLocation } from "react-router-dom";
import "./StaffPanel.css";
import Chat from "../components/Chat";

export default function StaffPanel() {
  const location = useLocation();
  const profile = location.state?.profile;

  const [allAppointments, setAllAppointments] = useState([]);
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewModal, setViewModal] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [newDate, setNewDate] = useState("");

  const [searchText, setSearchText] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [chatModal, setChatModal] = useState(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadSummary, setUnreadSummary] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);

  // ---------------- Notifications ----------------
  const fetchUnreadNotifications = useCallback(async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("receiver_id", profile.id)
      .order("created_at", { ascending: true });

    if (error) return console.error(error);

    const grouped = {};
    data.forEach((msg) => {
      const sender = msg.sender_id;
      if (!grouped[sender]) grouped[sender] = [];
      grouped[sender].push(msg);
    });

    const summaries = await Promise.all(
      Object.keys(grouped).map(async (senderId) => {
        const messages = grouped[senderId];
        const lastMessage = messages[messages.length - 1];
        const unread = messages.filter((m) => !m.read_status).length;

        const { data: user } = await supabase
          .from("users")
          .select("id, first_name, last_name")
          .eq("id", senderId)
          .single();

        return {
          id: user?.id || senderId,
          first_name: user?.first_name || "Unknown",
          last_name: user?.last_name || "",
          last_message: lastMessage?.message || "",
          last_message_time: lastMessage?.created_at || "",
          unread_count: unread,
        };
      })
    );

    setUnreadSummary(summaries);
    setUnreadCount(summaries.reduce((sum, s) => sum + s.unread_count, 0));
  }, [profile]);

  useEffect(() => {
    fetchUnreadNotifications();
    if (!profile) return;

    const channel = supabase
      .channel("notifications_channel_staff")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${profile.id}`,
        },
        () => fetchUnreadNotifications()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchUnreadNotifications, profile]);

  // ---------------- Fetch Appointments ----------------
  const fetchAppointments = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        status,
        patient:users!appointments_patient_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("staff_id", profile.id)
      .order("appointment_date", { ascending: true });

    if (error) {
      console.error(error);
      setAllAppointments([]);
      setFilteredAppointments([]);
      setLoading(false);
      return;
    }

    setAllAppointments(data);
    setFilteredAppointments(data);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  // ---------------- Filters ----------------
  useEffect(() => {
    let filtered = allAppointments;

    if (searchText) {
      const text = searchText.toLowerCase();
      filtered = filtered.filter(
        (appt) =>
          appt.patient?.first_name?.toLowerCase().includes(text) ||
          appt.patient?.last_name?.toLowerCase().includes(text)
      );
    }

    if (searchDate) {
      const start = new Date(searchDate);
      const end = new Date(searchDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((appt) => {
        const apptDate = new Date(appt.appointment_date);
        return apptDate >= start && apptDate <= end;
      });
    }

    if (statusFilter) {
      filtered = filtered.filter((appt) => appt.status === statusFilter);
    }

    setFilteredAppointments(filtered);
  }, [searchText, searchDate, statusFilter, allAppointments]);

  // ---------------- Appointment Actions ----------------
  const confirmAppointment = async (id) => {
    if (!window.confirm("Confirm this appointment?")) return;
    await supabase.from("appointments").update({ status: "confirmed" }).eq("id", id);
    fetchAppointments();
  };

  const cancelAppointment = async (id) => {
    if (!window.confirm("Cancel this appointment?")) return;
    await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    fetchAppointments();
  };

  const markDone = async (id) => {
    if (!window.confirm("Mark this appointment as done?")) return;
    await supabase.from("appointments").update({ status: "done" }).eq("id", id);
    fetchAppointments();
  };

  const saveReschedule = async () => {
    if (!newDate) return alert("Select a new date");
    await supabase
      .from("appointments")
      .update({
        appointment_date: new Date(newDate).toISOString(),
        status: "pending",
      })
      .eq("id", rescheduleModal.id);

    setRescheduleModal(null);
    setNewDate("");
    fetchAppointments();
  };

  const openChat = async (patientSummary) => {
  if (!patientSummary) return;

  // If the summary already has id, first_name, last_name, use it directly
  let patient = patientSummary;

  // But if patientSummary came from notifications and lacks full info, fetch it
  if (!patientSummary.email) { // assuming 'email' indicates incomplete info
    const { data: fullPatient, error } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("id", patientSummary.id)
      .single();
    if (error) return console.error("Failed to fetch patient", error);
    patient = fullPatient;
  }

  setChatModal(patient);
};

  if (!profile) return <p>No profile. Please login again.</p>;
  if (loading) return <p>Loading appointments...</p>;

  return (
    <div className="staff-panel">
      {/* Header */}
      <div className="header">
        <h2>Welcome, {profile.first_name}</h2>

        {/* Notifications */}
        <div className="notif-bell-container">
          <div className="notif-bell" onClick={() => setBellOpen((p) => !p)}>
            🔔 {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
          </div>

          {bellOpen && (
            <div className="notif-dropdown scrollable-dropdown">
              {unreadSummary.length === 0 && <div className="notif-empty">No messages</div>}
              {unreadSummary.map((sender) => {
                const timeLabel = sender.last_message_time
                  ? new Date(sender.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : "";
                return (
                  <div
                    key={sender.id}
                    className="notif-item"
                    onClick={() => {
                      openChat(sender);
                      setBellOpen(false);
                    }}
                  >
                    <div className="notif-top">
                      <span className="notif-name">{sender.first_name} {sender.last_name}</span>
                      {sender.unread_count > 0 && <span className="notif-unread-dot">{sender.unread_count}</span>}
                    </div>
                    <div className="notif-msg">{sender.last_message.slice(0, 40)}{sender.last_message.length > 40 ? "..." : ""}</div>
                    <div className="notif-time">{timeLabel}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Search & Table */}
      <div className="search-bar">
        <input type="text" placeholder="Search patient name..." value={searchText} onChange={e => setSearchText(e.target.value)} />
        <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button onClick={fetchAppointments}>Refresh</button>
      </div>

      {filteredAppointments.length === 0 ? <p>No appointments found.</p> :
        <table className="appointments-table">
          <thead>
            <tr>
              <th>Patient</th><th>Date/Time</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAppointments.map((appt) => (
              <tr key={appt.id}>
                <td>{appt.patient?.first_name} {appt.patient?.last_name}</td>
                <td>{new Date(appt.appointment_date).toLocaleString()}</td>
                <td className={`status ${appt.status}`}>{appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}</td>
                <td className="actions-col">
                  <button className="action-btn view" onClick={() => setViewModal(appt)}>View</button>
                  <button className="action-btn confirm" disabled={["done","cancelled"].includes(appt.status)} onClick={()=>confirmAppointment(appt.id)}>Confirm</button>
                  <button className="action-btn cancel" disabled={["done","cancelled"].includes(appt.status)} onClick={()=>cancelAppointment(appt.id)}>Cancel</button>
                  <button className="action-btn resched" disabled={["done","cancelled"].includes(appt.status)} onClick={()=>setRescheduleModal(appt)}>Reschedule</button>
                  {appt.status!=="done" && appt.status!=="cancelled" && <button className="action-btn done" onClick={()=>markDone(appt.id)}>Done</button>}
                  <button className="action-btn message" onClick={()=>openChat(appt.patient)}>Message</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }

      {/* View Modal */}
      {viewModal && (
        <div className="modal-overlay">
          <div className="modal-card wide">
            <h3>Appointment Details</h3>
            <p><strong>Patient:</strong> {viewModal.patient?.first_name} {viewModal.patient?.last_name}</p>
            <p><strong>Email:</strong> {viewModal.patient?.email}</p>
            <p><strong>Date:</strong> {new Date(viewModal.appointment_date).toLocaleString()}</p>
            <p><strong>Status:</strong> {viewModal.status}</p>
            <button className="close-btn" onClick={() => setViewModal(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Reschedule Appointment</h3>
            <input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)} />
            <div className="modal-actions">
              <button className="save-btn" onClick={saveReschedule}>Save</button>
              <button className="cancel-btn" onClick={()=>setRescheduleModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatModal && (
        <Chat
          profile={profile}
          patient={chatModal}
          onClose={() => {
            setChatModal(null);
            fetchUnreadNotifications();
          }}
        />
      )}
    </div>
  );
}

import React, { useEffect, useState, useCallback } from "react"; 
import { supabase } from "../supabaseClient";
import { useLocation } from "react-router-dom";
import "./PatientPanel.css";
import Chat from "../components/Chat";

export default function PatientPanel() {
  const location = useLocation();
  const profile = location.state?.profile;

  const [appointments, setAppointments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");

  const [chatOpen, setChatOpen] = useState(false);
  const [chatStaff, setChatStaff] = useState(null);

  const [bellOpen, setBellOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadSummary, setUnreadSummary] = useState([]);

  // ---------------- Fetch Staff ----------------
  const fetchStaff = useCallback(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, last_name, position, role")
      .eq("role", "staff");

    if (error) console.error("Staff error:", error);
    else {
      setStaffList(data);
      setFilteredStaff(data);
    }
  }, []);

  useEffect(() => {
    const filtered = staffList.filter((s) =>
      `${s.first_name} ${s.last_name} ${s.position}`.toLowerCase().includes(search.toLowerCase())
    );
    setFilteredStaff(filtered);
  }, [search, staffList]);

  // ---------------- Fetch Appointments ----------------
  const fetchAppointments = useCallback(async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        status,
        staff:users!appointments_staff_id_fkey (id, first_name, last_name, position)
      `)
      .eq("patient_id", profile.id)
      .order("appointment_date", { ascending: true });

    if (error) console.error(error);
    else setAppointments(data || []);

    setLoading(false);
  }, [profile]);

  // ---------------- Fetch Notifications ----------------
  const fetchUnreadNotifications = useCallback(async () => {
    if (!profile) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .or(`receiver_id.eq.${profile.id},sender_id.eq.${profile.id}`)
      .order("created_at", { ascending: false });

    if (error) return console.error(error);

    // Group by sender
    const grouped = {};
    data.forEach(msg => {
      const senderKey = msg.sender_id === profile.id ? msg.receiver_id : msg.sender_id;
      if (!grouped[senderKey]) grouped[senderKey] = [];
      grouped[senderKey].push(msg);
    });

    const summaries = await Promise.all(
      Object.keys(grouped).map(async (key) => {
        const msgs = grouped[key];
        msgs.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        const lastMessage = msgs[0];
        const unread = msgs.filter(m => !m.read_status && m.receiver_id === profile.id).length;

        const { data: staff } = await supabase
          .from("users")
          .select("id, first_name, last_name")
          .eq("id", key)
          .single();

        const messageDate = new Date(lastMessage.created_at);
        const now = new Date();
        const dateLabel = messageDate.toDateString() === now.toDateString()
          ? "Today"
          : messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

        return {
          ...staff,
          last_message: lastMessage.message,
          last_message_time: lastMessage.created_at,
          unread_count: unread,
          message_date_label: dateLabel
        };
      })
    );

    setUnreadSummary(summaries);
    setUnreadCount(summaries.reduce((s, i) => s + i.unread_count, 0));
  }, [profile]);

  // ---------------- Realtime Listener ----------------
  useEffect(() => {
    fetchAppointments();
    fetchStaff();
    fetchUnreadNotifications();

    if (!profile) return;

    const channel = supabase
      .channel("patient_notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `receiver_id=eq.${profile.id}`
        },
        () => fetchUnreadNotifications()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [fetchAppointments, fetchStaff, fetchUnreadNotifications, profile]);

  // ---------------- Save Appointment ----------------
  const saveAppointment = async () => {
    if (!selectedStaff || !selectedDate)
      return alert("Please select staff and date.");

    const { error } = await supabase.from("appointments").insert({
      patient_id: profile.id,
      staff_id: selectedStaff.id,
      appointment_date: new Date(selectedDate).toISOString(),
      status: "pending"
    });

    if (error) return alert("Saving failed.");

    setShowModal(false);
    setSelectedStaff(null);
    setSelectedDate("");
    fetchAppointments();
  };

  if (!profile || loading) return <p>Loading...</p>;

  return (
    <div className="patient-panel">
      <div className="header">
        <h2>Welcome, {profile.first_name}</h2>

        {/* Notification Bell */}
        <div className="notif-bell-container">
          <div className="notif-bell" onClick={() => setBellOpen(prev => !prev)}>
            🔔
            {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
          </div>

          {bellOpen && (
            <div className="notif-dropdown scrollable-dropdown">
              {unreadSummary.length === 0 && <div className="notif-empty">No messages</div>}
              
              {unreadSummary.map(sender => {
                const timeLabel = new Date(sender.last_message_time)
                  .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                return (
                  <div
                    key={sender.id}
                    className="notif-item"
                    onClick={() => {
                      setChatStaff(sender);
                      setChatOpen(true);
                      setBellOpen(false);
                    }}
                  >
                    <div className="notif-top">
                      <span className="notif-name">
                        {sender.first_name} {sender.last_name}
                      </span>
                      <span className="notif-time">
                        {sender.message_date_label} {timeLabel}
                      </span>
                      {sender.unread_count > 0 && (
                        <span className="notif-unread-dot">{sender.unread_count}</span>
                      )}
                    </div>
                    <div className="notif-msg">
                      {sender.last_message.length > 50
                        ? sender.last_message.slice(0, 50) + "..."
                        : sender.last_message}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <button className="add-btn" onClick={() => setShowModal(true)}>
        ➕ Book Appointment
      </button>

      <h3>Your Appointments</h3>
      {appointments.length === 0 ? (
        <p>No appointments yet.</p>
      ) : (
        <table className="appointments-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map(appt => (
              <tr key={appt.id}>
                <td>{appt.staff?.first_name} {appt.staff?.last_name} ({appt.staff?.position})</td>
                <td>{new Date(appt.appointment_date).toLocaleString()}</td>
                <td>{appt.status}</td>
                <td>
                  <button
                    className="action-btn message"
                    onClick={() => {
                      setChatStaff(appt.staff);
                      setChatOpen(true);
                    }}
                  >
                    Chat
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Book Appointment</h3>
            <input
              type="text"
              className="search-input"
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="staff-list">
              {filteredStaff.map((s) => (
                <div
                  key={s.id}
                  className={`staff-item ${selectedStaff?.id === s.id ? "selected" : ""}`}
                  onClick={() => setSelectedStaff(s)}
                >
                  <strong>{s.first_name} {s.last_name}</strong>
                  <span>{s.position}</span>
                </div>
              ))}
            </div>

            {selectedStaff && (
              <p className="selected-staff-text">
                Selected: {selectedStaff.first_name} {selectedStaff.last_name}
              </p>
            )}

            <label>Date & Time</label>
            <input
              type="datetime-local"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />

            <div className="modal-actions">
              <button className="save-btn" onClick={saveAppointment}>Save</button>
              <button className="cancel-btn" onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      {chatOpen && chatStaff && profile && (
        <Chat
          profile={profile}
          patient={chatStaff}
          onClose={() => {
            setChatOpen(false);
            setChatStaff(null);
            fetchUnreadNotifications();
          }}
        />
      )}
    </div>
  );
}

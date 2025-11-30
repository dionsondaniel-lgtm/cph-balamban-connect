import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import "./Chat.css";

export default function Chat({ profile, patient, onClose }) {
  const [chatMessages, setChatMessages] = useState([]);
  const [allConversations, setAllConversations] = useState([]);
  const [activePatient, setActivePatient] = useState(patient || null);
  const [newChatMsg, setNewChatMsg] = useState("");

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // ---------------- Fetch all conversations ----------------
  const fetchConversations = useCallback(async () => {
    if (!profile) return;

    const { data: msgs } = await supabase
      .from("notifications")
      .select("*")
      .or(`receiver_id.eq.${profile.id},sender_id.eq.${profile.id}`)
      .order("created_at", { ascending: false });

    const grouped = {};
    msgs.forEach((m) => {
      const otherUser = m.sender_id === profile.id ? m.receiver_id : m.sender_id;
      if (!grouped[otherUser]) grouped[otherUser] = [];
      grouped[otherUser].push(m);
    });

    const convos = await Promise.all(
      Object.keys(grouped).map(async (uid) => {
        const { data: user } = await supabase
          .from("users")
          .select("id, first_name, last_name")
          .eq("id", uid)
          .single();

        const list = grouped[uid];
        const last = list[0];
        const unread = list.filter(
          (msg) => msg.receiver_id === profile.id && !msg.read_status
        ).length;

        return {
          user: user || { first_name: "Unknown", last_name: "" },
          last_message: last?.message || "",
          time: last?.created_at || "",
          unread_count: unread,
        };
      })
    );

    setAllConversations(convos);

    if (!activePatient && convos.length > 0) {
      setActivePatient(convos[0].user);
    }
  }, [profile, activePatient]);

  // ---------------- Fetch messages for a patient ----------------
  const fetchMessages = useCallback(
    async (patientParam) => {
      if (!profile || !patientParam) return;

      const roomId1 = `room_staff${profile.id}_patient${patientParam.id}`;
      const roomId2 = `room_staff${patientParam.id}_patient${profile.id}`;

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .or(`room_id.eq.${roomId1},room_id.eq.${roomId2}`)
        .order("created_at", { ascending: true });

      setChatMessages(data || []);

      const unread = (data || []).filter(
        (msg) => msg.receiver_id === profile.id && !msg.read_status
      );
      if (unread.length > 0) {
        await supabase
          .from("notifications")
          .update({ read_status: true })
          .in("id", unread.map((u) => u.id));
      }

      fetchConversations();
    },
    [profile, fetchConversations]
  );

  // ---------------- Effect: Update chat when activePatient changes ----------------
  useEffect(() => {
    if (!activePatient) return;
    fetchMessages(activePatient);

    const roomId1 = `room_staff${profile.id}_patient${activePatient.id}`;
    const roomId2 = `room_staff${activePatient.id}_patient${profile.id}`;

    const channel = supabase
      .channel(`chat_staff${profile.id}_patient${activePatient.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `or=(room_id.eq.${roomId1},room_id.eq.${roomId2})`,
        },
        () => fetchMessages(activePatient)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activePatient, profile, fetchMessages]);

  // ---------------- Auto-expand textarea ----------------
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    }
  }, [newChatMsg]);

  // ---------------- Auto-scroll ----------------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ---------------- Send new message ----------------
  const sendChatMessage = async () => {
    if (!newChatMsg.trim() || !activePatient || !profile) return;

    const roomId = `room_staff${profile.id}_patient${activePatient.id}`;
    const messageData = {
      message: newChatMsg.trim(),
      sender_id: profile.id,
      receiver_id: activePatient.id,
      room_id: roomId,
      read_status: false,
    };

    setNewChatMsg("");
    setChatMessages((prev) => [
      ...prev,
      { ...messageData, created_at: new Date().toISOString() },
    ]);

    await supabase.from("notifications").insert([messageData]);
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const date = new Date(ts);
    const now = new Date();

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else {
      return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  };

  if (!profile || !activePatient) return <p>Loading chat...</p>;

  return (
    <div className="chat-overlay">
      <div className="chat-container">
        {/* Sidebar */}
        <aside className="chat-sidebar">
          <div className="sidebar-header">
            <h3>Messages</h3>
            <span className="close-main" onClick={onClose}>×</span>
          </div>
          <div className="sidebar-scroll">
            {allConversations.map((c) => (
              <div
                key={c.user.id}
                className={`sidebar-item ${activePatient?.id === c.user.id ? "active" : ""}`}
                onClick={() => setActivePatient(c.user)}
              >
                <div className="avatar">{c.user.first_name[0]}</div>
                <div className="sidebar-info">
                  <h4>{c.user.first_name} {c.user.last_name}</h4>
                  <p>{c.last_message.slice(0, 25)}{c.last_message.length > 25 ? "..." : ""}</p>
                </div>
                {c.unread_count > 0 && <span className="sidebar-unread">{c.unread_count}</span>}
              </div>
            ))}
          </div>
        </aside>

        {/* Chat Main */}
        <main className="chat-main">
          <div className="chat-header-bar">
            <div className="avatar big">{activePatient.first_name[0]}</div>
            <h3>{activePatient.first_name} {activePatient.last_name}</h3>
          </div>

          <div className="chat-body">
            {chatMessages.map((msg) => {
              const mine = msg.sender_id === profile.id;
              return (
                <div key={msg.id || Math.random()} className={`bubble-row ${mine ? "right" : "left"}`}>
                  <div className={`bubble ${mine ? "mine" : "theirs"}`}>
                    <p className="bubble-text" style={{ whiteSpace: "pre-wrap" }}>{msg.message}</p>
                    <div className="bubble-time">
                      {formatTime(msg.created_at)}
                      {mine && <span className={`tick ${msg.read_status ? "read" : ""}`}>{msg.read_status ? "✓✓" : "✓"}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef}></div>
          </div>

          <div className="chat-input-bar">
            <textarea
              ref={textareaRef}
              value={newChatMsg}
              onChange={(e) => setNewChatMsg(e.target.value)}
              placeholder="Type a message..."
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
            />
            <button className="send-btn" onClick={sendChatMessage}>➤</button>
          </div>
        </main>
      </div>
    </div>
  );
}

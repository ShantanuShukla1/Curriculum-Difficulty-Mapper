import { useEffect, useState } from "react";

// AI-ASSISTED
// Date: 08-06-2026
// Developer: Shantanu Shukla
// Model: Claude Sonnet 4.6
// Prompt: "Write a React component that lets a dataset owner view who a
// dataset is shared with, add a new VT PID, and remove an existing one,
// calling GET/POST/DELETE on /api/datasets/<id>/shares(/share), matching
// the style conventions in CsvUploadForm.jsx."
// Modifications: None yet, used as generated — will adjust once wired
// into CurriculumMapLive alongside Nathan's dataset picker.
// Reason: Backend sharing endpoints (Jonathan) were already built; needed
// the matching frontend UI for tonight's deadline.
//
// Lets the owner of a dataset see who currently has access, grant access to
// a new VT PID, and revoke access from an existing one. Only rendered for
// datasets the logged-in user owns (backend enforces this too — every
// /shares endpoint 403s for non-owners).
export default function ShareDatasetPanel({ datasetId, isOwner }) {
  const [sharedWith, setSharedWith] = useState([]);
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!datasetId || !isOwner) {
      setSharedWith([]);
      return;
    }
    loadShares();
  }, [datasetId, isOwner]);

  async function loadShares() {
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch(`/api/datasets/${datasetId}/shares`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Failed to load shares: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      setSharedWith(data.shared_with || []);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setMessage(err.message);
    }
  }

  async function handleAdd() {
    const trimmed = username.trim();
    if (!trimmed) {
      setStatus("error");
      setMessage("Enter a VT PID first.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch(`/api/datasets/${datasetId}/share`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to share: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      setSharedWith(data.shared_with || []);
      setUsername("");
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setMessage(err.message);
    }
  }

  async function handleRemove(target) {
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch(
        `/api/datasets/${datasetId}/share/${encodeURIComponent(target)}`,
        { method: "DELETE", credentials: "include" }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to remove: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      setSharedWith(data.shared_with || []);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setMessage(err.message);
    }
  }

  if (!isOwner) {
    return null;
  }

  return (
    <div style={panelStyle}>
      <h4 style={{ margin: "0 0 10px 0", color: "#e6edf3" }}>Share dataset</h4>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          placeholder="VT PID"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          style={inputStyle}
        />
        <button
          onClick={handleAdd}
          disabled={status === "loading"}
          style={buttonStyle}
        >
          Add
        </button>
      </div>

      {sharedWith.length > 0 ? (
        <ul style={listStyle}>
          {sharedWith.map((u) => (
            <li key={u} style={listItemStyle}>
              <span style={{ color: "#e6edf3" }}>{u}</span>
              <button
                onClick={() => handleRemove(u)}
                disabled={status === "loading"}
                style={removeButtonStyle}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: "#8b949e", fontSize: 13, marginTop: 10 }}>
          Not shared with anyone yet.
        </p>
      )}

      {message && (
        <p
          style={{
            color: status === "error" ? "#f85149" : "#3fb950",
            fontSize: 13,
            marginTop: 8,
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}

const panelStyle = {
  padding: 16,
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 8,
  width: 260,
};

const inputStyle = {
  flex: 1,
  minWidth: 0,
  padding: "6px 8px",
  background: "#0d1117",
  color: "#e6edf3",
  border: "1px solid #30363d",
  borderRadius: 6,
};

const buttonStyle = {
  padding: "6px 14px",
  background: "#1f6feb",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const listStyle = {
  listStyle: "none",
  margin: "10px 0 0 0",
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const listItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 13,
};

const removeButtonStyle = {
  padding: "3px 8px",
  background: "transparent",
  color: "#f85149",
  border: "1px solid #f85149",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
};

import { useState } from "react";

export default function CsvUploadForm({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  // AI-ASSISTED
  // Date: 07-20-2026
  // Developer: Shantanu Shukla
  // Model: Claude Sonnet 4.6
  // Prompt: "Reset the status and message state whenever a new file is selected in the file input."
  // Modifications: None, used as generated.
  // Reason: Prevents a stale success/error message from a previous upload from lingering after the user picks a new file.
  function handleFileChange(e) {
    setFile(e.target.files[0] || null);
    setStatus("idle");
    setMessage("");
  }

  // AI-ASSISTED
  // Date: 07-20-2026
  // Developer: Shantanu Shukla
  // Model: Claude Sonnet 4.6
  // Prompt: "Write a CSV upload handler using fetch and FormData that tracks idle/uploading/success/error status, shows an error message on non-2xx responses, and clears the selected file after a successful upload."
  // Modifications: Added the `res.ok` check with a manually thrown Error including status/statusText, since fetch doesn't reject on HTTP error codes by default.
  // Reason: Without this the form showed "Upload complete" even when the backend returned a 400/500.
  async function handleUpload() {
    if (!file) {
      setStatus("error");
      setMessage("Choose a CSV file first.");
      return;
    }

    setStatus("uploading");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(
          `Upload failed: ${res.status} ${res.statusText}`
        );
      }

      const data = await res.json();

      setStatus("success");
      setMessage("Upload complete.");
      setFile(null);

      onUploadSuccess?.(data);
    } catch (err) {
      setStatus("error");
      setMessage(err.message);
    }
  }

  return (
    <div style={panelStyle}>
      <h4 style={{ margin: "0 0 10px 0", color: "#e6edf3" }}>
        Upload curriculum CSV
      </h4>

      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        style={{ color: "#8b949e" }}
      />

      <button
        onClick={handleUpload}
        disabled={status === "uploading"}
        style={buttonStyle}
      >
        {status === "uploading" ? "Uploading..." : "Upload"}
      </button>

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

const buttonStyle = {
  display: "block",
  marginTop: 10,
  padding: "6px 14px",
  background: "#1f6feb",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

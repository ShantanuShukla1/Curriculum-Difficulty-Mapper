import { useState } from "react";

export default function CsvUploadForm({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  // AI-ASSISTED
  // Date: 07-20-2026
  // Developer: Shantanu Shukla
  // Model: Claude Sonnet 4.6
  // Prompt: "Reset the status and message state whenever a new file is selected in the file input."
  // Modifications: None, used as generated.
  // Reason: Prevents a stale success/error message from a previous upload from lingering after the user picks a new file.
  // Updated: 08-07-2026
  // Changes since original: Added a .csv extension check that rejects non-CSV
  // files immediately (instead of only finding out after the upload request
  // fails), and pre-fills the editable label field from the picked filename
  // (minus extension) so people can rename datasets as they go (e.g. "CS1",
  // "CS2") without typing from scratch.
  // Reason: Requested sanity check on file type, and a simple way to name
  // uploads without adding a separate rename flow/endpoint.
  function handleFileChange(e) {
    const picked = e.target.files[0] || null;
    setStatus("idle");
    setMessage("");

    if (!picked) {
      setFile(null);
      return;
    }

    if (!picked.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setLabel("");
      setStatus("error");
      setMessage("Only CSV files are allowed.");
      e.target.value = "";
      return;
    }

    setFile(picked);
    setLabel(picked.name.replace(/\.csv$/i, ""));
  }

  // AI-ASSISTED
  // Date: 07-20-2026
  // Developer: Shantanu Shukla
  // Model: Claude Sonnet 4.6
  // Prompt: "Write a CSV upload handler using fetch and FormData that tracks idle/uploading/success/error status, shows an error message on non-2xx responses, and clears the selected file after a successful upload."
  // Modifications: Added the `res.ok` check with a manually thrown Error including status/statusText, since fetch doesn't reject on HTTP error codes by default. Later added credentials: 'include' since /api/upload is behind login_required and needs the session cookie sent explicitly, and changed onUploadSuccess to pass data.dataset_id instead of the full response body so callers can load that specific dataset.
  // Reason: Without the res.ok check the form showed "Upload complete" even when the backend returned a 400/500. Without credentials: 'include', cross-context requests could silently 401 despite the user being logged in via the CAS session cookie.
  // Updated: 08-07-2026
  // Changes since original: Appends the editable `label` field to the
  // FormData sent to the backend (which already accepted an optional
  // `label` field, just wasn't being sent from the frontend).
  // Reason: Lets people name their upload instead of it defaulting to the
  // raw filename.
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
    formData.append("label", label.trim() || file.name);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
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
      setLabel("");

      onUploadSuccess?.(data.dataset_id);
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

      {file && (
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name this dataset (e.g. CS1)"
          style={labelInputStyle}
        />
      )}

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

const labelInputStyle = {
  display: "block",
  width: "100%",
  marginTop: 8,
  padding: "6px 8px",
  background: "#0d1117",
  color: "#e6edf3",
  border: "1px solid #30363d",
  borderRadius: 6,
  fontSize: 13,
  boxSizing: "border-box",
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

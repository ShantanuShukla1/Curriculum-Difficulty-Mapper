// AI-ASSISTED
// Date: 08-06-2026
// Developer: Shantanu Shukla
// Model: Claude Sonnet 4.6
// Dropdown that lists the curricula/datasets the current user has
// access to (GET /api/datasets) and, on selection, fetches the full
// curriculum (GET /api/curriculum/<id>) and hands it back to the
// parent via onCurriculumLoaded.
// Prompt: "create react component with a a dropdown list that calls 
// /api/datasets to get the datasets accesable to the user and allow 
// them to select one to display using a GET /api/curriculum/<id>"
//
// Allows users to select which of the available datasets to view.

import { useEffect, useState } from "react";
import { fetchCurriculumById } from "../api/curriculum";
 
export default function DatasetSelector({ onCurriculumLoaded, selectedId: controlledId }) {
  const [datasets, setDatasets] = useState([]);
  const [selectedId, setSelectedId] = useState(controlledId || "");
  const [listStatus, setListStatus] = useState("loading"); // 'loading' | 'ready' | 'error'
  const [loadStatus, setLoadStatus] = useState("idle"); // 'idle' | 'loading' | 'error'
 
  // Load the list of datasets the user can access.
  useEffect(() => {
    let cancelled = false;
 
    async function fetchDatasets() {
      setListStatus("loading");
      try {
        const res = await fetch("/api/datasets");
        if (!res.ok) throw new Error(`Failed to load datasets (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
 
        const list = Array.isArray(data) ? data : data.datasets;
        if (!Array.isArray(list)) {
          throw new Error("Unexpected /api/datasets response shape");
        }
 
        setDatasets(list);
        setListStatus("ready");
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setListStatus("error");
      }
    }
 
    fetchDatasets();
    return () => {
      cancelled = true;
    };
  }, []);
 
  // Fetch the chosen curriculum whenever selectedId changes.
  async function handleSelect(id) {
    setSelectedId(id);
    if (!id) return;
 
    setLoadStatus("loading");
    try {
      const curriculum = await fetchCurriculumById(id);
      setLoadStatus("idle");
      onCurriculumLoaded?.(curriculum);
    } catch (err) {
      console.error(err);
      setLoadStatus("error");
    }
  }
 
  return (
    <div style={wrapperStyle}>
      <label style={labelStyle} htmlFor="dataset-select">
        Dataset
      </label>
 
      <select
        id="dataset-select"
        value={selectedId}
        onChange={(e) => handleSelect(e.target.value)}
        disabled={listStatus === "loading"}
        style={selectStyle}
      >
        <option value="" disabled>
          {listStatus === "loading" ? "Loading datasets…" : "Select a dataset"}
        </option>
        {datasets.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
 
      {listStatus === "error" && (
        <p style={errorStyle}>Couldn't load your datasets. Try refreshing the page.</p>
      )}
      {loadStatus === "loading" && <p style={hintStyle}>Loading curriculum…</p>}
      {loadStatus === "error" && (
        <p style={errorStyle}>Couldn't load that curriculum. Try selecting it again.</p>
      )}
    </div>
  );
}
 
const wrapperStyle = {
  width: 200,
  padding: 12,
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 8,
  marginBottom: 12,
};
 
const labelStyle = {
  display: "block",
  color: "#8b949e",
  fontSize: 12,
  marginBottom: 6,
};
 
const selectStyle = {
  width: "100%",
  background: "#0d1117",
  color: "#e6edf3",
  border: "1px solid #30363d",
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 13,
};
 
const hintStyle = {
  color: "#6e7681",
  fontSize: 10,
  marginTop: 6,
};
 
const errorStyle = {
  color: "#f85149",
  fontSize: 10,
  marginTop: 6,
};

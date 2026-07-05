import { useEffect, useState } from "react";
import CourseGraph from "./components/CourseGraph";
import CourseDetailPanel from "./components/CourseDetailPanel";
import CsvUploadForm from "./components/CsvUploadForm";
import { fetchCurriculum } from "./api/curriculum";

// ---------------------------------------------------------------------
// CurriculumMapLive
//
// Same as CurriculumMapExample, but pulls real data from the running
// Flask backend (localhost:5000) instead of mock data. Use this once
// app.py is running locally alongside `npm run dev`.
// ---------------------------------------------------------------------

export default function CurriculumMapLive() {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [error, setError] = useState(null);

  function loadCurriculum() {
    setGraphData(null);
    setError(null);
    fetchCurriculum()
      .then(setGraphData)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadCurriculum();
  }, []);

  if (error) {
    return (
      <div style={{ padding: 20, color: "#f85149" }}>
        Couldn't reach the backend: {error}
        <br />
        Make sure app.py is running (python app.py, from the backend folder).
      </div>
    );
  }

  if (!graphData) {
    return <div style={{ padding: 20, color: "#8b949e" }}>Loading curriculum data…</div>;
  }

  return (
    <div style={{ display: "flex", gap: 20, padding: 20, background: "#0d1117", minHeight: "100vh" }}>
      <CourseGraph
        courses={graphData.courses}
        edges={graphData.edges}
        onSelectCourse={setSelectedCourse}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <CourseDetailPanel course={selectedCourse} />
        <CsvUploadForm onUploadSuccess={loadCurriculum} />
      </div>
    </div>
  );
}
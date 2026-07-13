import { useEffect, useMemo, useState } from "react";
import CourseGraph from "./components/CourseGraph";
import CourseDetailPanel, { CurriculumTotalsPanel } from "./components/CourseDetailPanel";
import CsvUploadForm from "./components/CsvUploadForm";
import { fetchCurriculum } from "./api/curriculum";

// ---------------------------------------------------------------------
// CurriculumMapLive
//
// Same as CurriculumMapExample, but pulls real data from the running
// Flask backend (localhost:5000) instead of mock data. Use this once
// app.py is running locally alongside `npm run dev`.
//
// Layout: the whole app is locked to one viewport (100vh, no page-level
// scrolling). The graph fills the remaining vertical space and scrolls
// internally if it's too big; the course detail panel, curriculum-wide
// totals, and CSV upload form sit together in a compact row at the
// bottom, next to the graph's legend.
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

  // Sum of every course's scores across the whole curriculum, per
  // stakeholder request.
  const totals = useMemo(() => {
    if (!graphData) return null;
    return graphData.courses.reduce(
      (acc, c) => {
        acc.blocking += c.scores.blocking;
        acc.delay += c.scores.delay;
        acc.failure += c.scores.failure;
        acc.frequency += c.scores.frequency;
        acc.total += c.scores.total;
        return acc;
      },
      { blocking: 0, delay: 0, failure: 0, frequency: 0, total: 0 }
    );
  }, [graphData]);

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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100%",
        padding: 12,
        gap: 8,
        background: "#0d1117",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Graph fills all remaining vertical space. It scales itself
          (via viewBox) to fit whatever room it's given, so neither the
          page nor the graph ever needs to scroll. */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <CourseGraph
          courses={graphData.courses}
          edges={graphData.edges}
          onSelectCourse={setSelectedCourse}
        />
      </div>

      {/* Bottom row: detail panel, curriculum totals, and upload sit
          together near the legend, instead of stacked on the side. */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        <CourseDetailPanel course={selectedCourse} />
        <CurriculumTotalsPanel totals={totals} />
        <CsvUploadForm onUploadSuccess={loadCurriculum} />
      </div>
    </div>
  );
}

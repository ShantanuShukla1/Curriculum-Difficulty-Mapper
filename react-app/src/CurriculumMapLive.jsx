import { useEffect, useMemo, useState } from "react";
import CourseGraph from "./components/CourseGraph";
import CourseDetailPanel, {
  CurriculumTotalsPanel,
} from "./components/CourseDetailPanel";
import CsvUploadForm from "./components/CsvUploadForm";
import { fetchCurriculum } from "./api/curriculum";

export default function CurriculumMapLive() {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [error, setError] = useState(null);

  async function loadCurriculum() {
    setGraphData(null);
    setError(null);
    setSelectedCourse(null);

    try {
      const data = await fetchCurriculum();
      setGraphData(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCurriculum();
  }, []);

  const totals = useMemo(() => {
    if (!graphData) {
      return null;
    }

    return graphData.courses.reduce(
      (acc, course) => {
        acc.blocking += course.scores.blocking;
        acc.delay += course.scores.delay;
        acc.failure += course.scores.failure;
        acc.frequency += course.scores.frequency;
        acc.total += course.scores.total;

        return acc;
      },
      {
        blocking: 0,
        delay: 0,
        failure: 0,
        frequency: 0,
        total: 0,
      }
    );
  }, [graphData]);

  if (error) {
    return (
      <div
        style={{
          padding: 20,
          color: "#f85149",
          background: "#0d1117",
          minHeight: "100vh",
        }}
      >
        <h3>Unable to load curriculum data</h3>
        <p>{error}</p>

        <button
          onClick={loadCurriculum}
          style={{
            padding: "8px 14px",
            background: "#1f6feb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!graphData) {
    return (
      <div
        style={{
          padding: 20,
          color: "#8b949e",
          background: "#0d1117",
          minHeight: "100vh",
        }}
      >
        Loading curriculum data...
      </div>
    );
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
      <div style={{ flex: 1, minHeight: 0 }}>
        <CourseGraph
          courses={graphData.courses}
          edges={graphData.edges}
          onSelectCourse={setSelectedCourse}
        />
      </div>

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
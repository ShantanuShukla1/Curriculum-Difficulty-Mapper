import { useEffect, useMemo, useState } from "react";
import CourseGraph from "./components/CourseGraph";
import CourseDetailPanel, {
  CurriculumTotalsPanel,
} from "./components/CourseDetailPanel";
import CsvUploadForm from "./components/CsvUploadForm";
import DatasetSelector from "./components/DatasetSelector";
import ShareDatasetPanel from "./components/ShareDatasetPanel";
import { fetchCurriculum } from "./api/curriculum";

export default function CurriculumMapLive() {
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [error, setError] = useState(null);
  // Tracks the currently selected dataset object ({id, label, access, ...})
  // from DatasetSelector, so we know whether to show the owner-only
  // ShareDatasetPanel. Null means "still on the default/most-recent
  // dataset" (nothing picked from the dropdown yet).
  const [selectedDataset, setSelectedDataset] = useState(null);

  // AI-ASSISTED
  // Date: 07-22-2026
  // Developer: Shantanu Shukla
  // Model: Claude Sonnet 4.6
  // Prompt: "Add a retry button and error state to the curriculum loading screen, and reset selectedCourse whenever the curriculum reloads (e.g. after a new CSV upload)."
  // Modifications: Called loadCurriculum() directly from the Retry button's onClick instead of adding a separate retry function.
  // Reason: Keeps CSV upload and manual retry sharing the same loading path so both reset selection and error state consistently.
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
    async function checkAuthAndLoad() {
      try {
        const res = await fetch("/api/user", { credentials: "include" });

        if (res.status === 401) {
          window.location.href = "/api/login";
          return;
        }

        if (!res.ok) {
          setError(`Unable to verify session (status ${res.status})`);
          return;
        }

        loadCurriculum();
      } catch (err) {
        setError(err.message);
      }
    }

    checkAuthAndLoad();
  }, []);

  // AI-ASSISTED
  // Date: 07-22-2026
  // Developer: Shantanu Shukla
  // Model: Claude Sonnet 4.6
  // Prompt: "Write a memoized reducer that sums blocking, delay, failure, frequency, and total scores across every course in the fetched curriculum data, returning null until the data has loaded."
  // Modifications: Guarded against `graphData` being null before the reduce runs, since this component renders before the initial fetch resolves.
  // Reason: Needed a single totals object to pass into CurriculumTotalsPanel without recomputing it on every hover/click.
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

        <DatasetSelector
          onCurriculumLoaded={(curriculum) => setGraphData(curriculum)}
          onDatasetSelected={setSelectedDataset}
        />

        {selectedDataset && (
          <ShareDatasetPanel
            datasetId={selectedDataset.id}
            isOwner={selectedDataset.access === "owner"}
          />
        )}
      </div>
    </div>
  );
}

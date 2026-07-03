import { useState } from "react";
import CourseGraph from "./components/CourseGraph";
import CourseDetailPanel from "./components/CourseDetailPanel";
import { mockCourseData } from "./data/mockCourses";

// ---------------------------------------------------------------------
// Example usage. Drop this logic into wherever your real App.jsx routes
// to the curriculum map — the important part is passing courses/edges
// (eventually from a fetch('/curriculum') call) into CourseGraph, and
// tracking the selected course in state for the detail panel.
// ---------------------------------------------------------------------

export default function CurriculumMapExample() {
  const [selectedCourse, setSelectedCourse] = useState(null);

  return (
    <div style={{ display: "flex", gap: 20, padding: 20, background: "#0d1117", minHeight: "100vh" }}>
      <CourseGraph
        courses={mockCourseData.courses}
        edges={mockCourseData.edges}
        onSelectCourse={setSelectedCourse}
      />
      <CourseDetailPanel course={selectedCourse} />
    </div>
  );
}

// ---------------------------------------------------------------------
// CourseDetailPanel
//
// Shows the score breakdown for whichever course was last clicked in
// CourseGraph. Matches the "click a course to see a score value for
// each metric" requirement from the instructions doc.
// ---------------------------------------------------------------------

export default function CourseDetailPanel({ course }) {
  if (!course) {
    return (
      <div style={panelStyle}>
        <p style={{ color: "#8b949e", fontSize: 13 }}>
          Click a course in the graph to see its score breakdown.
        </p>
      </div>
    );
  }

  const { blocking, delay, failure, frequency, total } = course.scores;

  return (
    <div style={panelStyle}>
      <h3 style={{ margin: "0 0 4px 0", color: "#e6edf3" }}>
        {course.prefix} {course.number || ""}
      </h3>
      <p style={{ margin: "0 0 16px 0", color: "#8b949e", fontSize: 13 }}>
        {course.name}
      </p>

      <ScoreRow label="Blocking" value={blocking} hint="Courses directly/indirectly blocked" />
      <ScoreRow label="Delay" value={delay} hint="Longest prereq chain this course is on" />
      <ScoreRow label="Failure" value={failure} hint="Based on DFW rate range" />
      <ScoreRow label="Frequency" value={frequency} hint="Based on offerings per year" />

      <div style={{ borderTop: "1px solid #30363d", marginTop: 12, paddingTop: 12 }}>
        <ScoreRow label="Total" value={total} bold />
      </div>
    </div>
  );
}

function ScoreRow({ label, value, hint, bold }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#e6edf3", fontWeight: bold ? 700 : 500, fontSize: bold ? 15 : 13 }}>
          {label}
        </span>
        <span style={{ color: "#58a6ff", fontWeight: 700, fontSize: bold ? 16 : 14 }}>
          {value}
        </span>
      </div>
      {hint && <div style={{ color: "#6e7681", fontSize: 11 }}>{hint}</div>}
    </div>
  );
}

const panelStyle = {
  width: 240,
  padding: 16,
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 8,
};

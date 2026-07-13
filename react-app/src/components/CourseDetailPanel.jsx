// ---------------------------------------------------------------------
// CourseDetailPanel
//
// Shows the score breakdown for whichever course was last clicked in
// CourseGraph. Matches the "click a course to see a score value for
// each metric" requirement from the instructions doc.
//
// Also exports CurriculumTotalsPanel, which shows the same style of
// breakdown but summed across every course in the curriculum, per
// stakeholder request.
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
      <h3 style={{ margin: "0 0 2px 0", color: "#e6edf3", fontSize: 16 }}>
        {course.prefix} {course.number || ""}
      </h3>
      <p style={{ margin: "0 0 12px 0", color: "#8b949e", fontSize: 12 }}>
        {course.name}
      </p>

      <ScoreRow label="Blocking" value={blocking} hint="Courses directly/indirectly blocked" />
      <ScoreRow label="Delay" value={delay} hint="Longest prereq chain this course is on" />
      <ScoreRow label="Failure" value={failure} hint="Based on DFW rate range" />
      <ScoreRow label="Frequency" value={frequency} hint="Based on offerings per year" />

      <div style={{ borderTop: "1px solid #30363d", marginTop: 8, paddingTop: 8 }}>
        <ScoreRow label="Total" value={total} bold />
      </div>
    </div>
  );
}

export function CurriculumTotalsPanel({ totals }) {
  if (!totals) return null;

  return (
    <div style={panelStyle}>
      <h3 style={{ margin: "0 0 2px 0", color: "#e6edf3", fontSize: 16 }}>Curriculum Totals</h3>
      <p style={{ margin: "0 0 12px 0", color: "#8b949e", fontSize: 12 }}>
        Combined across every course
      </p>

      <ScoreRow label="Blocking" value={totals.blocking} hint="Sum across all courses" />
      <ScoreRow label="Delay" value={totals.delay} hint="Sum across all courses" />
      <ScoreRow label="Failure" value={totals.failure} hint="Sum across all courses" />
      <ScoreRow label="Frequency" value={totals.frequency} hint="Sum across all courses" />

      <div style={{ borderTop: "1px solid #30363d", marginTop: 8, paddingTop: 8 }}>
        <ScoreRow label="Grand Total" value={totals.total} bold />
      </div>
    </div>
  );
}

export function ScoreRow({ label, value, hint, bold }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#e6edf3", fontWeight: bold ? 700 : 500, fontSize: bold ? 14 : 12 }}>
          {label}
        </span>
        <span style={{ color: "#58a6ff", fontWeight: 700, fontSize: bold ? 15 : 13 }}>
          {value}
        </span>
      </div>
      {hint && <div style={{ color: "#6e7681", fontSize: 10 }}>{hint}</div>}
    </div>
  );
}

const panelStyle = {
  width: 200,
  padding: 12,
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 8,
};

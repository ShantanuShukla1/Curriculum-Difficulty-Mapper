// ---------------------------------------------------------------------
// fetchCurriculum
//
// Talks to the real backend and reshapes its response into the
// { courses, edges } format CourseGraph.jsx expects.
//
// Note: this used to need a workaround for a backend bug where `id` was
// the CSV course_id (which could be null/duplicated for pathway courses).
// That's been fixed — /curriculum now returns the database's unique id,
// so this file can just pass ids straight through.
// ---------------------------------------------------------------------

export async function fetchCurriculum(baseUrl = "http://localhost:5000") {
  const res = await fetch(`${baseUrl}/curriculum`);
  if (!res.ok) {
    throw new Error(`Failed to fetch /curriculum: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return transformCurriculumResponse(data);
}

export function transformCurriculumResponse(data) {
  const courses = data.courses.map((c) => ({
    id: c.id,
    courseId: c.course_id, // original CSV id, kept for reference/display only
    prefix: c.prefix,
    number: c.number,
    name: `${c.prefix} ${c.number || ""}`.trim(), // backend doesn't return course names yet
    scores: {
      blocking: c.blocking ?? 0,
      delay: c.delay ?? 0,
      failure: c.failure,     // may be null — not computed by backend yet
      frequency: c.frequency, // may be null — not computed by backend yet
      total: c.total,         // may be null — not computed by backend yet
    },
  }));

  // Each course lists its own prerequisites, so building edges is a
  // straightforward flatten: prereq -> this course, for every course.
  const edges = data.courses.flatMap((c) =>
    (c.prerequisites || []).map((p) => ({
      source: p.id,
      target: c.id,
      type: p.type,
    }))
  );

  return { courses, edges };
}

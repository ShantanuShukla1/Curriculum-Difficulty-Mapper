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
    courseId: c.course_id,
    prefix: c.prefix,
    number: c.number,
    term: c.term,
    name: c.name || `${c.prefix} ${c.number || ""}`.trim(),
    scores: {
      blocking: c.blocking ?? 0,
      delay: c.delay ?? 0,
      failure: c.failure ?? 0,
      frequency: c.frequency ?? 0,
      total: c.total ?? 0,
    },
  }));

  const edges = data.courses.flatMap((c) =>
    (c.prerequisites || []).map((p) => ({
      source: p.id,
      target: c.id,
      type: p.type,
    }))
  );

  return { courses, edges };
}
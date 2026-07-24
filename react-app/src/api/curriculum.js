// Fetches curriculum data from the backend.
// The frontend and backend are exposed through the same domain,
// so API requests use the /api prefix.

export async function fetchCurriculum(datasetId) {
  const url = datasetId
    ? `/api/curriculum?dataset_id=${encodeURIComponent(datasetId)}`
    : "/api/curriculum";

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch curriculum: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();

  return transformCurriculumResponse(data);
}

export function transformCurriculumResponse(data) {
  const courses = (data.courses || []).map((c) => ({
    id: c.id,
    courseId: c.course_id,
    prefix: c.prefix,
    number: c.number,
    term: c.term,
    name: c.name || `${c.prefix || ""} ${c.number || ""}`.trim(),
    scores: {
      blocking: c.blocking ?? 0,
      delay: c.delay ?? 0,
      failure: c.failure ?? 0,
      frequency: c.frequency ?? 0,
      total: c.total ?? 0,
    },
  }));

  const edges = (data.courses || []).flatMap((c) =>
    (c.prerequisites || []).map((p) => ({
      source: p.id,
      target: c.id,
      type: p.type,
    }))
  );

  return {
    courses,
    edges,
  };
}
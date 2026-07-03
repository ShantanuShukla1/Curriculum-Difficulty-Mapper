// Mock data shaped like what /curriculum should eventually return.
// Built from the CS 1114 example in the CDM instructions doc so the
// numbers here are ones we can sanity-check against by hand.
//
// Swap this file out once GET /curriculum returns real data — the
// CourseGraph component expects exactly this shape: { courses, edges }.

export const mockCourseData = {
  courses: [
    { id: "cs1114", prefix: "CS", number: 1114, name: "Intro to Software Design",
      scores: { blocking: 14, delay: 5, failure: 4, frequency: 0, total: 23 } },
    { id: "cs2114", prefix: "CS", number: 2114, name: "Software Design & Data Structures",
      scores: { blocking: 8, delay: 4, failure: 2, frequency: 0, total: 14 } },
    { id: "cs1944", prefix: "CS", number: 1944, name: "Seminar",
      scores: { blocking: 0, delay: 1, failure: 0, frequency: 1, total: 2 } },
    { id: "cs2104", prefix: "CS", number: 2104, name: "Problem Solving in CS",
      scores: { blocking: 1, delay: 2, failure: 1, frequency: 1, total: 5 } },
    { id: "cs2505", prefix: "CS", number: 2505, name: "Intro to Computer Organization",
      scores: { blocking: 6, delay: 3, failure: 3, frequency: 0, total: 12 } },
    { id: "math2534", prefix: "MATH", number: 2534, name: "Intro to Discrete Math",
      scores: { blocking: 3, delay: 2, failure: 2, frequency: 1, total: 8 } },
    { id: "cs2506", prefix: "CS", number: 2506, name: "Computer Organization II",
      scores: { blocking: 4, delay: 2, failure: 3, frequency: 1, total: 10 } },
    { id: "cs3114", prefix: "CS", number: 3114, name: "Data Structures & Algorithms",
      scores: { blocking: 3, delay: 1, failure: 3, frequency: 0, total: 7 } },
    { id: "math3134", prefix: "MATH", number: 3134, name: "Applied Combinatorics",
      scores: { blocking: 0, delay: 1, failure: 1, frequency: 2, total: 4 } },
    { id: "cs3214", prefix: "CS", number: 3214, name: "Computer Systems",
      scores: { blocking: 1, delay: 1, failure: 4, frequency: 1, total: 7 } },
    { id: "cs3604", prefix: "CS", number: 3604, name: "Professionalism in Computing",
      scores: { blocking: 0, delay: 1, failure: 0, frequency: 1, total: 2 } },
    { id: "cs3304", prefix: "CS", number: 3304, name: "Comparative Languages",
      scores: { blocking: 0, delay: 1, failure: 1, frequency: 1, total: 3 } },
    { id: "cstheory", prefix: "CS", number: 0, name: "CS Theory Elective",
      scores: { blocking: 0, delay: 1, failure: 0, frequency: 2, total: 3 } },
    { id: "cs4944", prefix: "CS", number: 4944, name: "Capstone Prep",
      scores: { blocking: 0, delay: 1, failure: 0, frequency: 1, total: 2 } },
    { id: "cscapstone", prefix: "CS", number: 0, name: "CS Capstone",
      scores: { blocking: 0, delay: 1, failure: 0, frequency: 1, total: 2 } },
  ],

  // type is "prereq" or "coreq" — used to style edges differently.
  // This subset reproduces the delay chain from the instructions doc:
  // CS1114 -> CS2114 -> CS2505 -> CS2506 -> CS3214 (5 courses, delay score 5)
  edges: [
    { source: "cs1114", target: "cs2114", type: "prereq" },
    { source: "cs1114", target: "cs1944", type: "prereq" },
    { source: "cs1114", target: "cs2104", type: "prereq" },
    { source: "cs2114", target: "cs2505", type: "prereq" },
    { source: "cs2114", target: "math2534", type: "coreq" },
    { source: "cs2505", target: "cs2506", type: "prereq" },
    { source: "cs2506", target: "cs3114", type: "prereq" },
    { source: "cs2506", target: "cs3214", type: "prereq" },
    { source: "cs3114", target: "math3134", type: "coreq" },
    { source: "cs3214", target: "cs3604", type: "prereq" },
    { source: "cs3214", target: "cs3304", type: "prereq" },
    { source: "cs3214", target: "cstheory", type: "prereq" },
    { source: "cs3604", target: "cs4944", type: "prereq" },
    { source: "cs4944", target: "cscapstone", type: "prereq" },
  ],
};

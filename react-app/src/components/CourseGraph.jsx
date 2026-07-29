import { useMemo, useState } from "react";

// ---------------------------------------------------------------------
// CourseGraph
//
// Renders the curriculum as a layered DAG (courses -> their unlocked
// courses, left to right). Handles the "Visual Effects" from the
// instructions doc:
//   1. Click a course -> onSelectCourse fires so a detail panel can show
//      its blocking / delay / failure / frequency / total scores.
//   2. Prereq vs coreq edges are styled differently (solid vs dashed).
//   3. Hovering a course highlights the courses it blocks (descendants)
//      and, separately, the courses on its longest prereq chain (delay).
//   4. Hovering either side of a corequisite pair highlights the edge
//      between them in solid orange, regardless of which side is hovered.
//
// Props:
//   courses: [{ id, prefix, number, term, name, scores }]
//   edges:   [{ source, target, type }]  type is "prereq" | "coreq"
//   onSelectCourse: (course) => void
// ---------------------------------------------------------------------

const NODE_WIDTH = 140;
const NODE_HEIGHT = 50;
const COLUMN_GAP = 200;
const ROW_GAP = 70;
const MARGIN = 40;

export default function CourseGraph({ courses, edges, onSelectCourse }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  // ---- Build adjacency maps once per data change ----
  const { childrenOf, parentsOf } = useMemo(() => {
    const childrenOf = new Map();
    const parentsOf = new Map();
    courses.forEach((c) => {
      childrenOf.set(c.id, []);
      parentsOf.set(c.id, []);
    });
    edges.forEach((e) => {
      childrenOf.get(e.source)?.push(e);
      parentsOf.get(e.target)?.push(e);
    });
    return { childrenOf, parentsOf };
  }, [courses, edges]);

  // ---- Group courses by term for column layout ----
  // Uses the term field from the backend (1-8 for each semester).
  // Falls back to prereq depth if term is missing.
  //
  // AI-ASSISTED
  // Date: 07-14-2026
  // Developer: Shantanu Shukla
  // Model: Claude Sonnet 4.6
  // Prompt: "Write a memoized layout function that groups courses into columns by their term field, and falls back to computing prerequisite depth via DFS when term is missing, avoiding infinite recursion on cycles."
  // Modifications: Adjusted the depth fallback to use a `visiting` set instead of throwing on cycles, and mapped the 1-indexed term field to 0-indexed columns to match this app's schema.
  // Reason: Needed the graph to stay left-to-right by semester even for placeholder/pathway courses that have no term set.
  const columns = useMemo(() => {
    const col = new Map();
    const visiting = new Set();

    function depthOf(id) {
      if (col.has(id)) return col.get(id);
      if (visiting.has(id)) return 0;
      visiting.add(id);
      const parents = parentsOf.get(id) || [];
      const depth = parents.length === 0
        ? 0
        : Math.max(...parents.map((e) => depthOf(e.source))) + 1;
      visiting.delete(id);
      col.set(id, depth);
      return depth;
    }

    courses.forEach((c) => {
      if (c.term != null) {
        col.set(c.id, c.term - 1); // term is 1-indexed, columns are 0-indexed
      } else {
        depthOf(c.id);
      }
    });

    return col;
  }, [courses, parentsOf]);

  // ---- Turn columns into x/y positions ----
  const positions = useMemo(() => {
    const byColumn = new Map();
    courses.forEach((c) => {
      const col = columns.get(c.id) ?? 0;
      if (!byColumn.has(col)) byColumn.set(col, []);
      byColumn.get(col).push(c.id);
    });

    const pos = new Map();
    byColumn.forEach((ids, col) => {
      ids.forEach((id, row) => {
        pos.set(id, {
          x: MARGIN + col * COLUMN_GAP,
          y: MARGIN + row * ROW_GAP,
        });
      });
    });
    return pos;
  }, [courses, columns]);

  const width = Math.max(...[...positions.values()].map((p) => p.x)) + NODE_WIDTH + MARGIN;
  const height = Math.max(...[...positions.values()].map((p) => p.y)) + NODE_HEIGHT + MARGIN;

  // ---- Hover highlight sets ----
  // Blocking set: every descendant of the hovered course.
  // Delay set: the single longest prereq->this->descendant chain it sits on.
  // Coreq partners: every course connected to the hovered course by a
  // corequisite edge (in either direction).
  //
  // AI-ASSISTED
  // Date: 07-16-2026
  // Developer: Shantanu Shukla
  // Model: Claude Sonnet 4.6
  // Prompt: "Given a hovered node, compute the full descendant set (blocking), the single longest prereq-to-descendant chain through that node (delay), and any corequisite partners, using the childrenOf/parentsOf adjacency maps."
  // Modifications: Rewrote longestChainBack/longestChainForward to pass a per-branch `seen` set instead of a single shared one, so branching prereq trees don't falsely mark sibling paths as already visited.
  // Reason: Match the "Visual Effects" hover requirements from the instructions doc without recomputing this on every render frame.
  const { blockingSet, delaySet, coreqPartners } = useMemo(() => {
    if (!hoveredId) {
      return { blockingSet: new Set(), delaySet: new Set(), coreqPartners: new Set() };
    }

    const blockingSet = new Set();
    const stack = [hoveredId];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of childrenOf.get(cur) || []) {
        if (!blockingSet.has(e.target)) {
          blockingSet.add(e.target);
          stack.push(e.target);
        }
      }
    }

    function longestChainBack(id, seen = new Set()) {
      const parents = parentsOf.get(id) || [];
      if (parents.length === 0) return [id];
      let best = [];
      for (const e of parents) {
        if (seen.has(e.source)) continue;
        const chain = longestChainBack(e.source, new Set(seen).add(id));
        if (chain.length > best.length) best = chain;
      }
      return [...best, id];
    }
    function longestChainForward(id, seen = new Set()) {
      const children = childrenOf.get(id) || [];
      if (children.length === 0) return [id];
      let best = [];
      for (const e of children) {
        if (seen.has(e.target)) continue;
        const chain = longestChainForward(e.target, new Set(seen).add(id));
        if (chain.length > best.length) best = chain;
      }
      return [id, ...best];
    }

    const back = longestChainBack(hoveredId);
    const forward = longestChainForward(hoveredId);
    const delaySet = new Set([...back, ...forward]);

    const coreqPartners = new Set();
    edges.forEach((e) => {
      if (e.type === "coreq" && (e.source === hoveredId || e.target === hoveredId)) {
        coreqPartners.add(e.source);
        coreqPartners.add(e.target);
      }
    });

    return { blockingSet, delaySet, coreqPartners };
  }, [hoveredId, childrenOf, parentsOf, edges]);

  function handleSelect(course) {
    setSelectedId(course.id);
    onSelectCourse?.(course);
  }

  // ---- Term labels for column headers ----
  const termLabels = useMemo(() => {
    const labels = new Map();
    courses.forEach((c) => {
      if (c.term != null) {
        labels.set(c.term - 1, `Semester ${c.term}`);
      }
    });
    return labels;
  }, [courses]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        border: "1px solid #333",
        borderRadius: 8,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Graph area scales to fit whatever space it's given (all 8
          semesters + all rows), so it never needs to scroll. */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height + 30}`}
          preserveAspectRatio="xMinYMin meet"
          style={{ background: "#0f1115", display: "block" }}
        >
        <defs>
          <marker id="arrow-prereq" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#7d8590" />
          </marker>
          <marker id="arrow-coreq" viewBox="0 0 10 10" refX="9" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#d29922" />
          </marker>
        </defs>

        {/* Semester column headers */}
        {[...termLabels.entries()].map(([col, label]) => (
          <text
            key={col}
            x={MARGIN + col * COLUMN_GAP + NODE_WIDTH / 2}
            y={22}
            fill="#58a6ff"
            fontSize={16}
            fontWeight={700}
            textAnchor="middle"
          >
            {label}
          </text>
        ))}

        {/* Edges
            AI-ASSISTED
            Date: 07-17-2026
            Developer: Shantanu Shukla
            Model: Claude Sonnet 4.6
            Prompt: "Style SVG path edges differently depending on whether they're a coreq hover, part of the longest delay chain, part of the blocking set, or a normal prereq/coreq edge, with dimmed opacity for unrelated edges on hover."
            Modifications: Reordered the stroke-color ternary so coreq-hover always wins over delay/blocking coloring, since a corequisite pair should stay visually distinct even when it also sits on the longest chain.
            Reason: The original AI draft colored delay-chain edges over coreq edges, which made corequisite relationships hard to spot during hover. */}
        {edges.map((e, i) => {
          const from = positions.get(e.source);
          const to = positions.get(e.target);
          if (!from || !to) return null;

          const x1 = from.x + NODE_WIDTH;
          const y1 = from.y + NODE_HEIGHT / 2 + 30;
          const x2 = to.x;
          const y2 = to.y + NODE_HEIGHT / 2 + 30;
          const midX = (x1 + x2) / 2;

          const isCoreq = e.type === "coreq";
          const isCoreqHover =
            isCoreq && hoveredId && (e.source === hoveredId || e.target === hoveredId);
          const isHighlighted =
            hoveredId &&
            (blockingSet.has(e.target) || e.source === hoveredId) &&
            (blockingSet.has(e.source) || e.source === hoveredId);
          const isDelay = delaySet.has(e.source) && delaySet.has(e.target);

          const stroke = isCoreqHover
            ? "#d29922"
            : isDelay
            ? "#58a6ff"
            : isHighlighted
            ? "#3fb950"
            : isCoreq
            ? "#d29922"
            : "#4b525c";

          return (
            <path
              key={i}
              d={`M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`}
              fill="none"
              stroke={stroke}
              strokeWidth={isCoreqHover || isDelay || isHighlighted ? 2.5 : 1.5}
              strokeDasharray={isCoreq ? "6,4" : undefined}
              markerEnd={isCoreq ? "url(#arrow-coreq)" : "url(#arrow-prereq)"}
              opacity={hoveredId && !isHighlighted && !isDelay && !isCoreqHover ? 0.15 : 1}
            />
          );
        })}

        {/* Nodes */}
        {courses.map((c) => {
          const pos = positions.get(c.id);
          if (!pos) return null;

          const isHovered = hoveredId === c.id;
          const isSelected = selectedId === c.id;
          const isInBlocking = blockingSet.has(c.id);
          const isInDelay = delaySet.has(c.id);
          const isCoreqPartner = coreqPartners.has(c.id);
          const dimmed = hoveredId && !isHovered && !isInBlocking && !isInDelay && !isCoreqPartner;

          return (
            <g
              key={c.id}
              transform={`translate(${pos.x}, ${pos.y + 30})`}
              onMouseEnter={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleSelect(c)}
              style={{ cursor: "pointer" }}
            >
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={8}
                fill={isSelected ? "#1f6feb" : isInDelay ? "#1b3a5c" : isInBlocking ? "#1a3d2b" : "#1c2128"}
                stroke={isHovered ? "#58a6ff" : isSelected ? "#58a6ff" : "#30363d"}
                strokeWidth={isHovered || isSelected ? 2 : 1}
                opacity={dimmed ? 0.35 : 1}
              />
              <text x={10} y={18} fill="#e6edf3" fontSize={12} fontWeight={600}>
                {c.prefix === "0" || !c.prefix ? (c.name || "Elective") : `${c.prefix} ${c.number || ""}`}
              </text>
              <text x={10} y={34} fill="#8b949e" fontSize={10}>
                {c.prefix === "0" || !c.prefix ? "" : (c.name && c.name.length > 22 ? c.name.slice(0, 20) + "…" : c.name || "")}
              </text>
            </g>
          );
        })}
        </svg>
      </div>

      {/* Legend: fixed height, always visible, never scaled or scrolled off */}
      <div style={{ display: "flex", gap: 20, padding: "8px 14px", fontSize: 12, color: "#8b949e", flexShrink: 0 }}>
        <LegendLine color="#4b525c" label="Prerequisite" dashed={false} />
        <LegendLine color="#d29922" label="Corequisite" dashed={true} />
        <LegendLine color="#58a6ff" label="Longest chain (hover)" dashed={false} />
        <LegendLine color="#3fb950" label="Blocked courses (hover)" dashed={false} />
      </div>
    </div>
  );
}

function LegendLine({ color, label, dashed }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width="24" height="8">
        <line x1="0" y1="4" x2="24" y2="4" stroke={color} strokeWidth={2}
              strokeDasharray={dashed ? "5,3" : undefined} />
      </svg>
      {label}
    </div>
  );
}

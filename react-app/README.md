# Curriculum Difficulty Mapping — Frontend

React/Vite frontend for the Curriculum Difficulty Mapping (CDM) tool. Renders a curriculum as an interactive prerequisite graph, lets users upload their own curriculum CSVs, switch between datasets they own or that have been shared with them, and manage who else can access a dataset they own.

See the backend's `API_REFERENCE.md` for the full endpoint contract this frontend talks to.

---

## Tech Stack

- **React 19** — UI
- **Vite** — dev server and build tool
- **MUI / Emotion** — UI components and styling
- **Oxlint** — linting
- **nginx** — serves the built static files in production
- **Docker** — containerization
- **Kubernetes (VT Discovery Cluster)** — production deployment

---

## Local Development

### Prerequisites

- Node.js (22+ recommended, matches the Docker build image)
- npm

### Setup

```bash
cd react-app
npm install
npm run dev
```

Vite starts on `http://localhost:5173`.

### Connecting to the backend

The dev server proxies all `/api/*` requests to the live production backend (see the `server.proxy` block in `vite.config.js`), so local development talks to real deployed data — including real CAS login — without needing to run the backend locally. There is no separate local backend URL to configure for day-to-day frontend work.

Because requests go through this proxy, they appear same-origin to the browser, so session cookies work correctly without any extra CORS configuration on your end.

> **Caution:** since this points at the production backend, actions taken while developing locally (uploads, sharing changes) affect real data. Don't test destructive changes against a dataset you or a teammate cares about.

### Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run Oxlint |

---

## Deployment (Kubernetes)

### Build and Push Image

```bash
./deploy-frontend.sh [tag]
```

Builds for `linux/amd64` (required for the VT Discovery cluster), runs `npm run build` inside the image, and serves the resulting static files with nginx. Pushes to the VT container registry. Defaults to the `latest` tag if none is given.

### Kubernetes Setup

- **Registry Secret** — same Registry-type secret as the backend, so the cluster can pull the frontend image.
- **Ingress** — routes all non-`/api` traffic to the frontend ClusterIP service on port 80. `/api` is routed separately to the backend, so frontend and backend share the same public domain (`currdiffmap.discovery.cs.vt.edu`) — this is what lets session cookies work without cross-origin issues in production.
- **nginx** — `nginx.conf` serves static files and falls back to `index.html` for any unmatched route, so client-side routing (if added later) won't 404 on refresh.

### Updating a Deployment

Same as the backend: after pushing a new image, scale the frontend deployment down to 0 and back up to 1 to pull the new image.

---

## Project Structure

```
src/
├── main.jsx                     entry point, mounts App
├── App.jsx                      renders CurriculumMapLive
├── CurriculumMapLive.jsx        top-level page: loading/error state, layout
├── api/
│   └── curriculum.js            fetch wrappers for the curriculum endpoints
└── components/
    ├── CourseGraph.jsx          renders the curriculum as an interactive DAG
    ├── CourseDetailPanel.jsx    per-course score breakdown + curriculum totals
    ├── CsvUploadForm.jsx        upload a new curriculum CSV
    ├── DatasetSelector.jsx      switch between owned / shared datasets
    └── ShareDatasetPanel.jsx    owner-only: grant/revoke dataset access
```

---

## Features

- **Curriculum display** — courses are laid out left-to-right by semester (`CourseGraph.jsx`). Courses with no semester set (e.g. pathway/placeholder rows) fall back to a computed prerequisite-depth column so the graph stays readable even on messy uploaded data. Clicking a course shows its blocking/delay/failure/frequency/total scores (`CourseDetailPanel.jsx`); a totals panel shows the same breakdown summed across the whole curriculum.
- **Hover highlighting** — hovering a course highlights every course it blocks (descendants) and the courses on its longest prerequisite chain, computed client-side against the already-loaded graph data.
- **CSV upload** — `CsvUploadForm.jsx` uploads a curriculum CSV to `/api/upload`, which becomes a new dataset owned by the logged-in user, and immediately loads it once the upload succeeds.
- **Dataset switching** — `DatasetSelector.jsx` lists every dataset the user owns or has been given access to (`/api/datasets`) and loads whichever one is selected (`/api/curriculum/<id>`).
- **Dataset sharing** — `ShareDatasetPanel.jsx` is shown only when the selected dataset is owned by the logged-in user. Lets the owner view who currently has access, grant access to a VT PID, and revoke it.

---

## Notes

- Auth is entirely session-cookie based via the backend's CAS flow — the frontend never handles credentials directly, it just needs `credentials: "include"` on requests to authenticated endpoints.
- The full endpoint contract (request/response shapes, error codes) lives in the backend's `API_REFERENCE.md`, not duplicated here, so the two don't drift out of sync.

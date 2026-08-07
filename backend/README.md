# Curriculum Difficulty Mapping — Backend

Flask/Python backend for the Curriculum Difficulty Mapping (CDM) tool. Computes blocking, delay, failure, and frequency scores for courses in an engineering curriculum and exposes them via a REST API. Supports VT CAS authentication, per-user dataset ownership, and dataset sharing between users.

---

## Tech Stack

- **Python 3.12 / Flask** — web framework and API
- **SQLite** — database (file-based, no separate server needed)
- **NetworkX** — directed acyclic graph construction and traversal for scoring
- **pandas** — CSV parsing
- **python-cas** — VT CAS authentication
- **flask-cors** — cross-origin request support for local development
- **Docker** — containerization
- **Kubernetes (VT Discovery Cluster)** — production deployment

---

## Local Development

### Prerequisites

- Python 3.12
- pip

### Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Flask starts on `http://localhost:5000`.

### Environment Variables

All environment variables have sensible local defaults. You only need to set them explicitly for production (Kubernetes) deployment.

| Variable | Default | Description |
|---|---|---|
| `DB_PATH` | `curriculum.db` | Path to the SQLite database file. In K8s, point this inside the PVC mount path. |
| `SECRET_KEY` | `dev-secret-key-not-for-production` | Signs Flask session cookies. Set a strong random value in production. |
| `SESSION_COOKIE_SECURE` | `false` | Set to `true` in production to restrict session cookie to HTTPS only. |
| `SERVICE_URL` | `http://localhost:5000` | Public URL of this backend. CAS redirects back to `SERVICE_URL/api/login?` after login. |
| `FRONTEND_URL` | `http://localhost:5173` | URL of the React frontend. Flask redirects here after login/logout. |
| `CAS_SERVER_URL` | `https://login.cs.vt.edu/cas/` | VT CAS server URL. Use `https://login.vt.edu/profile/cas/` for the main VT CAS server. |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed CORS origins. Not needed in production if frontend and backend share the same domain. |

### CAS in Local Development

CAS authentication requires a publicly reachable callback URL, so the full login flow cannot be completed locally. For local testing, you can skip auth entirely — hit `/api/curriculum` directly, it returns the demo dataset without login.

---

## Deployment (Kubernetes)

### Build and Push Image

```bash
./deploy-backend.sh
```

This builds for `linux/amd64` (required for the VT Discovery cluster) and pushes to the VT container registry.

### Kubernetes Setup

1. **Registry Secret** — a Registry-type secret in the namespace, backed by a GitLab access token with `read_registry` scope, so the cluster can pull the image.

2. **Opaque Secret** — an Opaque secret named `flask-secrets` with key `secret-key`, holding a strong random string (generated with `python3 -c "import secrets; print(secrets.token_hex(32))"`).

3. **Persistent Volume** — a PVC mounted at `/app/data` in the backend Deployment. `DB_PATH=/app/data/curriculum.db` is set as an environment variable so the database writes to the persistent volume instead of the container's ephemeral filesystem.

4. **Deployment Environment Variables**:
   - `SECRET_KEY` → from `flask-secrets` secret
   - `DB_PATH` → `/app/data/curriculum.db`
   - `SERVICE_URL` → cluster ingress URL (e.g. `https://currdiffmap.discovery.cs.vt.edu`)
   - `FRONTEND_URL` → frontend URL
   - `CAS_SERVER_URL` → `https://login.vt.edu/profile/cas/`
   - `SESSION_COOKIE_SECURE` → `true`
   - `ALLOWED_ORIGINS` → frontend URL

5. **Ingress** — routes the `/api` prefix to the backend ClusterIP service on port 5000. The nginx whitelist annotation `nginx.ingress.kubernetes.io/whitelist-source-range: 0.0.0.0/0,::/0` allows external traffic in.

### Updating a Deployment

After pushing a new image, scale the backend deployment down to 0 and back up to 1 to pull the new image.

---

## Database Schema

| Table | Purpose |
|---|---|
| `users` | VT PIDs of users who have logged in via CAS |
| `datasets` | Curriculum uploads, each owned by a user |
| `courses` | Individual courses belonging to a dataset |
| `prerequisites` | Prerequisite and corequisite relationships between courses (by database id) |
| `scores` | Computed blocking, delay, failure, and frequency scores per course |
| `dataset_shares` | Access control — maps datasets to users who have been granted access |

---

## Scoring Algorithm

Each course receives four scores:

- **Blocking** — number of courses directly or indirectly blocked by this course (descendants in the prerequisite DAG)
- **Delay** — length of the longest prerequisite chain this course appears on (forward + backward DP over topological sort)
- **Failure** — points based on DFW rate: 0 pts (0–5%), 1 pt (6–10%), 2 pts (11–15%), 3 pts (16–20%), 4 pts (21%+)
- **Frequency** — points based on offerings per year: 0 pts (3+/year), 1 pt (2/year), 2 pts (1/year)

**Total** = Blocking + Delay + Failure + Frequency

The curriculum total is the sum of all individual course totals.

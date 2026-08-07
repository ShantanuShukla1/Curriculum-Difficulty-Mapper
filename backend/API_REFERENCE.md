# CDM Backend — API Reference

Base URL (production): `https://currdiffmap.discovery.cs.vt.edu`  
Base URL (local dev): `http://localhost:5000`

All endpoints are prefixed with `/api`. All responses are JSON. Authentication is managed via a signed session cookie set at login — include `credentials: "include"` in all frontend fetch calls.

---

## Authentication

### `GET /api/login`

Initiates or completes a CAS login.

**Case 1 — No ticket (user navigating to login):**  
Redirects the browser to the VT CAS login page.

**Case 2 — Ticket present (`?ticket=ST-...`):**  
CAS redirects back here after successful login. Flask validates the ticket, creates a session, and redirects to the frontend. On failure, redirects to the frontend with `?error=auth_failed`.

**Auth required:** No  
**Response:** 302 redirect (never returns JSON directly)

---

### `GET /api/logout`

Clears the Flask session and redirects to CAS SSO logout. Logging out here logs the user out of all VT CAS-protected services.

**Auth required:** No  
**Response:** 302 redirect

---

### `GET /api/user`

Returns the currently logged-in user's VT PID.

**Auth required:** Yes  
**Response:**
```json
{ "user": "jmichel1322" }
```
**Errors:**
- `401` — not logged in

---

## Curriculum

### `GET /api/curriculum`

Returns the curriculum data for the most relevant dataset:
- Logged-in users: their most recently uploaded dataset (falls back to demo if none)
- Anonymous users: the demo dataset

**Auth required:** No  
**Response:**
```json
{
  "dataset_id": 3,
  "curriculum_total": 537,
  "total_blocking": 235,
  "total_delay": 302,
  "total_failure": 53,
  "total_frequency": 20,
  "courses": [
    {
      "id": 124,
      "course_id": 197,
      "name": "MATH 1225: Calculus of a Single Variable",
      "prefix": "MATH",
      "number": 1225,
      "term": 1,
      "credit_hours": 4,
      "blocking": 24,
      "delay": 11,
      "failure": 4,
      "frequency": 0,
      "total": 39,
      "prerequisites": [
        { "id": 123, "type": "prereq" },
        { "id": 125, "type": "coreq" }
      ]
    }
  ]
}
```

> `id` is the database-internal id used as the graph node key and in `prerequisites[].id`. `course_id` is the original CSV course id, kept for reference only.

---

### `GET /api/curriculum/<dataset_id>`

Returns curriculum data for a specific dataset.

- Datasets owned by the `demo` user are publicly accessible.
- All other datasets require login, and the requester must be the owner or appear in the dataset's share list.

**Auth required:** Depends on dataset ownership (see above)  
**Response:** Same shape as `GET /api/curriculum`  
**Errors:**
- `401` — login required for this dataset
- `403` — logged in but not authorized
- `404` — dataset not found

---

## Datasets

### `GET /api/datasets`

Lists all datasets the logged-in user owns, plus datasets shared with them.

**Auth required:** Yes  
**Response:**
```json
{
  "datasets": [
    { "id": 3, "label": "CS Curriculum", "access": "owner" },
    { "id": 7, "label": "AE Curriculum", "access": "shared", "owner_username": "sshantanu24" }
  ]
}
```
**Errors:**
- `401` — not logged in

---

### `GET /api/datasets/<dataset_id>/shares`

Lists the VT PIDs that have been granted access to a dataset. Owner-only.

**Auth required:** Yes (owner only)  
**Response:**
```json
{ "dataset_id": 3, "shared_with": ["nldunlap", "sshantanu24"] }
```
**Errors:**
- `401` — not logged in
- `403` — not the owner
- `404` — dataset not found

---

### `POST /api/datasets/<dataset_id>/share`

Grants a VT PID access to a dataset. Owner-only. If the PID has never logged in before, a placeholder user row is created so the grant is ready on their first login.

**Auth required:** Yes (owner only)  
**Request body:**
```json
{ "username": "nldunlap" }
```
**Response:**
```json
{ "dataset_id": 3, "shared_with": ["nldunlap"] }
```
**Errors:**
- `400` — missing username
- `401` — not logged in
- `403` — not the owner
- `404` — dataset not found

---

### `DELETE /api/datasets/<dataset_id>/share/<username>`

Revokes a VT PID's access to a dataset. Owner-only.

**Auth required:** Yes (owner only)  
**Response:**
```json
{ "dataset_id": 3, "shared_with": [] }
```
**Errors:**
- `401` — not logged in
- `403` — not the owner
- `404` — dataset not found or user not found

---

## Upload

### `POST /api/upload`

Parses a curriculum CSV, computes scores, and stores the result as a new dataset owned by the logged-in user.

**Auth required:** Yes  
**Request:** `multipart/form-data`
- `file` (required) — the curriculum CSV file
- `label` (optional) — a display name for this dataset; defaults to the filename

**Response:**
```json
{ "status": "success", "dataset_id": 5 }
```
**Errors:**
- `400` — no file provided
- `401` — not logged in

### CSV Format

The curriculum CSV must follow the format provided by Dr. Smith. The file has 7 metadata rows before the column headers. Expected columns:

| Column | Description |
|---|---|
| `Course ID` | Numeric course identifier |
| `Course Name` | Full course name (e.g. `CS 1114: Intro to Software Design`) |
| `Prefix` | Department prefix (e.g. `CS`, `MATH`) |
| `Number` | Course number (e.g. `1114`) |
| `Prerequisites` | Semicolon-delimited list of prerequisite Course IDs (e.g. `120;121`) |
| `Corequisites` | Semicolon-delimited list of corequisite Course IDs |
| `Credit Hours` | Number of credit hours |
| `Term` | Term number the course is typically taken in |
| `Failure Rate` | DFW rate as a percentage string (e.g. `31%`) |
| `Frequency` | Number of times offered per year |

Rows with `0` or blank for Prefix/Number (electives, pathways) are retained and given scores of 0 for metrics they don't contribute to.

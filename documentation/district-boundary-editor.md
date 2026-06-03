# District Boundary Editor

> **v2 (feature change).** Districts **may overlap**, district **names are not unique**, and **two actors create districts**: a `superAdmin` or district `admin` via the admin app, and a `user` with no eligible district who draws one during onboarding (and is promoted to admin of it). The editor is a **shared component in `packages/ui`** used by both admin-front and user-front. See `ROADMAP.md` §2A.

Authorized actors draw, edit, and save district boundaries on an interactive map. Boundaries are stored as GeoJSON Polygons in the `DISTRICTS` collection and used across the platform to scope listings, events, votes, and incidents to each user's **active** district.

---

## User Flow

The actor navigates to the districts map, which is pre-loaded with all existing district boundaries. To create a new district they enter draw mode, trace a polygon by clicking to place vertices, and close the shape. After naming the district and confirming, the boundary is saved and immediately visible on the map.

Existing districts can be selected from a sidebar list. Clicking a district flies the map to its bounds and opens an inline form to rename it, reshape the polygon by dragging its vertices, or delete it.

**Who can do what.**

- **`superAdmin`** (company employee) — sees and edits **all** districts.
- **`admin`** — edits only the **one** district they govern (`adminDistrictId`).
- **`user`** with an **empty eligible set** — gets a **draw-only** flow in user-front: trace a polygon, name it, save. On save they are **promoted to admin** of the new district, and the client **forces a token refresh** to pick up the `adminDistrictId` claim. New polygons **may overlap** existing ones — that is expected, not an error.

---

## Architecture

The feature follows the same layered pattern as the rest of the API: contracts define the shape, use-cases hold the logic, and repositories handle persistence.

### Data Model

Each district holds a name and a geographic boundary in GeoJSON Polygon format — a closed ring of longitude/latitude coordinates. Admin assignment lives in a separate `district_admins` relationship (one district per admin, many admins per district — see `MCD/mongo.md`).

The boundary field carries a MongoDB **2dsphere** geospatial index, used at onboarding to find **all districts a given GPS coordinate falls inside**. Because districts may overlap, this returns a **set** — the user's _eligible_ districts — not a single match; the user then chooses one **active** district. `updatedAt` is tracked alongside `createdAt` for auditing.

### API

Five endpoints cover the full lifecycle:

| Method   | Path             | Description                                |
| -------- | ---------------- | ------------------------------------------ |
| `GET`    | `/districts`     | Return all districts with their boundaries |
| `GET`    | `/districts/:id` | Return a single district                   |
| `POST`   | `/districts`     | Create a district (creator becomes admin)  |
| `PATCH`  | `/districts/:id` | Update name and/or boundary                |
| `DELETE` | `/districts/:id` | Delete a district                          |

`GET /districts` returns the full list without pagination — district count is bounded (tens, not thousands) and the map needs all polygons on initial load. Mutations are authorized per §2A: `superAdmin` anywhere, `admin` only on their district; `POST` is additionally available to a `user` with no eligible district.

The contracts for these endpoints are defined in `@repo/contracts` following the ts-rest pattern and consumed by the API router and both frontend clients.

### Validation

The API enforces the following before persisting any boundary:

- The GeoJSON shape must be a `Polygon` (not a point, line, or multi-polygon).
- The boundary ring must be closed — first and last coordinate identical.
- The ring must contain at least three distinct points.
- **Overlap with existing districts is allowed** (v2) — no overlap check is performed.
- **District names are not required to be unique** (v2) — duplicates are permitted; districts are identified by `_id`.

---

## Frontend (shared editor)

The editor lives in `packages/ui` and is consumed by:

- **admin-front** — full draw/edit/delete, scoped to the actor's district authority.
- **user-front** — draw-only creation, shown only when the user has no eligible district.

### Libraries

The map is powered by **Leaflet** with **react-leaflet** for React integration, and **leaflet-geoman** for the draw and edit tools. OpenStreetMap provides the base tile layer — no API key required.

# District Boundary Editor — Admin Feature

Admins can draw, edit, and save district boundaries on an interactive map. Boundaries are stored as GeoJSON Polygons in the `DISTRICTS` collection and used across the platform to scope listings, events, votes, and incidents.

---

## User Flow

The admin navigates to the districts management page, which displays an interactive map pre-loaded with all existing district boundaries. To create a new district, the admin enters draw mode, traces a polygon on the map by clicking to place vertices, and closes the shape. After naming the district and confirming, the boundary is saved and immediately visible on the map.

Existing districts can be selected from a sidebar list. Clicking a district flies the map to its bounds and opens an inline form where the admin can rename it, reshape the polygon by dragging its vertices, or delete it entirely.

---

## Architecture

The feature follows the same layered pattern as the rest of the API: contracts define the shape, use-cases hold the logic, and repositories handle persistence.

### Data Model

Each district holds a name and a geographic boundary in GeoJSON Polygon format — a closed ring of longitude/latitude coordinates. The boundary field is indexed in MongoDB with a geospatial index, which enables future queries such as "find the district a given GPS coordinate belongs to." The `updatedAt` timestamp is tracked alongside `createdAt` to support auditing.

### API

Five endpoints cover the full lifecycle:

| Method | Path | Description |
|---|---|---|
| `GET` | `/districts` | Return all districts with their boundaries |
| `GET` | `/districts/:id` | Return a single district |
| `POST` | `/districts` | Create a district |
| `PATCH` | `/districts/:id` | Update name and/or boundary |
| `DELETE` | `/districts/:id` | Delete a district |

`GET /districts` returns the full list without pagination — district count is bounded (tens, not thousands) and the map needs all polygons on initial load.

The contracts for these endpoints are defined in `@repo/contracts` following the ts-rest pattern and are consumed by both the API router and the admin frontend client.

### Validation

The API enforces the following rules before persisting any boundary:

- The GeoJSON shape must be a `Polygon` (not a point, line, or multi-polygon).
- The boundary ring must be closed — the first and last coordinate must be identical.
- The ring must contain at least three distinct points.
- District names must be unique — attempting to create a duplicate name returns a conflict error.

### Backend Structure

The district feature mirrors the existing user feature in structure:

- **Entity** — Zod schema defining the district shape and validating incoming GeoJSON.
- **Repository** — Interface with an in-memory implementation for development; swappable for MongoDB via the container without touching use-cases.
- **Use-Cases** — One file per operation. The create and update use-cases contain the GeoJSON validation logic.
- **Router** — Thin ts-rest handler that delegates to use-cases and returns typed responses.

---

## Admin Frontend

### Libraries

The map is powered by **Leaflet** with **react-leaflet** for React integration, and **leaflet-geoman** for the draw and edit tools. OpenStreetMap provides the base tile layer — no API key is required for any of these.

### Page Layout

The districts page is split into two panels: a sidebar on the left and the map on the right filling the remaining viewport height.

**Sidebar** — Lists all districts by name. Clicking a district selects it, centers the map on its bounds, and reveals inline controls to rename or delete it. A "New District" button initiates draw mode on the map.

**Map** — Renders all saved district polygons as filled regions with label tooltips. Saved districts use a muted color; the district being actively drawn or edited is visually distinct. When draw mode is active, the user clicks on the map to place vertices and double-clicks to close the polygon. When edit mode is active, the polygon vertices become draggable.

### Data Handling

A custom hook (`useDistricts`) manages all API interactions. It wraps the typed ts-rest client generated from `@repo/contracts` and exposes the district list alongside create, update, and delete operations. After any mutation, the list is refreshed so the map stays in sync.

---

## Data Flow

```
Sidebar                             Map
  │                                  │
  │  "New District" clicked          │
  │ ───────────────────────────────► │  draw mode activated
  │                                  │
  │                                  │  admin traces polygon
  │                                  │  polygon closed
  │  boundary received  ◄─────────── │
  │                                  │
  │  admin enters name + saves       │
  │                                  │
  │  POST /districts                 │
  │       │                          │
  │       ▼  success                 │
  │  list refreshed ────────────────►│  new polygon rendered
```

---

## Geospatial Index

A `2dsphere` index must be created on the `geoJson` field when the MongoDB repository is wired up. This is a prerequisite for geospatial queries used in other parts of the platform — for example, determining which district a user's registered address falls within, or filtering incidents by geographic area.

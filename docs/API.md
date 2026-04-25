# SprintLearn — API Documentation

> Auto-generated reference. See `MISSION_PRD.md §7` for the full contract.

## Base URL

```
http://localhost:3000/api
```

## Endpoints

### Health Check

```
GET /api/health
```

**Response** `200 OK`:
```json
{
  "status": "ok",
  "timestamp": "2026-04-25T07:00:00.000Z",
  "version": "1.0.0"
}
```

---

### Start Learning Sprint

```
POST /api/session/start
```

> Not yet implemented (returns `501`).

---

### Submit Answer

```
POST /api/session/answer
```

> Not yet implemented (returns `501`).

---

### Get Knowledge State

```
GET /api/session/state?user_id=<uuid>
```

> Not yet implemented (returns `501`).

---

### Get Concept by ID

```
GET /api/concepts/:id
```

> Not yet implemented (returns `501`).

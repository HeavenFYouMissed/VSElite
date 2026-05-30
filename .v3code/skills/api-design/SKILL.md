---
name: api-design
description: REST API and endpoint design patterns
keywords:
  - api
  - REST
  - endpoint
  - route
  - HTTP
  - request
  - response
  - status code
  - middleware
  - CORS
  - rate limit
alwaysApply: false
---

# API Design Skill

## REST Conventions

### URL Structure
- Use nouns, not verbs: `/users` not `/getUsers`
- Use plural: `/users` not `/user`
- Nest for relationships: `/users/:id/posts`
- Use kebab-case: `/user-profiles` not `/userProfiles`
- Max 3 levels of nesting

### HTTP Methods
| Method | Purpose | Idempotent | Body |
|--------|---------|------------|------|
| GET | Read | Yes | No |
| POST | Create | No | Yes |
| PUT | Replace | Yes | Yes |
| PATCH | Partial update | No | Yes |
| DELETE | Remove | Yes | No |

### Status Codes
- `200` OK — successful GET/PUT/PATCH
- `201` Created — successful POST
- `204` No Content — successful DELETE
- `400` Bad Request — validation error (client's fault)
- `401` Unauthorized — not authenticated
- `403` Forbidden — authenticated but not authorized
- `404` Not Found — resource doesn't exist
- `409` Conflict — duplicate/state conflict
- `422` Unprocessable — semantically invalid
- `429` Too Many Requests — rate limited
- `500` Internal Server Error — server's fault

## Response Format

```json
{
  "data": { ... },
  "meta": { "page": 1, "total": 42 },
  "errors": [{ "field": "email", "message": "Invalid format" }]
}
```

## Pagination
- Use `?page=1&limit=20` or `?cursor=abc123`
- Always include total count in response
- Default limit: 20, max limit: 100

## Error Responses
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [{ "field": "email", "rule": "required" }]
  }
}
```

## Security Checklist
- [ ] Rate limiting on all endpoints
- [ ] Input validation on all parameters
- [ ] Authentication on protected routes
- [ ] Authorization (can THIS user access THIS resource?)
- [ ] CORS configured properly
- [ ] No sensitive data in URLs (use headers/body)

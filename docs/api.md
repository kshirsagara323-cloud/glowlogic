# API reference (grows each phase). Base URL: http://localhost:4000

Errors always look like `{ "error": { "code": "...", "message": "..." } }`
(validation errors add a `fields` list). All `/api/v1/me*` routes need `Authorization: Bearer <token>`.

| Method | Path | Auth | Body | Success | Errors |
|---|---|---|---|---|---|
| GET | `/health` | none | none | 200 `{status, database, version, timestamp}` | 503 if DB down |
| GET | `/api/v1/me` | yes | none | 200 `{user, profile}` | 401, 403 disabled |
| PATCH | `/api/v1/me/profile` | yes | any of: ageGroup, climate, sunExposure, budgetTier (1-4), regionCountry (2 capital letters), fragrancePreference, routineComplexity, coveragePreference, finishPreference | 200 `{profile}` | 400 invalid/unknown field, 401, 413 |
| POST | `/api/v1/me/consents` | yes | `{purpose, granted, policyVersion}` | 201 | 400, 401 |
| GET | `/api/v1/me/export` | yes | none | 200 JSON download | 401 |
| DELETE | `/api/v1/me` | yes | `{"confirm":"DELETE"}` | 204 | 400, 401, 502 login cleanup failed |

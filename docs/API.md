# HTTP API

Job Tracker is mostly server-rendered pages and server actions; it has no public REST API in v1. These are the HTTP endpoints it exposes.

```yaml
openapi: 3.1.0
info:
  title: Job Tracker
  version: 0.1.0
  license:
    name: AGPL-3.0-only
    identifier: AGPL-3.0-only
paths:
  /api/health:
    get:
      summary: Liveness check
      description: Used by Docker and uptime monitors. Reveals nothing about the installation.
      responses:
        "200":
          description: The app is running.
          headers:
            Cache-Control:
              schema: { type: string, const: no-store }
          content:
            application/json:
              schema:
                type: object
                properties:
                  status: { type: string, const: ok }
                required: [status]
  /api/auth/session:
    get:
      summary: Current session (Auth.js)
      description: Returns the signed-in user's id, email, name and image, or null. Requires the session cookie.
      responses:
        "200":
          description: Session or null.
          content:
            application/json:
              schema:
                oneOf:
                  - type: "null"
                  - type: object
                    properties:
                      user:
                        type: object
                        properties:
                          id: { type: string, format: uuid }
                          email: { type: string, format: email }
                          name: { type: [string, "null"] }
                          image: { type: [string, "null"] }
                      expires: { type: string, format: date-time }
  /api/auth/csrf:
    get:
      summary: Auth.js CSRF token
      description: Part of Auth.js. Job Tracker's own forms use server actions with their own CSRF token instead.
      responses:
        "200":
          description: Token.
```

Sign up, login, logout, verification, password reset and account deletion are Next.js server actions. They only accept same-origin POST requests carrying a valid `csrf_token`, so they are not a public API.

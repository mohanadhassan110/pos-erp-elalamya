---
name: security-audit
description: Use for authentication, authorization, reports protection, destructive actions, API security, file uploads, audit logs and production readiness.
---

# Security

- Never trust frontend permissions.
- Enforce authorization server-side.
- Reports and owner-only operations require explicit permission/role or secure supervisor authentication.
- Destructive invoice operations require elevated permission and audit logging.
- Validate and authorize every file upload.
- Never expose secrets in source code or client bundles.
- Use Laravel CSRF/authentication mechanisms appropriate to the API architecture.
- Rate-limit sensitive authentication and mutation endpoints where appropriate.
- Log security-relevant actions without storing unnecessary sensitive data.
- Treat audit logs as append-oriented history.
- For financial mutations, record actor, timestamp, operation, entity and relevant before/after state or event reference.

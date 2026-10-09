---
name: laravel-architecture
description: Use for Laravel backend design, new modules, refactors, API endpoints, database changes and business workflows.
---

# Laravel Architecture

Use a pragmatic layered/domain-oriented architecture:

HTTP/API
-> Form Requests / authorization
-> Actions or Application Services
-> Domain business rules
-> Eloquent models/repositories only where justified
-> Database

Rules:
- Controllers remain thin.
- Form Requests own input validation.
- Policies/authorization own access decisions.
- Actions/services orchestrate business operations.
- Transactions surround multi-aggregate financial/inventory mutations.
- Models contain relationships, casts, scopes and small invariant-safe behavior; do not turn models into giant service classes.
- API Resources define response contracts.
- Use DTOs/value objects only when they clarify boundaries.
- Avoid repository pattern by default; use it when a real persistence boundary or complex query abstraction exists.
- Keep modules separated by business capability: Catalog, Inventory, Sales, Customers, Suppliers, Expenses, Reports, Authentication/Audit.
- Every migration must include appropriate indexes, foreign keys and constraints.
- Avoid N+1 queries and unbounded queries.
- Use policies and server-side authorization for every protected mutation.

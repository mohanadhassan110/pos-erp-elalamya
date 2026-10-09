---
name: change-control
description: Use before non-trivial implementation work to prevent AI drift, architecture mutation, scope creep and accidental rewrites.
---

# AI Change Control

Before coding:
- Read AGENTS.md and relevant skills.
- Inspect current architecture and existing implementation.
- Identify the exact acceptance criteria.
- Identify impacted modules and data flows.
- Identify tests that prove correctness.

During coding:
- Do not change stack or architecture without approval.
- Do not introduce packages unless justified and approved.
- Do not rename core concepts casually.
- Do not rewrite working modules to a preferred pattern.
- Do not implement adjacent features not requested.
- Keep changes small and reversible.

After coding:
- Run tests and checks.
- Review database and business side effects.
- Verify no unrelated files changed.
- Report files changed, tests run, and known limitations.

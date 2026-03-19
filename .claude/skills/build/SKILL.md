---
name: build
description: Build the Uuumi web project using Astro to check for compilation errors
---

Build the Uuumi web project and report results:

1. Run: `npm run build 2>&1 | tail -30`
2. If the build succeeds, report success briefly
3. If the build fails, show the relevant error(s) and suggest fixes

Rules:
- Only build when explicitly invoked via /build
- Do NOT build automatically after completing tasks
- Keep output concise — focus on errors, not warnings

---
name: engine-validation
description: Verify Engine Atlas changes or prepare a source handoff using numeric geometry checks, production compilation, and focused visual review. Use for this repository's regression checks and release readiness.
---

# Validate Engine Atlas

Read the request and git diff to identify remaining risks. Run commands from the root with locked dependencies, using npm ci if absent.

- Geometry, motion, packing, picking, or separation: npm run test:engines. This checks actual builders, inventory bounds, home matrices, reverse scrubbing, identity, isolation, and linkages.
- Executable application changes: npm run build:local or the host-required equivalent.
- Rendering/shared UI changes: npm run test:local. These are HTML/component tests, not browser tests.
- Skill edits: validate matching name/front matter, useful triggers, valid references, and metadata whose default prompt names the skill. Use the host's skill validator when available.

For a new engine, ensure the fixture enumerates it and every component group contains meshes. Keep source-extraction delimiters aligned after builder refactors.

When browser review is requested or available, cover switching, picking, hide/isolate, cutaway, animation, both layouts, slider reversal, spacing, playback, and narrow screens. Record only what was exercised; do not infer visual fidelity or frame rate from builds.

For a source download, commit intended files, run python3 scripts/export-repository.py <absolute-zip-path>, and verify the archive and manifest hashes. Include setup instructions, exclude credentials and generated folders, and report untested platform boundaries.

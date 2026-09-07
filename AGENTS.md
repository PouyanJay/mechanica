# Engine Atlas repository guidance

## Product requirements

- Preserve the seven engines and detailed dark 3D interface.
- Keep separation a continuous, reversible slider. Zero restores the exact captured assembly; one shows every independent piece in inventory.
- Preserve group and piece selection, hiding, isolation, cutaway, camera fitting, and playback.
- Use no em dashes or en dashes in authored UI copy or new documentation.
- Describe geometry as educational reference models, without claiming manufacturer CAD fidelity.

## Work in this repository

Read README.md and the affected module before editing. Reuse declared dependencies and the lockfile. Relevant workflows are in .agents/skills/engine-models, engine-explosion, and engine-validation.

Run commands from the repository root. Setup: npm ci. Development: npm run dev:local. Preserve the original hosted scripts and sites() Vite plugin. A connected checkout retains its own hosting identity; a portable export omits it.

For geometry, motion, or separation changes, run npm run test:engines. For executable changes, run npm run build:local or the host-required equivalent. For rendering/shared UI changes, run npm run test:local. Add meaningful mechanism invariants for new engines.

Review visual states when requested or available in the development environment. Numeric tests alone do not establish visual quality. Report actual verification and limitations.

## Architecture constraints

- Engine keys, component IDs, scene groups, and UI state must agree.
- Preserve instanced piece identities and captured home transforms.
- Surface markings follow their host and are not independent hardware.
- Avoid rebuilding geometry every animation frame. Dispose owned GPU resources and listeners.
- Preserve fixed piston rod lengths and rotary shaft-to-rotor motion at 3:1.
- Restrict flow overlays to supported engines.

## Handoff

Update documentation when commands or architecture change. Commit skills with source. Exclude credentials, environment files, dependencies, output, and caches from exports. Use scripts/export-repository.py after committing.

There is no required multi-agent topology or model pin. This guidance supports one coding agent. The agents/openai.yaml files are skill UI metadata, not running subagents.

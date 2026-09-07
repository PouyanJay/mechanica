---
name: engine-models
description: Add or refine Engine Atlas engine geometry, component catalogs, or mechanical animation. Use for turbine, piston, rotary, or new engine mechanisms. Use engine-explosion for separation-only work.
---

# Engine models

Work from the repository root. Read AGENTS.md, docs/ARCHITECTURE.md, and the closest existing builder.

1. Define the stable engine key and actual component groups in app/engine-data.ts.
2. Implement turbine geometry in app/engine-scene.tsx or mechanical geometry in app/mechanical-engines.ts. Follow the existing build context and register the builder.
3. Assign useful piece names and matching part metadata. Repeated instances represent independent hardware; surface markings attach to their host.
4. Keep linkage constraints meaningful. Piston rods connect crank and wrist pins at fixed length. Rotary motion retains a 3:1 shaft-to-rotor relation and apex housing locus. Label illustrative ratios honestly.
5. Integrate visibility, isolation, picking, clipping, labels, fitting, animation capture, and cleanup. Restrict flow overlays to supported engines.
6. Extend scripts/check-explosion.mjs with the engine and its mechanism constraints. Run npm run test:engines and npm run build:local or the host-required equivalent.

Deliver a selectable, distinct mechanism with accurate component text and reported checks. Inspect assembled and separated silhouettes when visual review is available. Numeric checks alone do not demonstrate graphics quality.

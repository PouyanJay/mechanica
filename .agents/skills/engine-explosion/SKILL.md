---
name: engine-explosion
description: Change or repair Engine Atlas continuous disassembly, reassembly, individual-piece selection, inventory packing, spacing, or camera fitting. Use for separation-slider or exploded-view changes.
---

# Engine separation

Read app/explosion-controller.ts, app/explosion-layout.ts, and slider/camera integration in app/page.tsx and app/engine-scene.tsx.

1. Identify the failing engine, slider value, layout, spacing, aspect ratio, and visibility state.
2. Preserve the normalized 0 to 1 contract. Zero restores captured home matrices exactly. Derive deterministic poses instead of accumulating motion.
3. Preserve continuity at 0.45, early assembled orientation, reverse scrubbing, and animated-home capture. Update verification if deliberately changing the phase boundary.
4. Keep instance identities and picking mappings distinct. Decorations follow their host and do not count as loose hardware.
5. Pack visible independent pieces using actual projected bounds. Check narrow, square, and wide views, hidden groups, and single-piece isolation.
6. Keep camera bounds coordinated with the layout, preserving orthographic inventory presentation and useful full-separation navigation.
7. Run npm run test:engines, add a meaningful regression assertion if needed, and build executable changes.

When visual review is available, scrub both ways through 0, 25, 45, 60, 80, and 100 percent in both layouts. Report visual and numeric verification separately. Preserve the primary slider and exact reassembly for every engine.

# Architecture and extension notes

## Data and rendering

lib/engine/engine-data.ts defines EngineType, ENGINES, and getParts(engine). app/page.tsx owns UI state. EngineScene (components/engine/engine-scene.tsx) owns Three.js objects, rendering, interaction, and cleanup. Turbine builders live in the scene module; lib/engine/mechanical-engines.ts supplies piston, rotary, and shaft-output builders. lib/engine/explosion-controller.ts and lib/engine/explosion-layout.ts implement separation and packing.

Component groups carry their IDs. Mesh metadata carries part IDs and useful piece names. Repeated hardware uses InstancedMesh where appropriate. ExplosionController gives each source instance a logical identity while batching rendered representations. Keep catalog and scene metadata aligned or picking, visibility, labels, and counts will diverge.

## Continuous separation

The UI's 0 to 100 slider normalizes to 0 to 1. Early movement loosens the assembly while retaining piece orientation. The transition at 0.45 leads into individual-piece distribution. Inventory uses shelf packing and orthographic presentation; radial mode distributes pieces in space.

Each piece has a captured home matrix. Derive its pose from that home and the current slider value, without accumulating frame-to-frame offsets. A slider value reached in either direction must produce the same pose. Capture running mechanism transforms before entering separation so reassembly returns to that mechanical state.

userData.attachTo links surface markings to their source host. Decorations follow the host and are excluded from independent hardware counts. Layout considers visibility, aspect ratio, spacing, and isolation. Fit the camera to the resulting bounds.

## Mechanisms

Piston motion maintains crank, connecting rod, and wrist-pin constraints with constant rod length. Rotary motion uses an eccentric shaft, a 3:1 shaft-to-rotor speed ratio, and apex positions following the housing locus. Turbine and propeller ratios are illustrative.

## Add an engine

1. Add a stable engine key, catalog entry, and real component descriptions in lib/engine/engine-data.ts.
2. Add and register its geometry builder. Provide a distinct mechanism and useful piece names.
3. Match the component list to nonempty scene groups. Integrate clipping, cutaway, labels, picking, bounds, and cleanup.
4. Supply animation and capture current transforms correctly before separation.
5. Update engine-specific UI conditions, including flow support and reset behavior.
6. Add the engine to scripts/check-explosion.mjs and assert its mechanism constraints. The fixture extracts builder source using delimiters; update that extraction after builder refactors.
7. Run engine checks and a production build. Inspect assembled, partial, and fully separated states.

## Graphics

Geometry, metallic materials, studio lighting, and shadows are implemented in code. No external GLB or texture library is missing from this export. Improve topology, silhouette, material response, and lighting in the source. If importing licensed CAD later, record its source, license, units, coordinate conventions, level of detail, and hierarchy.

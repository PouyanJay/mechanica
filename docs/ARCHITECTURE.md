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

## Guided walkthroughs

`lib/engine/walkthroughs.ts` defines ordered lessons for all seven engines and pure state transitions for entering, stepping, playing and leaving a lesson. Each station names catalog component IDs, has no more than three sentences, and supplies a camera position and target. Optional hidden group IDs expose internal mechanisms; rotary lessons remove the side housings so the rotor face is visible. Piston and rotary stations also supply an absolute crank or eccentric-shaft angle in radians, using the same input as the mechanical builders.

The page owns the station index and playback timer. Auto-advance waits eight seconds at 1x speed; manual stepping pauses it, and the last station remains available for exploration. Dialogs suspend auto-advance. Starting clears separation, hiding and isolation, opens cutaway, and saves the airflow preference. Leaving restores airflow and retains selection, mechanism pose and the current camera position. Picking a component or changing the view mode also leaves the lesson.

`selectedParts` extends ordinary selection to multiple component groups using the same emissive material treatment. A normal pick returns to single selection. `lib/engine/walkthrough-camera.ts` preserves a station's viewing direction while increasing distance enough to fit every model corner with a margin at the actual canvas aspect ratio. The scene applies the existing camera easing and respects reduced motion. It never rebuilds geometry on station changes.

`components/engine/walkthrough-card.tsx` provides labeled controls and a polite, atomic live region. Desktop layouts reserve space beside the canvas; narrower layouts place the canvas, lesson and console in separate rows. Arrow keys step, Space toggles playback and Escape exits, while form controls and dialogs retain their own keyboard behavior.

`npm run test:engines` checks lesson coverage, catalog references, copy length, playback boundaries, airflow restoration and camera framing against the real engine geometry at three aspect ratios, in addition to the existing mechanism and separation checks.

For live Chromium checks, start the local server and run `PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/check-walkthrough-browser.mjs` using an existing Playwright installation and browser. `WALKTHROUGH_URL` overrides the default `http://localhost:5173`. `WALKTHROUGH_ARTIFACT_DIR` overrides the screenshot directory, which defaults to `mechanica-walkthrough` inside the system temporary directory. This optional check exercises all lessons, keyboard navigation, airflow restoration, speed and pause controls, and responsive layouts without adding a runtime dependency.

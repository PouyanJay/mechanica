# Free-angle cutaway verification

Issue #2 adds one movable, rotatable plane. The original housing section is the simple default; explicit orientation controls enable clipping of the entire mechanism. Multiple simultaneous planes and exporting clipped geometry are outside this change.

## Automated checks

Run from the repository root with the existing dependencies:

```sh
npm run test:engines
npm run test:local
npm run build:next
npm run lint
```

The engine check uses the real builders and section-rendering implementation. It verifies all seven engines at cardinal, polar and deterministic oblique orientations. Depth reaches every bounding-box corner, endpoint sections cover the entire projected extent, and flipping leaves the plane in the same position. Source matrices, stable piece identities, individual-piece counts and Explore materials remain unaffected. The existing linkage, rotary motion, walkthrough and separation regressions also run.

The component checks verify the original depth range, labeled yaw and pitch ranges, presets, disclosure, flip, guide and reset controls.

## Live browser checks

Use an existing Playwright installation and Chromium browser with a running local server:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/check-section-browser.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/check-walkthrough-browser.mjs
```

The section suite checks actual renderer materials and clipping coefficients for every engine, stable geometry, plane persistence across modes, engine reset, animation, airflow, one-finger manipulation without camera movement, and responsive controls. Screenshots provide a separate visual review of the V8 block and turbofan casing. Accessibility semantics are checked in the DOM; this does not replace testing with a real screen reader.

## Performance comparison

The baseline is the original cutaway at commit `727ec7f`. Serve a detached checkout on a separate port and compare it with the feature checkout on the same machine and browser:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CUTAWAY_URL=http://localhost:5174 CUTAWAY_ARTIFACT_DIR=/tmp/cutaway-baseline node scripts/check-cutaway-performance.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CUTAWAY_URL=http://localhost:5173 CUTAWAY_PLANE=free CUTAWAY_MATCH_CAMERA=1 CUTAWAY_BASELINE=/tmp/cutaway-baseline/performance.json node scripts/check-cutaway-performance.mjs
```

The performance script records three warmed samples of frame intervals and renderer CPU time for paused, playing, and playing-with-airflow scenarios. Keep GPU browser work sequential while collecting samples. Match the actual canvas size, pixel ratio and camera pose across baseline and feature runs. Frame rate must remain at least 90 percent of baseline. Render CPU time and draw counts are additional diagnostics, especially when both runs reach the display's frame-rate limit.

`CUTAWAY_PLANE=default|free|guide` selects the simple section, an oblique section at yaw 37 and pitch -23, or that section with its guide visible. `CUTAWAY_BASELINE` loads a prior report and asserts matching GPU, canvas, pixel ratio and camera before enforcing the 10 percent frame-rate gate. `CUTAWAY_SCENARIOS` can limit a focused rerun to `paused`, `playing` or `playing-airflow`; `CUTAWAY_SAMPLE_MS` defaults to 8000.

`CUTAWAY_MATCH_CAMERA=1` pins the benchmark render camera to the baseline pose. This keeps the rendered workload comparable after the responsive camera-fitting change; production camera behavior is verified separately by the section browser suite.

### Recorded comparison

The initial comparison used Chromium 148, ANGLE Metal on an Apple M5, balanced quality, a 1153 by 633 canvas, and device pixel ratio 1. Each scenario used three 8-second samples after warmup.

| Scenario | Original FPS | Oblique section FPS | Original render CPU | Oblique render CPU |
| --- | --- | --- | --- | --- |
| Paused | 120.000 | 120.000 | 1.821 ms | 1.629 ms |
| Playing | 120.001 | 119.999 | 1.837 ms | 1.582 ms |
| Playing with airflow | 119.999 | 120.000 | 1.702 ms | 1.518 ms |

The largest mean frame-rate decrease across the new default and oblique-section scenarios was 0.0045 percent. The visible guide added four draws and 12 triangles and averaged 120.003 FPS. No browser errors occurred. These measurements meet the issue's threshold on this configuration; the frame rate reached the refresh limit and is not a claim about every device.

After the responsive camera-fitting fix, a final paused oblique-section comparison used the explicit baseline camera pin and three more 8-second samples. It passed at 124.350 FPS against the original 120.000 FPS, with render CPU time of 1.600 ms against 1.821 ms and no browser errors. The report records `matchedRenderCamera: true`; the GPU, canvas and camera equality checks passed.

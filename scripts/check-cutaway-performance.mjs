// Optional live-browser comparison. No additional project dependencies are installed.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/check-cutaway-performance.mjs
// CUTAWAY_URL selects the server; CUTAWAY_ARTIFACT_DIR selects the report/screenshot directory.
// CUTAWAY_PLANE=default|free|guide selects the legacy default or a yaw37/pitch-23 cut.
// CUTAWAY_BASELINE=/path/to/performance.json enables matching camera/canvas assertions and the 10% FPS gate.
// CUTAWAY_MATCH_CAMERA=1 pins only the probe render camera to baseline when production camera fitting changes.
// CUTAWAY_SCENARIOS=paused,playing,playing-airflow and CUTAWAY_SAMPLE_MS=8000 control sampling.
// Compare isolated revisions serially on the same browser/GPU with other browser workloads stopped.
// Frame intervals measure delivered FPS; renderer CPU timings diagnose cost beneath the refresh-rate ceiling.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.CUTAWAY_URL || 'http://localhost:5173';
const artifacts = process.env.CUTAWAY_ARTIFACT_DIR || path.join(os.tmpdir(), 'mechanica-cutaway-performance');
const planeMode = process.env.CUTAWAY_PLANE || 'default';
assert(['default', 'free', 'guide'].includes(planeMode), 'CUTAWAY_PLANE must be default, free or guide');
const scenarios = (process.env.CUTAWAY_SCENARIOS || 'paused,playing,playing-airflow').split(',');
assert(scenarios.every(value => ['paused', 'playing', 'playing-airflow'].includes(value)), 'Unknown CUTAWAY_SCENARIOS value');
const baseline = process.env.CUTAWAY_BASELINE ? JSON.parse(await readFile(process.env.CUTAWAY_BASELINE, 'utf8')) : null;
const canvasSize = baseline?.environment.canvas || [1153, 633];
const sampleMs = Number(process.env.CUTAWAY_SAMPLE_MS || 8000);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  window.__THREE_DEVTOOLS__ = new EventTarget();
  window.__cutawayPerformance = { active: false, frames: [], renderer: null, scene: null, camera: null };
  window.__THREE_DEVTOOLS__.addEventListener('observe', ({ detail: renderer }) => {
    if (typeof renderer.render !== 'function') return;
    const original = renderer.render.bind(renderer);
    renderer.render = (scene, camera) => {
      const probe = window.__cutawayPerformance;
      probe.renderer = renderer; probe.scene = scene; probe.camera = camera;
      if (probe.fixedCamera) {
        camera.position.fromArray(probe.fixedCamera.position);
        camera.lookAt(camera.position.clone().add(camera.position.clone().fromArray(probe.fixedCamera.direction)));
        camera.updateMatrixWorld();
      }
      const start = performance.now();
      const result = original(scene, camera);
      if (probe.active) probe.frames.push({ at: start, cpuMs: performance.now() - start, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, programs: renderer.info.programs.length });
      return result;
    };
  });
});
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('canvas').waitFor();
  await page.getByRole('button', { name: 'Viewer settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Rendering quality' }).click();
  await page.getByRole('option', { name: 'Balanced', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: 'Cutaway', exact: true }).click();
  // Keep the workload comparable when the console changes the remaining canvas height.
  await page.locator('canvas').evaluate((canvas, size) => {
    const host = canvas.parentElement;
    Object.assign(host.style, { width: `${size[0]}px`, height: `${size[1]}px`, minHeight: `${size[1]}px`, maxHeight: `${size[1]}px`, flex: 'none' });
  }, canvasSize);
  const configurePlane = async () => {
    if (planeMode === 'default') return;
    await page.getByRole('button', { name: 'Plane controls', exact: true }).click();
    await page.getByRole('group', { name: 'Plane orientation presets', exact: true }).getByRole('button', { name: 'Side', exact: true }).click();
    for (const [label, value] of [['Yaw', 37], ['Pitch', -23]]) {
      await page.getByRole('slider', { name: label, exact: true }).evaluate((input, next) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
      assert.equal(await page.getByRole('slider', { name: label, exact: true }).inputValue(), String(value));
    }
    await page.getByRole('checkbox', { name: 'Show cutting plane', exact: true }).setChecked(planeMode === 'guide');
    await page.getByRole('button', { name: 'Plane controls', exact: true }).click();
  };
  await configurePlane();
  if (baseline && process.env.CUTAWAY_MATCH_CAMERA === '1') {
    await page.evaluate(environment => {
      window.__cutawayPerformance.fixedCamera = { position: environment.cameraPosition, direction: environment.cameraTargetDirection };
    }, baseline.environment);
  }
  await page.waitForTimeout(2500);
  const environment = await page.evaluate(() => {
    const { renderer, camera } = window.__cutawayPerformance;
    const gl = renderer.getContext(); const info = gl.getExtension('WEBGL_debug_renderer_info');
    return { userAgent: navigator.userAgent, gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), devicePixelRatio, rendererPixelRatio: renderer.getPixelRatio(), canvas: [gl.canvas.width, gl.canvas.height], cameraPosition: camera.position.toArray(), cameraTargetDirection: camera.getWorldDirection(camera.position.clone()).toArray(), gpuTimerAvailable: !!gl.getExtension('EXT_disjoint_timer_query_webgl2') };
  });
  if (baseline) {
    for (const field of ['gpu', 'rendererPixelRatio', 'canvas']) assert.deepEqual(environment[field], baseline.environment[field], `Comparable ${field}`);
    for (const field of ['cameraPosition', 'cameraTargetDirection']) assert(environment[field].every((value, index) => Math.abs(value - baseline.environment[field][index]) < 0.001), `Comparable ${field}`);
  }
  const samples = [];
  for (const scenario of scenarios) {
    const playing = scenario !== 'paused';
    const playButton = page.getByRole('button', { name: playing ? 'Animate engine rotation' : 'Pause engine rotation', exact: true });
    if (await playButton.count()) await playButton.click();
    const flow = page.getByRole('switch', { name: 'Show illustrative airflow' });
    if ((await flow.getAttribute('aria-checked') === 'true') !== (scenario === 'playing-airflow')) await flow.click();
    await page.waitForTimeout(2000);
    for (let repetition = 1; repetition <= 3; repetition++) {
      await page.evaluate(() => { window.__cutawayPerformance.frames = []; window.__cutawayPerformance.active = true; });
      await page.waitForTimeout(sampleMs);
      const frames = await page.evaluate(() => { window.__cutawayPerformance.active = false; return window.__cutawayPerformance.frames; });
      const intervals = frames.slice(1).map((frame, index) => frame.at - frames[index].at);
      const sample = { scenario, repetition, frames: frames.length, fps: 1000 / mean(intervals), frameMs: mean(intervals), p95FrameMs: percentile(intervals, .95), cpuMs: mean(frames.map(frame => frame.cpuMs)), p95CpuMs: percentile(frames.map(frame => frame.cpuMs), .95), calls: mean(frames.map(frame => frame.calls)), triangles: mean(frames.map(frame => frame.triangles)), programs: frames.at(-1).programs };
      samples.push(sample); console.log(JSON.stringify(sample));
    }
  }
  const flow = page.getByRole('switch', { name: 'Show illustrative airflow' });
  if (await flow.getAttribute('aria-checked') === 'true') await flow.click();
  const pause = page.getByRole('button', { name: 'Pause engine rotation', exact: true });
  if (await pause.count()) await pause.click();
  await page.screenshot({ path: path.join(artifacts, 'turbofan-cutaway.png') });
  await page.evaluate(() => { window.__cutawayPerformance.fixedCamera = null; });
  await page.locator('.engine-picker').click();
  await page.locator('.library-engine').nth(4).click();
  await page.getByRole('tab', { name: 'Cutaway', exact: true }).click();
  await configurePlane();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(artifacts, 'v8-cutaway.png') });
  const comparison = baseline ? scenarios.map(scenario => {
    const before = baseline.samples.filter(sample => sample.scenario === scenario);
    const after = samples.filter(sample => sample.scenario === scenario);
    const baselineFps = mean(before.map(sample => sample.fps));
    const currentFps = mean(after.map(sample => sample.fps));
    return { scenario, baselineFps, currentFps, fpsChangePercent: (currentFps / baselineFps - 1) * 100, withinTenPercent: currentFps >= baselineFps * .9, baselineCpuMs: mean(before.map(sample => sample.cpuMs)), currentCpuMs: mean(after.map(sample => sample.cpuMs)) };
  }) : null;
  const report = { url, planeMode, matchedRenderCamera: !!baseline && process.env.CUTAWAY_MATCH_CAMERA === '1', recordedAt: new Date().toISOString(), environment, sampleMs, samples, comparison, errors };
  await writeFile(path.join(artifacts, 'performance.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ artifacts, environment, comparison, errors }));
  if (comparison) assert(comparison.every(result => result.withinTenPercent), 'FPS must remain within ten percent of baseline in every scenario');
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
} finally { await browser.close(); }

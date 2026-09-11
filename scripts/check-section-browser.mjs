import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(() => {
  throw new Error('Set PLAYWRIGHT_MODULE to an installed Playwright index.mjs path.');
});
const artifacts = process.env.SECTION_ARTIFACT_DIR || path.join(os.tmpdir(), 'mechanica-sections');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && /THREE|WebGL|shader|GL_INVALID/i.test(message.text())) errors.push(message.text());
});
await page.addInitScript(() => {
  window.__THREE_DEVTOOLS__ = new EventTarget();
  window.__sectionProbe = {};
  window.__THREE_DEVTOOLS__.addEventListener('observe', ({ detail }) => {
    if (typeof detail.render !== 'function') return;
    const render = detail.render.bind(detail);
    detail.render = (scene, camera) => {
      window.__sectionProbe = { scene, camera };
      return render(scene, camera);
    };
  });
});

async function inspect() {
  return page.evaluate(() => {
    const { scene, camera } = window.__sectionProbe;
    const meshes = [];
    scene.traverse(object => {
      if (!object.isMesh || !object.userData.part) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      meshes.push({ part: object.userData.part, geometry: object.geometry.uuid, instanced: !!object.isInstancedMesh,
        clipped: materials.every(material => material.clippingPlanes?.length > 0 && Math.abs(material.clippingPlanes[0].constant) < 1e5),
        plane: materials[0].clippingPlanes?.[0] ? [...materials[0].clippingPlanes[0].normal.toArray(), materials[0].clippingPlanes[0].constant] : null });
    });
    const gizmo = scene.getObjectByName('section-plane-gizmo');
    return { meshes, camera: [...camera.position.toArray(), ...camera.quaternion.toArray()], gizmo: gizmo?.visible ?? false };
  });
}

async function expand() {
  const button = page.getByRole('button', { name: 'Plane controls', exact: true });
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
}

async function assertLayout(label) {
  const bounds = await page.evaluate(() => {
    const scene = document.querySelector('.scene-host').getBoundingClientRect();
    const console = document.querySelector('.bottom-console').getBoundingClientRect();
    const overflow = [...document.querySelectorAll('.section-controls button,.section-controls input')]
      .filter(control => control.getBoundingClientRect().width)
      .filter(control => { const box = control.getBoundingClientRect(); return box.x < console.x || box.right > console.right || box.top < console.top || box.bottom > console.bottom; });
    return { scene: scene.toJSON(), console: console.toJSON(), overflow: overflow.length, horizontal: document.documentElement.scrollWidth > innerWidth };
  });
  assert.equal(bounds.overflow, 0, `${label}: plane controls fit inside console`);
  assert.equal(bounds.horizontal, false, `${label}: no horizontal overflow`);
  assert(bounds.scene.height >= 200 && bounds.scene.y >= 50, `${label}: model has visible scene space`);
  assert(bounds.scene.bottom <= bounds.console.top + 1, `${label}: console does not cover the scene`);
  const projected = await page.evaluate(() => {
    const { scene, camera } = window.__sectionProbe;
    let maxX = 0, maxY = 0, corners = 0;
    scene.traverse(mesh => {
      if (!mesh.isMesh || !mesh.userData.part) return;
      for (let ancestor = mesh; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return;
      if (mesh.isInstancedMesh && !mesh.boundingBox) mesh.computeBoundingBox();
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const box = mesh.isInstancedMesh ? mesh.boundingBox : mesh.geometry.boundingBox;
      if (!box || box.isEmpty()) return;
      const point = mesh.position.clone();
      for (let index = 0; index < 8; index++) {
        point.set(index & 1 ? box.max.x : box.min.x, index & 2 ? box.max.y : box.min.y, index & 4 ? box.max.z : box.min.z).applyMatrix4(mesh.matrixWorld).project(camera);
        maxX = Math.max(maxX, Math.abs(point.x)); maxY = Math.max(maxY, Math.abs(point.y)); corners++;
      }
    });
    return { maxX, maxY, corners };
  });
  assert(projected.corners > 0);
  assert(projected.maxX <= 1.01 && projected.maxY <= 1.01, `${label}: actual component bounds fit inside canvas (${JSON.stringify(projected)})`);
}

try {
  await page.goto(process.env.SECTION_URL || 'http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__sectionProbe.scene);
  for (let engine = 0; engine < 7; engine++) {
    if (engine) {
      await page.locator('.engine-picker').click();
      await page.locator('.library-engine').nth(engine).click();
    }
    await page.getByRole('tab', { name: 'Cutaway', exact: true }).click();
    const depth = page.getByRole('slider', { name: 'Section depth', exact: true });
    assert.equal(await depth.inputValue(), '52', 'Engine switch resets section depth');
    await page.waitForTimeout(300);
    const baseline = await inspect();
    assert(baseline.meshes.some(mesh => mesh.clipped));
    assert(baseline.meshes.some(mesh => !mesh.clipped), 'Simple default retains housing-only clipping');
    await expand();
    assert.equal(await page.getByRole('slider', { name: 'Yaw', exact: true }).inputValue(), '0');
    assert.equal(await page.getByRole('slider', { name: 'Pitch', exact: true }).inputValue(), '0');
    for (const preset of ['Top', 'Side', 'Front', 'Along axis']) {
      await page.getByRole('button', { name: preset, exact: true }).click();
      await page.waitForTimeout(120);
      const cut = await inspect();
      assert(cut.meshes.every(mesh => mesh.clipped), `${preset}: all component meshes clip`);
      assert(cut.meshes.filter(mesh => mesh.instanced).every(mesh => mesh.clipped), `${preset}: instanced hardware clips`);
      assert(cut.meshes.every(mesh => mesh.plane.every(Number.isFinite)), 'Planes contain finite coefficients');
      assert.deepEqual(cut.meshes.map(mesh => mesh.geometry), baseline.meshes.map(mesh => mesh.geometry), 'Adjusting the plane reuses geometry');
    }
    const yaw = page.getByRole('slider', { name: 'Yaw', exact: true });
    const pitch = page.getByRole('slider', { name: 'Pitch', exact: true });
    await yaw.focus(); await page.keyboard.press('End');
    await pitch.focus(); await page.keyboard.press('Home');
    assert.equal(await yaw.inputValue(), '180');
    assert.equal(await pitch.inputValue(), '-90');
    await depth.focus(); await page.keyboard.press('End');
    assert.equal(await depth.inputValue(), '100');
    await depth.focus(); await page.keyboard.press('Home');
    assert.equal(await depth.inputValue(), '0');
    await page.getByRole('button', { name: 'Top', exact: true }).click();
    await page.waitForTimeout(100);
    const beforeFlip = (await inspect()).meshes[0].plane;
    await page.getByRole('button', { name: 'Flip cut side', exact: true }).click();
    await page.waitForTimeout(100);
    const afterFlip = (await inspect()).meshes[0].plane;
    assert(beforeFlip.every((value, index) => Math.abs(value + afterFlip[index]) < 1e-8), 'Flip negates the clipping plane');
    const toggle = page.getByRole('checkbox', { name: 'Show cutting plane', exact: true });
    assert(await toggle.isChecked());
    assert.equal((await inspect()).gizmo, true, 'The cutting-plane gizmo is actually rendered');
    await toggle.uncheck();
    await page.waitForTimeout(100);
    assert.equal((await inspect()).gizmo, false);
    assert.deepEqual((await inspect()).meshes[0].plane, afterFlip, 'Hiding the gizmo preserves the cut');
    await page.getByRole('tab', { name: 'Explore', exact: true }).click();
    await page.waitForTimeout(100);
    assert.equal((await inspect()).gizmo, false);
    assert((await inspect()).meshes.every(mesh => !mesh.clipped), 'Explore disables all model clipping');
    await page.getByRole('tab', { name: 'Cutaway', exact: true }).click();
    await expand();
    assert.equal(await page.getByRole('button', { name: 'Flip cut side', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Reset cutting plane', exact: true }).click();
    assert.equal(await depth.inputValue(), '52');
    assert.equal(await yaw.inputValue(), '0');
    assert.equal(await pitch.inputValue(), '0');
    assert.equal(await toggle.isChecked(), false);
    await page.getByRole('button', { name: 'Along axis', exact: true }).click();
    await toggle.uncheck();
    if (engine === 0 || engine === 4) {
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(artifacts, engine === 0 ? 'turbofan-interior.png' : 'v8-interior.png'), fullPage: true });
    }
    console.log(`Passed engine ${engine + 1}: presets, ranges, instanced clipping, flip, gizmo, restore, reset`);
  }
  await page.locator('.engine-picker').click();
  await page.locator('.library-engine').first().click();
  await page.getByRole('tab', { name: 'Cutaway', exact: true }).click();
  await expand();
  await page.getByRole('button', { name: 'Side', exact: true }).click();
  const beforeMotion = await page.evaluate(() => {
    const matrices = []; window.__sectionProbe.scene.traverse(object => { if (object.isMesh && object.userData.part) matrices.push(object.matrixWorld.elements.join(',')); }); return matrices;
  });
  await page.getByRole('button', { name: 'Animate engine rotation', exact: true }).click();
  await page.getByRole('switch', { name: 'Show illustrative airflow' }).click();
  await page.waitForTimeout(1000);
  assert.equal(await page.getByRole('switch', { name: 'Show illustrative airflow' }).getAttribute('aria-checked'), 'true');
  assert(await page.getByRole('button', { name: 'Pause engine rotation', exact: true }).isVisible());
  const afterMotion = await page.evaluate(() => {
    const matrices = []; window.__sectionProbe.scene.traverse(object => { if (object.isMesh && object.userData.part) matrices.push(object.matrixWorld.elements.join(',')); }); return matrices;
  });
  assert.notDeepEqual(afterMotion, beforeMotion, 'The mechanism continues moving under a free-angle cut');
  await page.getByRole('button', { name: 'Pause engine rotation', exact: true }).click();
  for (const size of [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(1200);
    await assertLayout(`${size.width}x${size.height}`);
    await page.screenshot({ path: path.join(artifacts, `${size.width}x${size.height}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const yaw = page.getByRole('slider', { name: 'Yaw', exact: true });
  await yaw.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const cameraBefore = (await inspect()).camera;
  const box = await yaw.boundingBox();
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * .5, y: box.y + box.height * .5 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * .8, y: box.y + box.height * .5 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  assert.notEqual(await yaw.inputValue(), '0', 'Touch adjusts yaw');
  assert.deepEqual((await inspect()).camera, cameraBefore, 'Touching a plane slider does not orbit the model');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Viewer settings', exact: true }).click();
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.locator('.settings-dialog').waitFor({ state: 'hidden' });
  await page.screenshot({ path: path.join(artifacts, 'mobile-light.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, engines: 7, errors, artifacts }, null, 2));
} finally {
  await browser.close();
}

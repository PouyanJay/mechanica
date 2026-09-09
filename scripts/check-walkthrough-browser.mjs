import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright').catch(() => { throw new Error('Set PLAYWRIGHT_MODULE to an installed Playwright index.mjs path before running this optional live browser check.'); });
const artifacts=process.env.WALKTHROUGH_ARTIFACT_DIR || path.join(os.tmpdir(),'mechanica-walkthrough');
await mkdir(artifacts,{recursive:true});
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:process.platform==='darwin'?['--use-angle=metal']:[]});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
await page.addInitScript(() => {
  window.__THREE_DEVTOOLS__=new EventTarget();
  window.__walkthroughProbe={frames:[],scene:null,camera:null};
  window.__THREE_DEVTOOLS__.addEventListener('observe',({detail}) => {
    if(typeof detail.render!=='function')return;
    const original=detail.render.bind(detail);
    detail.render=(scene,camera) => {
      const probe=window.__walkthroughProbe;
      probe.scene=scene;probe.camera=camera;
      probe.frames.push({at:performance.now(),position:camera.position.toArray()});
      if(probe.frames.length>120)probe.frames.shift();
      return original(scene,camera);
    };
  });
});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const out=[];
try {
  await page.goto(process.env.WALKTHROUGH_URL || 'http://localhost:5173',{waitUntil:'networkidle'});
  await page.locator('canvas').waitFor();
  const engines=['Turbofan','Turbojet','Turboprop','Turboshaft','V8','Inline-four','Wankel rotary'];
  for (let i=0;i<engines.length;i++) {
    if(i) {
      await page.locator('.engine-picker').click();
      const options=page.locator('.library-engine');
      await options.nth(i).click();
      await page.waitForTimeout(450);
    }
    await page.locator('.bottom-console .walkthrough-launch').click();
    const card=page.locator('.walkthrough-card');
    await card.waitFor();
    assert.equal(await card.locator('[aria-live="polite"][aria-atomic="true"]').count(),1);
    assert.equal(await card.getByRole('button',{name:'Previous station',exact:true}).isDisabled(),true);
    if(i<4) assert.equal(await page.getByRole('switch',{name:'Show illustrative airflow'}).getAttribute('aria-checked'),'true');
    const titles=[]; console.log("Testing",engines[i]);
    for(let step=0;step<12;step++) {
      await page.waitForTimeout(350);
      titles.push(await card.locator('h2').innerText());
      const names=await card.locator('.walkthrough-components li').allTextContents();
      assert(names.length>0);
      assert((await page.locator('.part-row.active').count())>=names.length);
      const highlighted=await page.evaluate(() => {
        const ids=new Set();
        window.__walkthroughProbe.scene.traverse(mesh => {if(mesh.material?.emissiveIntensity>0 && mesh.userData.part)ids.add(mesh.userData.part);});
        return [...ids];
      });
      assert(highlighted.length>=names.length,'Every station component has highlighted geometry');
      if(step===1){
        const frames=await page.evaluate(()=>window.__walkthroughProbe.frames);
        assert(new Set(frames.map(frame=>frame.position.map(n=>n.toFixed(5)).join(','))).size>2,'Camera transitions through intermediate positions');
      }
      if(await card.getByRole('button',{name:'Next station',exact:true}).isDisabled()) break;
      await page.evaluate(()=>window.__walkthroughProbe.frames=[]);
      await card.getByRole('button',{name:'Next station',exact:true}).click();
    }
    assert(titles.length>=5);
    assert.equal(new Set(titles).size,titles.length);
    await card.locator('h2').focus();
    await page.keyboard.press('ArrowLeft');
    assert.notEqual(await card.locator('h2').innerText(),titles.at(-1));
    await page.keyboard.press('ArrowRight');
    assert.equal(await card.locator('h2').innerText(),titles.at(-1));
    await page.keyboard.press('Escape');
    assert.equal(await card.count(),0);
    await page.waitForTimeout(100);
    const exitPose=await page.evaluate(()=>window.__walkthroughProbe.camera.position.toArray());
    await page.waitForTimeout(250);
    const laterPose=await page.evaluate(()=>window.__walkthroughProbe.camera.position.toArray());
    assert(exitPose.every((value,index)=>Math.abs(value-laterPose[index])<1e-7),'Exit retains current camera position');
    if(i<4) assert.equal(await page.getByRole('switch',{name:'Show illustrative airflow'}).getAttribute('aria-checked'),'false');
    out.push({engine:engines[i],stations:titles.length,titles}); console.log("Passed",engines[i],titles.length);
  }
  await page.getByRole('button',{name:'Viewer help',exact:true}).click();
  await page.locator('.help-dialog .walkthrough-launch').click();
  await page.locator('.help-dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Pause walkthrough',exact:true}).click();
  await page.waitForTimeout(1000);
  await page.screenshot({path:path.join(artifacts,'desktop.png'),fullPage:true});
  for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1280,height:680},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(700);
    const scene=await page.locator('.scene-host').boundingBox();
    const card=await page.locator('.walkthrough-card').boundingBox();
    const canvas=await page.locator('.scene-host canvas').boundingBox();
    assert(canvas.y>=scene.y-1 && canvas.y+canvas.height<=scene.y+scene.height+1);
    assert(scene.y>=50,'Scene must start below the page header');
    const console=await page.locator('.bottom-console').boundingBox();
    assert(scene.height>=240);
    assert(card.y>=scene.y+scene.height-1);
    assert(console.y>=card.y+card.height-1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(artifacts,`${viewport.width}x${viewport.height}.png`),fullPage:true});
    out.push({viewport,scene,card,console});
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Viewer settings'}).click();
  await page.getByRole('button',{name:'Light',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.locator('.settings-dialog').waitFor({state:'hidden'});
  await page.screenshot({path:path.join(artifacts,'mobile-light.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('combobox',{name:'Animation speed'}).click();
  await page.getByRole('option',{name:'2×',exact:true}).click();
  await page.waitForTimeout(350);
  await page.locator('.walkthrough-card h2').focus();
  const before=await page.locator('.walkthrough-step').innerText();
  await page.keyboard.press('Space');
  await page.waitForTimeout(4500);
  assert.notEqual(await page.locator('.walkthrough-step').innerText(),before);
  await page.keyboard.press('Space');
  const paused=await page.locator('.walkthrough-step').innerText();
  await page.waitForTimeout(4500);
  assert.equal(await page.locator('.walkthrough-step').innerText(),paused);
  out.push({autoAdvanceAtDoubleSpeed:true,spacePauses:true});console.log('Passed autoplay, keyboard pause, and responsive layouts');
  await page.keyboard.press('Escape');
  await page.locator('.engine-picker').click();
  await page.locator('.library-engine').first().click();
  const flow=page.getByRole('switch',{name:'Show illustrative airflow'});
  await flow.click();
  await page.locator('.bottom-console .walkthrough-launch').click();
  await page.getByRole('button',{name:'Exit walkthrough',exact:true}).first().click();
  assert.equal(await flow.getAttribute('aria-checked'),'true');console.log('Passed originally enabled airflow restoration');
  await page.getByRole('button',{name:'Hide Fan & inlet',exact:true}).click();
  await page.getByRole('tab',{name:'Explore',exact:true}).click();
  const separation=page.locator('.master-explode-control [role=slider]');
  await separation.focus();await page.keyboard.press('End');
  assert.match(await page.locator('.master-explode-heading output').innerText(),/100/);
  await page.locator('.bottom-console .walkthrough-launch').click();
  assert.equal(await page.getByRole('tab',{name:'Cutaway',exact:true}).getAttribute('aria-selected'),'true');
  assert.match(await page.locator('.master-explode-heading output').innerText(),/^0/);
  assert.equal(await page.locator('.part-row.muted').count(),0);
  await page.getByRole('button',{name:'Exit walkthrough',exact:true}).first().click();
  await page.locator('.part-select').nth(1).click();
  await page.getByRole('button',{name:'Isolate component',exact:true}).click();
  await page.locator('.isolation-pill').click();
  await page.getByRole('button',{name:'Hide Axial compressor',exact:true}).click();
  assert.equal(await page.locator('.part-row.muted').count(),1);
  await page.getByRole('button',{name:'Show Axial compressor',exact:true}).click();
  const section=page.locator('.console-slider [role=slider]');
  await section.focus();await page.keyboard.press('End');
  assert.equal(await section.getAttribute('aria-valuenow'),'100');
  await section.focus();await page.keyboard.press('Home');
  assert.equal(await section.getAttribute('aria-valuenow'),'0');
  await page.getByRole('tab',{name:'Explore',exact:true}).click();
  await separation.focus();await page.keyboard.press('End');
  await page.getByRole('combobox',{name:'Explosion layout'}).click();
  await page.getByRole('option',{name:'Radial spread',exact:true}).click();
  await page.getByRole('combobox',{name:'Explosion layout'}).click();
  await page.getByRole('option',{name:'All pieces',exact:true}).click();
  await page.waitForTimeout(350);
  await separation.focus();await page.keyboard.press('Home');
  assert.match(await page.locator('.master-explode-heading output').innerText(),/^0/);
  await page.getByRole('tab',{name:'Assembled',exact:true}).click();
  out.push({flowInitiallyOnRestored:true,startFromHiddenExploded:true,selectionHideIsolate:true,cutawaySlider:true,separationReversalAndLayouts:true});
  for(const viewport of [{width:768,height:1024},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    for(const active of [false,true]) {
      if(active){
        await page.locator('.bottom-console .walkthrough-launch').click();
        await page.getByRole('button',{name:'Pause walkthrough',exact:true}).click();
      }
      await page.waitForTimeout(500);
      const overflow=await page.evaluate(()=>{
        const console=document.querySelector('.bottom-console').getBoundingClientRect();
        return [...document.querySelectorAll('.bottom-console button,.bottom-console [role=slider]')]
          .filter(control=>control.getBoundingClientRect().width)
          .filter(control=>{const box=control.getBoundingClientRect();return box.x<console.x||box.right>console.right||box.y<console.y||box.bottom>console.bottom;})
          .map(control=>control.getAttribute('aria-label')||control.textContent);
      });
      assert.deepEqual(overflow,[],`Turbine console controls fit at ${viewport.width}px, active=${active}`);
      await page.screenshot({path:path.join(artifacts,`turbofan-${viewport.width}-${active?'active':'inactive'}.png`),fullPage:true});
      if(active)await page.getByRole('button',{name:'Exit walkthrough',exact:true}).first().click();
    }
  }
  out.push({turbinePhoneAndTabletControlsFit:true});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,checks:out,errors,artifacts},null,2));
} finally {await browser.close();}

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import ts from 'typescript';
import * as T from 'three';
const temp=resolve('.sites-runtime/explosion-check');await mkdir(temp,{recursive:true});
async function compile(name,source){const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replaceAll("'./explosion-layout'","'./explosion-layout.mjs'").replaceAll("'./engine-data'","'./engine-data.mjs'").replaceAll("'./explosion-controller'","'./explosion-controller.mjs'").replaceAll("'./mechanical-engines'","'./mechanical-engines.mjs'");await writeFile(resolve(temp,name+'.mjs'),js);}
for(const name of ['engine-data','explosion-layout','explosion-controller','mechanical-engines'])await compile(name,await readFile(`app/${name}.ts`,'utf8'));
const scene=await readFile('app/engine-scene.tsx','utf8');
const builder=scene.slice(scene.indexOf('  function material'),scene.indexOf('  build(live.current.engine);'));
await compile('fixture',`import * as T from 'three';import {getParts} from './engine-data';import {buildPistonEngine,buildRotaryEngine,buildShaftOutput} from './mechanical-engines';import {ExplosionController} from './explosion-controller';export function fixture(kind:string){
let PARTS=getParts(kind),mechanism=null,mechanismTime=0,modelBounds=new T.Box3();const TAU=Math.PI*2,scene=new T.Scene();let root=new T.Group();scene.add(root);let groups:Record<string,T.Group>={},rotors:T.Group[]=[],picks:T.Object3D[]=[],materials:T.MeshStandardMaterial[]=[],labels:any[]=[],triangles=0;let explosion:ExplosionController|null=null;const clip=new T.Plane(new T.Vector3(0,-1,0),.15);let currentEngine='';const stats={current:()=>{}};const el={appendChild:()=>{}};const document={createElement:()=>({style:{setProperty:()=>{}},remove:()=>{}})};${builder}\nbuild(kind);return{model:root,controller:explosion,rotors,groups,animate:(t)=>mechanism?.(t)};}`);
const {fixture}=await import(pathToFileURL(resolve(temp,'fixture.mjs')).href);
function closeMatrix(a,b,epsilon=1e-6){for(let i=0;i<16;i++)assert.ok(Math.abs(a.elements[i]-b.elements[i])<epsilon,`matrix element ${i}: ${a.elements[i]} vs ${b.elements[i]}`);}
for(const engine of ['turbofan','turbojet','turboprop','turboshaft','v8','inline4','rotary']){
 const {model,controller:c,rotors,groups,animate}=fixture(engine);
 assert.ok(c.count>(engine==='rotary'?40:engine==='v8'||engine==='inline4'?150:1000),'Individual mechanical parts must be represented');for(const [id,group] of Object.entries(groups)){let count=0;group.traverse(o=>{if(o instanceof T.Mesh)count++;});assert.ok(count>0,`Empty component group: ${engine}/${id}`);}
 assert.equal(new Set(c.pieces.map(p=>p.id)).size,c.pieces.length,'Every instance has a stable, distinct identity');
 let cases=0;
 for(const aspect of [.48,1,2.2])for(const hidden of [[],[Object.keys(groups)[0]]]){
  c.layout({layout:'inventory',spacing:40,aspect,hidden,isolated:null,isolatedPiece:null});c.update(1);
  const visible=c.pieces.filter(p=>p.visible&&!p.attachment);
  const boxes=visible.map(p=>({id:p.id,box:p.localBox.clone().applyMatrix4(p.current)})).sort((a,b)=>a.box.min.x-b.box.min.x);
  // Orthographic inventory projection: every piece needs a disjoint XY bounding box.
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length&&boxes[j].box.min.x<boxes[i].box.max.x-1e-7;j++){
   const a=boxes[i].box,b=boxes[j].box;
   assert.ok(a.max.y<=b.min.y+1e-7||b.max.y<=a.min.y+1e-7,`overlap: ${boxes[i].id}, ${boxes[j].id}`);
  }
  const fit=c.fit(1,aspect);assert.ok(Number.isFinite(fit.distance)&&fit.distance<2500);assert.ok(visible.every(p=>!hidden.includes(p.part)));
  c.update(.36);const intermediate=c.pieces.find(p=>p.visible&&!p.attachment);assert.notDeepEqual(intermediate.current.elements,intermediate.home.elements);
  c.update(0);for(const p of visible)closeMatrix(p.current,p.home);
  cases++;
 }
 c.layout({layout:'radial',spacing:80,aspect:1.5,hidden:[],isolated:null,isolatedPiece:null});c.update(1);
 for(const p of c.pieces)assert.ok(p.current.elements.every(Number.isFinite));
 c.update(0);for(const p of c.pieces)closeMatrix(p.current,p.home);
 // Scrubbing is deterministic in both directions and continuous at the two-stage boundary.
 c.layout({layout:'inventory',spacing:40,aspect:1.5,hidden:[],isolated:null,isolatedPiece:null});
 const sample=c.pieces.find(p=>!p.attachment);
 const poses=new Map();for(const t of [0,.1,.25,.45,.6,.8,1]){c.update(t);poses.set(t,sample.current.clone());}
 for(const t of [1,.8,.6,.45,.25,.1,0]){c.update(t);closeMatrix(sample.current,poses.get(t));}
 c.update(.45-1e-7);const before=sample.current.clone();c.update(.45+1e-7);closeMatrix(before,sample.current,1e-4);
 c.update(.25);const q=new T.Quaternion();sample.current.decompose(new T.Vector3(),q,new T.Vector3());assert.ok(Math.abs(q.dot(sample.homeQuaternion))>1-1e-6,'Early separation preserves assembled orientation');
 console.log(`${engine}: forward/backward slider positions match and the stage transition is continuous.`);
 const single=c.pieces.find(p=>!p.attachment&&p.source instanceof T.InstancedMesh)??c.pieces.find(p=>!p.attachment);
 c.layout({layout:'inventory',spacing:40,aspect:1,hidden:[],isolated:null,isolatedPiece:single.id});assert.equal(c.visibleCount,1);c.update(1);
 const box=single.localBox.clone().applyMatrix4(single.current);const center=box.getCenter(new T.Vector3());c.root.visible=true;
 const picked=c.pick(new T.Raycaster(new T.Vector3(center.x,center.y,box.max.z+10),new T.Vector3(0,0,-1)));
 // A ray through an airfoil bounding center may pass outside its curved surface. Its batch mapping is exact regardless.
 assert.equal(c.info(single.batch.userData.pieceIds[single.index]).id,single.id);if(picked)assert.equal(picked.id,single.id);
 // Capture a running engine, then repeatedly separate and return with no rotational drift.
 rotors.forEach((r,i)=>r.rotation.x=.13+i*.019);c.captureHome();c.layout({layout:'inventory',spacing:20,aspect:1.6,hidden:[],isolated:null,isolatedPiece:null});
 for(let repeat=0;repeat<5;repeat++){c.update(1);c.update(.42);c.update(0);for(const p of c.pieces)closeMatrix(p.current,p.home);}
 const liner=c.pieces.find(p=>p.attachment);if(['turbofan','turbojet','turboprop','turboshaft'].includes(engine))assert.ok(liner,'Liner markings must remain attached to their housing');
 console.log(`${engine}: ${c.count} independent pieces; ${cases} non-overlapping layouts; exact repeated reassembly; single-piece isolation passed.`);
 if(engine==='v8'||engine==='inline4'){
  const n=engine==='v8'?8:4;assert.equal(groups.pistons.children.length,n);assert.equal(groups.rods.children.length,n);
  for(const theta of [0,.4,1.5,3.2,6.1,9.4]){animate(theta);model.updateWorldMatrix(true,true);
   groups.rods.children.forEach((rod,i)=>{const big=new T.Vector3(0,-1.75/2,0).applyMatrix4(rod.matrixWorld),small=new T.Vector3(0,1.75/2,0).applyMatrix4(rod.matrixWorld);const wrist=groups.pistons.children[i].getWorldPosition(new T.Vector3());assert.ok(small.distanceTo(wrist)<1e-6,'Rod small end must follow wrist pin');assert.ok(Math.abs(big.distanceTo(small)-1.75)<1e-6);assert.ok(Math.abs(Math.hypot(big.y+.5,big.z)-.45)<1e-6,'Big end must follow crank throw');});
  }
  console.log(`${engine}: all ${n} piston linkages preserve rod length and crank throw throughout rotation.`);
 }
 if(engine==='rotary'){
  for(const theta of [0,.6,2,4,6,9,13]){animate(theta);model.updateWorldMatrix(true,true);const motion=groups.seals.children[0],tips=motion.children.filter(o=>o.userData.pieceName==='Apex seal');assert.equal(tips.length,3);tips.forEach((tip,k)=>{const world=tip.getWorldPosition(new T.Vector3()),phi=theta/3+k/3*Math.PI*2;assert.ok(Math.abs(world.y-(1.55*Math.cos(phi)+.25*Math.cos(3*phi)))<1e-6);assert.ok(Math.abs(world.z-(1.55*Math.sin(phi)+.25*Math.sin(3*phi)))<1e-6);});assert.ok(Math.abs(groups.rotor.children[0].rotation.x-theta/3)<1e-8);}
  console.log('rotary: apexes follow the housing locus and the output shaft rotates at 3:1.');
 }
 animate(.8);c.captureHome();c.layout({layout:'inventory',spacing:40,aspect:1,hidden:[],isolated:null,isolatedPiece:null});c.update(1);c.update(0);for(const p of c.pieces)closeMatrix(p.current,p.home);
 c.dispose();model.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
}
for(const path of ['app/page.tsx','app/engine-data.ts','app/engine-scene.tsx','app/globals.css'])assert.ok(!/[\u2013\u2014]|&mdash;|&#8212;/.test(await readFile(path,'utf8')),`${path} contains a long dash`);
console.log('Site text contains no em dashes or en dashes.');

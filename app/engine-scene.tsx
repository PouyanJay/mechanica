'use client';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getParts, EngineType, ENGINES, ViewerState } from './engine-data';
import { buildPistonEngine, buildRotaryEngine, buildShaftOutput } from './mechanical-engines';
import { ExplosionController, PieceInfo } from './explosion-controller';

type Props={state:ViewerState; onSelect:(id:string|null,piece?:PieceInfo|null)=>void; onStats:(total:number,visible:number)=>void};
const TAU=Math.PI*2;
export default function EngineScene({state,onSelect,onStats}:Props){
 const host=useRef<HTMLDivElement>(null), live=useRef(state), select=useRef(onSelect);live.current=state;select.current=onSelect;const stats=useRef(onStats);stats.current=onStats;
 const [error,setError]=useState(''),[ready,setReady]=useState(false);
 useEffect(()=>{
  const mount=host.current;if(!mount)return;const el:HTMLDivElement=mount;
  let renderer:T.WebGLRenderer;try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setError('The 3D viewer needs WebGL. Please open this page in a browser with hardware acceleration enabled.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x101419,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;renderer.localClippingEnabled=true;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Interactive engine. Drag to rotate, scroll to zoom, or select a component.');
  const scene=new T.Scene();const perspective=new T.PerspectiveCamera(34,1,.1,3000),orthographic=Object.assign(new T.OrthographicCamera(-10,10,10,-10,.1,3000),{aspect:1});let camera:T.PerspectiveCamera|typeof orthographic=perspective;camera.position.set(-10,6.5,13.5);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=3;controls.maxDistance=2000;controls.target.set(.25,0,0);controls.maxPolarAngle=Math.PI*.94;
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=1.1;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xc5e2ff,0x343a46,2));
  const key=new T.DirectionalLight(0xfff5e8,5);key.position.set(-5,8,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-12,right:12,top:9,bottom:-9,near:.5,far:35});key.shadow.normalBias=.035;scene.add(key);
  const rim=new T.DirectionalLight(0x8fc9ff,3.8);rim.position.set(4,4,-7);scene.add(rim);const front=new T.DirectionalLight(0xffffff,2);front.position.set(-8,1,2);scene.add(front);
  const floor=new T.Mesh(new T.PlaneGeometry(150,150),new T.ShadowMaterial({opacity:.35}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.7;floor.receiveShadow=true;scene.add(floor);
  // Floor grid drawn in a shader with a radial fade, so it dissolves before it can meet the canvas edge as a hard line. Neutral grey reads on both themes.
  const grid=new T.Mesh(new T.PlaneGeometry(60,60),new T.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){vec2 p=(vUv-.5)*60.;vec2 g=abs(fract(p+.5)-.5)/fwidth(p);float line=1.-min(min(g.x,g.y),1.);float fade=1.-smoothstep(3.,13.,length(p));gl_FragColor=vec4(vec3(.55,.6,.66),line*fade*.3);}'}));grid.rotation.x=-Math.PI/2;grid.position.y=-2.72;scene.add(grid);
  let root=new T.Group();scene.add(root);let groups:Record<string,T.Group>={},rotors:T.Group[]=[],picks:T.Object3D[]=[],materials:T.MeshStandardMaterial[]=[],labels:HTMLButtonElement[]=[];
  let explosion:ExplosionController|null=null;let PARTS=getParts(live.current.engine);let mechanism:((time:number)=>void)|null=null,mechanismTime=0;let modelBounds=new T.Box3();
  const clip=new T.Plane(new T.Vector3(0,-1,0),.15);let currentEngine='';let triangles=0;
  function material(color:number,rough=.33,metal=.88,clipped=false){const m=new T.MeshStandardMaterial({color,roughness:rough,metalness:metal,side:T.DoubleSide,clippingPlanes:clipped?[clip]:[]});m.userData.base=new T.Color(color);materials.push(m);return m;}
  function mesh(g:T.BufferGeometry,m:T.Material,parent:T.Object3D){const o=new T.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;parent.add(o);triangles+=(g.index?.count??g.attributes.position.count)/3;return o;}
  // Surface of revolution around X. The profile is [axial position, radius].
  function lathe(profile:number[][],m:T.Material,parent:T.Object3D){const g=new T.LatheGeometry(profile.map(p=>new T.Vector2(p[1],p[0])),128);g.rotateZ(-Math.PI/2);const o=mesh(g,m,parent);o.userData.pieceName=profile[0][1]===0?'Spinner / cone':'Housing';return o;}
  function cyl(x:number,len:number,r:number,m:T.Material,parent:T.Object3D,r2=r){const g=new T.CylinderGeometry(r2,r,len,80);g.rotateZ(-Math.PI/2);const o=mesh(g,m,parent);o.position.x=x;o.userData.pieceName=r<.1?'Fuel injector':'Shaft / sleeve';return o;}
  function ring(x:number,r:number,t:number,m:T.Material,parent:T.Object3D){const g=new T.TorusGeometry(r,t,10,112);g.rotateY(Math.PI/2);const o=mesh(g,m,parent);o.position.x=x;o.userData.pieceName='Retaining ring';return o;}
  // Closed, swept airfoil with spanwise twist. This is original reference geometry.
  function blade(inner:number,outer:number,chord:number,sweep:number,twist:number){const verts:number[]=[],idx:number[]=[];const spans=18,around=32;
   for(let i=0;i<=spans;i++){const t=i/spans,r=inner+(outer-inner)*t,c=chord*(1-.38*t),ang=twist*(1-t)+.2;
    for(let j=0;j<around;j++){const a=j/around*TAU,u=(1-Math.cos(a))*.5;const thick=5*.105*(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u*u*u-.1036*u*u*u*u)*Math.sign(Math.sin(a));const camber=.05*Math.sin(Math.PI*u),xx=(u-.5)*c,zz=(thick+camber)*c;
     verts.push(xx*Math.cos(ang)-zz*Math.sin(ang)+sweep*t*t,r,xx*Math.sin(ang)+zz*Math.cos(ang)+.14*t*t);
    }
   }for(let i=0;i<spans;i++)for(let j=0;j<around;j++){const a=i*around+j,b=i*around+(j+1)%around,c=a+around,d=b+around;idx.push(a,b,c,b,d,c);}for(let j=1;j<around-1;j++){idx.push(0,j+1,j);const b=spans*around;idx.push(b,b+j,b+j+1);}
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();return g;}
  function blades(parent:T.Group,x:number,inner:number,outer:number,count:number,chord:number,m:T.Material,rotating:boolean,sweep=.15,twist=.7){const group=new T.Group();group.position.x=x;parent.add(group);if(rotating)rotors.push(group);const geo=blade(inner,outer,chord,sweep,twist);const batch=new T.InstancedMesh(geo,m,count);const mat=new T.Matrix4();for(let i=0;i<count;i++){mat.makeRotationX(i/count*TAU);batch.setMatrixAt(i,mat);}batch.userData.pieceName=rotating?'Rotor blade':'Stator vane';batch.userData.inventoryFlat=true;batch.castShadow=true;batch.receiveShadow=true;group.add(batch);triangles+=(geo.index?.count??0)/3*count;return group;}
  function bolts(parent:T.Group,x:number,r:number,count:number,m:T.Material){const g=new T.CylinderGeometry(.042,.042,.065,6);g.rotateZ(Math.PI/2);const b=new T.InstancedMesh(g,m,count),mat=new T.Matrix4();for(let i=0;i<count;i++){const a=i/count*TAU;mat.makeTranslation(x,Math.sin(a)*r,Math.cos(a)*r);b.setMatrixAt(i,mat);}b.userData.pieceName='Fastener';parent.add(b);}
  function pipe(points:T.Vector3[],r:number,m:T.Material,parent:T.Object3D){const o=mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,r,8,false),m,parent);o.userData.pieceName='Tube';o.userData.inventoryFlat=true;return o;}
  function clearModel(){mechanism=null;mechanismTime=0;if(explosion){scene.remove(explosion.root);explosion.dispose();explosion=null;}root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});materials.forEach(m=>m.dispose());scene.remove(root);labels.forEach(l=>l.remove());root=new T.Group();scene.add(root);groups={};rotors=[];picks=[];materials=[];labels=[];triangles=0;}
  function build(kind:EngineType){clearModel();PARTS=getParts(kind);const fan=kind==='turbofan',power=kind==='turboprop'||kind==='turboshaft';
   PARTS.forEach(p=>{const g=new T.Group();g.userData.id=p.id;g.userData.explode=(p.x*.32);root.add(g);groups[p.id]=g;const l=document.createElement('button');l.className='model-label';l.innerHTML='<svg aria-hidden="true"><polyline/></svg><span></span>';(l.lastChild as HTMLElement).textContent=p.short;l.setAttribute('aria-label',p.short);l.onclick=()=>select.current(p.id);l.style.setProperty('--part-color',p.color);el!.appendChild(l);labels.push(l);});
   if(kind==='v8'||kind==='inline4')mechanism=buildPistonEngine(kind,{groups,clip,materials});
   else if(kind==='rotary')mechanism=buildRotaryEngine({groups,clip,materials});
   else {
   const titanium=material(0xb0bdc9,.29),silver=material(0xced4d7,.25),dark=material(0x59636d,.37),steel=material(0x929ba3,.3),warm=material(0x9c8271,.42),nickel=material(0xa8a399,.32),shell=material(0xaab5c0,.34,.8,true),shellDark=material(0x4f5c67,.4,.85,true),liner=material(0x97826c,.5,.8,true);
   const fg=groups.fan;
   if(fan){blades(fg,-3.02,.53,2.13,24,.94,titanium,true,.3,1.05);lathe([[-4.03,0],[-3.98,.13],[-3.8,.32],[-3.5,.47],[-3.13,.54],[-2.85,.52]],silver,fg);ring(-3.1,.53,.04,dark,fg);blades(fg,-2.55,.65,2.1,36,.36,dark,false,.05,-.5);}
   else if(power){blades(groups.compressor,-2.77,.49,1.27,30,.4,titanium,true);mechanism=buildShaftOutput(kind as 'turboprop'|'turboshaft',{groups,clip,materials});}
   else{lathe([[-3.6,0],[-3.35,.25],[-2.95,.45],[-2.6,.52]],silver,fg);blades(fg,-2.77,.49,1.27,30,.4,titanium,true);}
   const cg=groups.compressor;
   lathe([[-2.7,.44],[-2.4,.57],[-1.5,.7],[-.5,.78],[.55,.83],[.75,.8]],dark,cg);
   for(let i=0;i<9;i++){const x=-2.35+i*.335,outer=1.25-i*.036,inner=.56+i*.033;blades(cg,x,inner,outer,36+i*2,.27,i%2?steel:silver,true,.035,.68);ring(x,inner,.044,steel,cg);if(i<8)blades(cg,x+.17,inner+.025,outer+.015,40+i*2,.16,dark,false,0,-.7);ring(x,outer+.035,.035,shellDark,cg);}
   const bg=groups.combustor;
   const combustionLiner=lathe([[.7,.98],[.88,1.07],[1.1,1.1],[2.1,1.03],[2.34,.91],[2.34,.85],[2.08,.97],[1.1,1.04],[.88,1.01],[.7,.92]],liner,bg);
   lathe([[.75,.53],[.95,.6],[1.9,.63],[2.3,.55]],warm,bg);ring(.9,1.09,.06,nickel,bg);ring(2.22,.97,.055,nickel,bg);
   // Injector heads and small liner perforation collars, arranged around the annulus.
   for(let i=0;i<18;i++){const a=i/18*TAU;const inj=cyl(.91,.2,.085,nickel,bg);inj.position.y=Math.sin(a)*.84;inj.position.z=Math.cos(a)*.84;pipe([new T.Vector3(.9,Math.sin(a)*.84,Math.cos(a)*.84),new T.Vector3(.68,Math.sin(a)*1.13,Math.cos(a)*1.13),new T.Vector3(.5,Math.sin(a)*1.13,Math.cos(a)*1.13)],.025,steel,bg);}
   const holeGeo=new T.CircleGeometry(.025,9),holes=new T.InstancedMesh(holeGeo,material(0x242424,.95,.1,true),240),dummy=new T.Object3D();for(let i=0;i<240;i++){const a=(i%48)/48*TAU,x=1.12+Math.floor(i/48)*.19;dummy.position.set(x,Math.sin(a)*1.078,Math.cos(a)*1.078);dummy.lookAt(x,Math.sin(a)*2,Math.cos(a)*2);dummy.updateMatrix();holes.setMatrixAt(i,dummy.matrix);}holes.userData.attachTo=combustionLiner.uuid;bg.add(holes);
   const tg=groups.turbine;lathe([[2.35,.52],[2.7,.61],[3.2,.64],[3.75,.53]],dark,tg);
   for(let i=0;i<5;i++){const x=2.38+i*.29,r=.98-i*.015;const rotor=blades(tg,x,.56,r,52,.22,i<2?warm:nickel,true,.025,.65);rotor.userData.rate=(fan||power)&&i>=2?.7:1.1;ring(x,.58,.065,steel,tg);if(i<4)blades(tg,x+.16,.58,r,48,.13,dark,false,0,-.6);ring(x,r+.07,.035,shellDark,tg);}
   const ng=groups.nozzle;
   if(power){lathe([[3.78,1.03],[4.3,1.03],[4.3,.97],[3.78,.97]],shellDark,ng);for(const side of (kind==='turboprop'?[-1,1]:[1]))pipe([new T.Vector3(4.0,0,0),new T.Vector3(4.3,0,side*.8),new T.Vector3(4.4,.2,side*1.65)],.38,warm,ng);ring(3.84,1.02,.05,steel,ng);bolts(ng,3.84,1.04,36,silver);}
   else {lathe([[3.78,1.03],[4.1,1],[4.7,.81],[5.1,.64],[5.1,.59],[4.7,.76],[4.1,.95],[3.78,.98]],shellDark,ng);lathe([[3.65,.48],[3.9,.46],[4.35,.32],[4.85,.04],[4.9,0]],nickel,ng);ring(3.84,1.02,.05,steel,ng);bolts(ng,3.84,1.04,36,silver);}

   const sg=groups.shaft;cyl(.05,7.1,.13,silver,sg);if(fan||power)cyl(.62,5.1,.205,dark,sg);[-2.64,.58,3.71].forEach(x=>{ring(x,.25,.065,silver,sg);blades(sg,x,.25,.5,8,.16,dark,false,0,0);});
   const casing=groups.casing;
   if(fan){lathe([[-3.62,2.21],[-3.67,2.29],[-3.57,2.36],[-3.32,2.38],[-2.6,2.34],[-1.6,2.2],[.2,1.92],[1.2,1.67],[1.2,1.6],[.2,1.85],[-1.6,2.13],[-2.6,2.27],[-3.32,2.3],[-3.5,2.28],[-3.62,2.21]],shell,casing);[-3.25,-2.5,-1.2,.5].forEach((x,i)=>{ring(x,[2.35,2.32,2.14,1.85][i],.035,shellDark,casing);bolts(casing,x,[2.35,2.32,2.14,1.85][i],48,shellDark);});}
   else if(power)lathe([[-2.8,1.32],[-2.5,1.32],[-2.5,1.25],[-2.8,1.25]],shell,casing);
   else lathe([[-3.6,1.32],[-3.65,1.39],[-3.4,1.45],[-2.8,1.38],[-2.5,1.32],[-2.5,1.26],[-3.4,1.38],[-3.6,1.32]],shell,casing);
   lathe([[-2.5,1.3],[-1.5,1.22],[.6,1.13],[.85,1.19],[2.2,1.13],[2.4,1.1],[3.8,1.09],[3.8,1.03],[2.4,1.04],[2.2,1.07],[.85,1.13],[.6,1.07],[-1.5,1.16],[-2.5,1.24]],shell,casing);
   [-2.4,-.2,.7,2.2,3.75].forEach((x,i)=>{const r=[1.3,1.17,1.15,1.14,1.09][i];ring(x,r,.06,shellDark,casing);bolts(casing,x,r,40,shellDark);});
   for(let i=0;i<8;i++){const a=i/8*TAU+.1,pts=[-.4,.3,1.1,2,2.5].map((x,j)=>new T.Vector3(x,Math.sin(a)*[1.22,1.2,1.28,1.24,1.17][j],Math.cos(a)*[1.22,1.2,1.28,1.24,1.17][j]));pipe(pts,.018,shellDark,casing);}
   }
   const partMaterials=new Map<string,T.MeshStandardMaterial>();root.traverse(o=>{if(o instanceof T.Mesh){let p:T.Object3D|null=o;while(p&&!p.userData.id)p=p.parent;o.userData.part=p?.userData.id;const source=o.material as T.MeshStandardMaterial;const key=o.userData.part+source.uuid;let local=partMaterials.get(key);if(!local){local=source.clone();local.clippingPlanes=source.clippingPlanes;partMaterials.set(key,local);materials.push(local);}o.material=local;picks.push(o);}});root.updateWorldMatrix(true,true);modelBounds.setFromObject(root);for(const group of Object.values(groups)){const bounds=new T.Box3().setFromObject(group);group.userData.anchor=bounds.getCenter(new T.Vector3());}currentEngine=kind;explosion=new ExplosionController(root);scene.add(explosion.root);stats.current(explosion.count,explosion.count);
  }
  build(live.current.engine);
  // Airflow is a schematic visualization, not a fluid simulation: comet-like
  // streaklines advance through the engine stations (intake, compression,
  // combustion, jet) with station-based speed, rotor swirl, turbulence jitter
  // and a temperature colour ramp. It runs whenever the overlay is on, even
  // with mechanism playback paused.
  const n=2400,flowSeg=new Float32Array(n*6),flowSegColor=new Float32Array(n*6),flowHead=new Float32Array(n*3),flowHeadColor=new Float32Array(n*3);
  const segGeo=new T.BufferGeometry();segGeo.setAttribute('position',new T.BufferAttribute(flowSeg,3));segGeo.setAttribute('color',new T.BufferAttribute(flowSegColor,3));
  const headGeo=new T.BufferGeometry();headGeo.setAttribute('position',new T.BufferAttribute(flowHead,3));headGeo.setAttribute('color',new T.BufferAttribute(flowHeadColor,3));
  const flowLines=new T.LineSegments(segGeo,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending}));
  const flowHeads=new T.Points(headGeo,new T.PointsMaterial({size:.09,vertexColors:true,transparent:true,opacity:.95,depthWrite:false,blending:T.AdditiveBlending}));
  flowLines.frustumCulled=false;flowHeads.frustumCulled=false;
  const flow=new T.Group();flow.add(flowLines);flow.add(flowHeads);scene.add(flow);
  let flowTime=0;const flowP=new T.Vector3(),flowQ=new T.Vector3(),flowC=new T.Color(),flowD=new T.Color();
  // Independent per-particle seeds. Deriving phase and angle both linearly
  // from i correlates them (a golden-ratio resonance) and braids the streams
  // into ropes; hashing keeps the cones axisymmetric.
  const flowSeedP=new Float32Array(n),flowSeedA=new Float32Array(n),flowSeedJ=new Float32Array(n),flowSeedR=new Float32Array(n);
  for(let i=0;i<n;i++){const h=(k:number)=>{const v=Math.sin(i*12.9898+k*78.233)*43758.5453;return v-Math.floor(v);};flowSeedP[i]=h(1);flowSeedA[i]=h(2)*TAU;flowSeedJ[i]=h(3)-.5;flowSeedR[i]=h(4);}
  const mix3=(c:T.Color,r:number,g:number,b:number,t:number)=>{c.r+=(r-c.r)*t;c.g+=(g-c.g)*t;c.b+=(b-c.b)*t;};
  // Most of each particle's life is spent where the flow is actually visible
  // from outside: the spiralling intake capture, the bypass sheath along the
  // rear casing, and the jet. The interior pass is brief; the cutaway still
  // reveals it while the section plane is open.
  function flowSample(p:number,i:number,bypass:boolean,fan:boolean,power:boolean,out:T.Vector3,c:T.Color){
   const a=flowSeedA[i],jit=flowSeedJ[i],wob=Math.sin(flowTime*2.3+i*1.31);
   if(p<.3){
    // Intake capture: a wide, slow spiral drawn in toward the inlet lip.
    const lip=bypass?1.9:fan?1.3:.95,capture=(bypass?2.75:fan?2.45:1.9)+jit*.3;
    const t=p/.3,x=-6.4+t*3.4;
    const r=lip+(capture-lip)*(1-t)*(1-t)+wob*.02;
    const sw=a+flowTime*.42+t*t*2.6;
    out.set(x+jit*.5,Math.sin(sw)*r,Math.cos(sw)*r);
    c.setRGB(.32,.58,1);mix3(c,.55,.85,1,t);
    c.multiplyScalar((.3+.7*t*t)*(.82+.18*wob)*Math.min(1,p*24));
    return;
   }
   if(bypass){
    if(p<.44){
     // Hidden run through the fan duct.
     const t=(p-.3)/.14,x=-3+t*4.2,r=1.62+jit*.1;
     const sw=a+flowTime*.28+t*1.1;
     out.set(x,Math.sin(sw)*r,Math.cos(sw)*r);
     c.setRGB(.5,.78,1).multiplyScalar(.9);
    }else{
     // Cool sheath streaming along the rear casing.
     const t=(p-.44)/.56,x=1.2+t*4.4,r=1.66+t*.42+wob*(.02+t*.05);
     const sw=a+flowTime*.28+1.1+t*.5;
     out.set(x,Math.sin(sw)*r,Math.cos(sw)*r);
     c.setRGB(.55,.8,1).multiplyScalar((1-t*.8)*(.85+.15*Math.sin(flowTime*3.1+i*2.1)));
    }
    c.multiplyScalar(Math.min(1,(1-p)*6));
    return;
   }
   if(p<.46){
    // Brief interior pass: compression, combustion flash, turbine.
    const t=(p-.3)/.16,x=-2.7+t*7.7;
    const r=Math.max(.1,(.85-t*.35)*(1+jit*.12)+wob*.03);
    const sw=a+flowTime*.35+t*4.2;
    out.set(x,Math.sin(sw)*r,Math.cos(sw)*r);
    c.setRGB(.6,.82,1);
    mix3(c,1,.66,.26,Math.min(1,Math.max(0,(t-.42)*2.4)));
    mix3(c,1,.9,.62,Math.max(0,(t-.75)*3)*.6);
    c.multiplyScalar(1+.3*Math.sin(flowTime*7+i*3.7)*Math.max(0,t-.4));
    return;
   }
   // Jet: white-hot core with shock-diamond shimmer, widening into a
   // turbulent plume that dims to ember red. Power turbines extract the
   // energy first, so theirs is short and subdued.
   const t=(p-.46)/.54,x=5+(1-Math.pow(1-t,1.4))*(power?2.2:3.9);
   const r=Math.max(.05,(.5+t*t*(power?.5:1.05))*(1+jit*.2)+wob*(.02+t*.14));
   const sw=a+flowTime*.3+4.2+t*.8;
   out.set(x+wob*t*.06,Math.sin(sw)*r,Math.cos(sw)*r);
   c.setRGB(1,.94,.75);
   mix3(c,1,.5,.16,Math.min(1,t*1.9));
   mix3(c,.5,.12,.05,Math.max(0,(t-.55)*2.2));
   const diamonds=power?1:1+.6*Math.exp(-t*3)*Math.pow(Math.sin((x-5)*4.6),2);
   c.multiplyScalar(diamonds*(1-t*t*.75)*(power?.5:.95)*Math.min(1,(1-p)*5));
  }
  const ray=new T.Raycaster(),pointer=new T.Vector2();let down=[0,0];
  function pointerDown(e:PointerEvent){down=[e.clientX,e.clientY];}
  function pointerUp(e:PointerEvent){
   if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;
   const b=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);ray.setFromCamera(pointer,camera);
   if(explosion?.root.visible){const hit=explosion.pick(ray);select.current(hit?.part??null,hit);return;}
   const hits=ray.intersectObjects(picks,false);const hit=hits.find(h=>{let p:T.Object3D|null=h.object;while(p){if(!p.visible)return false;p=p.parent;}const m=(h.object as T.Mesh).material as T.MeshStandardMaterial;return !m.clippingPlanes?.length||clip.distanceToPoint(h.point)>=0;});select.current(hit?.object.userData.part??null,null);
  }
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  let layoutKey='',fitRequested=true,layoutBlend=1,orthoHalfGoal=10;
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;orthographic.aspect=w/h;perspective.aspect=w/h;if(camera instanceof T.OrthographicCamera){camera.left=-camera.top*camera.aspect;camera.right=camera.top*camera.aspect;}camera.updateProjectionMatrix();layoutKey='';fitRequested=true;};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  let frame=0,last=performance.now(),prevReset=-1,prevCamera='',prevZoom=0,prevQuality='',prevSelected:string|null=null,prevIsolation:string|null=null;
  let progress=0,prevMode='',prevAmount=-1,previousMatrixProgress=-1,inventoryWasVisible=false,previousSlider=-1;
  let goal:T.Vector3|null=null,targetGoal:T.Vector3|null=null;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Half-height an orthographic camera needs to frame `bounds` when looking along `direction`. Projects the box corners onto the camera's right/up axes; world-axis extents under-fit oblique views.
  function orthoHalf(bounds:T.Box3,direction:T.Vector3,aspect:number){const f=direction.clone().negate().normalize(),right=new T.Vector3().crossVectors(f,new T.Vector3(0,1,0)).normalize(),up=new T.Vector3().crossVectors(right,f).normalize(),center=bounds.getCenter(new T.Vector3());let hw=0,hh=0;for(let i=0;i<8;i++){const c=new T.Vector3(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).sub(center);hw=Math.max(hw,Math.abs(c.dot(right)));hh=Math.max(hh,Math.abs(c.dot(up)));}return Math.max(hh,hw/Math.max(.2,aspect),1)*1.07;}
  function overview(){const s=live.current;const size=modelBounds.getSize(new T.Vector3()),center=modelBounds.getCenter(new T.Vector3());const distance=Math.max(12,Math.max(size.y,size.x/Math.max(.4,camera.aspect))*1.9+size.z);const dir=new T.Vector3(...(s.camera==='front'?[-1,.06,0]:s.camera==='side'?[0,.1,1]:s.camera==='ortho'?[-10,6.5,13.5]:[-.55,.36,.75]) as [number,number,number]).normalize();goal=dir.clone().multiplyScalar(distance).add(center);targetGoal=center;orthoHalfGoal=orthoHalf(modelBounds,dir,camera.aspect);}
  function fitExplosion(amount:number){
   if(!explosion)return;
   const fit=explosion.fit(amount,camera.aspect);if(camera instanceof T.OrthographicCamera){camera.zoom=1;camera.updateProjectionMatrix();}
   const inventory=live.current.explodeLayout==='inventory';
   const stage=inventory?T.MathUtils.clamp((amount-.3)/.5,0,1):0;const direction=new T.Vector3(-10,6.5,13.5).normalize().lerp(inventory?new T.Vector3(0,0,1):new T.Vector3(-.12,.32,1).normalize(),inventory?stage:1).normalize();
   goal=fit.center.clone().addScaledVector(direction,fit.distance*(inventory?1:1.15));targetGoal=fit.center;orthoHalfGoal=orthoHalf(fit.bounds,direction,camera.aspect)*(inventory?1+.1*stage:1);
  }
  function animate(now:number){
   frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;const s=live.current;
   if(s.engine!==currentEngine){build(s.engine);progress=0;prevReset=-1;prevSelected=null;prevMode='';layoutKey='';previousMatrixProgress=-1;}
   const ex=explosion!;
   // Orthographic projection is a user preset in Assembled/Cutaway and the fixed projection for the inventory layout in Explore.
   const needsOrtho=(s.mode==='exploded'&&s.explodeLayout==='inventory')||(s.mode!=='exploded'&&s.camera==='ortho');
   if(needsOrtho!==(camera instanceof T.OrthographicCamera)){
    const old=camera;camera=needsOrtho?orthographic:perspective;camera.position.copy(old.position);camera.quaternion.copy(old.quaternion);camera.aspect=old.aspect;
    if(needsOrtho){const half=old.position.distanceTo(controls.target)*Math.tan(34*Math.PI/360);orthographic.top=half;orthographic.bottom=-half;orthographic.left=-half*camera.aspect;orthographic.right=half*camera.aspect;orthographic.zoom=1;}
    controls.object=camera;camera.updateProjectionMatrix();fitRequested=true;prevReset=-1;
   }
   if(s.quality!==prevQuality){renderer.setPixelRatio(Math.min(devicePixelRatio,s.quality==='ultra'?2:1.25));resize();prevQuality=s.quality;}
   if(s.mode==='exploded'&&prevMode!=='exploded'){if(progress===0)ex.captureHome();layoutKey='';fitRequested=true;previousMatrixProgress=-1;}
   if(s.mode!==prevMode){if(s.mode!=='exploded')overview();prevMode=s.mode;}
   // Only packed cells for visible pieces participate in layout and camera fitting.
   const key=[s.explodeLayout,s.spacing,camera.aspect.toFixed(3),s.hidden.join(','),s.isolated,s.isolatedPiece].join('|');
   if(key!==layoutKey){ex.layout({layout:s.explodeLayout,spacing:s.spacing,aspect:camera.aspect,hidden:s.hidden,isolated:s.isolated,isolatedPiece:s.isolatedPiece});layoutKey=key;layoutBlend=0;fitRequested=true;previousMatrixProgress=-1;stats.current(ex.count,ex.visibleCount);}
   const desired=s.mode==='exploded'?s.explode/100:0;
   const ease=reducedMotion?1:1-Math.exp(-dt*7);
   progress=desired; if(desired!==previousSlider){layoutBlend=1;previousSlider=desired;}
   const inventoryVisible=s.mode==='exploded'||progress>0;
   ex.root.visible=inventoryVisible;root.visible=!inventoryVisible;floor.visible=!inventoryVisible;grid.visible=s.grid&&!(s.mode==='exploded'&&s.explodeLayout==='inventory'&&progress>.3);
   const morphing=layoutBlend<1;layoutBlend=Math.min(1,layoutBlend+(reducedMotion?1:dt/.65));if(inventoryVisible&&(progress!==previousMatrixProgress||!inventoryWasVisible||morphing)){ex.update(progress,layoutBlend);previousMatrixProgress=progress;}
   inventoryWasVisible=inventoryVisible;
   if(s.mode==='exploded'){
    if(fitRequested||s.explode!==prevAmount){fitExplosion(desired);fitRequested=false;prevAmount=s.explode;}
    ex.highlight(s.selected,s.selectedPiece);
   }
   if(s.reset!==prevReset||s.camera!==prevCamera){if(s.mode==='exploded')fitExplosion(desired);else overview();prevReset=s.reset;prevCamera=s.camera;}
   if(s.zoom!==prevZoom){if(camera instanceof T.OrthographicCamera){camera.zoom*=s.zoom>prevZoom?1.22:.82;camera.updateProjectionMatrix();}else goal=camera.position.clone().sub(controls.target).multiplyScalar(s.zoom>prevZoom?.82:1.22).add(controls.target);prevZoom=s.zoom;}
   if(s.isolated!==prevIsolation){if(s.mode==='exploded'){fitExplosion(desired);}else if(s.isolated){const bounds=new T.Box3().setFromObject(groups[s.isolated]);const center=bounds.getCenter(new T.Vector3());targetGoal=center;goal=center.clone().add(new T.Vector3(-4,3,6));}else overview();prevIsolation=s.isolated;}
   if(goal){camera.position.lerp(goal,ease);if(camera.position.distanceTo(goal)<.015)goal=null;}
   if(targetGoal){controls.target.lerp(targetGoal,ease);if(controls.target.distanceTo(targetGoal)<.015)targetGoal=null;}
   if(camera instanceof T.OrthographicCamera){camera.top=T.MathUtils.lerp(camera.top,orthoHalfGoal,ease);camera.bottom=-camera.top;camera.left=-camera.top*camera.aspect;camera.right=camera.top*camera.aspect;camera.updateProjectionMatrix();}
   clip.constant=s.mode==='cutaway'?T.MathUtils.lerp(modelBounds.min.y-.2,modelBounds.max.y+.2,s.section/100):100;floor.position.y=modelBounds.min.y-.2;grid.position.y=modelBounds.min.y-.22;
   for(const p of PARTS){const g=groups[p.id];g.visible=!s.hidden.includes(p.id)&&(!s.isolated||s.isolated===p.id);}
   if(s.selected!==prevSelected){root.traverse(o=>{if(o instanceof T.Mesh){const m=o.material as T.MeshStandardMaterial;m.emissive.setHex(o.userData.part===s.selected?0xd39868:0);m.emissiveIntensity=o.userData.part===s.selected?.17:0;}});prevSelected=s.selected;}
   if(s.playing&&!inventoryVisible){mechanismTime+=dt*s.speed;mechanism?.(mechanismTime);rotors.forEach((r,i)=>r.rotation.x+=dt*s.speed*(r.userData.rate??(i===0&&s.engine==='turbofan'?.7:1.1)));}
   controls.mouseButtons.LEFT=s.mode==='exploded'&&progress>.8&&s.explodeLayout==='inventory'?T.MOUSE.PAN:T.MOUSE.ROTATE;controls.touches.ONE=s.mode==='exploded'&&progress>.8&&s.explodeLayout==='inventory'?T.TOUCH.PAN:T.TOUCH.ROTATE;controls.update();flow.visible=s.flow&&ENGINES[s.engine].flow&&!inventoryVisible&&!s.isolated;
   if(flow.visible){
    flowTime+=dt*(s.playing?Math.max(.6,s.speed):1);
    const fan=s.engine==='turbofan',power=s.engine==='turboprop'||s.engine==='turboshaft';
    for(let i=0;i<n;i++){
     const bypass=fan&&i<n*.45;
     const rate=.075*(1+flowSeedR[i]*.3);
     const p=(flowSeedP[i]+flowTime*rate)%1;
     flowSample(p,i,bypass,fan,power,flowP,flowC);
     flowSample(Math.max(0,p-.011),i,bypass,fan,power,flowQ,flowD);
     flowSeg[i*6]=flowQ.x;flowSeg[i*6+1]=flowQ.y;flowSeg[i*6+2]=flowQ.z;
     flowSeg[i*6+3]=flowP.x;flowSeg[i*6+4]=flowP.y;flowSeg[i*6+5]=flowP.z;
     flowSegColor[i*6]=flowD.r*.12;flowSegColor[i*6+1]=flowD.g*.12;flowSegColor[i*6+2]=flowD.b*.12;
     flowSegColor[i*6+3]=flowC.r;flowSegColor[i*6+4]=flowC.g;flowSegColor[i*6+5]=flowC.b;
     flowHead[i*3]=flowP.x;flowHead[i*3+1]=flowP.y;flowHead[i*3+2]=flowP.z;
     flowHeadColor[i*3]=flowC.r;flowHeadColor[i*3+1]=flowC.g;flowHeadColor[i*3+2]=flowC.b;
    }
    segGeo.attributes.position.needsUpdate=true;segGeo.attributes.color.needsUpdate=true;
    headGeo.attributes.position.needsUpdate=true;headGeo.attributes.color.needsUpdate=true;
   }
   const offsets=[[-3.4,2.7,0],[-.9,1.8,0],[1.45,1.7,0],[3,1.55,0],[4.5,-1.5,0],[-1.6,-2.6,0],[0,-1.3,0]];
   // Callout labels: a dot on the part, a thin leader rising to a shelf that carries the name. Leaders all rise (names clear the silhouette) on three staggered tiers, and shelves point away from the model's screen centre, so they rarely collide.
   const centreX=modelBounds.getCenter(new T.Vector3()).project(camera).x;let topY=Infinity;for(let k=0;k<8;k++){const c=new T.Vector3(k&1?modelBounds.max.x:modelBounds.min.x,k&2?modelBounds.max.y:modelBounds.min.y,k&4?modelBounds.max.z:modelBounds.min.z).project(camera);if(c.z<1)topY=Math.min(topY,(-c.y*.5+.5)*el.clientHeight);}
   labels.forEach((l,i)=>{const p=PARTS[i],g=groups[p.id];const pos=(g.userData.anchor as T.Vector3).clone().project(camera);l.hidden=inventoryVisible||!s.labels||!g.visible||pos.z>1||pos.x<-.95||pos.x>.95||pos.y<-.9||pos.y>.9;if(l.hidden)return;l.style.left=((pos.x*.5+.5)*el.clientWidth)+'px';l.style.top=((-pos.y*.5+.5)*el.clientHeight)+'px';const anchorY=(-pos.y*.5+.5)*el.clientHeight;const right=pos.x>=centreX,ex=right?40:-40,ey=Math.min(-44,(topY-22-(i%3)*26)-anchorY);const span=l.lastChild as HTMLElement,w=span.offsetWidth||60;(l.firstChild!.firstChild as SVGElement).setAttribute('points',`0,0 ${ex},${ey} ${ex+(right?w+6:-(w+6))},${ey}`);span.style.left=(right?ex+3:ex-3)+'px';span.style.top=(ey-17)+'px';span.style.transform=right?'':'translateX(-100%)';l.classList.toggle('selected',s.selected===p.id);});
   renderer.render(scene,camera);
  }
  const onControlStart=()=>{goal=null;targetGoal=null;};controls.addEventListener('start',onControlStart);
  frame=requestAnimationFrame(animate);setReady(true);
  const contextLost=(e:Event)=>{e.preventDefault();setError('The graphics connection was interrupted. Reload the page to restore the engine.');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('webglcontextlost',contextLost);labels.forEach(l=>l.remove());if(explosion){scene.remove(explosion.root);explosion.dispose();}scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.LineSegments||o instanceof T.Points){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});materials.forEach(m=>m.dispose());env.dispose();renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div className="scene-host" ref={host}>{!ready&&!error&&<div className="viewer-message"><span className="loading-orbit"/>Preparing engine geometry</div>}{error&&<div className="viewer-message error" role="alert">{error}<button onClick={()=>location.reload()}>Reload viewer</button></div>}</div>;
}

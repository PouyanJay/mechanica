import * as T from 'three';
export type BuildContext={groups:Record<string,T.Group>;clip:T.Plane;materials:T.MeshStandardMaterial[]};
const TAU=Math.PI*2,Y=new T.Vector3(0,1,0);
export function createWorkshop(ctx:BuildContext){
 const {materials,clip}=ctx;
 const mat=(color:number,rough=.3,metal=.85,cut=false)=>{const m=new T.MeshStandardMaterial({color,roughness:rough,metalness:metal,side:T.DoubleSide,clippingPlanes:cut?[clip]:[]});materials.push(m);return m;};
 const steel=mat(0xaab5bf),polish=mat(0xd5dce1,.22),dark=mat(0x47535e,.35),cast=mat(0x536579,.48,.7,true),head=mat(0xa1b0bd,.36,.8,true),bronze=mat(0xa98965,.34),rubber=mat(0x252b30,.8,.1),ceramic=mat(0xe4ddd0,.45,.1),cover=mat(0x344d68,.3,.7,true);
 function mesh(geo:T.BufferGeometry,m:T.Material,parent:T.Object3D,name:string){const o=new T.Mesh(geo,m);o.castShadow=true;o.receiveShadow=true;o.userData.pieceName=name;o.userData.inventoryFlat=true;parent.add(o);return o;}
 function box(size:number[],pos:number[],m:T.Material,parent:T.Object3D,name:string){const shape=new T.Shape(),[w,h,d]=size,r=Math.min(.07,w*.12,h*.12);shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);const g=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:2,steps:1,curveSegments:5});g.translate(0,0,-d/2);const o=mesh(g,m,parent,name);o.position.set(...pos as [number,number,number]);return o;}
 function cylinder(radius:number,length:number,pos:number[],m:T.Material,parent:T.Object3D,name:string,axis='y',segments=64){const geo=new T.CylinderGeometry(radius,radius,length,segments);if(axis==='x')geo.rotateZ(-Math.PI/2);if(axis==='z')geo.rotateX(Math.PI/2);const o=mesh(geo,m,parent,name);o.position.set(...pos as [number,number,number]);return o;}
 function ring(radius:number,thickness:number,pos:number[],m:T.Material,parent:T.Object3D,name:string,axis='y'){const geo=new T.TorusGeometry(radius,thickness,10,72);if(axis==='y')geo.rotateX(Math.PI/2);if(axis==='x')geo.rotateY(Math.PI/2);const o=mesh(geo,m,parent,name);o.position.set(...pos as [number,number,number]);return o;}
 function tube(points:T.Vector3[],radius:number,m:T.Material,parent:T.Object3D,name:string){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,radius,10,false),m,parent,name);}
 function bolt(pos:number[],parent:T.Object3D,axis='y',length=.18){cylinder(.055,length,pos,steel,parent,'Bolt shank',axis,12);const cap=[...pos];cap[axis==='x'?0:axis==='y'?1:2]+=length/2;cylinder(.085,.06,cap,polish,parent,'Hex bolt',axis,6);}
 function gear(radius:number,teeth:number,width:number,parent:T.Object3D,name:string){const shape=new T.Shape();for(let i=0;i<teeth*4;i++){const a=i/(teeth*4)*TAU,r=radius*(i%4===0||i%4===3?.9:1);const y=Math.cos(a)*r,z=Math.sin(a)*r;if(i===0)shape.moveTo(y,z);else shape.lineTo(y,z);}shape.closePath();const hole=new T.Path();hole.absarc(0,0,radius*.27,0,TAU,true);shape.holes.push(hole);const geo=new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:true,bevelSegments:1,bevelThickness:.008,bevelSize:.008,curveSegments:40});geo.translate(0,0,-width/2);geo.rotateY(Math.PI/2);return mesh(geo,steel,parent,name);}
 return{mat,mesh,box,cylinder,ring,tube,bolt,gear,steel,polish,dark,cast,head,bronze,rubber,ceramic,cover};
}

/** Four-stroke inspection model. Slider-crank geometry fixes rod length at every frame. */
export function buildPistonEngine(kind:'v8'|'inline4',ctx:BuildContext){
 const w=createWorkshop(ctx),g=ctx.groups,v8=kind==='v8',r=.45,L=1.75,cy=-.5;
 const crank=new T.Group();crank.position.y=cy;g.crankshaft.add(crank);
 w.cylinder(.17,5.8,[0,0,0],w.steel,crank,'Main shaft','x');
 const positions=[-1.8,-.6,.6,1.8],phases=v8?[0,Math.PI/2,3*Math.PI/2,Math.PI]:[0,Math.PI,Math.PI,0];
 for(let j=0;j<4;j++){
  const x=positions[j],a=phases[j];w.cylinder(.19,.62,[x,Math.cos(a)*r,Math.sin(a)*r],w.polish,crank,'Crankpin','x');
  for(const dx of [-.32,.32]){const cw=w.box([.18,.77,.7],[x+dx,-Math.cos(a)*.24,-Math.sin(a)*.24],w.dark,crank,'Counterweight');cw.rotation.x=a;const cheek=w.box([.18,.58,.29],[x+dx,Math.cos(a)*.24,Math.sin(a)*.24],w.steel,crank,'Crank web');cheek.rotation.x=a;}
 }
 for(const x of [-2.45,-1.2,0,1.2,2.45]){w.cylinder(.26,.22,[x,0,0],w.polish,crank,'Main journal','x');w.ring(.29,.07,[x,cy,0],w.bronze,g.block,'Main bearing','x');}
 const fly=w.gear(1.05,72,.22,crank,'Flywheel ring gear');fly.position.x=3;w.cylinder(.72,.24,[3,0,0],w.dark,crank,'Flywheel','x');for(let i=0;i<8;i++)w.bolt([3.15,Math.cos(i/8*TAU)*.44,Math.sin(i/8*TAU)*.44],crank,'x');
 const pulley=w.gear(.58,32,.22,crank,'Timing drive');pulley.position.x=-3.05;
 const motions:Array<(a:number)=>void>=[];
 const banks=v8?[-Math.PI/4,Math.PI/4]:[0];
 banks.forEach((beta,bankIndex)=>{
  const bank=new T.Group();bank.rotation.x=beta;bank.position.set(v8?(bankIndex===0?-.105:.105):0,cy,0);g.block.add(bank);
  // A genuine open-bore casting made by extruding a profile with four circular holes.
  const blockShape=new T.Shape();blockShape.moveTo(-2.52,-.78);blockShape.lineTo(2.52,-.78);blockShape.lineTo(2.52,.78);blockShape.lineTo(-2.52,.78);blockShape.closePath();
  for(const x of positions){const hole=new T.Path();hole.absarc(x,0,.505,0,TAU,true);blockShape.holes.push(hole);}
  const blockGeo=new T.ExtrudeGeometry(blockShape,{depth:1.55,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,curveSegments:48});blockGeo.rotateX(-Math.PI/2);const block=w.mesh(blockGeo,w.cast,bank,'Bored cylinder block');block.position.y=1.04;
  for(const x of positions){const liner=new T.LatheGeometry([new T.Vector2(.5,1.04),new T.Vector2(.5,2.58),new T.Vector2(.53,2.58),new T.Vector2(.53,1.04)],64);const shell=w.mesh(liner,w.mat(0x9aabb8,.23,.85,true),bank,'Cylinder liner');shell.position.x=x;w.ring(.51,.025,[x,2.6,0],w.bronze,bank,'Head gasket fire ring');}
  const heads=new T.Group();heads.rotation.x=beta;heads.position.set(v8?(bankIndex===0?-.105:.105):0,cy,0);g.heads.add(heads);w.box([5.15,.34,1.56],[0,2.8,0],w.head,heads,'Cylinder head');w.box([5.2,.28,1.5],[0,3.49,0],w.cover,heads,'Cam cover');
  for(let i=0;i<12;i++)w.bolt([-2.27+(i%6)*.91,3.68,i<6?-.62:.62],heads);
  const cams=new T.Group();cams.rotation.x=beta;cams.position.set(v8?(bankIndex===0?-.105:.105):0,cy,0);g.valvetrain.add(cams);
  const camRotors:T.Group[]=[];
  for(const z of [-.43,.43]){const cam=new T.Group();cam.position.set(0,3.25,z);cams.add(cam);w.cylinder(.10,5.4,[0,0,0],w.polish,cam,'Camshaft','x');for(const x of positions){const lobe=w.cylinder(.15,.17,[x,.065,0],w.dark,cam,'Cam lobe','x');lobe.rotation.x=0;}const wheel=w.gear(.46,40,.12,cam,'Camshaft sprocket');wheel.position.x=-2.9;camRotors.push(cam);}
  const manifolds=new T.Group();manifolds.rotation.x=beta;manifolds.position.set(v8?(bankIndex===0?-.105:.105):0,cy,0);g.manifolds.add(manifolds);
  for(let j=0;j<4;j++){
   const x=positions[j],phase=phases[j],n=new T.Vector3(0,Math.cos(beta),Math.sin(beta));
   const piston=new T.Group();piston.rotation.x=beta;g.pistons.add(piston);
   const pg=new T.LatheGeometry([new T.Vector2(0,.28),new T.Vector2(.43,.28),new T.Vector2(.475,.24),new T.Vector2(.475,-.32),new T.Vector2(.39,-.32),new T.Vector2(.39,.14),new T.Vector2(0,.14)],72);w.mesh(pg,w.polish,piston,`Piston ${bankIndex*4+j+1}`);
   for(const y of [.17,.09,-.14])w.ring(.482,.015,[0,y,0],w.dark,piston,'Piston ring');w.cylinder(.095,.92,[0,-.06,0],w.steel,piston,'Wrist pin','x');
   const rod=new T.Group();g.rods.add(rod);w.box([.14,L-.25,.16],[0,0,0],w.steel,rod,'Connecting rod beam');w.cylinder(.24,.2,[0,-L/2,0],w.dark,rod,'Big end','x');w.ring(.155,.038,[.11,-L/2,0],w.bronze,rod,'Big-end bearing','x');w.cylinder(.14,.19,[0,L/2,0],w.steel,rod,'Small end','x');for(const y of [-L/2-.12,-L/2+.12])w.bolt([0,y,.22],rod,'z',.24);
   motions.push(theta=>{const a=theta+phase,pin=new T.Vector3(x+(v8?(bankIndex===0?-.105:.105):0),cy+r*Math.cos(a),r*Math.sin(a));const relative=a-beta,q=r*Math.cos(relative)+Math.sqrt(L*L-r*r*Math.sin(relative)**2);const wrist=n.clone().multiplyScalar(q).add(new T.Vector3(pin.x,cy,0));piston.position.copy(wrist);const delta=wrist.clone().sub(pin);rod.position.copy(pin).add(wrist).multiplyScalar(.5);rod.quaternion.setFromUnitVectors(Y,delta.normalize());});
   for(let v=0;v<2;v++){const valve=new T.Group();valve.position.set(x,3.0,v? .35:-.35);cams.add(valve);w.cylinder(.043,.52,[0,0,0],w.polish,valve,'Valve stem');w.cylinder(.19,.045,[0,-.25,0],w.steel,valve,v?'Exhaust valve':'Intake valve');const springPts=Array.from({length:100},(_,i)=>new T.Vector3(Math.cos(i/99*TAU*6)*.09,-.1+i/99*.28,Math.sin(i/99*TAU*6)*.09));w.tube(springPts,.014,w.dark,valve,'Valve spring');motions.push(theta=>{const c=((theta+phase+(j>1?TAU:0))%(TAU*2)+TAU*2)%(TAU*2);const start=v?3*Math.PI:0;const lift=c>=start&&c<=start+Math.PI?.13*Math.sin(c-start):0;valve.position.y=3-lift;});}
   w.cylinder(.085,.28,[x,3.08,0],w.ceramic,heads,'Spark plug insulator');w.cylinder(.07,.22,[x,2.87,0],w.steel,heads,'Spark plug body');
   w.tube([new T.Vector3(x,2.75,.76),new T.Vector3(x,2.7,1.14),new T.Vector3(x-.1,1.8,1.4),new T.Vector3(x-.35,1.4,1.55)],.13,w.bronze,manifolds,'Exhaust runner');
   w.tube([new T.Vector3(x,2.8,-.75),new T.Vector3(x,3.03,-1),new T.Vector3(x,3.3,-.86)],.15,w.steel,manifolds,'Intake runner');
  }
  w.box([4.9,.45,.5],[0,3.4,-.95],w.dark,manifolds,'Intake plenum');motions.push(theta=>camRotors.forEach(c=>c.rotation.x=theta/2));
 });
 w.box([5.4,.55,v8?1.5:1.4],[0,-1.35,0],w.cast,g.block,'Oil sump');for(const x of [-2.4,-1.2,0,1.2,2.4])for(const z of [-.66,.66])w.bolt([x,-1.04,z],g.block,'y');
 const animate=(theta:number)=>{crank.rotation.x=theta;motions.forEach(fn=>fn(theta));};animate(0);return animate;
}

/** The apex loci follow R exp(i phi) + e exp(i 3 phi). */
export function buildRotaryEngine(ctx:BuildContext){
 const w=createWorkshop(ctx),g=ctx.groups,R=1.55,e=.25,depth=1.3;
 const chamber=(margin=0)=>{const path=new T.Shape();for(let i=0;i<=240;i++){const a=i/240*TAU,y=R*Math.cos(a)+e*Math.cos(3*a),z=R*Math.sin(a)+e*Math.sin(3*a),length=Math.hypot(y,z),f=1+margin/length;if(!i)path.moveTo(y*f,z*f);else path.lineTo(y*f,z*f);}path.closePath();return path;};
 const ringShape=chamber(.28);ringShape.holes.push(new T.Path(chamber().getPoints(240)).closePath());
 function extrude(shape:T.Shape,d:number,x:number,m:T.Material,parent:T.Object3D,name:string){const geo=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:2,curveSegments:72});geo.translate(0,0,-d/2);geo.applyMatrix4(new T.Matrix4().set(0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1));const o=w.mesh(geo,m,parent,name);o.position.x=x;return o;}
 extrude(ringShape,depth,0,w.cast,g.housing,'Epitrochoid housing');
 for(const x of [-.49,-.24,0,.24,.49]){const fin=chamber(.4);fin.holes.push(new T.Path(chamber(.29).getPoints(240)).closePath());extrude(fin,.045,x,w.head,g.housing,'Cooling fin');}
 for(const x of [-.79,.79]){const side=chamber(.26);const bore=new T.Path();bore.absarc(0,0,.43,0,TAU,true);side.holes.push(bore);extrude(side,.18,x,w.head,g.endplates,'Side housing');w.ring(.37,.08,[x,0,0],w.bronze,g.endplates,'Shaft bearing','x');}
 for(let i=0;i<14;i++){const a=i/14*TAU,y=(R+.44)*Math.cos(a),z=(R-.05)*Math.sin(a);w.bolt([-.96,y,z],g.endplates,'x',.23);w.bolt([.96,y,z],g.endplates,'x',.23);}
 const rotorMotion=new T.Group(),sealMotion=new T.Group(),gearMotion=new T.Group();g.rotor.add(rotorMotion);g.seals.add(sealMotion);g.gears.add(gearMotion);
 const tri=new T.Shape();for(let k=0;k<3;k++){const a=k/3*TAU,b=(k+1)/3*TAU;for(let i=0;i<32;i++){const t=i/32,y=R*((1-t)*Math.cos(a)+t*Math.cos(b)),z=R*((1-t)*Math.sin(a)+t*Math.sin(b));if(k===0&&i===0)tri.moveTo(y,z);else tri.lineTo(y,z);}}tri.closePath();const hole=new T.Path();hole.absarc(0,0,.36,0,TAU,true);tri.holes.push(hole);extrude(tri,1.12,0,w.dark,rotorMotion,'Three-apex rotor');
 for(let k=0;k<3;k++){const a=k/3*TAU,y=R*Math.cos(a),z=R*Math.sin(a);w.box([1.16,.045,.045],[0,y,z],w.polish,sealMotion,'Apex seal');const b=(k+1)/3*TAU;for(const x of [-.575,.575])w.tube([new T.Vector3(x,y*.96,z*.96),new T.Vector3(x,R*(Math.cos(a)+Math.cos(b))*.48,R*(Math.sin(a)+Math.sin(b))*.48),new T.Vector3(x,R*Math.cos(b)*.96,R*Math.sin(b)*.96)],.018,w.polish,sealMotion,'Side seal');}
 // Geometric reference gearing: 30 internal teeth around a 20-tooth fixed gear.
 const fixed=w.gear(.50,20,.10,g.gears,'Fixed timing gear');fixed.position.x=.59;
 const internal=new T.Shape();internal.absarc(0,0,.91,0,TAU,false);const inner=new T.Path();for(let i=0;i<120;i++){const a=i/120*TAU,rad=i%4===0||i%4===3?.75:.71;if(!i)inner.moveTo(rad*Math.cos(a),rad*Math.sin(a));else inner.lineTo(rad*Math.cos(a),rad*Math.sin(a));}inner.closePath();internal.holes.push(inner);extrude(internal,.10,.59,w.steel,gearMotion,'Internal rotor gear');
 const eccentric=new T.Group();g.eccentric.add(eccentric);w.cylinder(.22,3.8,[0,0,0],w.polish,eccentric,'Output shaft','x');w.cylinder(.35,1.08,[0,e,0],w.steel,eccentric,'Eccentric journal','x');w.cylinder(.6,.16,[-1.25,-.12,0],w.dark,eccentric,'Balance weight','x');w.cylinder(.65,.15,[1.4,0,0],w.steel,eccentric,'Output flange','x');
 for(const sign of [-1,1]){w.tube([new T.Vector3(-.1,-.8,sign*1.43),new T.Vector3(-.1,-.85,sign*1.85),new T.Vector3(.55,-.75,sign*2.15)],.18,sign===1?w.bronze:w.steel,g.ports,sign===1?'Exhaust port':'Intake port');}
 for(const x of [-.3,.3]){w.cylinder(.07,.35,[x,1.85,0],w.ceramic,g.ports,'Spark plug insulator');w.cylinder(.09,.2,[x,1.62,0],w.steel,g.ports,'Spark plug body');}
 const animate=(theta:number)=>{eccentric.rotation.x=theta;for(const group of [rotorMotion,sealMotion,gearMotion]){group.position.set(0,e*Math.cos(theta),e*Math.sin(theta));group.rotation.x=theta/3;}};animate(0);return animate;
}

export function buildShaftOutput(kind:'turboprop'|'turboshaft',ctx:BuildContext){
 const w=createWorkshop(ctx),parent=ctx.groups.fan;
 const housing=w.cylinder(.98,.72,[-3.55,0,0],w.head,parent,'Reduction gearbox case','x');
 const sun=new T.Group(),carrier=new T.Group(),output=new T.Group();sun.position.x=carrier.position.x=-3.93;output.position.x=-4.18;parent.add(sun,carrier,output);
 const sunGear=w.gear(.29,20,.16,sun,'Sun gear');
 const planets:T.Mesh[]=[];for(let i=0;i<3;i++){const a=i/3*TAU,planet=w.gear(.29,20,.16,carrier,'Planet gear');planet.position.set(0,Math.cos(a)*.58,Math.sin(a)*.58);planets.push(planet);w.cylinder(.075,.3,[0,planet.position.y,planet.position.z],w.bronze,carrier,'Planet bearing pin','x');}
 w.ring(.9,.045,[-3.93,0,0],w.steel,parent,'Fixed ring gear','x');for(let i=0;i<60;i++){const a=i/60*TAU;const tooth=w.box([.16,.045,.045],[-3.93,Math.cos(a)*.875,Math.sin(a)*.875],w.steel,parent,'Ring gear tooth');tooth.rotation.x=a;}
 w.cylinder(.21,.85,[-4.22,0,0],w.polish,parent,'Output spindle','x');for(let i=0;i<12;i++){const a=i/12*TAU;w.bolt([-3.98,Math.cos(a)*.97,Math.sin(a)*.97],parent,'x');}
 if(kind==='turboprop'){
  w.cylinder(.36,.4,[0,0,0],w.steel,output,'Propeller hub','x');
  for(let k=0;k<5;k++){const blade=new T.Group();blade.rotation.x=k/5*TAU;output.add(blade);const verts:number[]=[],indices:number[]=[];
   for(let i=0;i<=30;i++){const t=i/30,span=.32+t*2.9,chord=.48*Math.sin(Math.PI*(.08+.9*t))+.13,twist=.85*(1-t)+.12;for(let j=0;j<24;j++){const a=j/24*TAU,u=Math.cos(a)*chord/2,th=Math.sin(a)*.035*(1-t*.7);verts.push(u*Math.cos(twist)-th*Math.sin(twist)+.16*t*t,span,u*Math.sin(twist)+th*Math.cos(twist)+.17*t*t);}}
   for(let i=0;i<30;i++)for(let j=0;j<24;j++){const a=i*24+j,b=i*24+(j+1)%24;indices.push(a,b,a+24,b,b+24,a+24);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();w.mesh(geo,w.dark,blade,'Propeller blade');const cuff=w.cylinder(.15,.32,[0,.42,0],w.steel,blade,'Blade root cuff');
  }
  const spinner=new T.LatheGeometry([new T.Vector2(0,-.58),new T.Vector2(.14,-.51),new T.Vector2(.34,-.12),new T.Vector2(.38,.12)],80);spinner.rotateZ(-Math.PI/2);w.mesh(spinner,w.polish,output,'Propeller spinner');
 }else{w.cylinder(.52,.2,[-.3,0,0],w.polish,output,'Power take-off flange','x');for(let i=0;i<8;i++){const a=i/8*TAU;w.bolt([-.45,Math.cos(a)*.37,Math.sin(a)*.37],output,'x');}for(let i=0;i<16;i++){const a=i/16*TAU;const spline=w.box([.55,.025,.04],[-.08,Math.cos(a)*.22,Math.sin(a)*.22],w.steel,output,'Output spline');spline.rotation.x=a;}}
 return(theta:number)=>{sun.rotation.x=theta*1.2;carrier.rotation.x=theta*.3;output.rotation.x=theta*.3;planets.forEach(p=>p.rotation.x=-theta*.9);};
}

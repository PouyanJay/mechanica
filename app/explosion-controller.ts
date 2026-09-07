import * as T from 'three';
import { packInventory } from './explosion-layout';

export type PieceInfo={id:string;part:string;name:string};
type Piece=PieceInfo&{
 source:T.Mesh; sourceIndex:number; batch:T.InstancedMesh; index:number;
 home:T.Matrix4; homePosition:T.Vector3; homeQuaternion:T.Quaternion; homeScale:T.Vector3;
 targetPosition:T.Vector3; targetQuaternion:T.Quaternion; spreadPosition:T.Vector3;
 localCenter:T.Vector3; localBox:T.Box3; displayBox:T.Box3; visible:boolean; attachment?:Piece;
 current:T.Matrix4; transitionFrom:T.Matrix4;
};
export type ExplosionOptions={layout:'radial'|'inventory';spacing:number;aspect:number;hidden:string[];isolated:string|null;isolatedPiece:string|null};
const ONE=new T.Vector3(1,1,1);
export class ExplosionController {
 readonly root=new T.Group();
 readonly pieces:Piece[]=[];
 readonly batches:T.InstancedMesh[]=[];
 readonly lookup=new Map<string,Piece>();
 private materials:T.MeshStandardMaterial[]=[];
 private partOrder:string[]=[];
 private bounds=new T.Box3();
 private groupCenters=new Map<string,T.Vector3>();
 private groupCounts=new Map<string,number>();
 private options:ExplosionOptions={layout:'inventory',spacing:40,aspect:1,hidden:[],isolated:null,isolatedPiece:null};
 private temporary=new T.Matrix4();
 private position=new T.Vector3();
 private quaternion=new T.Quaternion();
 private zero=new T.Vector3(0,0,0);
 private frameBox=new T.Box3();
 private selectedKey='';
 private decorationSource=new Map<string,Piece>();
 constructor(private model:T.Group){
  this.root.name='Individual engine pieces';this.partOrder=model.children.map(g=>String(g.userData.id));
  model.updateWorldMatrix(true,true);
  const sources:T.Mesh[]=[];model.traverse(o=>{if(o instanceof T.Mesh)sources.push(o);});
  let serial=0;const labelCounts=new Map<string,number>();
  for(const source of sources){
   const mat=(source.material as T.MeshStandardMaterial).clone();mat.clippingPlanes=[];mat.emissive.setHex(0);mat.emissiveIntensity=0;this.materials.push(mat);
   const count=source instanceof T.InstancedMesh?source.count:1;const labelKey=source.userData.part+':'+source.userData.pieceName;const row=(labelCounts.get(labelKey)??0)+1;labelCounts.set(labelKey,row);
   const batch=new T.InstancedMesh(source.geometry,mat,count);batch.frustumCulled=false;batch.castShadow=false;batch.receiveShadow=false;batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
   batch.userData.pieceIds=[];this.root.add(batch);this.batches.push(batch);
   source.geometry.computeBoundingBox();const box=source.geometry.boundingBox!.clone();
   for(let i=0;i<count;i++){
    const part=String(source.userData.part),name=String(source.userData.pieceName??'Component');
    const p:Piece={id:`${part}:${serial++}`,part,name:count>1?`${name} ${String(i+1).padStart(2,'0')} · ${source.userData.inventoryFlat?'row':'set'} ${row}`:`${name} ${row}`,source,sourceIndex:i,batch,index:i,home:new T.Matrix4(),homePosition:new T.Vector3(),homeQuaternion:new T.Quaternion(),homeScale:new T.Vector3(),targetPosition:new T.Vector3(),spreadPosition:new T.Vector3(),targetQuaternion:new T.Quaternion(),localCenter:box.getCenter(new T.Vector3()),localBox:box.clone(),displayBox:new T.Box3(),visible:true,current:new T.Matrix4(),transitionFrom:new T.Matrix4()};
    batch.userData.pieceIds.push(p.id);batch.setColorAt(i,new T.Color(0xffffff));this.pieces.push(p);this.lookup.set(p.id,p);if(!(source instanceof T.InstancedMesh))this.decorationSource.set(source.uuid,p);
   }
  }
  for(const p of this.pieces){const attached=p.source.userData.attachTo;if(attached)p.attachment=this.decorationSource.get(attached);}
  this.captureHome();this.root.visible=false;
 }
 get count(){return this.pieces.filter(p=>!p.attachment).length;}
 get visibleCount(){return this.pieces.filter(p=>!p.attachment&&p.visible).length;}
 captureHome(){
  this.model.updateWorldMatrix(true,true);
  for(const p of this.pieces){
   if(p.source instanceof T.InstancedMesh){p.source.getMatrixAt(p.sourceIndex,this.temporary);p.home.multiplyMatrices(p.source.matrixWorld,this.temporary);}else p.home.copy(p.source.matrixWorld);
   p.home.decompose(p.homePosition,p.homeQuaternion,p.homeScale);
   const center=p.localCenter.clone().applyMatrix4(p.home);const group=this.partOrder.indexOf(p.part);
   const angle=group/7*Math.PI*2,amount=.8;
   p.spreadPosition.copy(p.homePosition).add(new T.Vector3((center.x-.25)*.38,center.y*.3+Math.sin(angle)*amount,center.z*.3+Math.cos(angle)*amount));
   p.current.copy(p.home);p.transitionFrom.copy(p.home);
  }
 }
 layout(options:ExplosionOptions){
  for(const p of this.pieces)p.transitionFrom.copy(p.current);
  this.options=options;this.groupCenters.clear();this.groupCounts.clear();
  const hidden=new Set(options.hidden);const selected=options.isolatedPiece?this.lookup.get(options.isolatedPiece):null;
  for(const p of this.pieces){p.visible=!hidden.has(p.part)&&(!options.isolated||p.part===options.isolated)&&(!selected||p===selected||p.attachment===selected);}
  const independent=this.pieces.filter(p=>!p.attachment&&p.visible);
  const gap=.10+options.spacing/100*.55;
  if(options.layout==='inventory'){
   for(const p of independent){
    // Blades face the camera broadside; revolved parts face along their shaft axis.
    p.targetQuaternion.setFromAxisAngle(new T.Vector3(0,1,0),p.source.userData.inventoryFlat?0:Math.PI/2);
    p.displayBox.copy(p.localBox).applyMatrix4(new T.Matrix4().compose(this.zero,p.targetQuaternion,p.homeScale));
   }
   const layout=packInventory(independent.map(p=>{const size=p.displayBox.getSize(new T.Vector3());return{id:p.id,group:p.part,width:size.x,height:size.y};}),options.aspect,gap);
   for(const p of independent){const cell=layout.cells.get(p.id)!;const center=p.localCenter.clone().multiply(p.homeScale).applyQuaternion(p.targetQuaternion);p.targetPosition.set(cell.x,cell.y,0).sub(center);}
  }else{
   const groups=new Map<string,Piece[]>();
   for(const p of independent){const list=groups.get(p.part)??[];list.push(p);groups.set(p.part,list);}
   const order=this.partOrder;
   const spread=1+options.spacing/100*1.6;
   for(const [part,parts] of groups){
    // Axial stage spacing plus radial separation preserves the engine's arrangement.
    const axial=order.indexOf(part)-2.5;
    const rows=new Map<string,Piece[]>();
    for(const p of parts){const center=p.localCenter.clone().applyMatrix4(p.home);const key=(Math.round(center.x*12)/12).toFixed(2);const row=rows.get(key)??[];row.push(p);rows.set(key,row);}
    const rowKeys=[...rows.keys()].sort((a,b)=>Number(a)-Number(b));
    rowKeys.forEach((key,rowIndex)=>{
     const row=rows.get(key)!;
     row.forEach((p,index)=>{
      const center=p.localCenter.clone().applyMatrix4(p.home);const radial=Math.hypot(center.y,center.z);
      const angle=radial>.025?Math.atan2(center.z,center.y):index/Math.max(1,row.length)*Math.PI*2;
      const size=p.localBox.getSize(new T.Vector3()).multiply(p.homeScale);
      const radius=radial+(row.length>1?(Math.max(.15,size.y)*row.length/(Math.PI*2)+.5)*spread:1.3*spread);
      const x=center.x+axial*3.7*spread+(rowIndex-(rowKeys.length-1)/2)*.6*spread;
      const desired=new T.Vector3(x,Math.cos(angle)*radius,Math.sin(angle)*radius);
      if(part==='casing')desired.y-=7*spread;if(part==='shaft')desired.y+=5*spread;
      p.targetQuaternion.copy(p.homeQuaternion);
      p.targetPosition.copy(desired).sub(p.localCenter.clone().multiply(p.homeScale).applyQuaternion(p.targetQuaternion));
     });
    });
   }
  }
  // Surface markings travel with their host part and are not counted as loose hardware.
  for(const p of this.pieces){if(p.attachment){p.visible=p.attachment.visible;const a=p.attachment;const delta=new T.Matrix4().compose(a.targetPosition,a.targetQuaternion,a.homeScale).multiply(a.home.clone().invert());const target=delta.multiply(p.home);target.decompose(p.targetPosition,p.targetQuaternion,new T.Vector3());}}
  this.bounds.makeEmpty();
  for(const p of independent){const m=new T.Matrix4().compose(p.targetPosition,p.targetQuaternion,p.homeScale);this.bounds.union(p.localBox.clone().applyMatrix4(m));const center=p.localCenter.clone().applyMatrix4(m);if(!this.groupCenters.has(p.part))this.groupCenters.set(p.part,new T.Vector3());this.groupCenters.get(p.part)!.add(center);this.groupCounts.set(p.part,(this.groupCounts.get(p.part)??0)+1);}
  for(const [part,center] of this.groupCenters)center.divideScalar(this.groupCounts.get(part)!);
  if(this.bounds.isEmpty())this.bounds.set(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1));
  this.selectedKey='';
  return this.bounds.clone();
 }
 update(progress:number,layoutBlend=1){
  const t=T.MathUtils.clamp(progress,0,1);this.frameBox.makeEmpty();
  for(const p of this.pieces){
   if(!p.visible){this.temporary.compose(this.zero,p.homeQuaternion,this.zero);p.batch.setMatrixAt(p.index,this.temporary);continue;}
   if(t===0)p.current.copy(p.home);
   else if(t===1)p.current.compose(p.targetPosition,p.targetQuaternion,p.homeScale);
   else{if(this.options.layout==='inventory'){
    const stage=Math.max(0,(t-.45)/.55);
    if(t<=.45)this.position.lerpVectors(p.homePosition,p.spreadPosition,t/.45);
    else this.position.lerpVectors(p.spreadPosition,p.targetPosition,stage);
    this.quaternion.slerpQuaternions(p.homeQuaternion,p.targetQuaternion,stage);
   }else{this.position.lerpVectors(p.homePosition,p.targetPosition,t);this.quaternion.slerpQuaternions(p.homeQuaternion,p.targetQuaternion,t);}
   p.current.compose(this.position,this.quaternion,p.homeScale);}
   if(layoutBlend<1){const fromPosition=new T.Vector3(),fromQuaternion=new T.Quaternion(),fromScale=new T.Vector3();p.transitionFrom.decompose(fromPosition,fromQuaternion,fromScale);p.current.decompose(this.position,this.quaternion,new T.Vector3());this.position.lerpVectors(fromPosition,this.position,layoutBlend);this.quaternion.slerpQuaternions(fromQuaternion,this.quaternion,layoutBlend);p.current.compose(this.position,this.quaternion,p.homeScale);}
   p.batch.setMatrixAt(p.index,p.current);
  }
  for(const p of this.pieces){if(p.attachment&&p.visible){p.current.copy(p.attachment.current).multiply(p.attachment.home.clone().invert()).multiply(p.home);p.batch.setMatrixAt(p.index,p.current);}}
  for(const batch of this.batches)batch.instanceMatrix.needsUpdate=true;
 }
 highlight(part:string|null,piece:string|null){
  const key=`${part}:${piece}`;if(key===this.selectedKey)return;this.selectedKey=key;
  const white=new T.Color(0xffffff),active=new T.Color(0xffba78);
  for(const p of this.pieces)p.batch.setColorAt(p.index,(piece?(p.id===piece||p.attachment?.id===piece):p.part===part)?active:white);
  for(const b of this.batches)if(b.instanceColor)b.instanceColor.needsUpdate=true;
 }
 info(id:string):PieceInfo|null{const p=this.lookup.get(id);if(!p)return null;const item=p.attachment??p;return{id:item.id,part:item.part,name:item.name};}
 pick(ray:T.Raycaster):PieceInfo|null{
  this.root.updateWorldMatrix(true,true);
  // Raycasting uses updated instance bounds, not the original assembly bounds.
  for(const b of this.batches)b.computeBoundingSphere();
  for(const h of ray.intersectObjects(this.batches,false)){
   if(h.instanceId===undefined)continue;const id=h.object.userData.pieceIds[h.instanceId];const p=this.lookup.get(id);if(p?.visible)return this.info(id);
  }return null;
 }
 groupAnchor(part:string,progress:number){const target=this.groupCenters.get(part);if(!target)return null;return target.clone().multiplyScalar(progress);}
 fit(progress:number,aspect:number){
  const home=new T.Box3();for(const p of this.pieces)if(p.visible&&!p.attachment)home.union(p.localBox.clone().applyMatrix4(p.home));
  if(home.isEmpty())home.set(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1));
  const b=new T.Box3();for(const p of this.pieces)if(p.visible&&!p.attachment)b.union(p.localBox.clone().applyMatrix4(p.current));if(b.isEmpty())b.copy(home);
  const size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());
  const halfFov=34*Math.PI/360;
  const dist=(Math.max(size.y/2,size.x/(2*Math.max(.2,aspect)))/Math.tan(halfFov)+size.z/2+2)*1.13;
  return {center,distance:Math.max(8,dist),bounds:b};
 }
 dispose(){for(const m of this.materials)m.dispose();for(const b of this.batches){b.dispose();this.root.remove(b);}this.pieces.length=0;this.lookup.clear();}
}

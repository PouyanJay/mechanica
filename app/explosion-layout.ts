/** Non-overlapping inventory cells, measured from each piece's displayed bounds. */
export type InventoryItem = { id:string; width:number; height:number; group:string };
export type InventoryCell = { x:number; y:number; width:number; height:number };
export function packInventory(items:InventoryItem[], aspect:number, gap:number){
 const cells=new Map<string,InventoryCell>();
 if(!items.length)return {cells,width:1,height:1};
 const cards=items.map(item=>({...item,width:Math.max(.085,item.width)+gap,height:Math.max(.085,item.height)+gap}));
 const area=cards.reduce((a,c)=>a+c.width*c.height,0);
 // Tall pieces lead each shelf. Stable ties keep layouts repeatable when reassembled.
 cards.sort((a,b)=>b.height-a.height||a.group.localeCompare(b.group)||a.id.localeCompare(b.id));
 const widthTarget=Math.max(...cards.map(c=>c.width),Math.sqrt(area*Math.max(.25,Math.min(4,aspect)))*1.07);
 let rowY=0,rowHeight=0,cursor=0,width=0;
 for(const card of cards){
  if(cursor&&cursor+card.width>widthTarget){rowY+=rowHeight;cursor=0;rowHeight=0;}
  cells.set(card.id,{x:cursor+card.width/2,y:-(rowY+card.height/2),width:card.width,height:card.height});
  cursor+=card.width;rowHeight=Math.max(rowHeight,card.height);width=Math.max(width,cursor);
 }
 const height=rowY+rowHeight;
 for(const cell of cells.values()){cell.x-=width/2;cell.y+=height/2;}
 return {cells,width,height};
}

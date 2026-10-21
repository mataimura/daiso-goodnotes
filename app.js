import {detectScreen,rectify,extractInk,traceStrokes,OUTPUT_W,OUTPUT_H} from './pipeline.js';
import {exportGoodnotes} from './goodnotes.js';

const el=id=>document.getElementById(id);
const photoCanvas=el('photo-canvas'),pc=photoCanvas.getContext('2d',{willReadFrequently:true});
const outCanvas=el('preview-canvas'),oc=outCanvas.getContext('2d');
let srcCanvas=null,srcImage=null,quad=null,editMode=false,dragIndex=-1;
let createdFile=null,createdURL=null,fileBase='DAISO_ink';
const tick=()=>new Promise(r=>setTimeout(r,35));
function setStatus(where,message,kind=''){
  where.textContent=message;where.className=`status ${kind}`;
}
function setBusy(b){
  el('convert').disabled=b;el('auto-detect').disabled=b;el('edit-corners').disabled=b;
  el('photo-input').disabled=b;
}
function validateQuad(pts,w,h){
  if(pts?.length!==4||pts.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>w||p.y>h))
    throw new Error('四隅が画像の外にあります');
  const area=pts.reduce((s,p,i)=>s+p.x*pts[(i+1)%4].y-pts[(i+1)%4].x*p.y,0)/2;
  if(area<w*h*.09)throw new Error('囲んだ画面が小さすぎます');
}
function drawPhoto(){
  if(!srcCanvas)return;
  photoCanvas.width=srcCanvas.width;photoCanvas.height=srcCanvas.height;
  pc.drawImage(srcCanvas,0,0);
  if(!quad)return;
  pc.lineWidth=Math.max(4,photoCanvas.width/170);pc.strokeStyle='#24b7aa';
  pc.fillStyle='rgba(17,190,173,.08)';pc.beginPath();pc.moveTo(quad[0].x,quad[0].y);
  for(let i=1;i<4;i++)pc.lineTo(quad[i].x,quad[i].y);pc.closePath();pc.fill();pc.stroke();
  const rr=Math.max(9,photoCanvas.width/75);
  for(let i=0;i<4;i++){
    const p=quad[i];pc.beginPath();pc.arc(p.x,p.y,rr,0,Math.PI*2);
    pc.fillStyle=editMode?'#f5c76c':'#fff';pc.fill();pc.strokeStyle='#188579';pc.stroke();
    pc.fillStyle='#12453f';pc.font=`bold ${Math.round(rr*1.3)}px -apple-system,sans-serif`;
    pc.textAlign='center';pc.textBaseline='middle';pc.fillText(String(i+1),p.x,p.y);
  }
}
async function readFileImage(file){
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;
    await img.decode();
    if(img.naturalWidth<50||img.naturalHeight<50)throw new Error('画像を読み込めません');
    const maxSide=2300,scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas;
  }finally{URL.revokeObjectURL(url);}
}
function guessQuad(w,h){return [{x:.11*w,y:.11*h},{x:.80*w,y:.10*h},{x:.86*w,y:.84*h},{x:.09*w,y:.85*h}];}
async function autoDetect(){
  const w=srcCanvas.width,h=srcCanvas.height;
  const scale=Math.min(1,970/h),det=document.createElement('canvas');
  det.width=Math.round(w*scale);det.height=Math.round(h*scale);
  const dc=det.getContext('2d',{willReadFrequently:true});
  dc.drawImage(srcCanvas,0,0,det.width,det.height);
  const r=detectScreen(dc.getImageData(0,0,det.width,det.height));
  const sx=w/det.width,sy=h/det.height;
  const points=r.quad.map(p=>({x:p.x*sx,y:p.y*sy}));
  validateQuad(points,w,h);
  quad=points;editMode=false;photoCanvas.classList.remove('adjust');
  drawPhoto();
  setStatus(el('crop-status'),'自動検出しました。四隅が液晶の内側に沿っているか確認してください。');
}

el('photo-input').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  fileBase=(file.name.replace(/\.[^.]+$/,'').replace(/[^\w\-\u3040-\u30ff\u3400-\u9fff]/g,'_')||'DAISO')+'_ink';
  el('filename').textContent=file.name;
  el('crop-panel').hidden=false;el('result-panel').hidden=true;
  setStatus(el('crop-status'),'写真を読み込んでいます...');
  try{
    srcCanvas=await readFileImage(file);
    srcImage=srcCanvas.getContext('2d').getImageData(0,0,srcCanvas.width,srcCanvas.height);
    quad=guessQuad(srcCanvas.width,srcCanvas.height);drawPhoto();await tick();
    try{await autoDetect();}
    catch(ex){
      quad=guessQuad(srcCanvas.width,srcCanvas.height);editMode=true;
      photoCanvas.classList.add('adjust');drawPhoto();
      setStatus(el('crop-status'),`自動検出できませんでした。黄色の四隅を指で調整してください：${ex.message}`,'warning');
    }
  }catch(ex){srcCanvas=null;quad=null;el('crop-panel').hidden=true;
    setStatus(el('crop-status'),`写真を開けませんでした：${ex.message}`,'error');
    alert('写真を読み込めません。iPhoneの写真アプリからJPEGで共有する方法も試してください。\n'+ex.message);
  }
});
el('auto-detect').addEventListener('click',async()=>{
  if(!srcCanvas)return;
  try{await autoDetect();}catch(ex){setStatus(el('crop-status'),`${ex.message}。「四隅を修正」から調整してください。`,'warning');}
});
el('edit-corners').addEventListener('click',()=>{
  if(!quad)return;
  editMode=!editMode;photoCanvas.classList.toggle('adjust',editMode);
  el('edit-corners').textContent=editMode?'✓ 四隅の調整を終える':'✎ 四隅を修正';
  if(editMode)setStatus(el('crop-status'),'丸印を指でドラッグして、液晶の内側四隅に合わせてください。','warning');
  else setStatus(el('crop-status'),'位置を確定しました。変換を実行できます。');
  drawPhoto();
});
function screenXY(e){
  const r=photoCanvas.getBoundingClientRect();
  // object-fit canvas size matches bounding rect aspect from CSS max-height.
  return {x:(e.clientX-r.left)*photoCanvas.width/r.width,
    y:(e.clientY-r.top)*photoCanvas.height/r.height};
}
photoCanvas.addEventListener('pointerdown',e=>{
  if(!editMode||!quad)return;
  const p=screenXY(e);let best=1e9,besti=-1;
  for(let i=0;i<4;i++){const d=Math.hypot(p.x-quad[i].x,p.y-quad[i].y);if(d<best){best=d;besti=i;}}
  if(best<photoCanvas.width*.19){dragIndex=besti;photoCanvas.setPointerCapture(e.pointerId);e.preventDefault();}
});
photoCanvas.addEventListener('pointermove',e=>{
  if(dragIndex<0||!editMode)return;
  const p=screenXY(e);quad[dragIndex]={x:Math.max(0,Math.min(srcCanvas.width,p.x)),y:Math.max(0,Math.min(srcCanvas.height,p.y))};
  drawPhoto();e.preventDefault();
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])
  photoCanvas.addEventListener(type,()=>{dragIndex=-1;});
el('sensitivity').addEventListener('input',()=>{
  const v=+el('sensitivity').value;el('sensitivity-label').textContent=(v===9?'標準':v<9?'高感度':'低感度')+`（${v}）`;
});
function renderInk(strokeData){
  const {page,strokes}=strokeData;
  outCanvas.width=page.width;outCanvas.height=page.height;
  oc.fillStyle='white';oc.fillRect(0,0,page.width,page.height);
  oc.strokeStyle='#141b1c';oc.fillStyle='#141b1c';oc.lineCap='round';oc.lineJoin='round';
  for(const s of strokes){
    if(s.points.length<2)continue;
    oc.lineWidth=Math.max(.8,s.mean_width*.68);
    oc.beginPath();oc.moveTo(s.points[0].x,s.points[0].y);
    for(const p of s.points.slice(1))oc.lineTo(p.x,p.y);
    oc.stroke();
  }
}
const canvasBlob=(canvas,type,quality)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('サムネイル保存失敗')),type,quality));
el('convert').addEventListener('click',async()=>{
  if(!srcImage||!quad)return;
  setBusy(true);el('result-panel').hidden=true;
  try{
    validateQuad(quad,srcImage.width,srcImage.height);
    setStatus(el('crop-status'),'1/4　盤面をまっすぐに補正しています...');await tick();
    const rectified=rectify(srcImage,quad);
    setStatus(el('crop-status'),'2/4　青緑の筆跡を抽出しています...');await tick();
    const low=+el('sensitivity').value;
    const ink=extractInk(rectified,{low,high:Math.max(low+9,Math.round(low*2.67))});
    setStatus(el('crop-status'),'3/4　編集可能な線を復元しています...');await tick();
    const strokeData=traceStrokes(ink);
    renderInk(strokeData);
    setStatus(el('crop-status'),'4/4　Goodnotesファイルを作成しています...');await tick();
    // Use preview as the thumbnail in a valid JPEG (not a ZIP blob).
    const thumbCanvas=document.createElement('canvas');
    thumbCanvas.width=320;thumbCanvas.height=Math.round(320*strokeData.page.height/strokeData.page.width);
    thumbCanvas.getContext('2d').drawImage(outCanvas,0,0,thumbCanvas.width,thumbCanvas.height);
    const thumb=await canvasBlob(thumbCanvas,'image/jpeg',.85);
    const res=await exportGoodnotes(strokeData,thumb,{widthGain:.24,title:'DAISO 手書きメモ'});
    createdFile=new File([res.blob],`${fileBase}.goodnotes`,{type:'application/octet-stream'});
    if(createdURL)URL.revokeObjectURL(createdURL);
    createdURL=URL.createObjectURL(res.blob);
    el('result-panel').hidden=false;
    setStatus(el('result-status'),`変換できました。${res.strokes}本の編集可能な擬似ストローク（約${Math.round(res.blob.size/1024)}KB）。Goodnotesへの取り込み後、投げ縄と消しゴムを確認してください。`);
    setStatus(el('crop-status'),'変換完了。下にスクロールしてGoodnotesに共有できます。');
    el('result-panel').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(ex){setStatus(el('crop-status'),`変換に失敗しました：${ex.message}`,'error');console.error(ex);}
  finally{setBusy(false);}
});
el('share').addEventListener('click',async()=>{
  if(!createdFile)return;
  try{
    if(navigator.canShare?.({files:[createdFile]})&&navigator.share){
      await navigator.share({files:[createdFile],title:'DAISO 手書きメモ'});
    }else{
      downloadFile();setStatus(el('result-status'),'共有メニューが利用できないためファイルを保存しました。Goodnotesから「読み込む」を選んでください。','warning');
    }
  }catch(ex){if(ex.name!=='AbortError')setStatus(el('result-status'),`共有できませんでした。「ファイル保存」を試してください：${ex.message}`,'warning');}
});
function downloadFile(){
  if(!createdFile||!createdURL)return;
  const a=document.createElement('a');a.href=createdURL;a.download=createdFile.name;document.body.appendChild(a);a.click();a.remove();
}
el('download').addEventListener('click',downloadFile);
if('serviceWorker'in navigator&&location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

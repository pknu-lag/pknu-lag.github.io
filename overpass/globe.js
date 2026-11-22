// Reproject the two registered geographic rasters onto a shared orthographic disc.
const Globe = (() => {
  const W = 720, H = 360, rad = Math.PI / 180;
  const rainColors = [0,0xffc0a04d,0xffffdc8d,0xffefb6ff,0xffffa5dc,0xfffcf3ef];
  const wrap = lon => ((lon+180)%360+360)%360-180;
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  function texture(image) {
    const c=document.createElement('canvas'); c.width=W;c.height=H;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0,W,H);
    return new Uint32Array(ctx.getImageData(0,0,W,H).data.buffer);
  }
  // Consecutive catalog half-orbits overlap at the poles. Use their shared
  // midpoint as the estimated turnaround and anchor longitude at the equator.
  function track(pair) {
    const tilt=98.12*rad;
    return pair.passes.map((p,i,list)=>{
      const start=Date.parse(p.start), end=Date.parse(p.end);
      const prior=i?Date.parse(list[i-1].end):start+250000;
      const next=i+1<list.length?Date.parse(list[i+1].start):end-250000;
      const a=prior>=start && prior<end?(prior+start)/2:start;
      const b=next<=end && next>start?(end+next)/2:end;
      const node=p.centerline.find(point=>point[1]===0)[0];
      function position(f){
        const asc=p.phase==='pm', mid=asc?0:Math.PI;
        const u=mid+(f-.5)*Math.PI;
        const delta=Math.atan2(Math.cos(tilt)*Math.sin(u),Math.cos(u))-mid;
        return [wrap(node+delta/rad-(f-.5)*(b-a)*360/86164000),Math.asin(Math.sin(tilt)*Math.sin(u))/rad];
      }
      return {...p,a,b,position};
    });
  }
  function newTrail(pair,passes) {
    const images={am:texture(pair.am),pm:texture(pair.pm)}, pixels=new Uint32Array(W*H);
    const rows=[], sinTilt=Math.sin(98.12*rad);
    for(const pass of passes){
      for(let row=0;row<H;row++){
        const lat=90-(row+.5)*180/H, sine=Math.sin(lat*rad)/sinTilt;
        if(Math.abs(sine)>1)continue;
        const limits=SwathTrail.front(pass,lat);
        if(!limits)continue;
        const f=.5+(pass.phase==='pm'?1:-1)*Math.asin(sine)/Math.PI;
        const left=Math.ceil((limits[0]+180)*W/360-.5),right=Math.floor((limits[1]+180)*W/360-.5);
        rows.push({time:pass.a+(pass.b-pass.a)*f,phase:pass.phase,row,left,right});
      }
    }
    rows.sort((a,b)=>a.time-b.time);
    let cursor=0,last=-Infinity;
    function seek(time){
      if(time<last){pixels.fill(0);cursor=0;}
      while(cursor<rows.length && rows[cursor].time<=time){
        const {row,left,right,phase}=rows[cursor++];
        for(let x=left;x<=right;x++){
          const index=row*W+(x+W)%W;
          const value=images[phase][index];
          if(value>>>24) pixels[index]=value;
        }
      }
      last=time;
    }
    return {pixels,seek};
  }
  function create(canvas,terrain) {
    const ctx=canvas.getContext('2d'), base=texture(terrain);
    let size=0,geo,rainGrid,image,output,lon=120,lat=26,split=.5,zoom=1;
    function projectMap(){
      const centerLat=lat*rad,sy=Math.sin(centerLat),cy=Math.cos(centerLat);
      geo.fill(-1);
      for(let row=0;row<size;row++){
        const y=(1-(row+.5)*2/size)/zoom;
        for(let col=0;col<size;col++){
          const x=((col+.5)*2/size-1)/zoom, z2=1-x*x-y*y;
          if(z2<0)continue;
          const z=Math.sqrt(z2),pos=row*size+col;
          const latitude=Math.asin(clamp(y*cy+z*sy,-1,1))/rad;
          const longitude=wrap(lon+Math.atan2(x,z*cy-y*sy)/rad);
          const gx=clamp(Math.floor((longitude+180)*2),0,W-1),gy=clamp(Math.floor((90-latitude)*2),0,H-1);
          geo[pos]=gy*W+gx;
          const rx=clamp(Math.floor((longitude+180)*4),0,1439);
          const ry=clamp(Math.floor((90-latitude)*4),0,719);
          rainGrid[pos]=ry*1440+rx;
        }
      }
    }
    function resize(){
      const desired=clamp(Math.round(canvas.clientWidth*Math.min(devicePixelRatio,1.35)),240,600);
      if(desired===size)return;
      size=canvas.width=canvas.height=desired;
      image=ctx.createImageData(size,size); output=new Uint32Array(image.data.buffer);
      geo=new Int32Array(output.length);rainGrid=new Int32Array(output.length);
      projectMap();
    }
    function center(x,y){
      const nextLon=wrap(x),nextLat=clamp(y,-89.8,89.8);
      if(nextLon===lon && nextLat===lat)return;
      lon=nextLon;lat=nextLat;projectMap();
    }
    function setZoom(value){
      const next=clamp(value,1,4);
      if(next!==zoom){zoom=next;output.fill(0);projectMap();}
      return zoom;
    }
    function project(point){
      const a=(point[0]-lon)*rad,b=point[1]*rad,c=lat*rad;
      const z=Math.sin(b)*Math.sin(c)+Math.cos(b)*Math.cos(a)*Math.cos(c);
      return {x:(1+zoom*Math.cos(b)*Math.sin(a))*size/2,
        y:(1-zoom*(Math.sin(b)*Math.cos(c)-Math.cos(b)*Math.cos(a)*Math.sin(c)))*size/2,front:z>0};
    }
    function draw(trail,rain,pass,f) {
      resize();
      const boundary=Math.round(size*split);
      for(let y=0,i=0;y<size;y++){
        for(let x=0;x<size;x++,i++){
          const g=geo[i];
          if(g<0)continue;
          const color=x<boundary?trail?.pixels[g]:rainColors[rain?.[rainGrid[i]]];
          output[i]=color || base[g];
        }
      }
      ctx.putImageData(image,0,0);
      if(!pass)return;
      ctx.save();ctx.scale(size/canvas.clientWidth,size/canvas.clientWidth);
      const ratio=canvas.clientWidth/size;
      ctx.beginPath();let visible=false;
      for(let i=0;i<=140;i++){
        const p=project(pass.position(i/140));
        if(p.front){if(visible)ctx.lineTo(p.x*ratio,p.y*ratio);else ctx.moveTo(p.x*ratio,p.y*ratio);}
        visible=p.front;
      }
      ctx.strokeStyle='rgba(249,252,245,.77)';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);
      const mark=project(pass.position(f));
      if(mark.front){
        ctx.translate(mark.x*ratio,mark.y*ratio);ctx.rotate(-.43);ctx.lineWidth=1.5;ctx.strokeStyle='#18343f';
        ctx.fillStyle='#bbebf5';for(const x of [-12,4]){ctx.fillRect(x,-3,8,6);ctx.strokeRect(x,-3,8,6);}
        ctx.fillStyle='#fff8d6';ctx.fillRect(-4,-5,8,10);ctx.strokeRect(-4,-5,8,10);
      }
      ctx.restore();return mark.front;
    }
    resize();
    return {draw,center,resize,setZoom,get zoom(){return zoom;},rotate(dx,dy){center(lon-dx/zoom,lat+dy/zoom);},
      divide(f){split=f;},view(){return [lon,lat];}};
  }
  return {create,track,newTrail,clamp};
})();

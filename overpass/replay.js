(async () => {
  if (location.hash === '#boseong-seasons') {
    location.replace('research.html#boseong-seasons');
    return;
  }
  const $=s=>document.getElementById(s);
  const canvas=$('earth'),seam=$('seam'),seek=$('seek'),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const DAY=86400000, SLOT=1800000, speed=240;
  let playing=!motion.matches, onScreen=true, seconds=0, dayStart, passes=[],trail,frames,active=null;
  let generation=0,frameId=0,previous=0, split=.5,pointer=null,pendingRotate=null,sourceDate='';
  let following=false;
  const terrain=new Image();terrain.src='img/smap-terrain.webp';await terrain.decode();
  const globe=Globe.create(canvas,terrain);
  function selectPass(time){return passes.find(p=>p.a<=time && time<p.b);}
  function redraw(){
    if(!frames){globe.draw();return;}
    const time=dayStart+seconds*1000,slot=Math.min(47,Math.floor(seconds/1800));
    const pass=selectPass(time),f=pass?(time-pass.a)/(pass.b-pass.a):0;
    trail.seek(time);active=pass?pass.position(f):null;
    if(following && active)centerOnSatellite();
    const visible=globe.draw(trail,frames[slot],pass,f);
    const stamp=new Date(time).toISOString(),clock=stamp.slice(11,16);
    $('utc').textContent=clock+' UTC';$('utc').dataset.utc=stamp;
    seek.value=String(Math.floor(seconds));seek.setAttribute('aria-valuetext',clock+' UTC');
    seek.style.setProperty('--played', (seconds / Number(seek.max) * 100).toFixed(2) + '%');
    const label=pass?'SMAP orbit '+pass.orbit+' · '+(pass.phase==='am'?'descending':'ascending')+(visible?'':' · far side'):'SMAP · between archived passes';
    $('orbit-info').textContent=label;$('locate').disabled=!active && !following;
    const start=dayStart+slot*SLOT;
    $('rain-info').textContent='IMERG '+new Date(start).toISOString().slice(11,16)+'–'+new Date(start+SLOT).toISOString().slice(11,16)+' UTC';
    $('rain-info').dataset.start=new Date(start).toISOString();
  }
  function tick(now){
    frameId=0;if(!frames||!onScreen||document.hidden||!playing){previous=0;return;}
    if(!previous)previous=now;
    if(now-previous>=64){
      seconds=(seconds+(now-previous)/1000*speed)%86400;
      previous=now;redraw();
    }
    frameId=requestAnimationFrame(tick);
  }
  function schedule(){if(!frameId && playing && onScreen && !document.hidden && frames)frameId=requestAnimationFrame(tick);}
  function setPlaying(value){
    playing=value;previous=0;
    $('play').dataset.playing=String(value);
    $('play').title=value?'Pause replay':'Play replay';
    $('play').setAttribute('aria-label',$('play').title);
    if(!value && frameId){cancelAnimationFrame(frameId);frameId=0;}schedule();
  }
  function seekTo(value){setPlaying(false);seconds=Globe.clamp(value,0,86399);redraw();}
  $('play').onclick=()=>setPlaying(!playing);
  seek.oninput=()=>seekTo(Number(seek.value));
  seek.addEventListener('keydown',e=>{
    const step={ArrowLeft:-60,ArrowRight:60,PageDown:-1800,PageUp:1800}[e.key];
    if(step){e.preventDefault();seekTo(seconds+step);}
  });
  $('back').onclick=()=>seekTo(seconds-1800);$('next').onclick=()=>seekTo(seconds+1800);
  // Frame the spacecraft just left of the comparison seam, even at maximum zoom.
  function centerOnSatellite(){globe.center(active[0]+16/globe.zoom,active[1]);}
  function setFollowing(value){
    following=value;
    $('locate-label').textContent=value?'Following SMAP':'Locate SMAP';
    $('locate').setAttribute('aria-pressed',String(value));
  }
  $('locate').onclick=()=>{setFollowing(!following);redraw();};
  function zoomBy(factor){
    const level=globe.setZoom(globe.zoom*factor);
    $('zoom-level').value=Number(level.toFixed(2))+'×';
    $('zoom-in').disabled=level===4;
    $('zoom-out').disabled=level===1;
    redraw();
  }
  $('zoom-in').onclick=()=>zoomBy(1.25);
  $('zoom-out').onclick=()=>zoomBy(1/1.25);
  let wheelDelta=0,wheelFrame=0;
  canvas.parentElement.addEventListener('wheel',event=>{
    if(!event.deltaY)return;
    event.preventDefault();
    const unit=event.deltaMode===1?16:event.deltaMode===2?canvas.clientHeight:1;
    wheelDelta+=event.deltaY*unit;
    if(!wheelFrame)wheelFrame=requestAnimationFrame(()=>{
      zoomBy(Math.exp(-Globe.clamp(wheelDelta,-1000,1000)*.002));
      wheelDelta=0;wheelFrame=0;
    });
  },{passive:false});
  canvas.onpointerdown=e=>{
    if(!e.isPrimary || e.button!==0)return;
    pointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);
  };
  function flushRotate(){
    if(!pendingRotate)return;
    const delta=pendingRotate;pendingRotate=null;
    setFollowing(false);
    globe.rotate(delta.x,delta.y);redraw();
  }
  canvas.onpointermove=e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    const scale=135/canvas.clientWidth,dx=(e.clientX-pointer.x)*scale,dy=(e.clientY-pointer.y)*scale;
    if(!dx && !dy)return;
    pointer.x=e.clientX;pointer.y=e.clientY;
    if(pendingRotate){pendingRotate.x+=dx;pendingRotate.y+=dy;}
    else {pendingRotate={x:dx,y:dy};requestAnimationFrame(flushRotate);}
  };
  canvas.onlostpointercapture=()=>{pointer=null;};
  canvas.onkeydown=e=>{
    const delta={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,10],ArrowDown:[0,-10]}[e.key];
    if(delta){e.preventDefault();setFollowing(false);globe.rotate(...delta);redraw();}
  };
  function setSplit(value){split=Globe.clamp(value,.05,.95);globe.divide(split);seam.style.left=split*100+'%';seam.setAttribute('aria-valuenow',Math.round(split*100));redraw();}
  function shift(e){const r=canvas.getBoundingClientRect();setSplit((e.clientX-r.left)/r.width);}
  seam.onpointerdown=e=>{if(e.isPrimary&&e.button===0){seam.setPointerCapture(e.pointerId);shift(e);}};
  seam.onpointermove=e=>{if(seam.hasPointerCapture(e.pointerId))shift(e);};
  seam.onkeydown=e=>{
    const value={ArrowLeft:split-.02,ArrowRight:split+.02,Home:.05,End:.95}[e.key];
    if(value!==undefined){e.preventDefault();setSplit(value);}
  };
  new ResizeObserver(()=>{globe.resize();redraw();}).observe(canvas);
  new IntersectionObserver(([entry])=>{onScreen=entry.isIntersecting;previous=0;schedule();}).observe(canvas);
  motion.addEventListener('change',e=>setPlaying(!e.matches));
  document.addEventListener('visibilitychange',()=>{previous=0;schedule();});
  // Accept a newer clock only after all 48 of its half-hour grids decode.
  const verified=new Map();
  async function getDay(date){
    if(verified.has(date))return verified.get(date);
    const start=Date.parse(date),result=new Array(48);
    let index=0;
    async function worker(){
      while(index<48){
        const i=index++,at=start+i*SLOT,frame=await RainFeed.load(date,at);
        if(!frame || Date.parse(frame.start)!==at)throw new Error('Incomplete IMERG day');
        result[i]=frame.pixels;
      }
    }
    await Promise.all(Array.from({length:4},worker));
    verified.set(date,result);return result;
  }
  SmapFeed.load(async pair=>{
    const key=++generation;
    try{
      const grids=await getDay(pair.date);
      if(key!==generation || (sourceDate && pair.date<=sourceDate))return;
      const isFirst=!sourceDate;
      sourceDate=pair.date;dayStart=Date.parse(pair.date);passes=Globe.track(pair);trail=Globe.newTrail(pair,passes);
      frames=grids;seconds=0;
      $('date').textContent=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(dayStart);
      $('date').dateTime=pair.date;
      for(const id of ['back','next','play','seek'])$(id).disabled=false;
      redraw();if(isFirst && active){centerOnSatellite();redraw();}setPlaying(playing);
      for(const date of verified.keys())if(date<pair.date)verified.delete(date);
    }catch{if(!frames)$('date').textContent='Observation day unavailable';}
  },getDay);
})().catch(()=>{document.getElementById('date').textContent='Unable to load observations';});

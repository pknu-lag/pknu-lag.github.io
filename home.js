(() => {
  const figure = document.querySelector('.pass-map');
  const profile = document.querySelector('.profile-column');
  const reveal = new IntersectionObserver(([entry]) => {
    if(entry.isIntersecting) { profile.classList.add('in-view'); reveal.disconnect(); }
  });
  reveal.observe(profile);
  const canvas = document.querySelector('#track-map');
  const context = canvas.getContext('2d');
  if (!context || !window.SmapFeed) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.querySelector('#toggle-replay');
  const tag = document.querySelector('#track-sample');
  const apiDate = new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
  const base = new Image();
  base.src = 'img/smap-terrain.webp';
  let pair, trail, passes, passIndex = 0, fraction = 0;
  let sampledLabels = [];
  let view, rainFrame=null, rainLayer, paintedFrom=0;
  const rainWindow=document.querySelector('#rain-window');
  let width = 0, height = 0, pixelRatio = 1, visible = true;
  let playing = !motion.matches, raf = 0, lastFrame = 0, lastLabel = '', lastPass = '';
  const wrap = degrees => ((degrees + 180) % 360 + 360) % 360 - 180;
  const time = iso => iso.slice(11,16);
  const coordinates = (lon, lat) => Math.abs(lat).toFixed(1) + '°' + (lat < 0 ? 'S' : 'N')
    + '  ' + Math.abs(lon).toFixed(1) + '°' + (lon < 0 ? 'W' : 'E');

  function interpolate(line, progress) {
    const offset = Math.min(line.length - 1.000001, progress * (line.length - 1));
    const i = Math.floor(offset);
    const a=line[i], b=line[i+1], t=offset-i;
    return [wrap(a[0]+wrap(b[0]-a[0])*t), a[1]+(b[1]-a[1])*t];
  }

  // Start near the lab's region, at a point for which this day's map has a retrieval.
  function firstView() {
    let best = Infinity;
    passes.forEach((pass,index) => {
      for(let i=3; i<pass.centerline.length-3; i+=.25) {
        const position = i/(pass.centerline.length-1);
        const [lon,lat] = interpolate(pass.centerline,position);
        if(!pair.valueAt(pass.phase,lon,lat)) continue;
        let score = Math.hypot(wrap(lon-125)*.8,lat-38);
        // Prefer a land crossing near East Asia where a visitor can see
        // successive real observations during the opening few seconds.
        for(const lead of [.015,.03,.045,.06,.075]) {
          const [x,y]=interpolate(pass.centerline,position+lead);
          if(!pair.valueAt(pass.phase,x,y)) score+=4;
        }
        if(score<best) {
          best=score; passIndex=index; fraction=position;
        }
      }
    });
  }

  function revealRange(pass, from, to) {
    trail.advance(pass, from, to);
    // Keep the original bin at each marked point. Reproject its geographic
    // position whenever the camera moves. Empty cells carry no label.
    const count=24;
    for(let n=Math.floor(from*count)+1; n<=Math.floor(to*count); n++) {
      const [lon,lat]=interpolate(pass.centerline,n/count);
      const value=pair.valueAt(pass.phase,lon,lat);
      if(value) sampledLabels.push({lon,lat,value});
    }
  }

  function size() {
    width=figure.clientWidth;
    height=figure.clientHeight;
    pixelRatio=Math.min(devicePixelRatio || 1,1.6);
    canvas.width=Math.round(width*pixelRatio);
    canvas.height=Math.round(height*pixelRatio);
    const scale=Math.min(width/360,(height-18)/156);
    const centreY=width<700 ? 168+90*scale : height*.50;
    view={scale,left:(width-360*scale)/2,top:centreY-90*scale};
    buildRainLayer();
    draw();
  }

  let rainClock = 0;
  function buildRainLayer() {
    rainLayer = null;
    if (!rainFrame || !view) return;
    const unit = Math.min(1.2, Math.max(.48, view.scale / 3.2));
    const groups = new Map();
    for (const point of rainFrame.points) {
      const tier = point.lower >= 5 ? 2 : point.lower >= 1 ? 1 : 0;
      const snow = point.kind === 'snow';
      // Give neighbouring cells different phases, anchored to geographic coordinates.
      const phase = (Math.round((point.lon + 180) * 7 + (90 - point.lat) * 13) % 5) / 5;
      const key = [point.kind, tier, phase].join('/');
      if (!groups.has(key)) groups.set(key, {path: new Path2D(), snow, tier, phase});
      const path = groups.get(key).path;
      const x = view.left + (wrap(point.lon) + 180) * view.scale;
      const y = view.top + (90 - point.lat) * view.scale;
      if (snow) {
        const radius = (.85 + .26 * tier) * unit;
        path.moveTo(x + radius, y);
        path.arc(x, y, radius, 0, Math.PI * 2);
      } else {
        const length = (3.4 + 1.5 * tier) * unit;
        path.moveTo(x + .18 * length, y - .5 * length);
        path.lineTo(x - .18 * length, y + .5 * length);
      }
    }
    rainLayer = {groups, unit};
  }

  function drawPrecipitation(ctx) {
    if (!rainLayer) return;
    const {groups, unit} = rainLayer;
    for (const {path, tier, phase, snow} of groups.values()) {
      const t = (rainClock / (snow ? 1500 : 820) + phase) % 1;
      const fall = (t - .5) * unit * (snow ? 1.3 : 3);
      ctx.save();
      ctx.translate(-fall * .36, fall);
      ctx.globalAlpha = .58 + .36 * Math.sin(Math.PI * t);
      if (snow) {
        ctx.fillStyle = '#e4f3f8';
        ctx.fill(path);
      } else {
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(.75, unit * (1 + tier * .3));
        ctx.strokeStyle = ['#8ad0ea', '#a1e8ff', '#def8ff'][tier];
        ctx.stroke(path);
      }
      ctx.restore();
    }
  }

  function displayRain(frame) {
    rainFrame = frame;
    const start = new Date(frame.start);
    const date = start.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
    rainWindow.textContent = 'IMERG · '+date+' · '+time(frame.start)+'–'+time(frame.end)+' UTC';
    rainWindow.dateTime = frame.start;
    document.querySelector('#rain-origin').href = frame.source;
    buildRainLayer();
    draw();
  }

  function updateText(pass,lon,lat,pointX,pointY) {
    const stamp = pass.start;
    if(lastPass!==stamp) {
      document.querySelector('#pass-id').textContent = 'Orbit '+pass.orbit+'  /  '+(pass.phase==='am'?'Descending · AM':'Ascending · PM');
      document.querySelector('#pass-time').textContent = time(pass.start)+'–'+time(pass.end)+' UTC';
      document.querySelector('#map-origin').href=pair.source(pass.phase);
      lastPass=stamp;
    }
    const value=fraction>paintedFrom ? pair.valueAt(pass.phase,lon,lat) : null;
    const coord=coordinates(lon,lat);
    const key=coord+value+(fraction<=paintedFrom?'start':'');
    if(lastLabel!==key) {
      document.querySelector('#sample-value').textContent=value ? value+' cm³/cm³' : fraction<=paintedFrom ? 'Starting pass' : 'No retrieval';
      document.querySelector('#sample-location').textContent=coord;
      lastLabel=key;
    }
    tag.style.left=Math.round(Math.min(width-212,Math.max(0,pointX)))+'px';
    tag.style.top=Math.round(Math.max(30,Math.min(height-66,pointY)))+'px';
    tag.hidden=false;
    const start=Date.parse(pass.start), end=Date.parse(pass.end);
    const epoch=start+(end-start)*fraction;
    const dayFraction=(epoch-Date.parse(pair.date))/86400000;
    document.querySelector('#pass-progress').style.width=(Math.min(1,Math.max(0,dayFraction))*100)+'%';
  }

  function draw() {
    if(!trail || !width || !height) return;
    const pass=passes[passIndex];
    const [lon,lat]=interpolate(pass.centerline,fraction);
    const compact=width<700;
    const {left,top,scale}=view;
    const world=scale*360;
    const xAt=x=>left+(wrap(x)+180)*scale;
    const yAt=y=>top+(90-y)*scale;
    const pointX=xAt(lon);
    const ctx=context;
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    ctx.fillStyle='#192a2f';
    ctx.fillRect(0,0,width,height);
    ctx.drawImage(trail.canvas,left,top,world,180*scale);

    ctx.lineWidth=.65;
    ctx.strokeStyle='rgba(223,234,225,.22)';
    ctx.beginPath();
    const grid=compact?30:15;
    for(let x=-180;x<180;x+=grid) {ctx.moveTo(xAt(x),top);ctx.lineTo(xAt(x),top+180*scale);}
    for(let y=-60;y<=75;y+=grid) {ctx.moveTo(left,yAt(y));ctx.lineTo(left+world,yAt(y));}
    ctx.stroke();
    drawPrecipitation(ctx);

    function trace(points) {
      ctx.beginPath();
      let previous;
      for(const [lng,latitude] of points) {
        const x=xAt(lng),y=yAt(latitude);
        if(previous===undefined || Math.abs(previous-x)>world*.5) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        previous=x;
      }
    }
    trace(pass.centerline);
    ctx.setLineDash([5,6]);
    ctx.strokeStyle='#fff7cb';
    ctx.stroke();
    ctx.setLineDash([]);
    const y=yAt(lat);
    const front=trail.front(pass,lat);
    if(front) {
      const west=xAt(front[0]),east=west+(front[1]-front[0])*scale;
      const behind=pass.phase==='am'?-5:5;
      const fade=ctx.createLinearGradient(0,y,0,y+behind);
      fade.addColorStop(0,'rgba(215,245,255,.40)');fade.addColorStop(1,'rgba(215,245,255,0)');
      ctx.save();ctx.beginPath();ctx.rect(left,top,world,180*scale);ctx.clip();
      for(const shift of [0,-world]) {
        ctx.beginPath();ctx.moveTo(west+shift,y);ctx.lineTo(east+shift,y);
        ctx.lineWidth=1.6;ctx.strokeStyle='#f2fbff';ctx.stroke();
        ctx.fillStyle=fade;ctx.fillRect(west+shift,y,east-west,behind);
      }
      ctx.restore();
    }
    // A small spacecraft symbol stays anchored to the current scan line.
    ctx.save();ctx.translate(pointX,y);ctx.rotate(-.55);
    ctx.shadowColor='#0a252c';ctx.shadowBlur=5;ctx.strokeStyle='#17272b';ctx.lineWidth=2.3;
    ctx.fillStyle='white';ctx.fillRect(-6,-5,12,10);ctx.strokeRect(-6,-5,12,10);
    ctx.fillStyle='#9bc5d4';ctx.fillRect(6,-4,14,8);ctx.strokeRect(6,-4,14,8);
    ctx.beginPath();ctx.moveTo(-5,-3);ctx.lineTo(-12,-10);ctx.moveTo(-17,-11);ctx.quadraticCurveTo(-12,-4,-6,-11);
    ctx.strokeStyle='#fafdfd';ctx.stroke();ctx.restore();

    const shown=[];
    ctx.font='12px Arial';
    for(let i=sampledLabels.length-1;i>=0 && shown.length<(compact?2:5);i--) {
      const seen=sampledLabels[i],x=xAt(seen.lon),row=yAt(seen.lat);
      if(x<width*(compact?.04:.48)||x>width-95||row<height*(compact?.34:.09)||row>height*.88) continue;
      if(Math.abs(x-pointX)<165 && Math.abs(row-y)<75) continue;
      if(shown.some(p=>Math.abs(x-p.x)<110 && Math.abs(row-p.row)<38)) continue;
      shown.push({x,row});
      ctx.fillStyle='#e8f3f5';ctx.fillRect(x-1.5,row-1.5,3,3);
      ctx.lineWidth=3;ctx.strokeStyle='#253439';ctx.strokeText(seen.value,x+5,row-2);ctx.fillText(seen.value,x+5,row-2);
    }

    const cities=[['Busan',129.08,35.18],['Tokyo',139.69,35.68],['Beijing',116.41,39.90],['Jakarta',106.85,-6.21],['Sydney',151.21,-33.87],['Nairobi',36.82,-1.29],['Denver',-104.99,39.74],['Lima',-77.04,-12.05],['Paris',2.35,48.86]];
    ctx.font='12px Arial';
    cities.forEach(([name,lng,latitude])=>{
      if(compact && !['Busan','Nairobi','Lima'].includes(name)) return;
      const x=xAt(lng),yCity=yAt(latitude);
      if(x<18||x>width-65||yCity<24||yCity>height-18||Math.hypot(x-pointX,yCity-y)<40) return;
      ctx.fillStyle='#edf5f2';ctx.fillRect(x-1.5,yCity-1.5,3,3);
      ctx.strokeStyle='#1e3033';ctx.lineWidth=3;ctx.strokeText(name,x+6,yCity-2);ctx.fillText(name,x+6,yCity-2);
    });
    const reading=interpolate(pass.centerline,Math.max(paintedFrom,fraction-.0015));
    updateText(pass,reading[0],reading[1],pointX,y);
  }

  function step(now) {
    if(!playing || !visible || document.hidden || !trail) {raf=0; lastFrame=0; return;}
    if(!lastFrame || now-lastFrame>=40) {
      if(lastFrame) {
        // Each complete half-pass takes 32 seconds on screen. Polar ends
        // outside the catalog-derived centreline are omitted.
        const elapsed = Math.min(now - lastFrame, 200);
        if (!motion.matches) rainClock += elapsed;
        const next = fraction + elapsed / 32000;
        revealRange(passes[passIndex],fraction,Math.min(next,1));
        fraction=next;
        if(fraction>=1) {
          fraction%=1; passIndex=(passIndex+1)%passes.length;
          paintedFrom=0;
          if(passIndex===0) {trail.reset(); sampledLabels=[];}
          revealRange(passes[passIndex],0,fraction);
        }
      }
      draw();
      lastFrame=now;
    }
    raf=requestAnimationFrame(step);
  }
  function resumeIfVisible() {
    if(!raf && playing && visible && !document.hidden && trail) raf=requestAnimationFrame(step);
  }
  function setPlaying(value) {
    playing=value;
    toggle.textContent=value?'Pause':'Play';
    toggle.setAttribute('aria-label',value?'Pause pass replay':'Play pass replay');
    lastFrame=0;
    resumeIfVisible();
  }
  toggle.addEventListener('click',()=>setPlaying(!playing));
  motion.addEventListener('change',e=>setPlaying(!e.matches));
  document.addEventListener('visibilitychange',resumeIfVisible);
  new ResizeObserver(size).observe(figure);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;resumeIfVisible();}).observe(figure);
  window.RainFeed.watchLatest(displayRain, status => {
    document.querySelector('#rain-status').textContent = 'IMERG: '+status+'.';
    if (!rainFrame && status.includes('unavailable')) rainWindow.textContent = 'IMERG unavailable';
  });
  base.decode().then(()=>{
    window.SmapFeed.load(data=>{
      pair=data;
      passes=data.passes;
      trail=window.SwathTrail.create(data,base);
      sampledLabels=[];
      passIndex=0;fraction=0;lastPass='';lastLabel='';
      firstView();
      paintedFrom=fraction;
      const dateLabel = document.querySelector('#observed-day');
      dateLabel.dateTime = pair.date;
      dateLabel.textContent = apiDate.format(new Date(pair.date));
      toggle.hidden=false;
      setPlaying(playing);
      size();
    });
  }).catch(()=>{});
})();

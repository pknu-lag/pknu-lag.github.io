/* IMERG V07 multisatellite half-hour precipitation rate, NASA GIBS. The
   replay uses the half-hour interval containing the SMAP replay clock.
   The displayed grid is sampled at one degree from the 0.1° science product. */
window.RainFeed = (() => {
  const width=360, height=180, halfHour=1800000, dayMs=86400000;
  const offlineFirst=Date.parse('2026-11-17T22:30:00Z'), slotsInAtlas=52;
  const layer='IMERG_Precipitation_Rate_30min';
  const gibs='https://gibs.earthdata.nasa.gov';
  const frames=new Map(), pending=new Map();
  let atlasPromise, palettePromise, domainPromise, domainChecked=0;

  function slot(date,utc) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const day=Date.parse(date+'T00:00:00Z');
    let clock;
    if (typeof utc === 'number') clock=utc;
    else if (typeof utc === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(utc)) clock=Date.parse(date+'T'+utc+'Z');
    else clock=utc instanceof Date ? utc.getTime() : Date.parse(utc);
    // First and last catalogued half-orbits can straddle UTC midnight.
    if (!Number.isFinite(day) || !Number.isFinite(clock) || clock<day-2*3600000 || clock>day+dayMs+2*3600000) return null;
    return new Date(Math.floor(clock/halfHour)*halfHour).toISOString();
  }

  function query(base,args) {return base+'?'+new URLSearchParams(args);}

  async function request(url,type) {
    const resp=await fetch(url,{cache:type==='text'?'no-cache':'default',signal:AbortSignal.timeout(10000)});
    if (!resp.ok) throw new Error('IMERG resource unavailable');
    return resp[type]();
  }

  function imageAt(url) {
    return new Promise((resolve,reject) => {
      const img=new Image();
      if (url.startsWith('https:')) img.crossOrigin='anonymous';
      const deadline=setTimeout(()=>done(false),12000);
      function done(ok) {
        clearTimeout(deadline);
        img.onload=img.onerror=null;
        if (ok) resolve(img);
        else reject(new Error('IMERG image unavailable'));
      }
      img.onload=()=>done(true);
      img.onerror=()=>done(false);
      img.src=url;
    });
  }

  function palette() {
    if (!palettePromise) palettePromise=request('img/imerg-palette.json','json').then(rows => {
      const bins=[null],index=new Map();
      for (const [rgb,kind,lower,upper] of rows) {
        index.set(rgb,bins.length);
        bins.push({kind,lower,upper,value:upper==null?'≥ '+lower:lower+'–'+upper});
      }
      return {bins,index};
    }).catch(e=>{palettePromise=null;throw e;});
    return palettePromise;
  }

  async function allowed(ms) {
    // GetMap alone can yield an empty PNG in a temporal gap. Verify the
    // half-hour actually exists in the layer's published temporal domain.
    if (!domainPromise || Date.now()-domainChecked>3600000) {
      domainChecked=Date.now();
      domainPromise=request(query(gibs+'/wmts/epsg4326/best/wmts.cgi',{
        SERVICE:'WMTS',VERSION:'1.0.0',REQUEST:'DescribeDomains',LAYER:layer,TILEMATRIXSET:'2km'
      }),'text').then(xml=>{
        const doc=new DOMParser().parseFromString(xml,'application/xml');
        const time=[...doc.querySelectorAll('DimensionDomain')].find(el=>
          [...el.children].some(e=>e.localName==='Identifier' && e.textContent==='time'));
        return (time?.querySelector('Domain')?.textContent.trim().split(',')||[]).map(period=>{
          const [a,b=a]=period.split('/');
          return [Date.parse(a),Date.parse(b)];
        });
      }).catch(e=>{domainPromise=null;throw e;});
    }
    return (await domainPromise).some(([a,b])=>ms>=a && ms<=b);
  }

  async function raster(ms) {
    const frameIndex=(ms-offlineFirst)/halfHour;
    if (frameIndex>=0 && frameIndex<slotsInAtlas && Number.isInteger(frameIndex)) {
      if (!atlasPromise) atlasPromise=imageAt('img/imerg-2026-11-18.png').catch(e=>{atlasPromise=null;throw e;});
      const image=await atlasPromise;
      if (image.naturalWidth!==width*4 || image.naturalHeight!==height*13) throw new Error('Invalid IMERG atlas');
      return {image,x:(frameIndex%4)*width,y:Math.floor(frameIndex/4)*height};
    }
    if (!await allowed(ms)) throw new Error('No matching IMERG time window');
    const image=await imageAt(query(gibs+'/wms/epsg4326/best/wms.cgi',{
      SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:layer,STYLES:'',
      TIME:new Date(ms).toISOString().replace('.000Z','Z'),SRS:'EPSG:4326',BBOX:'-180,-90,180,90',
      WIDTH:width,HEIGHT:height,FORMAT:'image/png',TRANSPARENT:'TRUE'
    }));
    if (image.naturalWidth!==width || image.naturalHeight!==height) throw new Error('Invalid IMERG grid');
    return {image,x:0,y:0};
  }

  async function read(start) {
    const ms=Date.parse(start);
    const [{image,x,y},{bins,index}]=await Promise.all([raster(ms),palette()]);
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,x,y,width,height,0,0,width,height);
    const rgba=ctx.getImageData(0,0,width,height).data;
    const ids=new Uint8Array(width*height),points=[];
    let valid=0;
    for(let row=0;row<height;row++) for(let col=0;col<width;col++) {
      const pos=row*width+col,i=pos*4;
      if(rgba[i+3]!==255) continue;
      const id=index.get(rgba[i]*65536+rgba[i+1]*256+rgba[i+2]);
      if(!id) continue;
      ids[pos]=id;valid++;
      if(!(col%2) && !(row%2)) points.push({lon:col-179.5,lat:89.5-row,...bins[id]});
    }
    if(valid<20) throw new Error('No verified precipitation field');
    function valueAt(lon,lat) {
      if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>90) return null;
      const col=Math.floor(((lon+180)%360+360)%360),row=Math.min(height-1,Math.floor(90-lat));
      return bins[ids[row*width+col]];
    }
    const source=query('https://worldview.earthdata.nasa.gov/',{l:layer,t:new Date(ms+halfHour/2).toISOString()});
    return {start,end:new Date(ms+halfHour).toISOString(),units:'mm/h',source,points,valueAt};
  }

  function load(date,utc,callback) {
    const start=slot(date,utc);
    let result;
    if(!start) result=Promise.resolve(null);
    else if(frames.has(start)) result=Promise.resolve(frames.get(start));
    else {
      if(!pending.has(start)) pending.set(start,read(start).then(frame=>{
        frames.set(start,frame);
        if(frames.size>8) frames.delete(frames.keys().next().value);
        return frame;
      }).catch(()=>null).finally(()=>pending.delete(start)));
      result=pending.get(start);
    }
    if(typeof callback==='function') result.then(callback);
    return result;
  }
  return {slot,load};
})();

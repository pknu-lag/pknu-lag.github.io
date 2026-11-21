/* NASA GIBS SPL3SMP_E v006 browse imagery and corresponding NASA CMR
   SPL2SMP_E v006 half-orbit footprints. All dates below are UTC. */
(() => {
  const bundledDay = '2026-11-18';
  const gibs = 'https://gibs.earthdata.nasa.gov';
  const cmr = 'https://cmr.earthdata.nasa.gov/search/granules.umm_json';
  const layers = {
    am: 'SMAP_L3_Passive_Enhanced_Day_Soil_Moisture',
    pm: 'SMAP_L3_Passive_Enhanced_Night_Soil_Moisture'
  };
  const width = 2048, height = 1024, dayMs = 86400000;
  const displayListeners = new Set();
  let palette, current, started, refreshPromise, checkedDay, lastCheck = 0;

  function urlFor(base, params) {
    return base + '?' + new URLSearchParams(params);
  }

  async function request(url, type, cache = 'default') {
    const response = await fetch(url, {cache, signal: AbortSignal.timeout(16000)});
    if (!response.ok) throw new Error('Observation unavailable');
    return response[type]();
  }

  function mapUrl(day, phase) {
    return urlFor(gibs + '/wms/epsg4326/best/wms.cgi', {
      SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.1.1', LAYERS: layers[phase],
      STYLES: '', TIME: day, SRS: 'EPSG:4326', BBOX: '-180,-90,180,90',
      WIDTH: width, HEIGHT: height, FORMAT: 'image/png', TRANSPARENT: 'TRUE'
    });
  }

  function mapImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      if (url.startsWith('https://')) image.crossOrigin = 'anonymous';
      const timer = setTimeout(() => finish(false), 18000);
      function finish(ok) {
        clearTimeout(timer);
        image.onload = image.onerror = null;
        if (ok) resolve(image);
        else reject(new Error('Invalid SMAP map'));
      }
      image.onload = () => finish(image.naturalWidth === width && image.naturalHeight === height);
      image.onerror = () => finish(false);
      image.src = url;
    });
  }

  const wrapLon = lon => ((lon + 180) % 360 + 360) % 360 - 180;
  // Intersect each side of the CMR footprint at the same latitude, taking
  // the midpoint across the shorter arc even where a swath crosses 180°.
  function withCenterline(pass) {
    const centerline = [];
    for (const lat of [-76,-70,-60,-50,-40,-30,-20,-10,0,10,20,30,40,50,60,70,76]) {
      const edges = [];
      for (let i = 1; i < pass.outline.length; i++) {
        const [x1,y1] = pass.outline[i - 1], [x2,y2] = pass.outline[i];
        if ((y1 > lat) === (y2 > lat)) continue;
        edges.push(wrapLon(x1 + wrapLon(x2 - x1) * (lat - y1) / (y2 - y1)));
      }
      if (edges.length === 2) centerline.push([wrapLon(edges[0] + wrapLon(edges[1]-edges[0]) / 2),lat]);
    }
    if (pass.phase === 'am') centerline.reverse();
    return {...pass, centerline};
  }

  async function passList(day) {
    const query = urlFor(cmr, {
      short_name:'SPL2SMP_E', version:'006', temporal:day+'T00:00:00Z,'+day+'T23:59:59Z',
      page_size:100, sort_key:'start_date'
    });
    const response = await request(query, 'json');
    const passes = new Map();
    for (const {umm} of response.items) {
      const name = umm.GranuleUR.match(/_(\d+)_([AD])_\d{8}T/);
      const time = umm.TemporalExtent?.RangeDateTime;
      const shape = umm.SpatialExtent?.HorizontalSpatialDomain?.Geometry?.GPolygons?.[0]?.Boundary?.Points;
      if (!name || !time || !shape?.length) continue;
      passes.set(name[1] + name[2], {orbit:Number(name[1]), phase:name[2] === 'D' ? 'am' : 'pm',
        start:time.BeginningDateTime, end:time.EndingDateTime,
        outline:shape.map(p => [p.Longitude,p.Latitude])});
    }
    return [...passes.values()];
  }

  async function ranges(phase) {
    const xml = await request(urlFor(gibs + '/wmts/epsg4326/best/wmts.cgi', {
      SERVICE:'WMTS', REQUEST:'DescribeDomains', VERSION:'1.0.0', TILEMATRIXSET:'2km', LAYER:layers[phase]
    }), 'text', 'no-cache');
    const doc = new DOMParser().parseFromString(xml,'application/xml');
    const time = [...doc.querySelectorAll('DimensionDomain')].find(node =>
      [...node.children].some(child => child.localName === 'Identifier' && child.textContent === 'time'));
    const periods = time?.querySelector('Domain')?.textContent.trim().split(',') || [];
    return periods.map(period => {
      const [first, last = first] = period.split('/');
      return [first.slice(0,10), last.slice(0,10)];
    });
  }

  function raster(image) {
    const buffer = document.createElement('canvas');
    buffer.width = width;
    buffer.height = height;
    const context = buffer.getContext('2d', {willReadFrequently:true});
    context.drawImage(image,0,0);
    const rgba = context.getImageData(0,0,width,height).data;
    // A missing time sometimes returns a valid transparent PNG. Validate
    // both coverage and agreement with the official colour intervals.
    let valid = 0;
    for (let pixel = 0; pixel < width * height; pixel += 67) {
      const i = pixel * 4;
      if (rgba[i+3] === 255 && palette[rgba[i]*65536+rgba[i+1]*256+rgba[i+2]]) valid++;
    }
    if (valid < 250) throw new Error('Insufficient valid land observations');
    return rgba;
  }

  function makePair(date, am, pm, orbits) {
    const passes = orbits.map(withCenterline).filter(p => p.centerline.length > 10)
      .sort((a,b) => a.start.localeCompare(b.start));
    if (!['am','pm'].every(phase => passes.some(p => p.phase === phase))) throw new Error('Missing swaths');
    const pixels = {am:raster(am),pm:raster(pm)};
    function binAt(phase, x, y) {
      const bytes = pixels[phase];
      if (!bytes || y < 0 || y >= height) return null;
      const offset = 4 * (width * y + ((x % width + width) % width));
      return bytes[offset + 3] === 255 ? palette[bytes[offset]*65536 + bytes[offset+1]*256 + bytes[offset+2]] || null : null;
    }
    function pixelAt(lon, lat) {
      return [Math.floor((wrapLon(lon)+180)/360*width),Math.min(height-1,Math.floor((90-lat)/180*height))];
    }
    function valueAt(phase, lon, lat) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat)>90) return null;
      return binAt(phase, ...pixelAt(lon,lat));
    }
    function sampleNear(phase,lon,lat,radiusKm=100) {
      if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat)>85) return null;
      const radius = Math.min(200,Math.max(0,radiusKm));
      const [cx,cy] = pixelAt(lon,lat);
      const kmPerRow = 180/height*111.32;
      const longitudeFactor = Math.cos(lat*Math.PI/180);
      const ys = Math.ceil(radius/kmPerRow), xs = Math.ceil(ys/longitudeFactor);
      let nearest = null;
      for (let y=cy-ys; y<=cy+ys; y++) for (let x=cx-xs; x<=cx+xs; x++) {
        const sampleLon = wrapLon((x+.5)/width*360-180), sampleLat = 90-(y+.5)/height*180;
        const distanceKm = 111.32*Math.hypot(wrapLon(sampleLon-lon)*longitudeFactor,sampleLat-lat);
        if (distanceKm>radius || (nearest && distanceKm>=nearest.distanceKm)) continue;
        const value = binAt(phase,x,y);
        if (value) nearest = {lon:sampleLon,lat:sampleLat,value,distanceKm};
      }
      return nearest;
    }
    const source = phase => urlFor('https://worldview.earthdata.nasa.gov/',{l:layers[phase],t:date});
    return {date, am, pm, passes, source, valueAt, sampleNear};
  }

  async function fetchPair(date, local) {
    const base = 'img/smap-'+date+'-';
    const [am,pm,passes] = await Promise.all([
      mapImage(local ? base+'am.png' : mapUrl(date,'am')),
      mapImage(local ? base+'pm.png' : mapUrl(date,'pm')),
      local ? request(base+'passes.json','json') : passList(date)
    ]);
    return makePair(date,am,pm,passes);
  }

  function publish(pair) {
    if (current && pair.date <= current.date) return;
    current = pair;
    for (const callback of displayListeners) callback(pair);
  }

  async function findNewPair(targetDay) {
    const [am,pm] = await Promise.all([ranges('am'),ranges('pm')]);
    const common = [];
    for (const [startA,endA] of am) for (const [startB,endB] of pm) {
      const first = startA > startB ? startA : startB;
      const last = [endA,endB,targetDay].sort()[0];
      if (first <= last) common.push([first,last]);
    }
    common.sort((a,b)=>b[1].localeCompare(a[1]));
    let attempts = 0;
    for (const [first,last] of common) {
      let day = last;
      while (day >= first && day > (current?.date || bundledDay) && attempts++ < 3) {
        try { publish(await fetchPair(day,false)); return; } catch {
          day = new Date(Date.parse(day)-dayMs).toISOString().slice(0,10);
        }
      }
      if (attempts>=3) break;
    }
  }

  function refresh() {
    if (document.hidden || refreshPromise) return;
    const now = Date.now();
    const targetDay = new Date(now - dayMs).toISOString().slice(0,10);
    if (checkedDay === targetDay && now - lastCheck < 15 * 60000) return;
    checkedDay = targetDay;
    lastCheck = now;
    refreshPromise = findNewPair(targetDay).catch(() => {}).finally(() => {refreshPromise=null;});
  }

  async function initialize() {
    palette = await request('img/smap-palette.json','json');
    refresh();
    setInterval(refresh, 15 * 60000);
    document.addEventListener('visibilitychange',refresh);
    try { publish(await fetchPair(bundledDay,true)); } catch { /* Remote refresh can still succeed. */ }
  }

  window.SmapFeed = {
    load(callback) {
      displayListeners.add(callback);
      if (current) callback(current);
      if (!started) started = initialize().catch(() => {});
      return () => displayListeners.delete(callback);
    }
  };
})();

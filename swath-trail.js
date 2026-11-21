/* Reveal only pixels covered by a completed portion of a catalogued SMAP
   footprint. The plate keeps earlier valid retrievals until a new UTC day. */
window.SwathTrail = (() => {
  const wrap = x => ((x + 180) % 360 + 360) % 360 - 180;

  function front(pass, lat) {
    const edges = [];
    const outline = pass.outline;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i], b = outline[(i + 1) % outline.length];
      if ((a[1] > lat) === (b[1] > lat)) continue;
      const fraction = (lat - a[1]) / (b[1] - a[1]);
      edges.push(wrap(a[0] + wrap(b[0] - a[0]) * fraction));
    }
    // Centerline extents exclude the polar end caps: every retained
    // scanline must cross exactly one west and one east swath boundary.
    if (edges.length !== 2) return null;
    const span = wrap(edges[1] - edges[0]);
    if (!span) return null;
    return span > 0 ? [edges[0],edges[0] + span] : [edges[1],edges[1] - span];
  }

  function latitudeAt(line, fraction) {
    const t = Math.max(0, Math.min(1, fraction)) * (line.length - 1);
    const i = Math.min(line.length - 2, Math.floor(t));
    return line[i][1] + (line[i + 1][1] - line[i][1]) * (t-i);
  }

  function create(pair, baseImage) {
    const canvas = document.createElement('canvas');
    const width = canvas.width = pair.am.naturalWidth || pair.am.width;
    const height = canvas.height = pair.am.naturalHeight || pair.am.height;
    const ctx = canvas.getContext('2d');
    let previousStart;

    function reset() {
      ctx.clearRect(0,0,width,height);
      ctx.drawImage(baseImage,0,0,width,height);
      previousStart = undefined;
    }

    function advance(pass, fromFraction, toFraction) {
      if (toFraction <= fromFraction || pass.centerline.length < 2) return;
      if (previousStart && pass.start < previousStart) reset();
      previousStart = pass.start;
      const from = (90 - latitudeAt(pass.centerline, fromFraction)) * height / 180;
      const to = (90 - latitudeAt(pass.centerline, toFraction)) * height / 180;
      // Assign a cell to a strip by its center. Partial advances therefore
      // cover exactly the same pixels as one full advance, in either order.
      const first = Math.max(0,Math.ceil(Math.min(from,to) - .5));
      const last = Math.min(height-1,Math.floor(Math.max(from,to) - .5));
      const texture = pair[pass.phase];
      for (let y = first; y <= last; y++) {
        const extent = front(pass,90 - (y+.5)*180/height);
        if (!extent) continue;
        const left = Math.ceil((extent[0]+180)*width/360 - .5);
        const right = Math.floor((extent[1]+180)*width/360 - .5) + 1;
        const end = Math.min(right,width);
        if (end > left) ctx.drawImage(texture,left,y,end-left,1,left,y,end-left,1);
        if (right > width) ctx.drawImage(texture,0,y,right-width,1,0,y,right-width,1);
      }
    }
    reset();
    return {canvas,advance,reset,front};
  }
  return {create};
})();

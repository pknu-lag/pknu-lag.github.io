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

  return {front};
})();
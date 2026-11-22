(() => {
  // Points indicate the locality named in the archive, not travel routes.
  const places = [
    {name:'Boseong', area:'South Korea', lon:127.21, lat:34.76, photos:['01']},
    {name:'Andong', area:'South Korea', lon:128.73, lat:36.57, photos:['06']},
    {name:'Busan', area:'South Korea', lon:129.08, lat:35.18, photos:['11','12','20','24']},
    {name:'Jeju', area:'South Korea', lon:126.54, lat:33.38, photos:['08']},
    {name:'Ulsan', area:'South Korea', lon:129.31, lat:35.54, photos:['10']},
    {name:'Taipei', area:'Taiwan', lon:121.54, lat:25.02, photos:['05']},
    {name:'Sapporo', area:'Japan', lon:141.35, lat:43.06, photos:['18']},
    {name:'Stuttgart', area:'Germany', lon:9.18, lat:48.78, photos:['04']},
    {name:'Fairfax', area:'United States', lon:-77.31, lat:38.83, photos:['13']},
    {name:'Princeton', area:'United States', lon:-74.67, lat:40.35, photos:['14']}
  ];

  const section = document.querySelector('#places');
  const select = section.querySelector('#places-select');
  const record = section.querySelector('#places-record');
  const picture = record.querySelector('.visit-photo-link');
  const caption = record.querySelector('.visit-photo-caption');
  const pager = record.querySelector('.visit-pager');
  const [previous,next] = pager.querySelectorAll('button');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const coords = place => [place.lat,place.lon];
  let active = places[0], photoIndex = 0;

  for (const area of new Set(places.map(place=>place.area))) {
    const group = document.createElement('optgroup');
    group.label = area;
    for (const place of places.filter(place=>place.area===area)) group.append(new Option(place.name,place.name));
    select.append(group);
  }
  function showPhoto(index) {
    photoIndex = (index + active.photos.length) % active.photos.length;
    const item = document.getElementById('photo-'+active.photos[photoIndex]);
    const title = item.querySelector('figcaption').textContent;
    picture.href = caption.href = '#'+item.id;
    picture.setAttribute('aria-label','Enlarge photo: '+title);
    picture.querySelector('img').src = item.querySelector('img').src;
    caption.textContent = title;
    pager.hidden = active.photos.length === 1;
    pager.querySelector('span').textContent = (photoIndex+1)+' / '+active.photos.length;
  }
  for (const link of [picture,caption]) link.addEventListener('click',event=>{
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    document.getElementById(link.hash.slice(1)).querySelector('.photo-open').click();
  });
  previous.addEventListener('click',()=>showPhoto(photoIndex-1));
  next.addEventListener('click',()=>showPhoto(photoIndex+1));
  function display(place) {
    active = place;
    select.value = place.name;
    section.querySelector('#places-country').textContent = place.area;
    section.querySelector('#places-city').textContent = place.name;
    showPhoto(0);
  }
  section.hidden = false;
  display(active);

  const container = section.querySelector('.places-map');
  const map = L.map(container, {
    minZoom:0, maxZoom:8, zoomSnap:0.1, zoomDelta:1, wheelPxPerZoomLevel:95,
    zoomControl:false, attributionControl:false, preferCanvas:true,
    maxBounds:[[-85,-190],[85,190]], maxBoundsViscosity:1
  });
  const overview = [[-53,-170],[73,175]];
  map.fitBounds(overview,{animate:false});
  L.control.zoom({position:'bottomleft'}).addTo(map);
  L.control.scale({position:'bottomright',imperial:false,maxWidth:72}).addTo(map);
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'world-reset';
  reset.textContent = 'World view';
  reset.setAttribute('aria-label','Reset to world view');
  const resetControl = L.control({position:'topleft'});
  resetControl.onAdd = () => {
    L.DomEvent.disableClickPropagation(reset);
    return reset;
  };
  resetControl.addTo(map);
  reset.addEventListener('click',()=>{
    map.stop();
    map.flyToBounds(overview,{animate:!motion.matches,duration:.75});
  });

  const water = '#e4eff1';
  const styles = {
    land:{fillColor:'#cbd7c8',fillOpacity:1,color:'#a9beb3',weight:.65},
    border:{color:'#9cad9e',opacity:.8,weight:.8},
    river:{color:'#a6cbd0',opacity:.9,weight:1.2},
    lake:{fillColor:water,fillOpacity:1,color:'#b2cbca',weight:.6}
  };
  fetch('img/journal-geography.json').then(response=>{
    if (!response.ok) throw new Error('Map geometry unavailable');
    return response.json();
  }).then(data=>{
    for (const feature of data.features) {
      const kind = feature.properties.kind;
      const layer = L.geoJSON(feature,{interactive:false,smoothFactor:1,style:styles[kind]});
      if (kind==='river') {
        function updateRivers() {
          if (map.getZoom()>=4) layer.addTo(map);
          else layer.remove();
        }
        updateRivers();
        map.on('zoomend',updateRivers);
      } else layer.addTo(map);
    }
  }).catch(()=>{
    const note=document.createElement('span');
    note.className='map-message';
    note.textContent='Basemap unavailable';
    container.append(note);
  });

  const korea = places.filter(p=>p.area==='South Korea');
  const asia = places.filter(p=>['South Korea','Japan','Taiwan'].includes(p.area));
  const usa = places.filter(p=>p.area==='United States');
  const clusters = [
    {label:'East Asia',members:asia,anchor:korea[0],span:95},
    {label:'South Korea',members:korea,anchor:korea[0],span:19},
    {label:'Eastern U.S.',members:usa,anchor:usa[0],span:25}
  ];
  const markers = L.layerGroup().addTo(map);
  function choose(place) {
    display(place);
    map.stop();
    map.flyTo(coords(place),Math.max(7.4,map.getZoom()),{animate:!motion.matches,duration:.85});
    drawMarkers();
  }
  function addPin(place,group) {
    const label=group?.label || place.name;
    const pin=document.createElement('span');
    pin.className='pin-label';
    pin.textContent=label;
    if(group){
      const total=document.createElement('small');
      total.textContent=group.members.length;
      pin.append(total);
    }
    const left = (group===clusters[0] || (!group && ['Busan','Boseong'].includes(place.name)));
    const icon=L.divIcon({
      className:'travel-pin'+(left?' pin-left':'')+(active===place&&!group?' pin-selected':''),
      html:pin,iconSize:[16,16],iconAnchor:[8,8]
    });
    const marker=L.marker(coords(place),{icon,title:label,autoPanOnFocus:false}).addTo(markers);
    const element=marker.getElement();
    element.setAttribute('aria-label',group?'Explore '+label:'Show photos from '+place.name);
    const activate=()=>{
      if(!group) {choose(place);return;}
      if(!group.members.includes(active)) display(place);
      map.stop();
      map.flyToBounds(group.members.map(coords),{
        paddingTopLeft:[40,35],paddingBottomRight:[48,40],
        maxZoom:group===clusters[0]?4.3:6.8,animate:!motion.matches,duration:.85
      });
    };
    marker.on('click',activate);
    element.addEventListener('keydown',e=>{
      if(e.key===' '){e.preventDefault();activate();}
    });
  }
  function drawMarkers() {
    const focused = markers.getLayers().some(marker=>marker.getElement()===document.activeElement);
    markers.clearLayers();
    const bounds=map.getBounds(), span=bounds.getEast()-bounds.getWest();
    const clustered=new Set();
    for (const group of clusters) {
      if(span<group.span || clustered.has(group.anchor)) continue;
      addPin(group.anchor,group);
      for(const member of group.members) clustered.add(member);
    }
    for(const place of places) if(!clustered.has(place)) addPin(place);
    if(focused) container.focus({preventScroll:true});
  }
  select.addEventListener('change',()=>choose(places.find(p=>p.name===select.value)));
  map.on('zoomend',drawMarkers);
  drawMarkers();
  new ResizeObserver(()=>{map.invalidateSize({pan:false});drawMarkers();}).observe(container);
})();


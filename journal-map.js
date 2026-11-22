(() => {
  const section = document.querySelector('#places');
  const pins = section.querySelector('.places-pins');
  const land = section.querySelector('.places-land');
  const reset = section.querySelector('.world-reset');
  const select = section.querySelector('#places-select');
  const record = section.querySelector('#places-record');
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
  const views = {
    World:[-180,180,-58,82],
    'East Asia':[115,149,20,48],
    'South Korea':[125.45,130.9,32.65,37.45],
    'United States':[-79.7,-71.8,37.2,42.2],
    Germany:[3.5,15.5,46,55]
  };
  const clusters = {
    World:[
      {label:'Eastern U.S.', view:'United States', city:'Fairfax'},
      {label:'Germany', view:'Germany', city:'Stuttgart'},
      {label:'East Asia', view:'East Asia', city:'Boseong'}
    ],
    'East Asia':[{label:'South Korea', view:'South Korea', city:'Boseong'}]
  };
  for (const place of places) {
    select.add(new Option(place.name+' · '+place.area,place.name));
  }
  let active = places[0];
  let view = 'World';
  const byName = name => places.find(place => place.name === name);
  function showRecord(place) {
    active = place;
    select.value = place.name;
    const fragment = document.createDocumentFragment();
    for (const [index,id] of place.photos.entries()) {
      const original = document.getElementById('photo-'+id);
      const link = document.createElement('a');
      link.href = '#photo-'+id;
      if (index === 0) {
        const img = original.querySelector('img').cloneNode();
        img.alt = '';
        img.loading = 'lazy';
        link.append(img);
      }
      link.append(original.querySelector('figcaption').textContent);
      link.addEventListener('click',event => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        original.querySelector('a').click();
      });
      fragment.append(link);
    }
    record.replaceChildren(fragment);
  }
  function drawMap(focusMap = false) {
    const [west,east,south,north] = views[view];
    land.setAttribute('viewBox',[180+west,90-north,east-west,north-south].join(' '));
    pins.replaceChildren();
    reset.hidden = view === 'World';
    if (view === 'World' || view === 'East Asia') {
      for (const place of places) {
        if (place.lon < west || place.lon > east || place.lat < south || place.lat > north) continue;
        const dot = document.createElement('span');
        dot.className = 'place-dot';
        dot.setAttribute('aria-hidden','true');
        dot.style.left = (place.lon-west)/(east-west)*100+'%';
        dot.style.top = (north-place.lat)/(north-south)*100+'%';
        pins.append(dot);
      }
    }
    const pin = (place,label,destination) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'place-pin';
      button.style.left = (place.lon-west)/(east-west)*100+'%';
      button.style.top = (north-place.lat)/(north-south)*100+'%';
      button.setAttribute('aria-label',destination?'Explore '+label:'Show photos from '+place.name);
      button.setAttribute('aria-pressed',String(!destination && place === active));
      // Separate the two neighbouring coastal cities at the smallest width.
      if (view === 'South Korea' && ['Busan','Boseong'].includes(place.name)) button.classList.add('label-left');
      if (view === 'World' && label === 'East Asia') button.classList.add('label-left');
      const caption = document.createElement('span');
      caption.textContent = label;
      button.append(caption);
      button.addEventListener('click',() => {
        if (destination) view = destination;
        showRecord(place);
        drawMap(true);
      });
      pins.append(button);
    };
    for (const group of clusters[view] || []) pin(byName(group.city),group.label,group.view);
    for (const place of places) {
      if (place.area === view || (view === 'East Asia' && ['Taiwan','Japan'].includes(place.area))) {
        pin(place,place.name);
      }
    }
    if (focusMap) (pins.querySelector('[aria-pressed="true"]') || pins.querySelector('button'))?.focus({preventScroll:true});
  }
  select.addEventListener('change',() => {
    showRecord(byName(select.value));
    view = views[active.area] ? active.area : 'East Asia';
    drawMap();
  });
  reset.addEventListener('click',() => {view='World'; drawMap(true);});
  showRecord(active);
  drawMap();
  section.hidden = false;
})();

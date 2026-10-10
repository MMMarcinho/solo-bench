(() => {
  const clamp = (n) => Math.max(0, Math.min(1, n));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const effects = [...document.querySelectorAll('[data-effect]')];
  const states = effects.map(element => ({element, value: 0, target: 0, lines: [], words: []}));
  const titleAnchor = document.querySelector('[data-title-anchor]');
  const titlePhrase = document.querySelector('[data-title-phrase]');
  const titlePointer = document.querySelector('[data-title-pointer]');
  // Independent measurements from the public Chinese page, interpolated as an
  // approximation. Columns: untransformed anchor top / viewport height, text
  // translation, text rotation, then pointer position, opacity and scale.
  const titleFrames = [
    [1.172081,110,24,5,160.602,86.169,0,1],
    [.981857,110,24,5,165.196,67.6021,.440252,1],
    [.938264,110,24,5,195.657,38.5611,1,1],
    [.913123,101.442,26.3833,4.65123,188.038,40.3448,1,.890675],
    [.861645,83.6459,29.4323,3.90795,170.226,42.9516,1,.86],
    [.822015,70.3671,29.8971,3.33619,156.931,43.0764,1,.86],
    [.722940,38.731,23.9048,1.9068,125.239,36.2349,1,.86],
    [.622544,8.94786,7.40677,.458357,95.3772,18.8781,1,.862752],
    [.572346,0,0,0,98.2598,9.61497,1,1],
    [.522106,0,0,0,129.532,-4.38223,.744235,1],
    [.452134,0,0,0,150.4,-28.8,0,1]
  ];
  const title = {value:1.172081,target:1.172081,direction:'down',cursorAngle:-49};
  let frame = 0;

  function titlePose(anchorRatio) {
    if (anchorRatio >= titleFrames[0][0]) return titleFrames[0];
    if (anchorRatio <= titleFrames.at(-1)[0]) return titleFrames.at(-1);
    for (let i=0;i<titleFrames.length-1;i++) {
      const a=titleFrames[i],b=titleFrames[i+1];
      if(anchorRatio<=a[0]&&anchorRatio>=b[0]){
        const progress=(a[0]-anchorRatio)/(a[0]-b[0]);
        return a.map((value,j)=>j===0?anchorRatio:value+(b[j]-value)*progress);
      }
    }
    return titleFrames.at(-1);
  }
  function paintTitle() {
    if(!titleAnchor||!titlePhrase||!titlePointer)return;
    if(reduced.matches){
      titlePhrase.style.transform='none';
      titlePointer.style.opacity='0';
      return;
    }
    const [,x,y,rotation,cursorX,cursorY,opacity,scale]=titlePose(title.value);
    titlePhrase.style.transform=`translate(${x}px,${y}px) rotate(${rotation}deg)`;
    const directionAngle=title.direction==='down'?-49:-222;
    title.cursorAngle+= (directionAngle-title.cursorAngle)*.2;
    titlePointer.style.transform=`translate(${cursorX}px,${cursorY}px) rotate(${title.cursorAngle}deg) scale(${scale})`;
    titlePointer.style.opacity=String(opacity);
  }

  function makeLines(state) {
    const root = state.element;
    const copy = root.querySelector('.highlight-copy');
    if (!copy) return;
    const content = copy.textContent.trim();
    copy.textContent = '';
    state.words = [];
    for (const {segment: part} of new Intl.Segmenter('zh',{granularity:'word'}).segment(content)) {
      const word = document.createElement('span');
      word.className = 'highlight-word';
      word.textContent = part;
      copy.append(word);
      state.words.push(word);
    }
    root.querySelector('.highlight-bars')?.remove();
    root.querySelector('.highlight-cursor')?.remove();
    const rootBox = root.getBoundingClientRect();
    const grouped = [];
    for (const word of state.words) {
      const rect = word.getBoundingClientRect();
      const row = grouped.find(line => Math.abs(line.y - rect.y) < 3);
      if (row) { row.right = Math.max(row.right, rect.right); row.height = Math.max(row.height, rect.height); }
      else grouped.push({y: rect.y, left: rect.left, right: rect.right, height: rect.height});
    }
    const bars = document.createElement('span');
    bars.className = 'highlight-bars';
    bars.setAttribute('aria-hidden', 'true');
    state.lines = grouped.map(row => {
      const bar = document.createElement('span');
      bar.className = 'highlight-bar';
      bar.style.left = `${row.left - rootBox.left}px`;
      bar.style.top = `${row.y - rootBox.y + row.height * .1}px`;
      bar.style.height = `${row.height * .79}px`;
      bars.append(bar);
      return {bar, x: row.left - rootBox.left, y: row.y - rootBox.y, width: row.right - row.left, height: row.height};
    });
    root.prepend(bars);
    const cursor = document.createElement('span');
    cursor.className = 'highlight-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    root.append(cursor);
    state.cursor = cursor;
  }

  function targetFor(element) {
    const rect = element.getBoundingClientRect();
    const start = innerHeight * .87;
    const end = innerHeight * .27;
    return clamp((start - rect.top) / (start - end));
  }
  function paint(state) {
    const {element, value} = state;
    if (element.dataset.effect === 'move') {
      const p = reduced.matches ? 1 : 1 - Math.pow(1 - value, 2);
      const narrow = matchMedia('(max-width: 520px)').matches;
      element.querySelector('.motion-copy').style.setProperty('--motion-x', `${(1-p)*(narrow ? 18 : 110)}px`);
      element.querySelector('.motion-copy').style.setProperty('--motion-y', `${(1-p)*(narrow ? 8 : 24)}px`);
      element.querySelector('.motion-copy').style.setProperty('--motion-r', `${(1-p)*(narrow ? 2 : 5)}deg`);
      return;
    }
    if (!state.lines.length) return;
    const progress = value * state.lines.length;
    let active = null;
    state.lines.forEach((line, i) => {
      const amount = clamp(progress - i);
      line.bar.style.width = `${line.width * amount}px`;
      if (amount > 0 && amount < 1) active = {line, amount};
      else if (amount === 1 && !active) active = {line, amount};
    });
    if (!reduced.matches && active && value > 0 && value < 1) {
      state.cursor.style.opacity = '1';
      state.cursor.style.left = `${active.line.x + active.line.width * active.amount - 2}px`;
      state.cursor.style.top = `${active.line.y + active.line.height * .54}px`;
    } else state.cursor.style.opacity = '0';
  }
  function tick() {
    let moving = false;
    if(titleAnchor){
      const delta=title.target-title.value;
      title.value=reduced.matches||Math.abs(delta)<.0005?title.target:title.value+delta*.2;
      if(Math.abs(title.target-title.value)>=.0005)moving=true;
      paintTitle();
    }
    for (const state of states) {
      const difference = state.target - state.value;
      state.value = reduced.matches || Math.abs(difference) < .001 ? state.target : state.value + difference * .18;
      if (Math.abs(state.target - state.value) >= .001) moving = true;
      paint(state);
    }
    frame = moving ? requestAnimationFrame(tick) : 0;
  }
  function update() {
    for (const state of states) state.target = targetFor(state.element);
    if(titleAnchor){
      const next=titleAnchor.getBoundingClientRect().top/innerHeight;
      if(Math.abs(next-title.target)>.0005)title.direction=next<title.target?'down':'up';
      title.target=next;
    }
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function reflow() {
    for (const state of states) if (state.element.dataset.effect === 'highlight') makeLines(state);
    update();
  }
  addEventListener('scroll', update, {passive:true});
  addEventListener('resize', reflow);
  reduced.addEventListener('change', update);
  document.fonts.ready.then(reflow);
  reflow();
})();

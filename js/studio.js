/* The studio keeps each panel mounted: the wheel, URL, artwork and status agree. */
(function () {
  'use strict';
  var root=document.querySelector('[data-studio]');if(!root)return;
  var data=JSON.parse(document.getElementById('studio-data').textContent);
  var panels=Array.from(root.querySelectorAll('[data-studio-panel]'));
  var rail=root.querySelector('[data-studio-wheel]'), editor=root.querySelector('.studio-editor');
  var picker=root.querySelector('[data-studio-picker]'), pane=root.querySelector('.studio-pane');
  var mobile=matchMedia('(max-width:600px)'), motion=window.SkyMotion;
  var count=root.querySelector('[data-studio-count]'), name=root.querySelector('[data-studio-current-name]'), state=root.querySelector('[data-studio-status]');
  var announce=document.querySelector('[data-announce]'), enabled=true, current=-1, pendingClose=false;
  var spine=rail.querySelector('canvas'), ctx=spine.getContext('2d'), geometry=null, wheel=null;
  var scenes=data.map(function(item,i){return item.scene?window.SkyStudioScenes.mount(panels[i],item.scene,{motion:motion}):null;});
  var viewer=document.getElementById('studio-viewer'), viewerStage=viewer.querySelector('.studio-viewer-stage'), returnFocus=null, figureHome=null;
  var videos=panels.map(function(panel){var video=panel.querySelector('[data-studio-video]');return video?{video:video,visible:false,userPaused:false}:null;});
  function canPlayEvidence(item,i) { return current===i&&panels[i].dataset.studioView==='evidence'&&item.visible&&enabled&&!document.hidden&&!motion.reduced(); }
  function syncEvidence() {
    videos.forEach(function(item,i){if(!item)return;
      if(canPlayEvidence(item,i)&&!item.userPaused){var promise=item.video.play();if(promise)promise.catch(function(){});}
      else item.video.pause();
    });
  }
  videos.forEach(function(item,i){if(!item)return;
    item.video.addEventListener('pause',function(){if(item.video.paused&&canPlayEvidence(item,i))item.userPaused=true;});
    item.video.addEventListener('play',function(){item.userPaused=false;});
    new IntersectionObserver(function(records){item.visible=records.at(-1).isIntersecting;syncEvidence();}).observe(item.video);
  });
  function setView(index,view) {
    var panel=panels[index];panel.dataset.studioView=view;
    panel.querySelectorAll('[data-studio-view-pick]').forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.studioViewPick===view));});
    var label=panel.querySelector('[data-studio-view-label]'),caption=panel.querySelector('[data-studio-gallery-caption]');
    if(data[index].evidence){label.textContent=view==='evidence'?data[index].evidence.label:'Illustration';caption.textContent=view==='evidence'?data[index].evidence.caption:'Interactive illustration · controls below';}
    syncEvidence();
  }
  panels.forEach(function(panel,i){
    panel.querySelectorAll('[data-studio-view-pick]').forEach(function(button){button.addEventListener('click',function(){setView(i,button.dataset.studioViewPick);});});
    var model=panel.querySelector('.studio-model');if(model)model.addEventListener('toggle',function(){if(model.open)setView(i,'illustration');});
  });
  function hashIndex() {
    var slug;try{slug=decodeURIComponent(location.hash.slice(1));}catch(e){return 0;}
    if(slug==='hero'||!slug)slug='about';if(slug==='work-list')slug=data[1].slug;
    slug=slug.replace(/^project-/,'');return data.findIndex(function(item){return item.slug===slug;});
  }
  function closePicker(focus) {
    pendingClose=false;editor.classList.remove('is-picker-open');picker.setAttribute('aria-expanded','false');picker.lastElementChild.textContent='↓';
    rail.inert=mobile.matches;pane.inert=false;if(wheel)wheel.refresh();
    if(focus)picker.focus({preventScroll:true});
  }
  function select(index,meta) {
    if(index===current)return;
    var old=current;current=index;if(old>=0&&scenes[old])scenes[old].deactivate();
    panels.forEach(function(panel,i){var on=i===index;panel.classList.toggle('is-current',on);panel.classList.toggle('is-on',on);panel.inert=!on;panel.hidden=!on;panel.setAttribute('aria-hidden',String(!on));});
    if(scenes[index])scenes[index].activate();syncEvidence();
    count.textContent=String(index+1).padStart(2,'0')+' / '+String(data.length).padStart(2,'0');
    name.textContent=data[index].name;state.textContent=data[index].status;picker.querySelector('[data-studio-picker-name]').textContent=data[index].slug;
    root.dataset.selected=data[index].slug;
    if(meta&&meta.input!=='history'&&meta.input!=='initial')history.replaceState(null,'','#'+data[index].slug);
    if(meta&&meta.announce)announce.textContent=data[index].name+' selected';
    document.dispatchEvent(new CustomEvent('sky:workselect',{detail:{index:index-1}}));
  }
  function drawSpine(frame) {
    geometry=frame;if(!ctx)return;
    var width=340,height=frame.height,dpr=Math.min(devicePixelRatio||1,2);
    if(spine.width!==Math.round(width*dpr)||spine.height!==Math.round(height*dpr)){spine.width=Math.round(width*dpr);spine.height=Math.round(height*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    var ink=getComputedStyle(root).getPropertyValue('--ink').trim(),center=height/2;
    ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=.55;ctx.globalAlpha=.42;
    function noise(seed) { var n=Math.sin(seed*127.1)*43758.5453;return n-Math.floor(n); }
    function stem(y) {
      var d=(y-center)/80;
      return 90+940*(1-Math.cos(d*.085))+5*Math.sin(y*.023+frame.position*.7)+2*Math.sin(y*.081);
    }
    ctx.globalAlpha=.66;ctx.lineWidth=.75;
    ctx.beginPath();for(var y=0;y<=height;y+=3){var x=stem(y);if(!y)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
    frame.poses.forEach(function(pose,i){
      var cy=pose.y+47;if(cy < -70||cy>height+70)return;
      var sx=stem(cy),tx=110+pose.x+75*(1-pose.scale),strength=i===frame.selected?1:.5;
      for(var branch=0;branch<38;branch++){
        var seed=(i+1)*91+branch*43,spread=(noise(seed)-.5)*112;
        var reach=12+noise(seed+1)*68,endY=cy+spread,endX=sx-reach+noise(seed+2)*16;
        var forkX=sx-reach*.55,forkY=cy+spread*.28;
        ctx.globalAlpha=(.18+noise(seed+3)*.65)*strength;
        ctx.beginPath();ctx.moveTo(sx,cy);ctx.quadraticCurveTo(forkX,forkY,endX,endY);ctx.stroke();
        if(branch%3===0){ctx.beginPath();ctx.moveTo(forkX,forkY);ctx.lineTo(endX+noise(seed+4)*24,endY-9);ctx.stroke();}
        ctx.fillRect(endX-.65,endY-.65,1.3,1.3);
      }
      ctx.globalAlpha=.5*strength;ctx.beginPath();ctx.moveTo(sx,cy);ctx.lineTo(tx-3,cy);ctx.stroke();
    });ctx.globalAlpha=1;
    if(pendingClose&&wheel&&wheel.settled())closePicker(true);
  }
  wheel=window.SkyStudioWheel.mount(rail,{
    initial:Math.max(0,hashIndex()),reduced:motion.reduced,onSelect:select,onPose:drawSpine,
    onOpen:function(){wheel.pause();wheel.resume();closePicker(false);panels[current].focus({preventScroll:true});},onEscape:function(){closePicker(true);}
  });
  select(wheel.selected(),{input:'initial'});
  rail.inert=mobile.matches;
  picker.addEventListener('click',function(){
    var open=picker.getAttribute('aria-expanded')!=='true';
    if(!open){closePicker(true);return;}
    editor.classList.add('is-picker-open');picker.setAttribute('aria-expanded','true');picker.lastElementChild.textContent='↑';
    rail.inert=false;pane.inert=true;wheel.refresh();rail.querySelector('[aria-selected="true"]').focus({preventScroll:true});
  });
  rail.addEventListener('click',function(event){
    if(mobile.matches&&event.target.closest('[data-studio-pick]')){pendingClose=true;if(wheel.settled())closePicker(true);}
  });
  root.querySelectorAll('[data-studio-step]').forEach(function(button){button.addEventListener('click',function(){wheel.step(Number(button.dataset.studioStep),{input:'button',announce:true});});});
  root.querySelector('[data-bench-live]').addEventListener('click',function(event){enabled=!enabled;event.currentTarget.setAttribute('aria-pressed',String(enabled));root.querySelector('[data-studio-live-label]').textContent=enabled?'on':'off';scenes.forEach(function(scene){if(scene)scene.enabled(enabled);});syncEvidence();});
  document.addEventListener('click',function(event){
    var link=event.target.closest('a[href]');if(!link||event.button||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
    var url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname!==location.pathname||!url.hash)return;
    var slug=url.hash.slice(1);if(slug==='hero')slug='about';if(slug==='work-list')slug=data[1].slug;
    var index=data.findIndex(function(item){return item.slug===slug;});if(index<0)return;
    event.preventDefault();event.stopPropagation();
    var indexDialog=document.getElementById('site-index');if(indexDialog.open)indexDialog.close();
    history.pushState(null,'','#'+slug);wheel.set(index,{input:'history',announce:true});closePicker(false);
  },true);
  window.addEventListener('hashchange',function(){var index=hashIndex();if(index>=0)wheel.set(index,{input:'history',announce:true});});
  window.addEventListener('popstate',function(){var index=hashIndex();if(index>=0)wheel.set(index,{input:'history',announce:true});});
  mobile.addEventListener('change',function(){closePicker(false);wheel.refresh();});
  motion.subscribe(function(){if(motion.reduced()){wheel.pause();wheel.resume();}else wheel.refresh();scenes.forEach(function(scene){if(scene)scene.motionChanged();});syncEvidence();});
  document.addEventListener('visibilitychange',function(){scenes.forEach(function(scene){if(scene)scene.sync();});syncEvidence();});
  new MutationObserver(function(){if(geometry)drawSpine(geometry);}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-gear']});
  function closeViewer() { if(viewer.open)viewer.close(); }
  viewer.addEventListener('close',function(){
    if(figureHome){figureHome.parent.insertBefore(figureHome.figure,figureHome.next);figureHome=null;}
    viewerStage.replaceChildren();syncEvidence();if(returnFocus&&returnFocus.isConnected&&returnFocus.getClientRects().length&&!returnFocus.closest('[inert]'))returnFocus.focus({preventScroll:true});else panels[current].focus({preventScroll:true});returnFocus=null;
  });
  viewer.querySelector('[data-studio-viewer-close]').addEventListener('click',closeViewer);
  viewer.addEventListener('click',function(event){if(event.target===viewer)closeViewer();});
  root.querySelectorAll('[data-studio-zoom],[data-studio-evidence-zoom]').forEach(function(opener){
    if(opener.tagName!=='BUTTON'){opener.setAttribute('role','button');opener.tabIndex=0;opener.setAttribute('aria-label','View '+data.find(function(item){return item.slug===opener.dataset.studioZoom;}).name+' illustration large');opener.setAttribute('aria-keyshortcuts','Enter Space');}
    function open(){
      if(viewer.open)return;returnFocus=opener;
      var isEvidence=!!opener.dataset.studioEvidenceZoom,slug=opener.dataset.studioZoom||opener.dataset.studioEvidenceZoom, item=data.find(function(entry){return entry.slug===slug;});
      document.getElementById('studio-viewer-title').textContent=slug==='about'?'Hermes — original avatar':item.name+(isEvidence?' — project evidence':' — illustration');
      if(slug==='about'||isEvidence){var figure=isEvidence?opener.closest('[data-studio-evidence]'):document.getElementById('figure');figureHome={figure:figure,parent:figure.parentNode,next:figure.nextSibling};viewerStage.appendChild(figure);}
      else {var clone=opener.querySelector('svg').cloneNode(true);clone.querySelectorAll('[id]').forEach(function(node){node.removeAttribute('id');});clone.removeAttribute('aria-labelledby');clone.setAttribute('aria-label',item.name+' illustration');viewerStage.appendChild(clone);}
      viewer.showModal();syncEvidence();
    }
    opener.addEventListener('click',open);
    if(opener.tagName!=='BUTTON')opener.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
  });
  root.classList.add('is-ready');
  window.SkyStudio={select:function(index){wheel.set(index,{input:'api',announce:true});},selectSlug:function(slug){var i=data.findIndex(function(item){return item.slug===slug;});if(i>=0)wheel.set(i,{input:'api',announce:true});},selected:wheel.selected,settled:wheel.settled,position:wheel.position,slug:function(){return data[current].slug;},playing:function(){return !!(scenes[current]&&scenes[current].playing());},snapshot:function(){return {selected:current,slug:data[current].slug,scene:scenes[current]?scenes[current].snapshot():null};},wheel:wheel};
})();

/* Scene clocks and input inspection. The local models own their own SVG changes. */
(function () {
  'use strict';
  function mount(card, spec, options) {
    var drawing=card.querySelector('.scene-drawing'), svg=card.querySelector('.scene-svg');
    var caption=card.querySelector('[data-scene-status]'), button=card.querySelector('[data-scene-action]');
    var motion=options.motion, active=false, enabled=true, onscreen=false, raf=0, last=0, run=null;
    var inspected=-1, matrix=null, touched=false, modelActive=false, completed=false, reduced=motion.reduced;
    var ramp=card.dataset.scene==='airforge' ? window.SkyLabControls.previewRamp(30) : null;
    function status(text) { caption.textContent=text.replace(/^Illustration:\s*/i,''); }
    function cancel() { cancelAnimationFrame(raf); raf=0; last=0; }
    function allowed() { return active && enabled && onscreen && !document.hidden && !reduced(); }
    function queue() { if(!raf && run && allowed() && inspected<0) raf=requestAnimationFrame(frame); }
    function resetPaint() {
      card.querySelectorAll('.physics-ball,.capture-dot,.recall-marker,.recall-active,.trace-span,.trace-span rect,.pulse-bar,.pulse-wave,.voter,.vote-link,.fault-marker,.blocked-route,.scene-courier').forEach(function(node){
        ['transform','opacity','fill','stroke','stroke-dasharray','stroke-dashoffset'].forEach(function(prop){node.style.removeProperty(prop);});
      });
    }
    var lab=window.SkyLabControls.mount(card,card.dataset.scene,{
      beforeChange:function(){cancel();run=null;if(!modelActive)resetPaint();modelActive=true;touched=true;card.classList.remove('is-running');card.classList.add('is-lab-active','is-probed');button.setAttribute('aria-pressed','true');button.firstChild.textContent='Reset ';},
      status:status
    });
    function reset() {
      cancel();run=null;modelActive=false;touched=false;completed=false;inspected=-1;lab.reset();
      card.classList.remove('is-running','is-probed','is-lab-active');resetPaint();
      button.setAttribute('aria-pressed','false');button.firstChild.textContent='Replay ';status(spec.idle);
    }
    function paint(p) {
      var hot='var(--accent)', nodes=card.querySelectorAll('.fault-marker');
      nodes.forEach(function(node){node.style.opacity=String(.25+.75*Math.min(1,p*4));});
      card.querySelectorAll('.blocked-route').forEach(function(node){node.style.opacity=String(Math.max(0,Math.min(1,(p-.4)/.4)));});
      var capture=card.querySelector('.capture-dot');if(capture)capture.style.transform='translateX('+(41*p)+'px)';
      [['.recall-marker',99],['.recall-active',100]].forEach(function(entry){var node=card.querySelector(entry[0]);if(node)node.style.transform='translateX('+(entry[1]*p)+'px)';});
      card.querySelectorAll('.trace-span').forEach(function(node,i){node.style.opacity=String(.2+.8*Math.max(0,Math.min(1,(p-i*.08)/.65)));node.querySelector('rect').style.stroke=hot;});
      card.querySelectorAll('.pulse-bar').forEach(function(node,i){node.style.opacity=String(.2+.65*Math.max(0,Math.min(1,(p-i*.008)/.65)));node.style.fill=hot;});
      var wave=card.querySelector('.pulse-wave');if(wave){wave.style.strokeDasharray='1';wave.style.strokeDashoffset=String(1-p);wave.setAttribute('pathLength','1');}
      var voters=card.querySelectorAll('.voter');voters.forEach(function(node,i){node.style.fill=p>=(i+1)/(voters.length+1)?hot:'var(--paper)';});
      card.querySelectorAll('.vote-link').forEach(function(node){node.style.opacity=String(.2+.5*p);});
      var courier=card.querySelector('.scene-courier'), n=p*(spec.points.length-1), at=Math.min(spec.points.length-2,Math.floor(n)), k=n-at;
      k=k*k*(3-2*k);var a=spec.points[at],b=spec.points[at+1];
      courier.setAttribute('transform','translate('+(a[0]+(b[0]-a[0])*k)+' '+(a[1]+(b[1]-a[1])*k)+')');
      if(ramp){
        var ball=card.querySelector('.physics-ball'), index=p*(ramp.samples.length-1), left=Math.floor(index), next=Math.min(ramp.samples.length-1,left+1), mix=index-left;
        var x=ramp.samples[left][0]+(ramp.samples[next][0]-ramp.samples[left][0])*mix,y=ramp.samples[left][1]+(ramp.samples[next][1]-ramp.samples[left][1])*mix;
        ball.setAttribute('cx',x);ball.setAttribute('cy',y);var dot=card.querySelector('.scene-art circle.accent-fill');if(dot){dot.setAttribute('cx',x);dot.setAttribute('cy',y);}
        card.querySelector('.strong').setAttribute('d','M'+ramp.ramp.x1+' '+ramp.ramp.y1+'L'+ramp.ramp.x2+' '+ramp.ramp.y2);
        card.querySelector('.trajectory').setAttribute('d',ramp.samples.map(function(point,i){return(i?'L':'M')+point.join(' ');}).join(''));
      }
    }
    function update() {
      var step=0;spec.steps.forEach(function(entry,i){if(run.elapsed>=entry[0])step=i;});
      if(inspected<0)status(spec.steps[step][1]);
      var end=spec.steps[spec.steps.length-1][0], progress=Math.min(1,run.elapsed/end);
      paint(progress);
      if(progress===1){completed=true;card.classList.remove('is-running');run=null;cancel();}
    }
    function frame(now) {
      raf=0;if(!allowed()||inspected>=0){last=0;return;}
      var dt=last?Math.min(100,now-last):0;last=now;run.elapsed+=dt;update();queue();
    }
    function preview(manual) {
      reset();card.classList.toggle('is-probed',!!manual);
      if(manual){button.setAttribute('aria-pressed','true');button.firstChild.textContent='Reset ';}
      run={elapsed:0};if(reduced())run.elapsed=spec.steps[spec.steps.length-1][0];
      card.classList.toggle('is-running',!reduced());update();queue();
    }
    function sync() {
      matrix=null;
      if(active&&enabled&&onscreen&&!document.hidden)lab.resume();else lab.pause();
      if(!allowed())cancel();else queue();
    }
    new IntersectionObserver(function(entries){onscreen=entries[entries.length-1].isIntersecting;sync();}).observe(drawing);
    drawing.addEventListener('pointerenter',function(){var m=svg.getScreenCTM();matrix=m?m.inverse():null;});
    drawing.addEventListener('pointermove',function(event){
      if(modelActive||event.pointerType==='touch'||!active)return;
      if(!matrix){var m=svg.getScreenCTM();matrix=m?m.inverse():null;}if(!matrix)return;
      var point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix),near=-1,gap=80;
      spec.points.forEach(function(p,i){var distance=Math.hypot(point.x-p[0],point.y-p[1]);if(distance<gap){gap=distance;near=i;}});
      if(near===inspected)return;inspected=near;
      var mark=card.querySelector('.scene-pointer');mark.style.opacity=near<0?'0':'.75';
      if(near>=0){mark.setAttribute('transform','translate('+spec.points[near].join(' ')+')');status(spec.inspect[near]);cancel();}
      else {if(run)update();queue();}
    },{passive:true});
    drawing.addEventListener('pointerleave',function(){inspected=-1;card.querySelector('.scene-pointer').style.opacity='0';if(run)update();else if(!modelActive)status(completed?spec.steps.at(-1)[1]:spec.idle);queue();});
    card.querySelector('[data-lab-controls]').addEventListener('focusin',function(){touched=true;cancel();run=null;card.classList.remove('is-running');});
    button.addEventListener('click',function(){if(modelActive||card.classList.contains('is-probed'))reset();else if(touched){lab.run();sync();}else preview(true);});
    new ResizeObserver(function(){matrix=null;}).observe(drawing);
    return {
      activate:function(){active=true;preview(false);sync();},
      deactivate:function(){active=false;reset();lab.pause();},
      sync:sync,
      enabled:function(value){enabled=value;sync();},
      motionChanged:function(){
        if(reduced()&&run){run.elapsed=spec.steps.at(-1)[0];update();}
        if(reduced()&&modelActive&&card.dataset.scene==='airforge')lab.run();sync();
      },
      playing:function(){return !!run&&allowed()&&inspected<0;},
      snapshot:function(){return {active:active,enabled:enabled,visible:onscreen,elapsed:run?run.elapsed:null,model:lab.snapshot()};}
    };
  }
  window.SkyStudioScenes={mount:mount};
})();

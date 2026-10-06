// Genuine wall-clock render/input proof; no time, shader or pose overrides.
// node tools/qa/stage-1/live.mjs <output> [light|dark|blue|gear]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { serve } = await import(pathToFileURL(path.join(root, 'test/e2e/server.mjs')));
const out = path.resolve(process.argv[2]), mode = process.argv[3] || 'light';
fs.mkdirSync(out, { recursive: true });
const site = await serve(root);
const browser = await chromium.launch({channel:'chrome', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try {
  const context = await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,
    colorScheme:mode==='light'?'light':'dark', recordVideo:{dir:out,size:{width:1440,height:900}}});
  await context.addInitScript(({mode}) => {
    localStorage.setItem('sky-theme',mode==='light'?'light':'dark'); sessionStorage.setItem('sky-intro','seen');
    if(mode==='blue'||mode==='gear') sessionStorage.setItem('sky-gear',mode==='blue'?'blue':'two');
    window.__proof={samples:[],renderer:null};
    const proto=WebGL2RenderingContext.prototype, names=new WeakMap(),loc=proto.getUniformLocation;
    proto.getUniformLocation=function(p,n){const v=loc.call(this,p,n); if(v)names.set(v,n);return v;};
    const u=proto.uniform2f; proto.uniform2f=function(l,x,y){if(names.get(l)==='u_rot')window.__proof.rotation=[x,y];return u.call(this,l,x,y);};
    const draw=proto.drawArrays; proto.drawArrays=function(...args){
      if(this.canvas.classList.contains('hero-dots')){
        const ext=this.getExtension('WEBGL_debug_renderer_info');window.__proof.renderer=ext?this.getParameter(ext.UNMASKED_RENDERER_WEBGL):this.getParameter(this.RENDERER);
        window.__proof.samples.push({at:performance.now(),rotation:window.__proof.rotation,count:args[2]});
      }return draw.apply(this,args);
    };
  },{mode});
  const page=await context.newPage(),video=page.video(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(site.origin,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('#figure').classList.contains('is-live'));
  const events=[],start=Date.now(),box=await page.locator('#figure').boundingBox();
  const note=action=>events.push({seconds:(Date.now()-start)/1000,action});
  note('live; pointer outside hero');await page.waitForTimeout(7500);
  await page.screenshot({path:path.join(out,`${mode}-rest.png`)});
  note('trusted pointer to left side');await page.mouse.move(box.x+15,box.y+box.height*.55,{steps:14});await page.waitForTimeout(3500);
  await page.screenshot({path:path.join(out,`${mode}-left.png`)});
  note('trusted pointer crosses to right');await page.mouse.move(box.x+box.width-15,box.y+box.height*.55,{steps:24});await page.waitForTimeout(3500);
  await page.screenshot({path:path.join(out,`${mode}-right.png`)});
  note('pointer leaves; natural sway');await page.mouse.move(30,30,{steps:10});await page.waitForTimeout(14500);
  const proof=await page.evaluate(()=>window.__proof);
  fs.writeFileSync(path.join(out,`${mode}-events.json`),JSON.stringify({mode,viewport:{width:1440,height:900},dpr:1,
    note:'Natural speed. SwiftShader software rendering. MP4 encode rate does not establish presented FPS.',events,errors,...proof},null,2));
  await context.close(); await video.saveAs(path.join(out,`${mode}-natural.webm`));
  console.log(`${mode}: ${proof.samples.length} submitted draws; ${errors.length} page errors`);
}finally{await browser.close();site.server.close();}

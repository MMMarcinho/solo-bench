#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {fingerprint} from '../../shared/core.mjs';
import {decodePng,blueCoverage} from './png.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const name='02-GPT6 介绍页滚动效果';
const task=JSON.parse(fs.readFileSync(path.join(root,'case',name,'case.json')));
const rubric=JSON.parse(fs.readFileSync(path.join(root,'grader',name,'rubric.json')));
const args={};
for(let i=2;i<process.argv.length;i+=2){if(!['--candidate','--output','--chromium'].includes(process.argv[i])||!process.argv[i+1])throw Error('Usage: run.mjs --candidate PATH --output NEW_PATH [--chromium PATH]');args[process.argv[i]]=process.argv[i+1];}
if(!args['--candidate']||!args['--output'])throw Error('Missing candidate/output');
const candidate=fs.realpathSync(args['--candidate']),output=path.resolve(args['--output']);
const starter=fs.realpathSync(path.join(root,'case',name,'starter'));
if(candidate===starter||candidate.startsWith(starter+path.sep))throw Error('Do not run on immutable starter');
if(fs.existsSync(output)||output===candidate||output.startsWith(candidate+path.sep))throw Error('Output must be new and outside candidate');
fs.mkdirSync(output,{recursive:true});
const before=fingerprint(candidate);
const report={schema_version:'1.0',case_id:task.case_id,task_version:task.task_version,grader_version:rubric.grader_version,candidate_fingerprint:before.fingerprint,criteria:[],diagnostics:[],environment:{node:process.version,platform:process.platform,viewport:'1180x757 / 390x844',device_scale_factor:1},measurements:{},limitations:['The title curves are an independently calibrated approximation of observed frames, not the site algorithm.','Headless Chromium does not replace agent visual review or a physical mobile device.']};
const specs=rubric.criteria.filter(c=>c.method==='code');
let browser,server,page,phone;
function fail(message,blocked=false){const error=Error(message);error.blocked=blocked;throw error;}
function assert(condition,message){if(!condition)fail(message);}
function row(id,status,reason,evidence){const spec=specs.find(c=>c.id===id);report.criteria.push({...spec,status,score:status==='passed'?spec.max_score:status==='failed'?0:null,evidence,reason});}
async function check(id,fn){try{const evidence=await fn();row(id,'passed','Rendered browser measurements satisfy the declared checks.',evidence);}catch(e){row(id,e.blocked?'blocked':'failed',e.message,['measurements.json']);report.diagnostics.push({id,status:e.blocked?'blocked':'failed',message:e.message});}}
function write(){fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify(report.measurements,null,2)+'\n');fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');}
function staticServer(){return http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname)==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(candidate,rel);if(!file.startsWith(candidate+path.sep))throw Error('Path outside candidate');const bytes=fs.readFileSync(file);res.writeHead(200,{'content-type':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html','cache-control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function createPage(viewport,reducedMotion='no-preference'){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion,locale:'zh-CN',timezoneId:'UTC',serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===report.environment.origin?route.continue():route.abort());
  const p=await context.newPage();p.setDefaultTimeout(5000);
  p.on('pageerror',error=>report.diagnostics.push({id:'pageerror',status:'observed',message:error.message}));
  await p.goto(report.environment.origin,{waitUntil:'load'});await p.evaluate(()=>document.fonts.ready);return p;
}
async function titlePhase(p,ratio,settle=750){
  await p.evaluate(ratio=>{document.documentElement.style.scrollBehavior='auto';const e=document.querySelector('[data-title-anchor]');if(!e)throw Error('Missing public title anchor');scrollTo({top:scrollY+e.getBoundingClientRect().top-innerHeight*ratio,behavior:'instant'});},ratio);
  await p.waitForTimeout(settle);
}
async function sectionPhase(p,id,ratio,settle=700){
  await p.evaluate(({id,ratio})=>{document.documentElement.style.scrollBehavior='auto';const e=document.querySelector('[data-effect-id="'+id+'"]');if(!e)throw Error('Missing public effect hook '+id);scrollTo({top:scrollY+e.getBoundingClientRect().top-innerHeight*ratio,behavior:'instant'});},{id,ratio});
  await p.waitForTimeout(settle);
}
async function shot(p,name){const file=name+'.png';await p.screenshot({path:path.join(output,file),animations:'disabled'});return file;}
async function titleMetric(p){return p.evaluate(()=>{
  const anchor=document.querySelector('[data-title-anchor]'),fixed=document.querySelector('[data-title-fixed]'),phrase=document.querySelector('[data-title-phrase]'),pointer=document.querySelector('[data-title-pointer]'),body=document.querySelector('[data-static-body]');
  if(!anchor||!fixed||!phrase||!pointer||!body)throw Error('Title observation hooks missing');
  const layout=el=>{let x=0,y=0,n=el;while(n){x+=n.offsetLeft;y+=n.offsetTop;n=n.offsetParent;}return {x:x-scrollX,y:y-scrollY};};
  const anchorBox=anchor.getBoundingClientRect(),fixedBox=fixed.getBoundingClientRect(),phraseBox=phrase.getBoundingClientRect(),pointerBox=pointer.getBoundingClientRect(),bodyBox=body.getBoundingClientRect(),pLayout=layout(phrase),cLayout=layout(pointer);
  const phraseStyle=getComputedStyle(phrase),pointerStyle=getComputedStyle(pointer),pm=phraseStyle.transform==='none'?new DOMMatrix():new DOMMatrix(phraseStyle.transform),cm=pointerStyle.transform==='none'?new DOMMatrix():new DOMMatrix(pointerStyle.transform);
  const translation=style=>{if(style.translate==='none')return [0,0];const p=style.translate.split(' ');return [parseFloat(p[0])||0,parseFloat(p[1])||0];};
  const [ptx,pty]=translation(phraseStyle),[ctx,cty]=translation(pointerStyle);
  const angle=matrix=>Math.atan2(matrix.b,matrix.a)*180/Math.PI;
  const textAngle=angle(pm)+(phraseStyle.rotate==='none'?0:parseFloat(phraseStyle.rotate)||0);
  const cursorAngle=angle(cm)+(pointerStyle.rotate==='none'?0:parseFloat(pointerStyle.rotate)||0);
  // The bounding box expands when the phrase rotates around its center.
  // Recover the visual translation independently of that expansion.
  const textX=phraseBox.x-pLayout.x-(phrase.offsetWidth-phraseBox.width)/2;
  const textY=phraseBox.y-pLayout.y-(phrase.offsetHeight-phraseBox.height)/2;
  const pointerScale=Math.hypot(cm.a,cm.b)*(pointerStyle.scale==='none'?1:parseFloat(pointerStyle.scale)||1);
  const pointerX=cLayout.x+cm.e+ctx+4,pointerY=cLayout.y+cm.f+cty+4;
  const contactLocal={x:phrase.offsetWidth*.8,y:phrase.offsetHeight*.4},center={x:phrase.offsetWidth/2,y:phrase.offsetHeight/2},rad=textAngle*Math.PI/180;
  const contactX=pLayout.x+textX+center.x+(contactLocal.x-center.x)*Math.cos(rad)-(contactLocal.y-center.y)*Math.sin(rad);
  const contactY=pLayout.y+textY+center.y+(contactLocal.x-center.x)*Math.sin(rad)+(contactLocal.y-center.y)*Math.cos(rad);
  return {anchorRatio:anchorBox.top/innerHeight,textX,textY,textAngle,layoutGap:pLayout.x-fixedBox.right,phraseWidth:phrase.offsetWidth,phraseHeight:phrase.offsetHeight,fontSize:parseFloat(phraseStyle.fontSize),bodyRelativeTop:bodyBox.top-anchorBox.top,bodyTransform:getComputedStyle(body).transform,pointerX,pointerY,pointerAngle:cursorAngle,pointerScale,pointerOpacity:Number(pointerStyle.opacity),pointerDisplay:pointerStyle.display,pointerBox:pointerBox.toJSON(),contactDistance:Math.hypot(pointerX-contactX,pointerY-contactY),fixedBox:fixedBox.toJSON(),phraseBox:phraseBox.toJSON()};
});}
async function lineBoxes(p,id){return p.evaluate(id=>{const root=document.querySelector('[data-effect-id="'+id+'"]'),copy=root?.querySelector('.highlight-copy')||root;if(!copy)throw Error('Missing highlight target '+id);const walker=document.createTreeWalker(copy,NodeFilter.SHOW_TEXT),rects=[];while(walker.nextNode()){const text=walker.currentNode;if(!text.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(text);for(const r of range.getClientRects())if(r.width>2&&r.height>5)rects.push({x:r.left,right:r.right,y:r.top,height:r.height});}const rows=[];for(const r of rects){const row=rows.find(line=>Math.abs(line.y-r.y)<3);if(row){row.x=Math.min(row.x,r.x);row.right=Math.max(row.right,r.right);row.height=Math.max(row.height,r.height);}else rows.push({...r});}return rows.sort((a,b)=>a.y-b.y);},id);}
async function selection(p,id){const lines=await lineBoxes(p,id),png=decodePng(await p.screenshot({animations:'disabled'}));const coverage=lines.map(line=>blueCoverage(png,line));return {lines,coverage,total:coverage.length?coverage.reduce((a,b)=>a+b,0)/coverage.length:0};}
function renderedDifference(beforeImage,afterImage,box){const a=decodePng(beforeImage),b=decodePng(afterImage);if(a.width!==b.width||a.height!==b.height)throw Error('Pixel evidence dimensions mismatch');const x0=Math.max(0,Math.floor(box.x-3)),x1=Math.min(a.width,Math.ceil(box.right+3)),y0=Math.max(0,Math.floor(box.y-3)),y1=Math.min(a.height,Math.ceil(box.bottom+3));let changed=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*a.width+x)*a.channels,j=(y*b.width+x)*b.channels;if(Math.abs(a.pixels[i]-b.pixels[j])+Math.abs(a.pixels[i+1]-b.pixels[j+1])+Math.abs(a.pixels[i+2]-b.pixels[j+2])>75)changed++;}return changed;}

try{
  if(!fs.existsSync(path.join(candidate,'index.html'))){row('story_structure','failed','Candidate index.html missing',['measurements.json']);fail('Candidate has no runnable index.html');}
  let chromium;
  try{({chromium}=await import('playwright'));browser=await chromium.launch({headless:true,...(args['--chromium']?{executablePath:path.resolve(args['--chromium'])}:{})});}
  catch(e){fail('Chromium/Playwright unavailable: '+e.message,true);}
  report.environment.browser=browser.version();server=staticServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  report.environment.origin='http://127.0.0.1:'+server.address().port;page=await createPage({width:1180,height:757});
  await check('story_structure',async()=>{
    const data=await page.evaluate(()=>({h1:document.querySelector('h1')?.textContent.trim(),fixed:document.querySelector('[data-title-fixed]')?.textContent.trim(),phrase:document.querySelector('[data-title-phrase]')?.textContent.trim(),paragraphs:document.querySelectorAll('article p').length,links:[...document.querySelectorAll('a[href^="#"]')].length,highlights:document.querySelectorAll('[data-effect="highlight"]').length,scrollHeight:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth-innerWidth}));
    report.measurements.story_structure=data;
    assert(data.h1?.includes('GPT')&&data.fixed==='推出'&&data.phrase==='智能界面'&&data.paragraphs>=5&&data.links>=3&&data.highlights===3,'Chinese article structure or public title/highlight targets missing');
    assert(data.scrollHeight>757*3&&data.overflow<=2,'Article does not scroll or overflows horizontally');
    assert(!report.diagnostics.some(d=>d.id==='pageerror'),'Page script threw an error');
    return [await shot(page,'story-top'),'measurements.json'];
  });
  await check('title_drag',async()=>{
    const ratios=[1.172081,.981857,.938264,.913123,.861645,.822015,.722940,.622544,.572346,.522106,.452134],samples=[];
    for(const ratio of ratios){await titlePhase(page,ratio);samples.push({requestedRatio:ratio,...await titleMetric(page)});}
    report.measurements.title_drag={samples};
    assert(samples.every(s=>Math.abs(s.anchorRatio-s.requestedRatio)<.015),'Title anchor could not reach declared scroll phases');
    assert(samples.every(s=>Math.abs(s.layoutGap)<6),'推出 and 智能界面 do not share a tight final baseline');
    assert(samples.every(s=>Math.abs(s.bodyRelativeTop-samples[0].bodyRelativeTop)<3&&s.bodyTransform==='none'),'Body below title moves with the title');
    assert(samples[0].phraseWidth>85&&samples[0].phraseWidth<140&&samples[0].phraseHeight>28&&samples[0].phraseHeight<48&&samples[0].fontSize>24&&samples[0].fontSize<33,'Title phrase scale is far from observed desktop heading');
    for(const i of [0,1,2])assert(samples[i].textX>85&&samples[i].textX<130&&samples[i].textY>12&&samples[i].textY<36&&samples[i].textAngle>2&&samples[i].textAngle<8,'Title moves before cursor approach or lacks initial displacement');
    assert(samples[3].textX<110&&samples[3].textX>85&&samples[3].textY>23,'Title does not begin dragging after cursor contact');
    assert(samples[4].textX>65&&samples[4].textX<100&&samples[4].textY>23,'Title misses shallow downward drag stage');
    assert(samples[5].textX>50&&samples[5].textX<90&&samples[5].textY>18&&samples[5].textY<40&&samples[5].textAngle>1.8&&samples[5].textAngle<5,'Title misses measured mid-drag pose');
    assert(samples[6].textX>20&&samples[6].textX<60&&samples[6].textY>12&&samples[6].textY<35,'Title does not continue returning with scroll');
    assert(samples[7].textX>=0&&samples[7].textX<25&&samples[7].textY>=0&&samples[7].textY<18,'Title does not approach baseline');
    for(const i of [8,9,10])assert(Math.abs(samples[i].textX)<7&&Math.abs(samples[i].textY)<7&&Math.abs(samples[i].textAngle)<1,'Title fails to settle at normal baseline');
    await titlePhase(page,.822015);const heldA=await titleMetric(page);const partialScreenshot=await shot(page,'title-drag-partial');await pause(10500);const heldB=await titleMetric(page);
    await titlePhase(page,.572346);const end=await titleMetric(page);await titlePhase(page,.822015);const reverse=await titleMetric(page);await titlePhase(page,.938264);const earlyReverse=await titleMetric(page);
    report.measurements.title_drag={samples,heldA,heldB,end,reverse,earlyReverse};
    assert(Math.abs(heldA.textX-heldB.textX)<2&&Math.abs(heldA.textY-heldB.textY)<2&&Math.abs(heldA.textAngle-heldB.textAngle)<.2,'Title auto-plays while scrolling is paused');
    assert(Math.abs(reverse.textX-heldA.textX)<5&&Math.abs(reverse.textY-heldA.textY)<5&&Math.abs(reverse.textAngle-heldA.textAngle)<.5,'Title does not retrace the same mid-drag pose on upward scroll');
    assert(earlyReverse.textX>85&&earlyReverse.textAngle>2,'Title cannot return to its displaced start');
    return [partialScreenshot,'measurements.json'];
  });
  await check('title_pointer',async()=>{
    const ratios=[1.172081,.981857,.938264,.913123,.861645,.822015,.722940,.622544,.572346,.522106,.452134],samples=[];
    for(const ratio of ratios){await titlePhase(page,ratio);samples.push({requestedRatio:ratio,...await titleMetric(page)});}
    assert(samples[0].pointerOpacity<.15&&samples[1].pointerOpacity>.2&&samples[1].pointerOpacity<.85&&samples[2].pointerOpacity>.8,'Title cursor does not approach before drag');
    assert(samples[2].textX>85&&samples[3].textX<110,'Phrase moves before pointer arrives or never begins drag');
    assert(samples[3].pointerScale<.97&&samples[5].pointerScale>.72&&samples[5].pointerScale<.96,'Pointer does not shrink on contact');
    for(const i of [3,4,5,6,7])assert(samples[i].pointerOpacity>.8&&samples[i].contactDistance<27,'Pointer loses contact with moving title at stage '+i);
    assert(samples[8].textX<7&&samples[8].pointerOpacity>.8&&samples[8].pointerScale>.94,'Pointer releases before text returns or never restores size');
    assert(samples[10].textX<7&&samples[10].pointerOpacity<.15&&samples[10].pointerY<samples[8].pointerY-15,'Pointer does not leave up-right after release');
    await titlePhase(page,.938264);await titlePhase(page,.822015);const forward=await titleMetric(page),painted=await page.screenshot({animations:'disabled'});const screenshot=await shot(page,'title-pointer-contact');
    await page.evaluate(()=>document.querySelector('[data-title-pointer]').style.visibility='hidden');const hidden=await page.screenshot({animations:'disabled'});await page.evaluate(()=>document.querySelector('[data-title-pointer]').style.visibility='');
    const paintedPixelCount=renderedDifference(painted,hidden,forward.pointerBox);
    await titlePhase(page,.572346);await titlePhase(page,.822015);const reverse=await titleMetric(page);
    report.measurements.title_pointer={samples,forward,reverse,paintedPixelCount};
    assert(paintedPixelCount>18,'Title cursor has geometry but no visible rendered pixels');
    assert(Math.abs(forward.pointerAngle-reverse.pointerAngle)>55,'Cursor direction does not respond to reverse movement');
    assert(Math.abs(forward.pointerX-reverse.pointerX)<15&&Math.abs(forward.pointerY-reverse.pointerY)<15,'Pointer follows different paths for forward and reverse scroll');
    return [screenshot,'measurements.json'];
  });
  await check('line_selection',async()=>{
    const samples={};
    for(const id of ['h1','h2','h3']){
      const phases=[];for(const ratio of [.75,.55,.2]){await sectionPhase(page,id,ratio);phases.push({ratio,...await selection(page,id)});}
      samples[id]=phases;
      assert(phases.every(s=>s.lines.length>=2),'Highlight '+id+' does not wrap across measured lines');
      assert(phases[0].total<phases[1].total-.06&&phases[1].total<phases[2].total-.06,'Highlight '+id+' does not grow with scroll');
      assert(phases[2].coverage.every(v=>v>.65),'Highlight '+id+' does not complete its lines');
      assert(phases.slice(0,2).some(s=>s.coverage.some(v=>v>.06&&v<.92)),'Highlight '+id+' has no partial line stage');
      assert(phases[1].coverage.every((v,i,a)=>i===0||a[i-1]+.15>=v),'Highlight '+id+' fills later lines first');
    }
    await sectionPhase(page,'h2',.55);const pausedA=await selection(page,'h2');const screenshot=await shot(page,'selection-partial');await pause(10500);const pausedB=await selection(page,'h2');await sectionPhase(page,'h2',.2);const end=await selection(page,'h2');await sectionPhase(page,'h2',.55);const back=await selection(page,'h2');
    report.measurements.line_selection={samples,pausedA,pausedB,end,back};
    assert(Math.abs(pausedA.total-pausedB.total)<.04&&back.total<end.total-.07,'Highlight auto-plays or fails to reverse');
    return [screenshot,'measurements.json'];
  });
  await check('responsive_motion',async()=>{
    await page.setViewportSize({width:390,height:844});await titlePhase(page,.822015);const mobile=await titleMetric(page);const mobileTitleScreenshot=await shot(page,'phone-title-partial');
    const geometry=await page.evaluate(()=>{const body=document.querySelector('[data-static-body]')?.getBoundingClientRect();scrollTo({left:9999,behavior:'instant'});return {horizontalTravel:scrollX,body:body?{left:body.left,right:body.right}:null};});
    assert(geometry.horizontalTravel<=2&&geometry.body&&geometry.body.left>=-2&&geometry.body.right<=392,'Phone layout scrolls sideways or clips static body');
    assert(Math.abs(mobile.layoutGap)<6&&mobile.phraseBox.right<=392,'Title fragments separate or clip on phone');
    await sectionPhase(page,'h2',.55);const narrow=await selection(page,'h2');assert(narrow.lines.length>=3&&narrow.coverage.some(v=>v>.06&&v<.94),'Highlight fails to rewrap on phone');
    const screenshot=await shot(page,'phone-title-and-story');
    await page.setViewportSize({width:1180,height:757});await sectionPhase(page,'h2',.55);const wideAgain=await selection(page,'h2');assert(wideAgain.lines.length<narrow.lines.length,'Highlight does not reconstruct after resize');
    phone=await createPage({width:390,height:844},'reduce');await titlePhase(phone,.938264);const reduced=await titleMetric(phone);
    assert(Math.abs(reduced.textX)<7&&Math.abs(reduced.textY)<7&&(reduced.pointerOpacity<.1||reduced.pointerDisplay==='none'),'Reduced motion still moves the title or shows cursor');
    report.measurements.responsive_motion={mobile,geometry,narrow:{lines:narrow.lines.length,coverage:narrow.coverage},wideAgain:{lines:wideAgain.lines.length,coverage:wideAgain.coverage},reduced};
    return [mobileTitleScreenshot,screenshot,'measurements.json'];
  });
}catch(e){report.diagnostics.push({id:'runner_stop',status:e.blocked?'blocked':'observed',message:e.message});}
finally{
  if(phone)await phone.context().close();if(page)await page.context().close();if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
  const after=fingerprint(candidate);report.candidate_unchanged_during_grading=after.fingerprint===before.fingerprint;
  if(!report.candidate_unchanged_during_grading)report.diagnostics.push({id:'candidate_changed',status:'blocked',message:'Candidate changed during grading'});
  for(const spec of specs)if(!report.criteria.some(r=>r.id===spec.id))row(spec.id,report.diagnostics.some(d=>d.status==='blocked')?'blocked':'not_run','Earlier runner/browser step prevented observation.',[]);
  if(!report.candidate_unchanged_during_grading)for(const r of report.criteria){r.status='blocked';r.score=null;r.reason='Candidate changed during grading';r.evidence=[];}
  write();console.log(JSON.stringify({criteria:report.criteria.map(({id,status})=>({id,status})),result:path.join(output,'result.json')}));
  process.exitCode=report.criteria.some(r=>r.status==='blocked')?2:report.criteria.some(r=>r.status==='failed')?1:0;
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fingerprint,emptyCriterion} from '../../shared/core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const id='04-creation-dialog-race';
const task=JSON.parse(fs.readFileSync(path.join(root,'case',id,'case.json')));
const rubric=JSON.parse(fs.readFileSync(path.join(root,'grader',id,'rubric.json')));
const args={};
for(let i=2;i<process.argv.length;i+=2){if(!['--candidate','--output','--chromium'].includes(process.argv[i])||!process.argv[i+1])throw Error('Usage: --candidate PATH --output NEW_PATH [--chromium PATH]');args[process.argv[i]]=process.argv[i+1];}
if(!args['--candidate']||!args['--output'])throw Error('Missing candidate/output');
const candidate=fs.realpathSync(args['--candidate']),output=path.resolve(args['--output']);
const source=fs.realpathSync(path.join(root,'case',id,task.source.directory));
if(candidate===source||candidate.startsWith(source+path.sep))throw Error('Do not grade immutable source');
if(fs.existsSync(output)||output===candidate||output.startsWith(candidate+path.sep))throw Error('Output must be new and outside candidate');
fs.mkdirSync(output,{recursive:true});
const before=fingerprint(candidate);
const report={schema_version:'1.0',case_id:id,task_version:task.task_version,grader_version:rubric.grader_version,candidate_fingerprint:before.fingerprint,criteria:[],diagnostics:[],environment:{node:process.version,platform:process.platform},measurements:{},limitations:['Deterministic Chromium interaction checks, not real-device or visual-quality certification.','Candidate server code must run inside an externally isolated, credential-free environment; routing is not a security sandbox.']};
let browser,server,serverLog='',serverExit=null,origin;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function assert(ok,message){if(!ok)throw Error(message);}
async function until(fn,message,timeout=4000){const end=Date.now()+timeout;while(Date.now()<end){if(await fn())return;await pause(20);}throw Error(message);}
function blocked(message){const e=Error(message);e.blocked=true;return e;}
function equal(a,b,message){assert(JSON.stringify(a)===JSON.stringify(b),message+': '+JSON.stringify(a));}
function payloadEqual(a,b,message){equal(Object.keys(a||{}).sort(),Object.keys(b).sort(),message+' keys');for(const k of Object.keys(b))equal(a[k],b[k],message+' '+k);}
async function fresh(){
 const context=await browser.newContext({viewport:{width:1100,height:800},locale:'en-US',timezoneId:'UTC',serviceWorkers:'block'});
 const p=await context.newPage();p.setDefaultTimeout(2200);
 const requests=[],posts=[],errors=[];
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==origin)return route.abort();
  if(/^\/api\/templates\/(studio|lab)$/.test(url.pathname)&&req.method()==='GET'){
   requests.push({route,id:url.pathname.split('/').pop(),settled:false});return;
  }
  if(url.pathname==='/api/projects'&&req.method()==='POST'){
   let body;try{body=req.postDataJSON();}catch{body={invalidJSON:req.postData()};}
   posts.push(body);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'created-item',name:body.name,mode:body.mode})});return;
  }
  return route.continue();
 });
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin,{waitUntil:'load'});
 const t=name=>p.getByTestId(name);
 const settle=async()=>{await p.waitForTimeout(100);};
 const respond=async(index,title,status=200)=>{await until(()=>requests[index],'Expected template request '+index);const q=requests[index];q.settled=true;try{await q.route.fulfill({status,contentType:'application/json',body:JSON.stringify(status===200?{id:q.id,title,description:title+' description'}:{error:'Synthetic failure'})});}catch(e){if(!/closed|disposed|cancel|abort|Invalid Interception/i.test(e.message))throw e;}await settle();};
 const select=async value=>{const count=requests.length;await t('template').selectOption(value);await until(()=>requests.length>count,'Template selection did not issue a fresh GET');return count;};
 const ready=async title=>{await until(async()=>await t('template-status').getAttribute('data-state')==='ready','Current template never became ready');assert((await t('template-preview').innerText()).includes(title),'Preview does not show active response');assert((await t('template-preview').innerText()).includes(title+' description'),'Preview omits active description');};
 const submit=async()=>{if(await t('submit').isEnabled())await t('submit').click();await settle();};
 const noPost=async message=>{await submit();assert(posts.length===0,message);};
 const snapshot=async()=>({posts,requests:requests.map(q=>({id:q.id,settled:q.settled})),errors,body:await p.locator('body').innerText()});
 return {p,context,t,requests,posts,errors,settle,respond,select,ready,submit,noPost,snapshot};
}
async function check(name,fn){let f;const spec=rubric.criteria.find(c=>c.id===name);try{f=await fresh();await fn(f);assert(f.errors.length===0,'Page threw: '+f.errors.join('; '));report.criteria.push({...spec,status:'passed',score:spec.max_score,evidence:[name+'.json',name+'.png'],reason:'All declared sequences passed using rendered controls and captured HTTP payloads.'});}catch(e){report.criteria.push({...spec,status:e.blocked?'blocked':'failed',score:e.blocked?null:0,evidence:[name+'.json'],reason:e.message});report.diagnostics.push({id:name,status:e.blocked?'blocked':'failed',message:e.message});}finally{if(f){let state;try{state=await f.snapshot();await f.p.screenshot({path:path.join(output,name+'.png')});}catch(e){state={error:e.message};}report.measurements[name]=state;fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify(state,null,2)+'\n');await f.context.close();}else fs.writeFileSync(path.join(output,name+'.json'),JSON.stringify({error:'Browser fixture unavailable'})+'\n');}}
try{
 assert(fs.existsSync(path.join(candidate,'server.mjs')),'Missing required server.mjs entry point');
 let chromium;try{({chromium}=await import('playwright'));browser=await chromium.launch({headless:true,...(args['--chromium']?{executablePath:path.resolve(args['--chromium'])}:{})});}catch(e){throw blocked('Browser infrastructure unavailable: '+e.message);}
 report.environment.browser=browser.version();
 server=spawn(process.execPath,['server.mjs'],{cwd:candidate,env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR||'/tmp',LANG:'C.UTF-8',TZ:'UTC',PORT:'0'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',d=>{serverLog+=d;const m=serverLog.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(m)origin=m[0];});server.stderr.on('data',d=>serverLog+=d);server.on('error',e=>{serverLog+=e.message;serverExit=-1;});server.on('exit',code=>serverExit=code??-1);
 try{await until(()=>origin||serverExit!==null,'Candidate server did not publish its listening URL',5000);}catch(e){throw /EACCES|EPERM/.test(serverLog)?blocked('Infrastructure denied server startup: '+serverLog):e;}
 assert(origin&&serverExit===null,'Candidate server failed: '+serverLog);report.environment.origin=origin;
 await check('manual_payload',async f=>{const {t,posts,submit}=f;await t('open-create').click();assert(await t('create-dialog').isVisible(),'Dialog not visible');equal(await t('name').inputValue(),'','Default name');equal(await t('seats').inputValue(),'3','Default seats');await t('name').fill('  Example item  ');await t('seats').fill('7');await submit();await until(()=>posts.length===1,'Manual submit did not POST once');payloadEqual(posts[0],{mode:'manual',name:'Example item',seats:7},'Manual payload');await until(async()=>await t('create-result').isVisible(),'Success feedback missing');assert((await t('create-result').innerText()).includes('Example item'),'Success feedback lacks created name');assert(!(await t('create-dialog').isVisible()),'Successful manual POST did not close dialog');});
 await check('mode_isolation',async f=>{
  const {t,posts,requests,select,respond,ready,submit,noPost}=f;
  await t('open-create').click();await t('name').fill('Shared name');await t('seats').fill('8');
  await t('mode-template').click();equal(await t('template').inputValue(),'','First template mode should have no selection');
  await select('studio');await t('mode-manual').click();
  equal(await t('name').inputValue(),'Shared name','Name must survive mode switch');equal(await t('seats').inputValue(),'8','Manual seats must survive switch');
  await t('mode-template').click();equal(await t('template').inputValue(),'studio','Selected template must survive switch');
  await until(()=>requests.length===2,'Returning to template must refetch');
  await respond(0,'Obsolete mode response');
  equal(await t('template-status').getAttribute('data-state'),'loading','Old mode response resolved current loading state');
  assert((await t('template-status').innerText()).trim().length>0,'Loading has no readable feedback');
  assert(!(await t('template-preview').innerText()).includes('Obsolete mode response'),'Stale detail visible during refetch');
  await noPost('Old mode response enabled premature submit');
  await respond(1,'Studio refreshed');await ready('Studio refreshed');assert(await t('template-preview').isVisible(),'Ready preview hidden');
  await submit();await until(()=>posts.length===1,'Template submit missing');
  payloadEqual(posts[0],{mode:'template',name:'Shared name',templateId:'studio'},'Template payload must omit manual fields');
 });
 await check('template_race',async f=>{const {t,select,respond,ready,posts,submit,settle}=f;await t('open-create').click();await t('name').fill('Race item');await t('mode-template').click();await select('studio');await select('lab');await respond(1,'Lab current');await ready('Lab current');await respond(0,'Studio obsolete');await ready('Lab current');assert(!(await t('template-preview').innerText()).includes('Studio obsolete'),'Old success overwrites preview');await select('studio');await select('lab');await respond(3,'Lab newest');await respond(2,'Old error',500);await ready('Lab newest');await submit();await until(()=>posts.length===1,'Race submit missing');payloadEqual(posts[0],{mode:'template',name:'Race item',templateId:'lab'},'Race payload');});
 await check('dialog_lifecycle',async f=>{const {t,select,respond,ready,posts,submit,requests}=f;await t('open-create').click();await t('name').fill('Old draft');await t('seats').fill('9');await t('mode-template').click();await select('studio');await t('cancel').click();assert(!(await t('create-dialog').isVisible()),'Cancel did not close');await t('open-create').click();equal(await t('name').inputValue(),'','Reopen resets name');equal(await t('seats').inputValue(),'3','Reopen resets seats and manual mode');await t('mode-template').click();equal(await t('template').inputValue(),'','Reopen resets template choice');equal(await t('template-status').getAttribute('data-state'),'idle','Reopen template state idle');await select('studio');await respond(1,'New generation');await ready('New generation');await respond(0,'Old generation');await ready('New generation');assert(!(await t('template-preview').innerText()).includes('Old generation'),'Previous dialog generation contaminated new draft');await t('name').fill('Escaped draft');await f.p.keyboard.press('Escape');assert(!(await t('create-dialog').isVisible()),'Escape did not close dialog');await t('open-create').click();equal(await t('name').inputValue(),'','Escape reopen resets name');equal(await t('seats').inputValue(),'3','Escape reopen resets manual mode/seats');await t('mode-template').click();equal(await t('template').inputValue(),'','Escape reopen resets template');equal(await t('template-status').getAttribute('data-state'),'idle','Escape reopen resets status');await select('studio');await respond(2,'Final studio');await ready('Final studio');await t('name').fill('Fresh draft');await submit();await until(()=>posts.length===1,'Fresh draft submit missing');payloadEqual(posts[0],{mode:'template',name:'Fresh draft',templateId:'studio'},'Fresh payload');});
 await check('error_recovery',async f=>{const {t,select,respond,ready,requests,posts,submit}=f;await t('open-create').click();await t('name').fill('Retry item');await t('mode-template').click();await select('lab');await respond(0,'Failed',500);await until(async()=>await t('template-status').getAttribute('data-state')==='error','Active failure not shown');assert((await t('template-status').innerText()).trim().length>0,'Error status has no readable feedback');assert(await t('retry-template').isVisible()&&await t('retry-template').isEnabled(),'Retry unavailable');await t('retry-template').click();await until(()=>requests.length===2,'Retry did not request template');equal(requests[1].id,'lab','Retry requests current choice');equal(await t('template-status').getAttribute('data-state'),'loading','Retry must show loading');await respond(1,'Recovered lab');await ready('Recovered lab');await submit();await until(()=>posts.length===1,'Recovered template cannot submit');payloadEqual(posts[0],{mode:'template',name:'Retry item',templateId:'lab'},'Retry payload');});
 await check('validation',async f=>{const {t,select,respond,ready,posts,noPost,submit}=f;await t('open-create').click();await t('name').fill('   ');await noPost('Whitespace-only name submitted');await t('name').fill('Valid item');for(const value of ['0','21','1.5','']){await t('seats').fill(value);await noPost('Invalid manual seats submitted: '+value);}await t('seats').fill('3');await t('mode-template').click();await noPost('No template selected but submitted');await select('studio');await noPost('Loading template submitted');await respond(0,'Error',500);await noPost('Failed template submitted');await t('mode-manual').click();await submit();await until(()=>posts.length===1,'Manual mode blocked by stale template error');payloadEqual(posts[0],{mode:'manual',name:'Valid item',seats:3},'Manual after error payload');});
}catch(e){report.diagnostics.push({id:'runner_stop',status:e.blocked?'blocked':'failed',message:e.message});for(const spec of rubric.criteria)if(!report.criteria.some(c=>c.id===spec.id))report.criteria.push(emptyCriterion(spec,e.blocked?'blocked':'failed',e.message));for(const c of report.criteria)if(c.status==='failed'&&c.score===null){c.score=0;c.evidence=['server.log'];}}
finally{
 if(browser)await browser.close();if(server&&serverExit===null){server.kill('SIGTERM');await Promise.race([new Promise(r=>server.once('exit',r)),pause(1000)]);if(serverExit===null)server.kill('SIGKILL');}
 report.candidate_unchanged_during_grading=fingerprint(candidate).fingerprint===before.fingerprint;
 if(!report.candidate_unchanged_during_grading)for(const c of report.criteria){c.status='blocked';c.score=null;c.reason='Candidate source changed during grading';c.evidence=[];}
 fs.writeFileSync(path.join(output,'server.log'),serverLog);fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify(report.measurements,null,2)+'\n');fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.criteria.map(({id,status})=>({id,status}))));process.exitCode=report.criteria.some(c=>c.status==='blocked')?2:report.criteria.some(c=>c.status==='failed')?1:0;
}

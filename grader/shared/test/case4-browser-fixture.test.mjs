import test from 'node:test';
import assert from 'node:assert/strict';
import {openBrowserFixture} from '../../04-creation-dialog-race/code/browser-fixture.mjs';

const origin='http://127.0.0.1:12345';

function fake({failure, connected=true, closeFails=false}={}){
 const events=[];
 const cause=new Error('deliberate fixture failure');
 const p={async goto(url,opts){
  events.push('goto');
  assert.equal(url,origin);
  assert.deepEqual(opts,{waitUntil:'load'});
  if(failure==='navigation')throw cause;
 }};
 const context={
  async newPage(){events.push('page');if(failure==='newPage')throw cause;return p;},
  async close(){events.push('close');if(closeFails)throw Error('cleanup failed');},
 };
 const browser={
  async newContext(){events.push('context');if(failure==='newContext')throw cause;return context;},
  isConnected(){return connected;},
 };
 const prepare=async (c,page)=>{
  events.push('prepare');assert.equal(c,context);assert.equal(page,p);
  if(failure==='configure')throw cause;
 };
 return {events,cause,context,p,open:()=>openBrowserFixture(browser,origin,prepare)};
}

for(const [phase,events] of [
 ['newContext',['context']],
 ['newPage',['context','page','close']],
 ['configure',['context','page','prepare','close']],
]){
 test('Case 04 blocks '+phase+' without reaching the candidate',async ()=>{
  const f=fake({failure:phase,closeFails:true});
  await assert.rejects(f.open(),e=>e.blocked===true&&e.cause===f.cause&&e.message.includes(phase));
  assert.deepEqual(f.events,events);
 });
}

test('Case 04 keeps a connected browser candidate navigation error',async ()=>{
 const f=fake({failure:'navigation'});
 await assert.rejects(f.open(),e=>e===f.cause&&!e.blocked);
 assert.deepEqual(f.events,['context','page','prepare','goto','close']);
});

test('Case 04 blocks a browser disconnect during navigation',async ()=>{
 const f=fake({failure:'navigation',connected:false});
 await assert.rejects(f.open(),e=>e.blocked===true&&e.cause===f.cause);
 assert.deepEqual(f.events,['context','page','prepare','goto','close']);
});

test('Case 04 successful setup transfers context ownership to the criterion',async ()=>{
 const f=fake();
 assert.deepEqual(await f.open(),{context:f.context,p:f.p});
 assert.deepEqual(f.events,['context','page','prepare','goto']);
});

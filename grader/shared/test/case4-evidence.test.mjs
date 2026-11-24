import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runCriterion} from '../../04-creation-dialog-race/code/criterion.mjs';
import {aggregate} from '../core.mjs';

const spec={id:'manual_payload',method:'code',max_score:15};
const logs={posts:[{mode:'manual',name:'Example',seats:7}],requests:[{id:'lab',settled:true}],errors:[]};
const fail=message=>()=>{throw Error(message);};
async function exercise({run=()=>{}, body=()=> 'Example result', screenshot=()=>Buffer.from('test image'), snapshot=()=>structuredClone(logs), writeError, closeError}={}) {
 const files=new Map();
 let closed=false;
 const result=await runCriterion(spec,{
  fresh:async()=>({errors:[],snapshot,body,p:{screenshot},context:{close:async()=>{
   closed=true;
   if(closeError)throw Error('close failed');
  }}}),
  run,
  write(name,content){
   if(writeError&&name.endsWith(writeError))throw Error('write failed');
   files.set(name,content);
  },
 });
 assert.equal(closed,true);
 for(const ref of result.criterion.evidence)assert.ok(files.has(ref),ref);
 return {...result,files};
}

test('a PNG capture or save failure preserves structured evidence and full points',async()=>{
 for(const options of [{screenshot:fail('screenshot timed out')},{writeError:'.png'}]){
  const {criterion,measurements,diagnostics,files}=await exercise(options);
  assert.equal(criterion.status,'passed');
  assert.equal(criterion.score,15);
  assert.deepEqual(criterion.evidence,['manual_payload.json']);
  assert.deepEqual(JSON.parse(files.get('manual_payload.json')),{...logs,body:'Example result'});
  assert.deepEqual(measurements,{...logs,body:'Example result'});
  assert.equal(files.has('manual_payload.png'),false);
  assert.match(diagnostics[0].message,/Screenshot unavailable/);
 }
});
test('a successful capture references both artifacts; cleanup errors do not erase them',async()=>{
 const {criterion,diagnostics,files}=await exercise({closeError:true});
 assert.equal(criterion.status,'passed');
 assert.deepEqual(criterion.evidence,['manual_payload.json','manual_payload.png']);
 assert.deepEqual(files.get('manual_payload.png'),Buffer.from('test image'));
 assert.match(diagnostics[0].message,/cleanup failed/);
});
test('a behavioral failure stays failed with request evidence when page text and PNG cannot be captured',async()=>{
 const {criterion,diagnostics,files}=await exercise({run:fail('Incorrect payload'),body:fail('Page closed'),screenshot:fail('Page closed')});
 assert.equal(criterion.status,'failed');
 assert.equal(criterion.score,0);
 assert.equal(criterion.reason,'Incorrect payload');
 assert.deepEqual(criterion.evidence,['manual_payload.json']);
 assert.deepEqual(JSON.parse(files.get('manual_payload.json')),logs);
 assert.deepEqual(diagnostics.map(d=>d.status),['failed','warning','warning']);
});
test('unavailable required evidence blocks rather than manufacturing a scored result',async()=>{
 for(const options of [{snapshot:fail('snapshot failed')},{writeError:'.json'}]){
  const {criterion,files}=await exercise(options);
  assert.equal(criterion.status,'blocked');
  assert.equal(criterion.score,null);
  assert.equal(aggregate({criteria:[spec]},[criterion]).final_score,null);
  assert.deepEqual(criterion.evidence,[]);
  assert.equal(files.size,0);
 }
});

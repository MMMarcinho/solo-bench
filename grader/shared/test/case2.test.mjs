import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'solo-bench-case2-'));
const starter=path.join(root,'case/02-GPT6 介绍页滚动效果/starter');
const candidate=path.join(temp,'candidate');
fs.cpSync(starter,candidate,{recursive:true});
function run(name,mode='agent'){
  const output=path.join(temp,name);
  const call=spawnSync(process.execPath,[path.join(root,'grader/run.mjs'),'--case','02-GPT6 介绍页滚动效果','--mode',mode,'--candidate',candidate,'--output',output],{encoding:'utf8'});
  return {call,result:JSON.parse(fs.readFileSync(path.join(output,'result.json'))),output};
}
test('Case 02 uses shared pending/null envelope and candidate fingerprint',()=>{
  const {call,result,output}=run('pending');
  assert.equal(call.status,0,call.stderr);
  assert.equal(result.case_id,'02-GPT6 介绍页滚动效果');
  assert.match(result.candidate_fingerprint,/^[a-f0-9]{64}$/);
  assert.equal(result.criteria.length,8);
  assert.ok(result.criteria.filter(c=>c.method==='code').every(c=>c.status==='not_run'&&c.score===null));
  assert.ok(result.criteria.filter(c=>c.method==='agent').every(c=>c.status==='pending'&&c.score===null));
  assert.equal(result.score.final_score,null);
  assert.equal(result.score.code.maximum,65);
  assert.equal(result.score.agent.maximum,35);
  assert.ok(fs.existsSync(path.join(output,'agent-request.json')));
});
test('immutable Case 02 starter is rejected as a candidate',()=>{
  const output=path.join(temp,'protected');
  const call=spawnSync(process.execPath,[path.join(root,'grader/run.mjs'),'--case','02-GPT6 介绍页滚动效果','--mode','agent','--candidate',starter,'--output',output],{encoding:'utf8'});
  assert.notEqual(call.status,0);
  assert.match(call.stderr,/immutable source/);
});
test('missing Case 02 page is a structure failure, not browser infrastructure blocked',()=>{
  const empty=path.join(temp,'empty');fs.mkdirSync(empty);
  const output=path.join(temp,'missing-page');
  const call=spawnSync(process.execPath,[path.join(root,'grader/run.mjs'),'--case','02-GPT6 介绍页滚动效果','--mode','code','--candidate',empty,'--output',output],{encoding:'utf8'});
  const result=JSON.parse(fs.readFileSync(path.join(output,'result.json')));
  assert.equal(call.status,1);
  assert.equal(result.criteria.find(c=>c.id==='story_structure').status,'failed');
  assert.equal(result.criteria.find(c=>c.id==='story_structure').score,0);
  assert.equal(result.score.final_score,null);
});

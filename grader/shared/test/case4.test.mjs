import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {aggregate,emptyCriterion} from '../core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),id='04-creation-dialog-race';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'solo-bench-case4-'));
const starter=path.join(root,'case',id,'starter'),candidate=path.join(temp,'candidate');
fs.cpSync(starter,candidate,{recursive:true});
const rubric=JSON.parse(fs.readFileSync(path.join(root,'grader',id,'rubric.json')));
after(()=>fs.rmSync(temp,{recursive:true,force:true}));
function run(name,mode,extra=[],source=candidate){
 const output=path.join(temp,name);
 const call=spawnSync(process.execPath,[path.join(root,'grader/run.mjs'),'--case',id,'--mode',mode,'--candidate',source,'--output',output,...extra],{encoding:'utf8',timeout:20000});
 return {call,output,result:fs.existsSync(path.join(output,'result.json'))?JSON.parse(fs.readFileSync(path.join(output,'result.json'))):null};
}
test('code-only rubric totals 100 without manufacturing an agent score',()=>{
 assert.equal(rubric.criteria.length,6);assert.ok(rubric.criteria.every(c=>c.method==='code'));
 const result=aggregate(rubric,rubric.criteria.map(c=>({...c,status:'passed',score:c.max_score,evidence:['actual.json'],reason:'observed'})));
 assert.equal(result.final_score,100);assert.equal(result.agent.maximum,0);assert.equal(result.code.maximum,100);
 assert.equal(aggregate(rubric,rubric.criteria.map(c=>emptyCriterion(c))).final_score,null);
});
test('agent-only mode skips an unassigned judge and cannot complete code-only case',()=>{
 const {call,output,result}=run('agent','agent');assert.equal(call.status,0,call.stderr);assert.equal(result.score.final_score,null);assert.equal(result.score.code.maximum,100);assert.equal(result.score.agent.maximum,0);
 assert.ok(result.criteria.every(c=>c.status==='not_run'&&c.score===null));assert.ok(!fs.existsSync(path.join(output,'agent-request.json')));
});
test('all mode classifies missing Chromium as blocked without agent config',()=>{
 const {call,output,result}=run('browser-missing','all',['--chromium',path.join(temp,'no-browser')]);assert.equal(call.status,2,call.stderr);
 assert.ok(result.criteria.every(c=>c.status==='blocked'&&c.score===null));assert.equal(result.score.final_score,null);assert.ok(!fs.existsSync(path.join(output,'agent-request.json')));
});
test('missing candidate server fails before browser launch',()=>{
 const empty=path.join(temp,'empty');fs.mkdirSync(empty);
 const {call,result}=run('server-missing','code',['--chromium',path.join(temp,'no-browser')],empty);
 assert.equal(call.status,1,call.stderr);assert.ok(result.criteria.every(c=>c.status==='failed'&&c.score===0));assert.equal(result.score.final_score,0);
});
test('immutable Case 04 source cannot be graded',()=>{
 const {call,result}=run('immutable','code',[],starter);assert.notEqual(call.status,0);assert.equal(result,null);assert.match(call.stderr,/immutable source/);
});

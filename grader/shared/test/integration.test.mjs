import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'solo-bench-tests-'));
const candidate=path.join(scratch,'candidate');fs.cpSync(path.join(root,'case/01-chatbot/source'),candidate,{recursive:true});
function run(name,extra=[]){const out=path.join(scratch,name);const p=spawnSync(process.execPath,[path.join(root,'grader/run.mjs'),'--case','01-chatbot','--mode','agent','--candidate',candidate,'--output',out,...extra],{encoding:'utf8'});return {p,out,result:JSON.parse(fs.readFileSync(path.join(out,'result.json')))};}
test('agent mode prepares pending request without executing judge',()=>{const {p,out,result}=run('pending');assert.equal(p.status,0);assert.equal(result.score.final_score,null);assert.ok(result.criteria.filter(c=>c.method==='agent').every(c=>c.status==='pending'));assert.ok(fs.existsSync(path.join(out,'agent-request.json')))});
test('CLI adapter executes synthetic pending protocol; not a real judge',()=>{const cmd=JSON.stringify([process.execPath,path.join(root,'grader/shared/test/judge-fixture.mjs')]);const {p,out,result}=run('command',['--agent-command',cmd]);assert.equal(p.status,0,p.stderr);assert.equal(result.judge.model,'fixture-only');assert.ok(fs.existsSync(path.join(out,'agent-raw-response.txt')));assert.ok(fs.existsSync(path.join(out,'agent-result.json')));assert.equal(result.score.final_score,null)});
test('offline output from executed synthetic protocol imports through same adapter',()=>{const {p,result}=run('import',['--agent-result',path.join(scratch,'command/agent-result.json')]);assert.equal(p.status,0,p.stderr);assert.equal(result.judge.model,'fixture-only');assert.equal(result.criteria.length,9)});
test('malformed raw judge response is saved and blocks method',()=>{const bad=path.join(scratch,'malformed.json');fs.writeFileSync(bad,'NOT JSON');const {p,out,result}=run('malformed',['--agent-result',bad]);assert.equal(p.status,2);assert.equal(fs.readFileSync(path.join(out,'agent-raw-response.txt'),'utf8'),'NOT JSON');assert.ok(result.criteria.filter(c=>c.method==='agent').every(c=>c.status==='blocked'))});
test('invented device evidence cannot become score',()=>{const fixture=JSON.parse(fs.readFileSync(path.join(scratch,'command/agent-result.json')));const row=fixture.criteria.find(c=>c.id==='real_device');Object.assign(row,{status:'passed',score:5,evidence:['invented-phone.png'],reason:'Synthetic invalid claim, must reject'});const bad=path.join(scratch,'fake-device.json');fs.writeFileSync(bad,JSON.stringify(fixture));const {p,result}=run('fake-device',['--agent-result',bad]);assert.equal(p.status,2);assert.equal(result.score.final_score,null);assert.ok(result.criteria.find(c=>c.id==='real_device').reason.includes('Unknown artifact'))});

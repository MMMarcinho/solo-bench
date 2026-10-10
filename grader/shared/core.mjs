import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
export const statuses=['passed','partial','failed','pending','blocked','not_run'];
export function fingerprint(directory){const files={};const ignored=new Set(['.git','node_modules','dist','.vite','.cache','coverage','test-results','playwright-report']);function visit(d){for(const e of fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){if(ignored.has(e.name)||e.name==='.DS_Store'||e.name.startsWith('.env')||e.name.endsWith('.log'))continue;const p=path.join(d,e.name);if(e.isSymbolicLink())throw Error('Source symlinks require explicit review; unsupported: '+path.relative(directory,p));if(e.isDirectory())visit(p);else if(e.isFile())files[path.relative(directory,p).split(path.sep).join('/')]=sha256(fs.readFileSync(p));}}visit(directory);return {fingerprint:sha256(JSON.stringify(files)),files};}
export function emptyCriterion(c,status='not_run',reason='Method not requested'){return {...c,status,score:null,evidence:[],reason};}
export function validateEnvelope(value,expected,method,rubric){
 if(!expected||!value||!/^([a-f0-9]{64})$/.test(expected.candidate_fingerprint||''))throw Error('Expected candidate fingerprint must be 64 lowercase hex characters');
 for(const k of ['schema_version','case_id','task_version','grader_version'])if(typeof expected[k]!=='string'||!expected[k].trim())throw Error('Expected identity missing '+k);
 for(const k of ['schema_version','case_id','task_version','grader_version','candidate_fingerprint'])if(value[k]!==expected[k])throw Error(`Adapter ${k} mismatch`);
 if(method==='agent' && (!value.judge||typeof value.judge.name!=='string'||!value.judge.name.trim()||typeof value.judge.model!=='string'||!value.judge.model.trim()||!Number.isFinite(Date.parse(value.judge.executed_at_utc))))throw Error('Agent output needs judge name, model and execution time');
 if(!Array.isArray(value.criteria))throw Error('Adapter criteria must be an array');
 const expectedCriteria=rubric.criteria.filter(c=>c.method===method);
 if(value.criteria.length!==expectedCriteria.length)throw Error('Adapter must report each assigned criterion exactly once');
 const seen=new Set();
 for(const row of value.criteria){const spec=expectedCriteria.find(c=>c.id===row.id);if(!spec||seen.has(row.id))throw Error('Unknown or duplicate criterion '+row.id);seen.add(row.id);if(row.method!==method||row.max_score!==spec.max_score||!statuses.includes(row.status))throw Error('Invalid method, max_score or status for '+row.id);if(typeof row.reason!=='string'||!row.reason.trim()||!Array.isArray(row.evidence)||row.evidence.some(e=>typeof e!=='string'||!e.trim()))throw Error('Invalid evidence/reason for '+row.id);const scored=['passed','partial','failed'].includes(row.status);if(scored){if(!Number.isFinite(row.score)||row.score<0||row.score>spec.max_score||!row.evidence.length)throw Error('Invalid scored criterion '+row.id);if(row.status==='passed'&&row.score!==spec.max_score)throw Error('Passed means full points');if(row.status==='failed'&&row.score!==0)throw Error('Failed means zero');if(row.status==='partial'&&!(row.score>0&&row.score<spec.max_score))throw Error('Partial must be strictly between zero and max');}else if(row.score!==null)throw Error('Pending/blocked/not_run score must be null');}
 return value.criteria;
}
export function aggregate(rubric,criteria){
 const scoreOf=method=>{const rows=criteria.filter(c=>c.method===method);return {earned:rows.every(c=>c.score!==null)?rows.reduce((s,c)=>s+c.score,0):null,observed_earned:rows.reduce((s,c)=>s+(c.score??0),0),maximum:rows.reduce((s,c)=>s+c.max_score,0),pending:rows.filter(c=>c.score===null).map(c=>c.id)};};
 let cap=rubric.criteria.reduce((s,c)=>s+c.max_score,0);const gates=[];const byId=new Map(criteria.map(c=>[c.id,c]));for(const rule of rubric.gates||[]){if(rule.any.some(condition=>byId.get(condition.id)?.status===condition.status)){cap=Math.min(cap,rule.cap);gates.push({id:rule.id,cap:rule.cap});}}
 const complete=criteria.length===rubric.criteria.length&&criteria.every(c=>c.score!==null);const observed=criteria.reduce((s,c)=>s+(c.score??0),0);return {status:complete?'complete':'provisional',code:scoreOf('code'),agent:scoreOf('agent'),observed_total:observed,raw_total:complete?observed:null,final_score:complete?Math.min(observed,cap):null,maximum:rubric.criteria.reduce((s,c)=>s+c.max_score,0),cap,gates};
}

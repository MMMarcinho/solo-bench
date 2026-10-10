import fs from 'node:fs';
import path from 'node:path';
import {sha256,validateEnvelope} from './core.mjs';
/** Validation only: never a substitute for an actual judge execution. */
export function validateAgentEvidence(response,request,manifest,rubric){
 const rows=validateEnvelope(response,request,'agent',rubric);
 for(const key of ['case_id','task_version','grader_version','candidate_fingerprint'])if(manifest[key]!==request[key])throw Error('Evidence manifest '+key+' mismatch');
 for(const row of rows){for(const ref of row.evidence){const base=ref.split('#')[0];if(base.startsWith('source:')){const relative=base.slice(7),resolved=path.resolve(request.candidate_source,relative);if(!request.source_files?.[relative]||!resolved.startsWith(path.resolve(request.candidate_source)+path.sep)||!fs.statSync(resolved).isFile()||!fs.realpathSync(resolved).startsWith(fs.realpathSync(request.candidate_source)+path.sep)||sha256(fs.readFileSync(resolved))!==request.source_files[relative])throw Error('Invalid or changed source evidence reference '+ref);continue;}const artifact=manifest.artifacts.find(a=>a.id===base);if(!artifact)throw Error('Unknown artifact reference '+ref);const resolved=path.resolve(path.dirname(request.evidence_manifest),artifact.path);if(!fs.statSync(resolved).isFile()||sha256(fs.readFileSync(resolved))!==artifact.sha256)throw Error('Evidence changed or missing: '+ref);}
 if(row.id==='real_device'&&row.score!==null){const deviceArtifacts=manifest.artifacts.filter(a=>a.kind==='physical_device'&&typeof a.device==='string'&&a.device.trim()&&typeof a.browser==='string'&&a.browser.trim()&&Array.isArray(a.actions)&&a.actions.length>0);if(!deviceArtifacts.some(a=>row.evidence.some(ref=>ref.split('#')[0]===a.id)))throw Error('Scored real_device requires referenced physical_device artifact with device/browser/actions metadata');}}
 return response;
}

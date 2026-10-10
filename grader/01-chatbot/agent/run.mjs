#!/usr/bin/env node
/** Case agent adapter: validates an executed judge response; does not fabricate a judge. */
import fs from 'node:fs';
import {validateAgentEvidence} from '../../shared/agent-protocol.mjs';
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i]]=process.argv[i+1];
if(!args['--request']||!args['--response']||!args['--output'])throw Error('Usage: agent/run.mjs --request agent-request.json --response raw-judge.json --output agent-result.json');
try{
 const request=JSON.parse(fs.readFileSync(args['--request']));
 const response=JSON.parse(fs.readFileSync(args['--response']));
 const manifest=JSON.parse(fs.readFileSync(request.evidence_manifest));
 const rubric=JSON.parse(fs.readFileSync(new URL('../rubric.json',import.meta.url)));
 const result=validateAgentEvidence(response,request,manifest,rubric);
 fs.writeFileSync(args['--output'],JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:'validated',output:args['--output']}));
}catch(e){console.error(e.message);process.exitCode=2;}

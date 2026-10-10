/** Synthetic protocol fixture only. This is NOT an evaluator/model. */
let raw='';for await(const chunk of process.stdin)raw+=chunk;
const request=JSON.parse(raw);
const {schema_version,case_id,task_version,grader_version,candidate_fingerprint}=request;
console.log(JSON.stringify({schema_version,case_id,task_version,grader_version,candidate_fingerprint,judge:{name:'Synthetic protocol fixture (not an actual judge)',model:'fixture-only',executed_at_utc:new Date().toISOString()},criteria:request.criteria.map(c=>({...c,status:'pending',score:null,evidence:[],reason:'Synthetic fixture does not grade behavior.'}))}));

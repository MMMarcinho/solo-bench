// Request/POST evidence is required to score a criterion. UI text and PNG are
// supplemental: their capture can fail even after the assertions passed.
export async function runCriterion(spec, {fresh, run, write}) {
 const {id}=spec, evidence=[], diagnostics=[];
 let fixture, status='passed', score=spec.max_score;
 let reason='All declared sequences passed using rendered controls and captured HTTP payloads.';
 let measurements;
 const warn=(kind,error)=>diagnostics.push({id,status:'warning',message:kind+': '+error.message});
 try {
  fixture=await fresh();
  await run(fixture);
  if(fixture.errors.length)throw Error('Page threw: '+fixture.errors.join('; '));
 } catch(error) {
  status=error.blocked?'blocked':'failed';
  score=error.blocked?null:0;
  reason=error.message;
  diagnostics.push({id,status,message:reason});
 }
 try {
  measurements=fixture?fixture.snapshot():{error:'Browser fixture unavailable',reason};
  if(fixture){
   try{measurements.body=await fixture.body();}catch(error){warn('UI text unavailable',error);}
  }
  write(id+'.json',JSON.stringify(measurements,null,2)+'\n');
  evidence.push(id+'.json');
  if(fixture){
   try {
    write(id+'.png',await fixture.p.screenshot());
    evidence.push(id+'.png');
   }catch(error){warn('Screenshot unavailable',error);}
  }
 } catch(error) {
  status='blocked';
  score=null;
  reason='Structured evidence unavailable: '+error.message;
  diagnostics.push({id,status,message:reason});
 } finally {
  if(fixture){
   try{await fixture.context.close();}catch(error){warn('Browser context cleanup failed',error);}
  }
 }
 return {criterion:{...spec,status,score,evidence,reason}, measurements, diagnostics};
}

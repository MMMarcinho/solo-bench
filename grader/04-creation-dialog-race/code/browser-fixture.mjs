// Allocation and route installation belong to the grader. App navigation is
// separate and must not hide candidate failures just because setup hasn't returned.
function blocked(phase, cause){
 const error=new Error('Browser fixture '+phase+' failed: '+(cause?.message??cause),{cause});
 error.blocked=true;
 return error;
}

export async function openBrowserFixture(browser,origin,prepare){
 let context, p, phase='newContext';
 try{
  context=await browser.newContext({viewport:{width:1100,height:800},locale:'en-US',timezoneId:'UTC',serviceWorkers:'block'});
  phase='newPage';
  p=await context.newPage();
  phase='configure';
  await prepare(context,p);
  phase='navigation';
  await p.goto(origin,{waitUntil:'load'});
  return {context,p};
 }catch(cause){
  // Check connectivity before cleanup. If the browser is still connected,
  // preserve the existing candidate navigation classification and diagnostic.
  const error=phase!=='navigation'||!browser.isConnected()?blocked(phase,cause):cause;
  if(context){
   try{await context.close();}catch{/* Do not replace the setup failure. */}
  }
  throw error;
 }
}

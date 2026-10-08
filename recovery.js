'use strict';
(function(root){
 const databaseName='brandonFitnessV4';
 const legacyKeys=['brandonFitnessV3','brandonFitnessV2','brandonFitnessV1','brandonFitnessV4DeviceKey'];
 const sensitiveKey=key=>typeof key==='string'&&/(^|[-_:])(auth|tokens?|credentials?|password)([-_:]|$)/i.test(key);
 async function exportPayload(){
  const payload={format:'brandon-fitness-raw-recovery-v4',exportedAt:new Date().toISOString(),database:databaseName,app:[],backups:[],localStorage:{},errors:[]};
  for(const key of legacyKeys){
   try{const value=localStorage.getItem(key);if(value!==null)payload.localStorage[key]=value}
   catch(error){payload.errors.push({source:'localStorage',key,error:String(error.message||error)})}
  }
  let database;
  try{
   if(indexedDB.databases){
    const databases=await indexedDB.databases();
    if(!databases.some(item=>item.name===databaseName)){payload.databaseAbsent=true;payload.partial=payload.errors.length>0;return payload}
   }
   database=await new Promise((resolve,reject)=>{
    // No version is requested. Abort any upgrade, including creation of a missing database.
    const request=indexedDB.open(databaseName);let absent=false;
    request.onupgradeneeded=()=>{absent=true;request.transaction.abort()};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>absent?resolve(null):reject(request.error||new Error('Database could not be read'));
   });
   if(!database){payload.databaseAbsent=true;payload.partial=payload.errors.length>0;return payload}
   const stores=['app','backups'].filter(name=>database.objectStoreNames.contains(name));
   for(const name of ['app','backups'])if(!stores.includes(name))payload.errors.push({source:'IndexedDB',store:name,error:'Object store is missing'});
   if(stores.length)await new Promise((resolve,reject)=>{
    const transaction=database.transaction(stores,'readonly');let keys,values,backups;
    if(stores.includes('app')){const store=transaction.objectStore('app');keys=store.getAllKeys();values=store.getAll()}
    if(stores.includes('backups'))backups=transaction.objectStore('backups').getAll();
    transaction.oncomplete=()=>{
     if(keys)payload.app=keys.result.map((key,i)=>({key,value:values.result[i]})).filter(row=>!sensitiveKey(row.key));
     if(backups)payload.backups=backups.result;
     resolve();
    };
    transaction.onabort=()=>reject(transaction.error||new Error('Read-only recovery export aborted'));
   });
  }catch(error){payload.errors.push({source:'IndexedDB',error:String(error.message||error)})}
  finally{database?.close()}
  payload.partial=payload.errors.length>0;return payload;
 }
 function download(payload){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),link=document.createElement('a'),url=URL.createObjectURL(blob);
  link.href=url;link.download='brandon-fitness-v4-raw-recovery-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function render(error,standalone=false){
  const main=document.querySelector('main');if(!main)return;
  main.innerHTML='<div class="card"><h2>Saved data recovery</h2><p id="recoveryError"></p><button id="rawExport">Export saved device data</button><p>This export reads the saved database, local backups and older saved data without changing them. It includes the device key needed for encrypted local backups. Keep the file private.</p><p id="installationBoundary"></p></div>';
  document.getElementById('recoveryError').textContent=error?String(error.message||error):'Save a recovery copy before making repairs.';
  document.getElementById('installationBoundary').textContent=standalone?'This page can read only data saved in this browser. An installed iPhone app may keep separate storage. If that app fails at startup, update and open the installed app, then use its export button.':'Use this button from the same installed app or browser where you logged your workouts. A different browser may have separate saved data.';
  document.getElementById('rawExport').onclick=async()=>{
   const button=document.getElementById('rawExport');button.disabled=true;
   try{
    const payload=await exportPayload();download(payload);
    document.getElementById('recoveryError').textContent=payload.partial?'A partial recovery copy was exported. Some storage could not be read: '+payload.errors.map(item=>item.source+': '+item.error).join('; '):payload.databaseAbsent?'The older saved-data copy was exported. No v4 database was found in this browser.':'Recovery copy exported. Your saved data has not been changed.';
   }catch(failure){document.getElementById('recoveryError').textContent='Export could not finish: '+String(failure.message||failure)}
   finally{button.disabled=false}
  };
 }
 root.BFRecovery={exportPayload,render};
})(window);


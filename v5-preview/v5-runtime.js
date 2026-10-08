'use strict';
window.V5={
 build:'5.0.0-preview.2',busy:false,retry:null,conflict:false,audio:null,localRevision:0,localWriteConflict:false,
 status(text){const b=document.getElementById('syncBadge');if(b)b.textContent=text;const d=document.getElementById('cloudMessage');if(d)d.textContent=text;},
 authSnapshot(){if(!this.session?.user?.id)throw Error('Sign in to use cloud data');return{...this.session,user:{...this.session.user}}},
 assertSession(auth){if(!auth||this.session?.user?.id!==auth.user.id||this.session?.access_token!==auth.access_token)throw Error('Account changed during cloud operation; local data preserved')},
 async request(path,options={},auth=this.session){
  const cfg=BF_CONFIG;if(!cfg.url||!cfg.key)throw Error('Cloud project not configured');
  const response=await fetch(cfg.url+path,{...options,headers:{apikey:cfg.key,'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth.access_token}:{}),...options.headers},signal:AbortSignal.timeout(15000)});
  const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body.msg||body.message||body.error_description||'Cloud request failed ('+response.status+')');return body;
 },
 async login(){
  if(this.busy)return this.status('Wait for the current cloud operation before signing in');this.busy=true;let signedIn=false;
  try{
   const email=document.getElementById('cloudEmail').value.trim(),password=document.getElementById('cloudPassword').value;
   const auth=await this.request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})},null);
   document.getElementById('cloudPassword').value='';auth.expires_at=Date.now()/1000+auth.expires_in;
   await idbPut('app',auth,'v5-auth');this.session=auth;signedIn=true;this.status('Signed in · syncing');
  }catch(e){this.status(e.message)}finally{this.busy=false}
  if(signedIn)await this.sync();
 },
 async signup(){
  if(this.busy)return this.status('Wait for the current cloud operation before creating an account');this.busy=true;
  try{await this.request('/auth/v1/signup',{method:'POST',body:JSON.stringify({email:document.getElementById('cloudEmail').value.trim(),password:document.getElementById('cloudPassword').value})},null);document.getElementById('cloudPassword').value='';this.status('Check email to confirm your account, then sign in.')}catch(e){this.status(e.message)}finally{this.busy=false}
 },
 async refresh(auth=this.authSnapshot()){
  this.assertSession(auth);if(auth.expires_at>Date.now()/1000+60)return auth;
  const refreshed=await this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:auth.refresh_token})},auth);
  this.assertSession(auth);if(refreshed.user?.id!==auth.user.id)throw Error('Cloud account identity changed; local data preserved');
  refreshed.expires_at=Date.now()/1000+refreshed.expires_in;
  await idbPut('app',refreshed,'v5-auth');this.assertSession(auth);this.session=refreshed;return this.authSnapshot();
 },
 changed(){if(!state)return;this.status(this.session?'Saved locally · sync pending':'Saved locally · cloud disconnected');clearTimeout(this.retry);this.retry=setTimeout(()=>this.sync(),5000);},
 async sync(){
  if(this.busy||!this.session||!BF_CONFIG.url)return;
  if(!navigator.onLine){this.status('Offline · changes kept on this device');return}
  this.busy=true;
  const perform=async()=>{
   try{
    const auth=await this.refresh(this.authSnapshot()),owner=auth.user.id,meta=await idbGet('app','v5-sync')||{};
    if(meta.owner&&meta.owner!==owner)throw Error('Local data is linked to another account; export it before switching.');
    const rows=await this.request('/rest/v1/fitness_state?select=revision,payload,updated_at&user_id=eq.'+encodeURIComponent(owner),{},auth);
    const remote=rows[0],remoteRev=remote?.revision||0;
    if(remoteRev!==(meta.revision||0)){this.conflict=true;this.status('Cloud has another version · export both before resolving');document.getElementById('cloudConflict').hidden=false;return}
    const payload=BFCore.migrate(await idbGet('app',STATE_KEY)),fingerprint=JSON.stringify(payload);
    if(fingerprint===meta.fingerprint){this.status('Synced · '+new Date(meta.at).toLocaleTimeString());return}
    this.assertSession(auth);
    const result=await this.request('/rest/v1/rpc/fitness_save',{method:'POST',body:JSON.stringify({expected_revision:remoteRev,document:payload})},auth);
    this.assertSession(auth);
    if(result.conflict){this.conflict=true;this.status('Another device saved first · resolve versions');document.getElementById('cloudConflict').hidden=false;return}
    await idbPut('app',{owner,revision:result.revision,fingerprint,at:Date.now()},'v5-sync');
    this.conflict=false;this.status('Synced · '+new Date().toLocaleTimeString());
    if(JSON.stringify(state)!==fingerprint)this.changed();
   }catch(e){this.status('Saved locally · '+e.message);clearTimeout(this.retry);this.retry=setTimeout(()=>this.sync(),30000)}
  };
  try{if(navigator.locks)await navigator.locks.request('bf-v5-isolated-preview-sync',perform);else await perform()}finally{this.busy=false}
 },
 async remote(auth=this.authSnapshot()){
  auth=await this.refresh(auth);this.assertSession(auth);
  const row=(await this.request('/rest/v1/fitness_state?select=revision,payload&user_id=eq.'+encodeURIComponent(auth.user.id),{},auth))[0];this.assertSession(auth);return{row,auth};
 },
 async exportRemote(){
  if(this.busy)return this.status('Wait for the current cloud operation before exporting cloud data');this.busy=true;
  try{const {row:r}=await this.remote();if(r)download('brandon-fitness-cloud-'+r.revision+'.json',JSON.stringify(r.payload));else this.status('No cloud data yet')}catch(e){this.status(e.message)}finally{this.busy=false}
 },
 async useRemote(){
  if(this.busy)return this.status('Wait for the current cloud operation before restoring cloud data');
  if(state.activeSession)return alert('Finish or export the active workout before replacing this device’s state.');
  if(!confirm('Use the cloud version on this device? A raw local snapshot will be preserved first. Export both versions before proceeding.'))return;
  this.busy=true;
  try{
   const {row:r,auth}=await this.remote();if(!r)throw Error('No cloud version available');const next=BFCore.migrate(r.payload);
   if(state.activeSession)throw Error('An active workout started; cloud restore stopped. Finish or export it first.');
   const before=clone(state),beforeFingerprint=JSON.stringify(before),replacement={revision:this.localRevision,fingerprint:beforeFingerprint};
   await idbPut('app',before,'v5-before-cloud-'+Date.now());download('brandon-fitness-before-cloud.json',beforeFingerprint);
   this.assertSession(auth);if(JSON.stringify(state)!==beforeFingerprint)throw Error('Local data changed while preparing restore; export it and retry.');
   await idbPut('app',next,STATE_KEY,{replacement});
   await idbPut('app',{owner:auth.user.id,revision:r.revision,fingerprint:JSON.stringify(next),at:Date.now()},'v5-sync');
   this.conflict=false;document.getElementById('cloudConflict').hidden=true;renderEverything();this.status('Cloud version restored · local copy preserved');
  }catch(e){this.status(e.message)}finally{this.busy=false}
 },
 unlockAudio(){try{if(!this.audio)this.audio=new (window.AudioContext||window.webkitAudioContext)();this.audio.resume().catch(()=>{});}catch{}},
 chime(){
  try{const ctx=this.audio;if(ctx?.state==='running')[660,880,1100].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+i*.18;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.15,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.3);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+.32);});}catch{}
  if(navigator.vibrate)navigator.vibrate([150,80,150]);
 },
 timer(){
  const end=state?.activeSession?.restEndsAt;if(!end)return;
  if(end<=Date.now()&&this.notifiedEnd!==end){this.notifiedEnd=end;this.chime();state.activeSession.restEndsAt=null;schedulePersist();document.getElementById('restHint').textContent='Rest complete';}
 },
 async init(){
  document.getElementById('buildBadge').textContent='V5 · '+this.build;
  this.session=await idbGet('app','v5-auth');
  document.getElementById('cloudLogin').onclick=()=>this.login();document.getElementById('cloudSignup').onclick=()=>this.signup();document.getElementById('cloudSync').onclick=()=>this.sync();
  document.getElementById('cloudLogout').onclick=async()=>{if(this.busy)return this.status('Wait for the current cloud operation before signing out');this.busy=true;clearTimeout(this.retry);try{await idbDelete('app','v5-auth');this.session=null;this.status('Signed out · data kept locally')}catch(e){this.status('Sign out stopped: '+e.message)}finally{this.busy=false}};
  document.getElementById('exportCloud').onclick=()=>this.exportRemote();document.getElementById('useCloud').onclick=()=>this.useRemote();
  document.getElementById('testSound').onclick=()=>{this.unlockAudio();setTimeout(()=>this.chime(),100);};
  document.getElementById('cloudLocalExport').onclick=()=>download('brandon-fitness-local-v5.json',JSON.stringify(state));
  const rawExport=document.getElementById('exportRaw');if(rawExport)rawExport.onclick=async()=>{try{const payload=await this.rawRecoveryPayload();download('brandon-fitness-raw-recovery-'+localDate()+'.json',JSON.stringify(payload,null,2));this.status(payload.partial?'Partial raw export · '+payload.errors.map(e=>e.source+': '+e.error).join('; '):'Raw device backup exported · keep it private')}catch(e){this.status('Raw export failed: '+e.message)}};
  setInterval(()=>this.timer(),500);window.addEventListener('online',()=>this.sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden){this.timer();this.sync();}});
  this.status(BF_CONFIG.url?'Saved locally · sign in for cloud sync':'Saved locally · backend setup pending');if(this.session)this.sync();
 },
 async rawRecoveryPayload(){
  const payload={format:'brandon-fitness-raw-recovery-v5',exportedAt:new Date().toISOString(),app:[],backups:[],localStorage:{},errors:[]};
  if(this.pendingReplacementDraft)payload.unsavedReplacementDraft=clone(this.pendingReplacementDraft);
  for(const key of ['brandonFitnessV5PreviewLegacyV3','brandonFitnessV5PreviewLegacyV2','brandonFitnessV5PreviewLegacyV1','brandonFitnessV5PreviewDeviceKey']){
   try{const value=localStorage.getItem(key);if(value!==null)payload.localStorage[key]=value}catch(e){payload.errors.push({source:'localStorage',key,error:String(e.message||e)})}
  }
  try{
   if(!db)db=await openDB();
   const rows=await new Promise((resolve,reject)=>{
    const tx=db.transaction(['app','backups'],'readonly'),appStore=tx.objectStore('app'),keys=appStore.getAllKeys(),values=appStore.getAll(),backups=tx.objectStore('backups').getAll();
    tx.oncomplete=()=>resolve({app:keys.result.map((key,i)=>({key,value:values.result[i]})),backups:backups.result});tx.onabort=()=>reject(tx.error||new Error('Raw database read aborted'));
   });
   const secretKey=key=>typeof key==='string'&&/(^|[-_:])(auth|tokens?|credentials?|password)([-_:]|$)/i.test(key);
   payload.app=rows.app.filter(row=>!secretKey(row.key));payload.backups=rows.backups;
  }catch(e){payload.errors.push({source:'IndexedDB',error:String(e.message||e)})}
  payload.partial=payload.errors.length>0;return payload;
 },
 recovery(error){
  const main=document.querySelector('main');if(!main)return;
  main.innerHTML='<div class="card"><h2>Recovery · data preserved</h2><p id="recoveryError"></p><button id="rawExport">Export raw device data</button><p>Your existing database has not been erased. Save this export before any repair. It includes legacy data and the device snapshot encryption key. Keep the file private.</p></div>';
  document.getElementById('recoveryError').textContent=String(error?.message||error);
  document.getElementById('rawExport').onclick=async()=>{try{const payload=await this.rawRecoveryPayload();download('brandon-fitness-raw-recovery.json',JSON.stringify(payload));if(payload.partial)document.getElementById('recoveryError').textContent='Partial recovery export: '+payload.errors.map(e=>e.source+': '+e.error).join('; ')}catch(e){document.getElementById('recoveryError').textContent=e.message}};
 }


};
document.addEventListener('pointerdown',()=>V5.unlockAudio(),{passive:true});
window.addEventListener('unhandledrejection',e=>{console.error(e.reason);const b=document.getElementById('saveBadge');if(b)b.textContent=V5.localWriteConflict?'Another tab saved · export this tab, then reload':'Error · export backup';});

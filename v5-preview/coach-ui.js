'use strict';
window.CoachUI={
 key(slotId,exerciseId,gymId){return[gymId,slotId,exerciseId].join('::');},
 input(slot,options={}){
  const active=state.activeSession,gymId=active?.gymId||state.settings.defaultGymId;
  const exerciseId=options.exerciseId||slot.exerciseId,ex=exercise(exerciseId),entry=active?.exercises.find(e=>e.slotId===slot.id&&e.exerciseId===exerciseId);
  const profile=state.settings.coachProfiles?.[this.key(slot.id,exerciseId,gymId)]||{};
  const week=options.forceDeload?8:active?.week||state.currentWeek;
  const assoc=symptomAssociation(exerciseId),index=active?.exercises.findIndex(e=>e.slotId===slot.id)??-1;
  return{slotId:slot.id,exerciseId,gymId,currentMesoId:active?.mesocycleId||state.currentMesocycleId,week,forceDeload:!!options.forceDeload,now:now(),history:state.workouts,
   range:slot.range,plannedSets:options.plannedSets||plannedSets(slot,{forceDeload:options.forceDeload}),baseSets:slot.baseSets,priority:!!slot.priority,increment:profile.increment||ex.increment,
   availableLoads:profile.availableLoads,loadMode:profile.loadMode||'unknown',weightBasis:profile.weightBasis||'unknown',equipmentId:profile.equipmentId||'unconfirmed',equipmentConfirmed:!!profile.equipmentId&&profile.loadMode&&profile.loadMode!=='unknown',legacyEquipmentConfirmed:!!profile.legacySameEquipment,
   setupNotes:entry?.setupNotes??state.exerciseSetupNotes[setupNoteKey(gymId,exerciseId)]??'',targetRir:WEEK_PLAN[week]?.rirLow??2,type:ex.type,restSec:ex.rest,recovery:readiness(),symptomConcern:assoc.aggravator>=2,sessionFatigue:(!slot.priority&&index>0)?liveSessionFatigueBefore(index):0};
 },
 target(slot,options={}){
  const input=this.input(slot,options),a=BFCoach.recommend(input);if(options.setLimit&&a.sets>options.setLimit){a.sets=options.setLimit;a.targetReps=a.targetReps.slice(0,a.sets);a.prediction.targetReps=a.prediction.targetReps.slice(0,a.sets);a.prediction.plannedSets=a.sets;a.volume.reason='The session time limit retains this smaller dose.';}const assoc=symptomAssociation(input.exerciseId);
  const label={baseline:'Establish comparable baseline',increase:'Increase load',hold:'Build repeatable reps',reduce:'Protect quality',reset:'Re-entry target',deload:'Deload target',fatigue:'Fatigue protection',flag:'Review symptom association'}[a.action]||a.action;
  return{...a,advanced:a,rir:a.targetRir+' RIR',title:label+(a.load==null?'':` · ${a.load} lb`)+` · ${a.sets} sets`,why:a.reasons.slice(0,4).join(' '),trend:a.trend,assoc,warmups:input.loadMode==='external'?warmupsFor(slot,a.load):[],coachContext:{equipmentId:input.equipmentId,weightBasis:input.weightBasis,loadMode:input.loadMode},restSec:a.restSec};
 },
 details(c){
  const a=c.advanced;if(!a)return'';
  const alternatives=a.alternatives.filter(x=>Math.abs(x.load-(a.load||0))<=Math.max(5,(a.load||0)*.3)).slice(0,5);
  return`<div class="coach-evidence"><span class="pill">${esc(a.confidence.label)} confidence · ${a.confidence.count} comparable sessions</span><button type="button" data-coach-profile>Equipment + progression settings</button><details><summary>Why this target · model evidence</summary><ul>${a.reasons.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${a.model.capacity==null?'':`<p class="tiny">Estimated early-set capacity at the reference load: ${a.model.capacity} reps including reported reserve. Prediction buffer: ±${a.model.uncertainty} reps; this is a policy buffer, not a validated probability interval. ${a.model.pairCount} load-change observations.</p>`}${alternatives.length?`<div class="coach-table"><table><thead><tr><th>Available load</th><th>Early reps</th><th>Lower estimate</th><th>Progression</th></tr></thead><tbody>${alternatives.map(x=>`<tr><td>${x.load} lb</td><td>${x.reps}</td><td>${x.lowerReps}</td><td>${x.eligible?'Permitted':'Hold'}</td></tr>`).join('')}</tbody></table></div>`:''}</details></div>`;
 },
 last(entry){
  const slot=slotConfig(entry.slotId);if(!slot)return null;const input=this.input({...slot,exerciseId:entry.exerciseId},{exerciseId:entry.exerciseId});const recommendation=BFCoach.recommend(input);if(recommendation.flags.some(flag=>['equipment-unconfirmed','anchor-needs-review','no-safe-available-load'].includes(flag)))return null;
  const id=recommendation.evidence.sourceIds.at(-1),workout=state.workouts.find(w=>w.id===id);const ex=workout?.exercises.find(e=>e.slotId===entry.slotId&&e.exerciseId===entry.exerciseId);return ex?{workout,exercise:ex}:null;
 },
 nudge(entry,value,direction){const slot=slotConfig(entry.slotId);if(!slot)return value;const input=this.input({...slot,exerciseId:entry.exerciseId},{exerciseId:entry.exerciseId});if(input.availableLoads?.length){const sorted=[...input.availableLoads].sort((a,b)=>a-b);return direction>0?(sorted.find(x=>x>value)??value):([...sorted].reverse().find(x=>x<value)??value);}return Math.max(0,value+direction*input.increment);},
 attach(){
  document.querySelectorAll('[data-coach-profile]').forEach(button=>button.onclick=()=>{const card=button.closest('.exercise'),i=+card.dataset.ei,entry=state.activeSession?.exercises[i],po=activePlanSummary(),slot=po.plan[i];this.open(slot,entry?.exerciseId||slot.exerciseId);});
  const form=document.getElementById('coachProfileForm');if(form)form.onsubmit=e=>this.save(e);
  const close=document.getElementById('closeCoachProfile');if(close)close.onclick=()=>document.getElementById('coachProfileDialog').close();
 },
 open(slot,exerciseId){
  const gymId=state.activeSession?.gymId||state.settings.defaultGymId;
  const entry=state.activeSession?.exercises.find(e=>e.slotId===slot.id&&e.exerciseId===exerciseId);
  if(entry?.sets.some(s=>s.completedAt))return alert('Finish the active workout before changing its equipment or load convention. Its issued recommendation is preserved.');
  this.editing={slot,exerciseId,gymId};const profile=state.settings.coachProfiles?.[this.key(slot.id,exerciseId,gymId)]||{};
  document.getElementById('coachProfileTitle').textContent=exercise(exerciseId).name+' · '+(state.gyms.find(g=>g.id===gymId)?.name||'Gym');
  document.getElementById('coachEquipment').value=profile.equipmentId||'';
  document.getElementById('coachMode').value=profile.loadMode||'unknown';
  document.getElementById('coachBasis').value=profile.weightBasis||'unknown';
  document.getElementById('coachIncrement').value=profile.increment||exercise(exerciseId).increment;
  document.getElementById('coachLoads').value=(profile.availableLoads||[]).join(', ');
  document.getElementById('coachLegacy').checked=!!profile.legacySameEquipment;
  document.getElementById('coachProfileDialog').showModal();
 },
 async save(event){
  event.preventDefault();const {slot,exerciseId,gymId}=this.editing;
  const equipmentId=document.getElementById('coachEquipment').value.trim(),loadMode=document.getElementById('coachMode').value,weightBasis=document.getElementById('coachBasis').value,increment=Number(document.getElementById('coachIncrement').value);
  if(!equipmentId||loadMode==='unknown'||weightBasis==='unknown'||!Number.isFinite(increment)||increment<=0)return alert('Enter the equipment name, how you log weight, and the smallest load step.');
  if((loadMode==='assistance')!==(weightBasis==='assistance')||(loadMode==='bodyweight')!==(weightBasis==='bodyweight'))return alert('The weight basis must match the load convention. Choose assistance weight for assistance, or bodyweight for bodyweight only.');
  const loads=document.getElementById('coachLoads').value.trim(),availableLoads=loads?loads.split(',').map(x=>Number(x.trim())):null;
  if(availableLoads?.some(x=>!Number.isFinite(x)||x<=0))return alert('Available loads must be positive numbers separated by commas. Leave blank to use equal increments.');
  const priorProfile=state.settings.coachProfiles?.[this.key(slot.id,exerciseId,gymId)];
  const identityChanged=priorProfile?(priorProfile.equipmentId!==equipmentId||priorProfile.loadMode!==loadMode||priorProfile.weightBasis!==weightBasis):!document.getElementById('coachLegacy').checked;
  try{await idbPut('app',clone(state),'v5-before-equipment-change-'+now());}catch(error){return alert('Equipment unchanged because its safety snapshot failed: '+error.message);}
  state.settings.coachProfiles=state.settings.coachProfiles||{};state.settings.coachProfiles[this.key(slot.id,exerciseId,gymId)]={equipmentId,loadMode,weightBasis,increment,availableLoads,legacySameEquipment:document.getElementById('coachLegacy').checked};
  const entry=state.activeSession?.exercises.find(e=>e.slotId===slot.id&&e.exerciseId===exerciseId);
  if(entry){const c=this.target(slot,{exerciseId,forceDeload:state.activeSession.forceDeload,plannedSets:entry.plannedSets,setLimit:entry.plannedSets});entry.coachPrediction=clone(c.prediction);entry.coachRecommendation=clone(c);entry.coachContext=clone(c.coachContext);entry.plannedSets=c.sets;entry.sets=entry.sets.slice(0,c.sets);for(let i=0;i<entry.sets.length;i++){if(identityChanged){entry.sets[i].weight=c.load;entry.sets[i].reps=null;entry.sets[i].rir=null;}else if(entry.sets[i].weight==null)entry.sets[i].weight=c.load;entry.sets[i].targetReps=c.targetReps[i]??c.band[0];}}
  try{await persist({critical:true,reason:'coach_equipment_configured'});document.getElementById('coachProfileDialog').close();renderAllToday();}catch(error){alert(error.message);}
 }
};

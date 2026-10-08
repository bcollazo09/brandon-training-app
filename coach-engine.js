'use strict';
/* Deterministic coaching policy. Numerical priors are configurable engineering
   heuristics, not measured personal capacities or validated probability intervals. */
(function(root){
 const VERSION='3.0.0';
 // history is finalized saved workout history. Imported/manual entries may have
 // unknown completion timestamps; active/draft sessions are excluded separately.
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 const median=xs=>{const s=xs.filter(finite).sort((a,b)=>a-b);if(!s.length)return null;const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
 const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
 const mad=xs=>{const m=median(xs);return m==null?0:median(xs.map(x=>Math.abs(x-m)))||0;};
 const weightedMedian=rows=>{const sorted=[...rows].sort((a,b)=>a.value-b.value),total=sorted.reduce((s,r)=>s+r.weight,0);let sum=0;for(const r of sorted){sum+=r.weight;if(sum>=total/2)return r.value;}return sorted.at(-1)?.value??null;};
 const text=x=>String(x??'').trim().toLowerCase().replace(/\s+/g,' ');
 const round=x=>Math.round(x*10)/10;
 const day=86400000;
 function validSet(s){return s&&s.type!=='warmup'&&finite(s.weight)&&s.weight>=0&&finite(s.reps)&&s.reps>0&&s.reps<=60&&(s.rir==null||(finite(s.rir)&&s.rir>=0&&s.rir<=10));}
 function setsOf(ex){const seen=new Set();return(ex?.sets||[]).filter(s=>{if(!validSet(s))return false;if(s.id&&seen.has(s.id))return false;if(s.id)seen.add(s.id);return true;});}
 function select(input){
  const seen=new Set(),rows=[],rejected={context:0,invalid:0,deload:0};
  for(const w of [...(input.history||[])].filter(w=>w&&finite(w.timestamp)).sort((a,b)=>a.timestamp-b.timestamp||(String(a.id).localeCompare(String(b.id))))){
   if(w.timestamp>input.now){rejected.invalid++;continue;}
   if(w.id&&seen.has(w.id))continue;if(w.id)seen.add(w.id);
   if(w.status==='active'||w.status==='draft'){rejected.invalid++;continue;}
   if(w.week===8||w.templateId==='deload'){rejected.deload++;continue;}
   for(const ex of w.exercises||[]){
    if(!ex||ex.slotId!==input.slotId||ex.exerciseId!==input.exerciseId||ex.skipped)continue;
    const rawContext=ex.coachContext;const context=rawContext&&rawContext.equipmentId!=='unconfirmed'&&rawContext.weightBasis!=='unknown'&&rawContext.loadMode!=='unknown'?rawContext:null;
    if(w.gymId!==input.gymId||text(ex.setupNotes)!==text(input.setupNotes)){rejected.context++;continue;}
    if(context&&(context.equipmentId!==input.equipmentId||context.weightBasis!==input.weightBasis||context.loadMode!==input.loadMode)){rejected.context++;continue;}
    if(!context&&input.legacyEquipmentConfirmed!==true){rejected.context++;continue;}
    const sets=setsOf(ex).filter(set=>input.loadMode!=='external'||set.weight>0);if(!sets.length){rejected.invalid++;continue;}
    rows.push({id:w.id,date:w.date,timestamp:w.timestamp,mesoId:w.mesocycleId,week:w.week,sets,first:sets[0],ex,weight:Math.exp(-Math.max(0,input.now-w.timestamp)/(42*day))*(w.mesocycleId===input.currentMesoId?1:.65)});break;
   }
  }
  return{rows:rows.slice(-12),rejected};
 }
 function evaluate(prediction,actualSets){
  if(!prediction)return{status:'not-issued',usable:false};
  const sets=(actualSets||[]).filter(validSet);
  if(!sets.length)return{status:'no-valid-sets',usable:false};
  const planned=prediction.load,eligible=sets.filter(s=>finite(planned)&&Math.abs(s.weight-planned)<.001);
  if(!eligible.length)return{status:'load-changed',usable:false,adherence:0};
  const first=sets[0];
  if(first.rir==null||!eligible.includes(first))return{status:first.rir==null?'rir-missing':'first-load-changed',usable:false,adherence:eligible.length/sets.length};
  if(prediction.loadMode!=='external')return{status:'load-convention-unmodeled',usable:false};
  const expected=finite(prediction.expectedCapacity)?prediction.expectedCapacity:prediction.targetReps[0]+prediction.targetRir;
  const residual=first.reps+first.rir-expected;
  return{status:sets.length< prediction.targetReps.length?'partial':'evaluated',usable:true,adherence:eligible.length/sets.length,capacityError:round(residual),repError:round(first.reps-prediction.targetReps[0]),rirError:round(first.rir-prediction.targetRir),interpretation:residual>2?'underestimated':residual< -2?'overestimated':'within-band',engineVersion:prediction.engineVersion};
 }
 function normalize(raw){
  const range=Array.isArray(raw.range)&&raw.range.length===2&&raw.range.every(finite)&&raw.range[0]>0&&raw.range[1]>=raw.range[0]?raw.range:[8,12];
  return{...raw,now:finite(raw.now)?raw.now:Date.now(),week:clamp(Math.round(raw.week||1),1,8),range:range.map(x=>clamp(Math.round(x),1,60)),plannedSets:clamp(Math.round(raw.plannedSets||2),1,8),increment:finite(raw.increment)&&raw.increment>0?raw.increment:5,targetRir:finite(raw.targetRir)?clamp(raw.targetRir,0,6):2,restSec:finite(raw.restSec)?clamp(raw.restSec,30,600):120,loadMode:raw.loadMode||'unknown',type:raw.type||'compound',recovery:raw.recovery||{level:'unknown'},setupNotes:raw.setupNotes||'',weightBasis:raw.weightBasis||'unknown',equipmentId:raw.equipmentId||'legacy-confirmed'};
 }
 function grid(input,anchor){
  if(Array.isArray(input.availableLoads)&&input.availableLoads.length)return[...new Set(input.availableLoads.filter(x=>finite(x)&&x>0))].sort((a,b)=>a-b);
  const values=[];for(let k=-3;k<=2;k++){const v=Math.round((anchor/input.increment+k))*input.increment;if(v>0)values.push(round(v));}
  // The currently logged load is observable, but only generated equipment steps are candidates.
  return[...new Set(values)].sort((a,b)=>a-b);
 }
 function makePrediction(result,input,rows){const chosen=result.alternatives.find(x=>x.load===result.load);return{expectedCapacity:chosen?round(chosen.reps+result.targetRir):null,engineVersion:VERSION,issuedAt:input.now,contextKey:[input.gymId,input.slotId,input.exerciseId,input.equipmentId,input.weightBasis,input.loadMode,text(input.setupNotes)].join('::'),sourceExposureIds:rows.map(r=>r.id),load:result.load,loadMode:input.loadMode,targetReps:[...result.targetReps],targetRir:result.targetRir,confidence:{...result.confidence},reasonCodes:result.flags.slice(),uncertainty:result.model.uncertainty,model:{capacity:result.model.capacity,sensitivity:result.model.sensitivity,pairCount:result.model.pairCount},alternatives:result.alternatives.map(x=>({load:x.load,reps:x.reps,lowerReps:x.lowerReps,eligible:x.eligible})),plannedSets:result.sets};}
 function protectUnmodeled(result,input,last){
  const red=input.recovery.level==='red',yellow=input.recovery.level==='yellow',blocked=red||yellow||input.symptomConcern||input.sessionFatigue>0;
  if(red){result.targetRir=Math.max(result.targetRir,3);if(!(input.forceDeload||input.week===8)){result.sets=Math.max(1,Math.min(result.sets,last?.ex.plannedSets||last?.sets.length||result.sets)-(input.priority?0:1));result.volume={action:'reduce',reason:'Recorded recovery flags protect the requested working dose.'};}result.flags.push('recovery-protection');}
  else if(yellow){result.targetRir=Math.min(6,result.targetRir+1);result.flags.push('recovery-caution');}
  if(input.symptomConcern){result.flags.push('symptom-review');result.reasons.push('A reported symptom association blocks automatic rep and load progression pending exercise review.');}
  if(input.sessionFatigue>0)result.flags.push('earlier-session-fatigue');
  if(blocked){result.targetReps=Array.from({length:result.sets},(_,i)=>clamp(Math.min(result.targetReps[i]??input.range[0],last?.sets[i]?.reps??input.range[0]),...input.range));if(!(input.forceDeload||input.week===8)&&last)result.action=input.symptomConcern?'flag':red||input.sessionFatigue>0?'fatigue':'hold';result.reasons.push('Recovery or session flags protect reps and volume even when this load convention has no calibrated arithmetic.');}
  return result;
 }
 function recommend(raw={}){
  const input=normalize(raw),{rows,rejected}=select(input),reasons=[],flags=[];
  const last=rows.at(-1),n=rows.length,latestRir=last?.first.rir;
  let sets=input.plannedSets,targetRir=input.targetRir;
  const result={engineVersion:VERSION,action:'baseline',load:null,sets,band:input.range,targetReps:Array(sets).fill(input.range[0]),targetRir,confidence:{label:'low',count:n},reasons,flags,volume:{action:'hold',reason:'No additional volume is earned by default.'},restSec:input.restSec,trend:{kind:'baseline',text:'Insufficient comparable exposures.'},alternatives:[],model:{capacity:null,sensitivity:null,uncertainty:null,pairCount:0},evidence:{comparable:n,excluded:rejected,sourceIds:rows.map(x=>x.id)}};
  if(input.forceDeload||input.week===8){sets=Math.max(1,Math.ceil((input.baseSets||input.plannedSets)/2));targetRir=Math.max(targetRir,4);result.sets=sets;result.targetRir=targetRir;result.targetReps=Array(sets).fill(input.range[0]);result.volume={action:'reduce',reason:'Planned deload reduces working sets and retains more RIR.'};}
  if(!input.equipmentConfirmed||input.weightBasis==='unknown'){
   flags.push('equipment-unconfirmed');reasons.push('Confirm the equipment and whether weight is per hand, total, or a machine stack before transferring previous loads.');protectUnmodeled(result,input,last);result.prediction=makePrediction(result,input,rows);return result;
  }
  if(!last){reasons.push('No comparable completed history for this exercise, program slot, gym, and setup. Choose a conservative initial load and log the outcome.');protectUnmodeled(result,input,last);result.prediction=makePrediction(result,input,rows);return result;}
  const priorLoads=rows.slice(0,-1).map(r=>r.first.weight).filter(x=>x>0),priorLoadMedian=median(priorLoads);
  if(priorLoads.length>=3&&priorLoadMedian>0&&(last.first.weight/priorLoadMedian>2||last.first.weight/priorLoadMedian<.4)){
   flags.push('anchor-needs-review');reasons.push('The latest load is far outside the earlier equipment loads. Confirm the entry and equipment before receiving another load target.');result.prediction=makePrediction(result,input,rows);return result;
  }
  const anchor=last.first.weight;
  if(input.loadMode==='assistance'&&Array.isArray(input.availableLoads)&&input.availableLoads.length&&!input.availableLoads.some(load=>finite(load)&&Math.abs(load-anchor)<.001)){
   flags.push('anchor-unavailable');reasons.push('The recorded assistance setting is unavailable. Lower assistance is harder, so choose a fresh baseline rather than borrowing a setting.');protectUnmodeled(result,input,last);result.prediction=makePrediction(result,input,rows);return result;
  }
  if(input.loadMode!=='external'||anchor<=0){
   result.action='hold';result.load=anchor;flags.push('load-convention-unmodeled');
   if(input.forceDeload||input.week===8){result.action='deload';sets=Math.max(1,Math.ceil((input.baseSets||input.plannedSets)/2));targetRir=Math.max(targetRir,4);result.sets=sets;result.targetRir=targetRir;result.volume={action:'reduce',reason:'Planned deload reduces working sets and keeps more RIR.'};}
   result.targetReps=Array.from({length:sets},(_,i)=>clamp((last.sets[i]?.reps||input.range[0])+((latestRir!=null&&latestRir>targetRir+1)?1:0),...input.range));
   reasons.push(input.loadMode==='assistance'?'Assistance weight runs in the opposite direction from resistance. Keep the same assistance and build reps until an assistance-specific response is calibrated.':'Bodyweight or an unconfirmed load convention cannot use resistance-load arithmetic. Keep the recorded convention and progress controlled reps.');
   protectUnmodeled(result,input,last);result.prediction=makePrediction(result,input,rows);return result;
  }
  const recent=rows.slice(-6),known=recent.filter(r=>r.first.rir!=null),priorSensitivity=input.type==='isolation'?26:32;
  // Adjacent early-set observations reduce set-fatigue confounding. Training
  // adaptation is still a confound, so shrink the slope strongly toward its prior.
  const slopes=[];
  for(let i=1;i<rows.length;i++){
   const a=rows[i-1],b=rows[i],ratio=b.first.weight/a.first.weight;
   if(a.first.weight<=0||b.first.weight<=0||a.first.rir==null||b.first.rir==null||a.mesoId!==b.mesoId||b.timestamp-a.timestamp>28*day||Math.abs(Math.log(ratio))<.04||Math.abs(Math.log(ratio))>.4)continue;
   const slope=-((b.first.reps+Math.min(6,b.first.rir))-(a.first.reps+Math.min(6,a.first.rir)))/Math.log(ratio);
   if(slope>=8&&slope<=100)slopes.push(slope);
  }
  const pairCount=slopes.length,shrink=pairCount/(pairCount+6),sensitivity=clamp(priorSensitivity*(1-shrink)+(median(slopes)||priorSensitivity)*shrink,12,70);
  const usable=known.length>=2?known:recent;
  const normalized=usable.map(r=>({row:r,value:r.first.reps+(r.first.rir==null?0:Math.min(6,r.first.rir))+sensitivity*Math.log(r.first.weight/anchor),weight:r.weight}));
  const center=weightedMedian(normalized),dispersion=mad(normalized.map(r=>r.value)),outlierLimit=Math.max(3,3*dispersion);
  let outliers=0;const bounded=normalized.map(r=>{const v=clamp(r.value,center-outlierLimit,center+outlierLimit);if(v!==r.value)outliers++;return{...r,value:v};});
  const recentCenter=weightedMedian(bounded),latestKnown=normalized.at(-1)?.value||recentCenter;
  const capacity=clamp(.65*recentCenter+.35*clamp(latestKnown,center-outlierLimit,center+outlierLimit),1,66);
  const errors=recent.map(r=>evaluate(r.ex.coachPrediction,r.sets)).filter(e=>e.usable);
  const misses=errors.filter(e=>e.interpretation==='overestimated').length;
  const residualSpread=mad(errors.map(e=>e.capacityError));
  const missingRir=known.length<recent.length;
  const uncertainty=Math.max(known.length<2?3:1.25,1.4826*dispersion,1.4826*residualSpread,errors.length>=2?Math.sqrt(mean(errors.map(e=>e.capacityError**2)))*.75:0)+(n<3?.75:0)+(missingRir?.5:0);
  result.model={capacity:round(capacity),sensitivity:round(sensitivity),uncertainty:round(uncertainty),pairCount,priorSensitivity,calibration:pairCount>=3?'partially-personalized':'prior-dominated',feedback:{count:errors.length,overestimates:misses,medianError:median(errors.map(e=>e.capacityError))}};
  result.confidence={label:n>=6&&known.length>=5&&pairCount>=3&&uncertainty<2.5?'high':n>=3&&known.length>=2?'medium':'low',count:n};
  if(missingRir){flags.push('rir-incomplete');reasons.push('Missing RIR is unknown effort, not zero RIR; load increases need clearer evidence.');}
  if(outliers){flags.push('outlier-protected');reasons.push('An unusual exposure was limited in the estimate instead of deciding the next load by itself.');}
  if(!pairCount)reasons.push('Load response uses a conservative initial prior; this movement has no usable comparable load changes yet.');
  else reasons.push(`Load response is partially calibrated from ${pairCount} comparable load changes; strength adaptation can still affect that estimate.`);
  const trendVals=bounded.map(x=>x.value),earlier=trendVals.slice(0,Math.max(1,trendVals.length-2)),lastTwo=trendVals.slice(-2);
  const delta=n>=3?(mean(lastTwo)-(median(earlier)||mean(lastTwo))):0;
  const decline=n>=4&&lastTwo.every(v=>v<(median(earlier)||v)-1.5);
  const improving=n>=4&&outliers===0&&delta>=1&&lastTwo.every(v=>v>=(median(earlier)||v)+.5);
  result.trend={kind:decline?'regression':improving?'improving':n<3?'baseline':'stable',text:decline?'Two recent comparable early-set exposures declined.':improving?'Comparable early-set capacity is improving.':n<3?'More independent exposures are needed to establish a trend.':'Comparable early-set capacity is stable.',delta:round(delta)};
  const penalties=Array.from({length:Math.max(sets,8)},(_,i)=>{
   if(i===0)return 0;const observations=[];
   for(const row of recent){const first=row.first,s=row.sets[i];if(!s||first.rir==null||s.rir==null||s.weight<=0)continue;const deficit=(first.reps+Math.min(6,first.rir))-(s.reps+Math.min(6,s.rir)+sensitivity*Math.log(s.weight/first.weight));observations.push(clamp(deficit,0,12));}
   const fallback=i*(input.type==='isolation'?1.1:.8),observed=median(observations);return observed==null?fallback:(fallback*2+observed*observations.length)/(2+observations.length);
  });
  const matchedDose=Math.min(...recent.map(row=>row.sets.length));
  const drops=recent.map(row=>{const lastSet=row.sets[Math.min(matchedDose,row.sets.length)-1];return row.sets.length>1&&Math.abs(lastSet.weight-row.first.weight)<.001?(row.first.reps-lastSet.reps)/row.first.reps:null;}).filter(finite);
  const latestDrop=drops.at(-1)||0,shortRest=recent.slice(-2).some(row=>row.sets.slice(1).some(s=>finite(s.restBeforeSec)&&s.restBeforeSec<input.restSec*.65));
  const fatigue=decline||(drops.length>=2&&drops.slice(-2).every(d=>d>=.25)&&latestRir!=null&&latestRir<=targetRir+1);
  const gapDays=Math.max(0,(input.now-last.timestamp)/day),newMeso=!rows.some(r=>r.mesoId===input.currentMesoId);
  const symptom=!!input.symptomConcern,red=input.recovery.level==='red',yellow=input.recovery.level==='yellow';
  const priorSets=Math.max(last.sets.length,finite(last.ex.plannedSets)?Math.round(last.ex.plannedSets):last.sets.length);
  const incompleteDose=recent.some(row=>finite(row.ex.plannedSets)&&row.sets.length<row.ex.plannedSets);
  if(incompleteDose){flags.push('dose-incomplete');reasons.push('Recent exposures did not complete the recorded dose. Incomplete sessions do not earn a load or set increase.');}
  if(input.forceDeload||input.week===8){sets=Math.max(1,Math.ceil((input.baseSets||input.plannedSets)/2));targetRir=Math.max(targetRir,4);flags.push('deload');}
  else if(red||fatigue){sets=Math.max(1,Math.min(sets,priorSets)-(input.priority?0:1));targetRir=Math.max(targetRir,red?3:2);flags.push(red?'recovery-protection':'repeated-fatigue');}
  else if(yellow){targetRir=Math.min(6,targetRir+1);flags.push('recovery-caution');}
  if(symptom){flags.push('symptom-review');reasons.push('A recorded symptom association blocks automatic progression. Review the exercise; this is not a diagnosis or evidence that changing load treats symptoms.');}
  if(gapDays>14){flags.push('stale-history');reasons.push(`The last comparable exposure was ${Math.floor(gapDays)} days ago; rebuild confidence before progressing.`);}
  const volumeEarned=!(input.sessionFatigue>0)&&!incompleteDose&&n>=4&&known.length>=3&&improving&&!fatigue&&!red&&!yellow&&!symptom&&gapDays<14&&latestDrop<.2;
  if(!input.forceDeload&&input.week!==8&&sets>priorSets&&!volumeEarned){sets=priorSets;flags.push('volume-not-earned');reasons.push('An extra set is not earned yet; consolidate the existing dose before increasing it.');}
  if(sets>priorSets)sets=Math.min(sets,priorSets+1);
  if(input.sessionFatigue>0){flags.push('earlier-session-fatigue');reasons.push('Earlier exercises produced fatigue signals; protect this later slot instead of forcing progression.');}
  result.volume={action:sets<priorSets?'reduce':sets>priorSets?'increase':'hold',reason:sets>priorSets?'Repeated comparable improvement earns one extra set; keep the load steady.':sets<priorSets?'Protect quality while recovery or the planned deload lowers volume.':'Consolidate the current number of working sets.'};
  result.sets=sets;result.targetRir=targetRir;
  const loads=grid(input,anchor),freshRir=latestRir!=null,atTop=recent.slice(-2).length>=2&&recent.slice(-2).every(row=>row.sets.length>=Math.min(sets,priorSets)&&row.sets.slice(0,Math.min(sets,priorSets)).every(s=>s.reps>=input.range[1]&&s.rir!=null&&s.rir>=targetRir));
  const surplus=capacity-targetRir-input.range[0];
  const veryEasy=freshRir&&latestRir>=targetRir+3&&last.first.reps>=input.range[0]+3;
  const upwardBlocked=red||yellow||fatigue||symptom||input.sessionFatigue>0||outliers>0||gapDays>14||!freshRir||incompleteDose||(known.length<2&&!veryEasy)||misses>=2||sets>priorSets;
  const candidateData=loads.map(load=>{
   const shift=sensitivity*Math.log(load/anchor),extrapolation=Math.abs(Math.log(load/anchor))*(pairCount<3?8:4);
   const reps=capacity-shift-targetRir,lowerReps=reps-uncertainty-extrapolation;
   const projected=Array.from({length:sets},(_,i)=>reps-penalties[i]);
   const hardestFloor=projected.at(-1)-uncertainty-extrapolation;
   const above=load>anchor+.001;
   const eligible=!above||(!upwardBlocked&&lowerReps>=input.range[0]&&hardestFloor>=input.range[0]-1&&(atTop||surplus>=4)&&(load/anchor<=1.3));
   return{load,reps:round(reps),lowerReps:round(lowerReps),setReps:projected.map(round),eligible,why:!above?'Available same or easier load.':eligible?'Predicted early and later sets clear the rep floor with a buffer.':upwardBlocked?'Progression veto or insufficient effort evidence.':'The next step does not clear the rep floor with enough buffer.'};
  });
  result.alternatives=candidateData;
  if(!loads.length||loads.every(load=>load>anchor)){
   flags.push('no-safe-available-load');reasons.push('The supplied equipment has no same or easier load. The engine will not force a heavier setting when evidence or recovery cannot support it.');result.load=null;result.action='baseline';result.prediction=makePrediction(result,input,rows);return result;
  }
  const current=loads.find(x=>Math.abs(x-anchor)<.001),floor=loads.filter(x=>x<=anchor).at(-1);
  let load=current??floor??loads[0]??anchor,action='hold';
  if(input.forceDeload||input.week===8){load=loads.filter(x=>x<=anchor*.9).at(-1)??floor??anchor;action='deload';reasons.push('Planned deload: reduce sets, retain more RIR, and use an available load around or below 90% of the anchor.');}
  else if(newMeso&&input.week===1){load=loads.filter(x=>x<=anchor*.95).at(-1)??floor??anchor;action='reset';flags.push('new-cycle');reasons.push('The first exposure of a new mesocycle starts below the prior non-deload anchor.');}
  else if(gapDays>=21){load=loads.filter(x=>x<=anchor*.95).at(-1)??floor??anchor;action='reset';}
  else if(red||decline){load=loads.filter(x=>x<anchor).at(-1)??floor??anchor;action='reduce';}
  else if(fatigue||symptom){action=fatigue?'fatigue':'flag';}
  else if(!upwardBlocked){const next=candidateData.find(x=>x.load>anchor&&x.eligible);if(next){load=next.load;action='increase';}}
  if(current==null){flags.push('anchor-unavailable');reasons.push('The last logged load is not in the current equipment load grid. The next target uses an available step.');}
  const candidate=candidateData.find(x=>x.load===load),firstProjection=candidate?.reps??capacity-targetRir;
  result.load=load;result.action=action;
  // Suggestions are ceilings within the programmed band, not required reps at any cost.
  result.targetReps=Array.from({length:sets},(_,i)=>clamp(Math.floor(firstProjection-penalties[i]),...input.range));
  if(known.length<2&&action==='hold')result.targetReps=result.targetReps.map((r,i)=>Math.min(r,clamp((last.sets[i]?.reps||input.range[0])+1,...input.range)));
  if(shortRest&&latestDrop>.2){result.restSec=clamp(input.restSec+30,60,600);flags.push('rest-first');reasons.push('Recent short rests coincide with set drop-off. Allow more rest before concluding the exercise needs a permanent load reduction.');}
  reasons.unshift(`Last comparable exposure: ${anchor} lb × ${last.first.reps}${latestRir==null?' · RIR unlogged':` @${latestRir} RIR`}; ${n} independent comparable sessions.`);
  if(action==='increase')reasons.push(`The next available ${round(load-anchor)} lb step predicts about ${candidate.reps} early-set reps; its conservative prediction is ${candidate.lowerReps}.`);
  else if(action==='hold')reasons.push(upwardBlocked?'Hold the load while evidence, recovery, or the set-count change is resolved.':'The available load jump is too large for the current prediction buffer. Progress repeatable reps first.');
  reasons.push(result.trend.text,result.volume.reason);
  if(errors.length)reasons.push(`${errors.length} issued predictions have comparable outcomes; ${misses} were too ambitious. Outcome error widens the future prediction band.`);
  if(n>=6&&result.trend.kind==='stable'&&!fatigue){flags.push('possible-plateau');reasons.push('Six comparable exposures are stable. Review execution, rest consistency, and available load increments before adding volume or replacing the exercise. Stable output alone does not establish failed adaptation.');}
  result.prediction=makePrediction(result,input,rows);return result;
 }
 function live(raw={}){
  const opening=raw.opening||recommend(raw),done=(raw.completedSets||[]).filter(s=>s&&s.completedAt&&validSet(s));
  const unique=[];const ids=new Set();for(const s of done){if(s.id&&ids.has(s.id))continue;if(s.id)ids.add(s.id);unique.push(s);}
  if(!unique.length)return null;
  const input=normalize(raw);input.targetRir=finite(opening.targetRir)?opening.targetRir:input.targetRir;input.restSec=finite(opening.restSec)?opening.restSec:input.restSec;const last=unique.at(-1),first=unique[0],rest=last.restBeforeSec,shortRest=finite(rest)&&rest<input.restSec*.65;
  if(!input.equipmentConfirmed||input.weightBasis==='unknown')return{level:'warn',rescue:false,action:'review',load:last.weight,targetReps:null,restSec:input.restSec,text:'Confirm equipment and the weight convention before receiving a calculated next-set load.'};
  if(input.symptomConcern)return{level:'warn',rescue:false,action:'review',load:last.weight,targetReps:null,restSec:input.restSec,text:'A symptom review flag is active. Pause automatic progression and review the exercise.'};
  if(input.loadMode!=='external'||last.weight<=0)return{level:'good',rescue:false,action:'hold',load:last.weight,targetReps:clamp(last.reps,...input.range),restSec:input.restSec,text:'Keep this load convention; the resistance-load model does not apply to assistance or bodyweight.'};
  if(input.sessionFatigue>0){const current=recommend(raw),ceiling=current.load??last.weight;return{level:'warn',rescue:false,action:'protect',load:Math.min(last.weight,ceiling),targetReps:clamp(last.reps,...input.range),restSec:input.restSec,text:'Earlier exercises produced fatigue signals. Keep the current conservative load ceiling and protect later-slot quality.'};}
  const highEffort=last.rir!=null&&last.rir<input.targetRir-1,below=last.reps<input.range[0];
  const sameWeight=Math.abs(first.weight-last.weight)<.001,drop=sameWeight?(first.reps-last.reps)/Math.max(1,first.reps):0;
  if(shortRest&&(highEffort||below||drop>=.25))return{level:'warn',rescue:false,action:'rest',load:last.weight,targetReps:clamp(last.reps,...input.range),restSec:Math.min(600,input.restSec+30),text:'That miss followed a short rest. Add 30 seconds before deciding to reduce the load.'};
  if(below||highEffort){const easier=grid(input,last.weight).filter(x=>x<last.weight).at(-1)??last.weight;return{level:'warn',rescue:unique.length>=2&&drop>=.25,action:'reduce',load:easier,targetReps:input.range[0],restSec:input.restSec,text:`The last set missed the rep/effort envelope. Consider ${easier} lb for the next uncompleted set; protect technique.`};}
  if(unique.length>=2&&drop>=.25&&(last.rir==null||last.rir<=input.targetRir+1))return{level:'warn',rescue:true,action:'trim',load:last.weight,targetReps:clamp(last.reps,...input.range),restSec:input.restSec,text:'Repeated in-session drop-off is large. Keep quality and consider removing an optional final set.'};
  const target=last.rir==null?last.reps:last.reps+clamp(last.rir-input.targetRir, -1,2);
  return{level:'good',rescue:false,action:'hold',load:Math.min(last.weight,opening.load??last.weight),targetReps:clamp(Math.round(target),...input.range),restSec:input.restSec,text:last.rir==null?'RIR is missing; use the completed reps as a reference and log effort on the next set.':`Keep the opening load ceiling. Aim for about ${clamp(Math.round(target),...input.range)} controlled reps at the planned RIR; one easy set does not trigger another load jump.`};
 }
 root.BFCoach={recommend,live,evaluate,VERSION};if(typeof module!=='undefined')module.exports=root.BFCoach;
})(typeof window!=='undefined'?window:globalThis);

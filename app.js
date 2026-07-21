const PROGRAM={
"Pull 1":[["Lat Pulldown",3,"6–10"],["Chest Supported Row",3,"6–10"],["Single Arm Cable Rear Delt",3,"12–20"],["Cable Pullover",2,"10–15"],["Supinated Cable Curl",3,"8–12"],["Rope Hammer Curl",2,"10–15"]],
"Push 1":[["DB Bench",3,"6–10"],["Incline Machine Press",3,"8–12"],["Pec Fly",2,"12–15"],["Cable Lateral Raise",4,"12–20"],["Cable Skull Crusher",3,"10–15"],["Rope Pushdown",2,"12–15"]],
"Legs":[["Hack Squat",3,"6–10"],["Hip Thrust",3,"8–12"],["Seated Leg Curl",3,"8–15"],["Leg Extension",2,"10–15"],["Hip Abductor",3,"15–20"],["Hip Adductor",2,"12–15"],["Standing Calf Raise",4,"8–15"]],
"Pull 2":[["Wide Pulldown",3,"10–15"],["Chest Supported Machine Row",3,"10–15"],["Pec Deck Rear Delt",3,"15–20"],["Cable Pullover",2,"15–20"],["Cable Curl",3,"12–15"],["Hammer Rope Curl",3,"12–15"]],
"Push 2":[["DB Bench",3,"10–15"],["Pec Fly",3,"15–20"],["Cable Lateral Raise",4,"15–20"],["Rope Pushdown",3,"12–15"],["Overhead Cable Extension",3,"12–15"]]
};
const GUIDE={
1:["Base week","3 RIR","Establish a clean baseline."],
2:["Build","2 RIR","Add reps. Add one set only if recovery is good."],
3:["Build","2 RIR","Continue double progression without forcing volume."],
4:["Load","1–2 RIR","Add load after reaching the top of the range."],
5:["High volume","1 RIR","Add an isolation set only where recovery allows."],
6:["Peak","0–1 RIR","Compounds stay controlled. Failure only on selected isolations."],
7:["Highest recoverable volume","0–1 RIR","Push performance without lasting sciatica increase."],
8:["Deload","4–5 RIR","Use about half the sets and 85–90% of usual load."]
};
const KEY="brandonFitnessV2";
const OLD_KEY="brandonFitnessV1";
const DEFAULT={
  version:2,currentDay:"Pull 1",currentWeek:4,
  mesocycle:{name:"Mesocycle 1",startDate:"",completed:[]},
  workouts:[],checkins:[],timeline:[]
};
let state=load();

function load(){
  try{
    const current=JSON.parse(localStorage.getItem(KEY));
    if(current) return normalize({...DEFAULT,...current});
    const old=JSON.parse(localStorage.getItem(OLD_KEY));
    if(old){
      const migrated=normalize({...DEFAULT,...old,currentWeek:old.currentWeek||4});
      localStorage.setItem(KEY,JSON.stringify(migrated));
      return migrated;
    }
  }catch(e){}
  return structuredClone(DEFAULT);
}
function normalize(s){
  s.mesocycle=s.mesocycle||structuredClone(DEFAULT.mesocycle);
  s.mesocycle.completed=s.mesocycle.completed||[];
  s.workouts=s.workouts||[];s.checkins=s.checkins||[];s.timeline=s.timeline||[];
  return s;
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function today(){return new Date().toISOString().slice(0,10)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function show(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  if(id==="history")renderHistory();
  if(id==="progress")renderProgress();
  if(id==="settings")renderSettings();
}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>show(b.dataset.view));

function workoutSessions(day){return state.workouts.filter(w=>w.day===day).sort((a,b)=>a.timestamp-b.timestamp)}
function priorExercise(name,before=Infinity){
  for(let i=state.workouts.length-1;i>=0;i--){
    const w=state.workouts[i];
    if(w.timestamp>=before)continue;
    const e=w.exercises.find(x=>x.name===name);
    if(e)return{date:w.date,sets:e.sets,week:w.week};
  }
  return null;
}
function bestSet(sets){return [...sets].filter(s=>s.weight&&s.reps).sort((a,b)=>(b.weight*b.reps)-(a.weight*a.reps))[0]||null}
function targetFor(name,range){
  const p=priorExercise(name);
  if(!p)return"No previous data. Start conservatively and establish a baseline.";
  const valid=p.sets.filter(s=>s.weight&&s.reps);
  if(!valid.length)return"Repeat the prescribed rep range and log all working sets.";
  const [low,high]=range.split("–").map(Number);
  const avg=valid.reduce((a,s)=>a+s.reps,0)/valid.length;
  const weight=valid[0].weight;
  if(avg>=high)return`Increase weight slightly from ${weight} lb and return near ${low} reps.`;
  return`Keep ${weight} lb and try to add 1 total rep across the working sets.`;
}
function latestCheckin(){return [...state.checkins].sort((a,b)=>b.timestamp-a.timestamp)[0]||null}
function recoveryScore(c){
  if(!c)return null;
  const sleepScore=Math.min(10,(c.sleep||7)/8*10);
  const painPenalty=((c.backPain||0)+(c.sciatica||0))/2;
  return Math.max(0,Math.min(10,sleepScore-painPenalty*.55));
}
function recommendation(){
  const recent=[...state.checkins].sort((a,b)=>b.timestamp-a.timestamp).slice(0,7);
  const c=latestCheckin();
  if(!c)return{type:"",title:"Log a quick check-in",text:"A few seconds of sleep, bodyweight, back pain, and sciatica data will make recommendations more useful."};
  const avg=(key)=>recent.filter(x=>x[key]!=null).reduce((a,x)=>a+x[key],0)/(recent.filter(x=>x[key]!=null).length||1);
  const pain=avg("backPain"),sci=avg("sciatica"),sleepAvg=avg("sleep");
  if(sci>=5||pain>=6)return{type:"warn",title:"Keep today controlled",text:"Your recent pain scores are elevated. Maintain load, avoid grinders, and stop any movement that meaningfully increases leg symptoms."};
  if(sleepAvg&&sleepAvg<6)return{type:"warn",title:"Recovery is limited",text:"Recent sleep is under 6 hours. Maintain loads today rather than forcing progression."};
  if(state.currentWeek===8)return{type:"good",title:"Deload week",text:"Use about half your normal sets and keep 4–5 reps in reserve."};
  return{type:"good",title:"Progress normally",text:"Recent recovery data does not show an obvious reason to reduce today’s planned workload."};
}

function renderToday(){
  const g=GUIDE[state.currentWeek];
  mesoLabel.textContent=(state.mesocycle.name||"Mesocycle 1").toUpperCase();
  dayTitle.textContent=state.currentDay;
  weekText.textContent=`Week ${state.currentWeek}: ${g[0]} — ${g[2]}`;
  summaryWeek.textContent=`${state.currentWeek}/8`;
  summaryRir.textContent=g[1];
  rirBadge.textContent=g[1];
  const c=latestCheckin(),score=recoveryScore(c);
  summaryWeight.textContent=c?.bodyweight?`${c.bodyweight} lb`:"—";
  summaryRecovery.textContent=score==null?"—":`${score.toFixed(1)}/10`;

  const todayCheck=[...state.checkins].reverse().find(x=>x.date===today());
  bw.value=todayCheck?.bodyweight??"";
  sleep.value=todayCheck?.sleep??"";
  back.value=todayCheck?.backPain??"";
  sciatica.value=todayCheck?.sciatica??"";

  const rec=recommendation();
  recommendationCard.className=`card recommendation ${rec.type}`;
  recommendationCard.innerHTML=`<h3>${esc(rec.title)}</h3><p class="muted">${esc(rec.text)}</p>`;

  workout.innerHTML="";
  PROGRAM[state.currentDay].forEach(([name,sets,range])=>{
    const prior=priorExercise(name);
    const last=prior?`${prior.date}: ${prior.sets.map(s=>`${s.weight??"-"}×${s.reps??"-"}`).join(", ")}`:"No previous session";
    const card=document.createElement("div");
    card.className="card exercise";card.dataset.name=name;
    card.innerHTML=`<h3>${esc(name)}</h3><p class="muted">${sets} sets · ${range} reps</p><p class="last">Last: ${esc(last)}</p><div class="goal">${esc(targetFor(name,range))}</div><div class="sets"></div><label>Notes<input class="note" placeholder="Form, pain, setup..."></label>`;
    for(let i=1;i<=sets;i++){
      const r=document.createElement("div");r.className="setrow";
      r.innerHTML=`<span>Set ${i}</span><label>Weight<input class="weight" type="number" step=".5" inputmode="decimal"></label><label>Reps<input class="reps" type="number" inputmode="numeric"></label><label>RIR<input class="rir" type="number" min="0" max="10" inputmode="numeric"></label>`;
      card.querySelector(".sets").appendChild(r);
    }
    workout.appendChild(card);
  });
}

saveCheckin.onclick=()=>{
  const item={date:today(),timestamp:Date.now(),bodyweight:bw.value?+bw.value:null,sleep:sleep.value?+sleep.value:null,backPain:back.value?+back.value:null,sciatica:sciatica.value?+sciatica.value:null};
  state.checkins=state.checkins.filter(x=>x.date!==item.date);state.checkins.push(item);save();renderToday();alert("Check-in saved.");
};
finish.onclick=()=>{
  const exercises=[...document.querySelectorAll(".exercise")].map(card=>({
    name:card.dataset.name,
    notes:card.querySelector(".note").value.trim(),
    sets:[...card.querySelectorAll(".setrow")].map(r=>({
      weight:r.querySelector(".weight").value?+r.querySelector(".weight").value:null,
      reps:r.querySelector(".reps").value?+r.querySelector(".reps").value:null,
      rir:r.querySelector(".rir").value?+r.querySelector(".rir").value:null
    })).filter(s=>s.weight!==null||s.reps!==null||s.rir!==null)
  })).filter(e=>e.sets.length);
  if(!exercises.length)return alert("Enter at least one set first.");
  state.workouts.push({date:today(),timestamp:Date.now(),day:state.currentDay,week:state.currentWeek,mesocycle:state.mesocycle.name,exercises});
  save();alert("Workout saved.");renderToday();
};

function openDayDialog(){
  dayChoices.innerHTML="";
  Object.keys(PROGRAM).forEach(d=>{
    const b=document.createElement("button");b.textContent=d;
    b.onclick=()=>{state.currentDay=d;save();dayDialog.close();renderToday()};
    dayChoices.appendChild(b);
  });
  dayDialog.showModal();
}
changeDay.onclick=openDayDialog;
closeDayDialog.onclick=()=>dayDialog.close();

function renderProgram(){
  const g=GUIDE[state.currentWeek];
  weekGuide.innerHTML=`<h3>Week ${state.currentWeek}: ${g[0]}</h3><p><strong>${g[1]}</strong></p><p class="muted">${g[2]}</p>`;
  programList.innerHTML="";
  Object.entries(PROGRAM).forEach(([d,es])=>{
    const c=document.createElement("div");c.className="card";
    c.innerHTML=`<h3>${d}</h3>`+es.map(([n,s,r])=>`<div class="programrow"><span>${esc(n)}</span><strong>${s} × ${r}</strong></div>`).join("");
    programList.appendChild(c);
  });
}
advanceWeek.onclick=()=>{state.currentWeek=state.currentWeek===8?1:state.currentWeek+1;save();renderProgram();renderToday()};

function renderHistory(){
  const workouts=[...state.workouts].sort((a,b)=>b.timestamp-a.timestamp);
  const current=workouts.filter(w=>(w.mesocycle||state.mesocycle.name)===state.mesocycle.name);
  const totalSets=current.reduce((a,w)=>a+w.exercises.reduce((b,e)=>b+e.sets.length,0),0);
  const first=current[current.length-1],last=current[0];
  mesoSummary.innerHTML=`<p><strong>${esc(state.mesocycle.name)}</strong></p><p class="muted">${current.length} workouts · ${totalSets} logged working sets${first?` · ${first.date} to ${last.date}`:""}</p>`;
  historyList.innerHTML=workouts.length?workouts.map(w=>`<div class="historyitem"><strong>${esc(w.day)} · Week ${w.week}</strong><div class="history-meta">${w.date} · ${esc(w.mesocycle||"Legacy data")}</div><div class="muted">${w.exercises.map(e=>`${esc(e.name)}: ${e.sets.map(s=>`${s.weight??"-"}×${s.reps??"-"}`).join(", ")}`).join("<br>")}</div></div>`).join(""):"<p class='muted'>No workouts logged yet.</p>";
}

function buildPastForm(){
  pastDate.value=today();pastWeek.value=Math.max(1,state.currentWeek-1);
  pastDay.innerHTML=Object.keys(PROGRAM).map(d=>`<option>${d}</option>`).join("");
  renderPastExercises();
}
function renderPastExercises(){
  pastExercises.innerHTML="";
  PROGRAM[pastDay.value].forEach(([name,sets,range])=>{
    const div=document.createElement("div");div.className="past-exercise";div.dataset.name=name;
    div.innerHTML=`<h4>${esc(name)}</h4><p class="muted">${sets} sets · ${range}</p><div class="past-grid"><label>Weight<input class="past-weight" type="number" step=".5"></label><label>Reps<input class="past-reps" placeholder="e.g. 10,10,9"></label><label>RIR<input class="past-rir" placeholder="e.g. 2,2,1"></label></div>`;
    pastExercises.appendChild(div);
  });
}
addPastBtn.onclick=()=>{buildPastForm();pastDialog.showModal()};
quickAddBtn.onclick=()=>{buildPastForm();pastDialog.showModal()};
pastDay.onchange=renderPastExercises;
cancelPast.onclick=()=>pastDialog.close();
pastForm.onsubmit=e=>{
  e.preventDefault();
  const exercises=[...document.querySelectorAll(".past-exercise")].map(div=>{
    const weight=+div.querySelector(".past-weight").value||null;
    const reps=div.querySelector(".past-reps").value.split(",").map(x=>+x.trim()).filter(Boolean);
    const rirs=div.querySelector(".past-rir").value.split(",").map(x=>+x.trim()).filter(x=>!Number.isNaN(x));
    const sets=reps.map((r,i)=>({weight,reps:r,rir:rirs[i]??null}));
    return{name:div.dataset.name,notes:"Historical entry",sets};
  }).filter(e=>e.sets.length);
  if(!exercises.length)return alert("Enter at least one exercise.");
  const ts=new Date(`${pastDate.value}T12:00:00`).getTime();
  state.workouts.push({date:pastDate.value,timestamp:ts,day:pastDay.value,week:+pastWeek.value,mesocycle:state.mesocycle.name,exercises});
  save();pastDialog.close();renderHistory();renderToday();alert("Past workout saved.");
};

function draw(canvas,rows,series,min,max){
  const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,p=42;
  ctx.clearRect(0,0,w,h);ctx.fillStyle="#0e1528";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="#2a3552";ctx.lineWidth=1;
  for(let i=0;i<5;i++){const y=p+(h-2*p)*i/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}
  if(rows.length<2){ctx.fillStyle="#aeb8ca";ctx.font="22px sans-serif";ctx.fillText("Add more entries to show a trend",p,h/2);return}
  series.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=4;ctx.beginPath();rows.forEach((r,i)=>{const x=p+(w-2*p)*i/(rows.length-1),val=r[s.key],y=h-p-(h-2*p)*(val-min)/(max-min||1);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()});
}
function renderProgress(){
  const cs=[...state.checkins].sort((a,b)=>a.timestamp-b.timestamp);
  const b=cs.filter(x=>x.bodyweight!=null).slice(-40);
  if(b.length){const vals=b.map(x=>x.bodyweight);draw(bwChart,b,[{key:"bodyweight",color:"#60a5fa"}],Math.min(...vals)-2,Math.max(...vals)+2)}else draw(bwChart,[],[],0,1);
  const p=cs.filter(x=>x.backPain!=null||x.sciatica!=null).slice(-40).map(x=>({...x,backPain:x.backPain??0,sciatica:x.sciatica??0}));
  draw(painChart,p,[{key:"backPain",color:"#f59e0b"},{key:"sciatica",color:"#ef4444"}],0,10);
  const names=[...new Set(Object.values(PROGRAM).flat().map(x=>x[0]))].sort();
  exerciseSelect.innerHTML=names.map(n=>`<option>${esc(n)}</option>`).join("");
  exerciseSelect.onchange=renderExerciseProgress;renderExerciseProgress();
}
function renderExerciseProgress(){
  const name=exerciseSelect.value,rows=[];
  [...state.workouts].sort((a,b)=>a.timestamp-b.timestamp).forEach(w=>{
    const e=w.exercises.find(x=>x.name===name);if(!e)return;
    const b=bestSet(e.sets);if(b)rows.push({date:w.date,score:b.weight*b.reps,weight:b.weight,reps:b.reps});
  });
  if(rows.length){const vals=rows.map(x=>x.score);draw(exerciseChart,rows,[{key:"score",color:"#93c5fd"}],Math.min(...vals)*.9,Math.max(...vals)*1.1)}
  else draw(exerciseChart,[],[],0,1);
  exerciseHistory.innerHTML=rows.length?rows.slice(-10).reverse().map(r=>`<div class="historyitem"><strong>${r.date}</strong><div class="muted">${r.weight} lb × ${r.reps}</div></div>`).join(""):"<p class='muted'>No data yet.</p>";
}

function renderSettings(){
  mesoNameInput.value=state.mesocycle.name||"Mesocycle 1";
  weekInput.value=state.currentWeek;
  mesoStartInput.value=state.mesocycle.startDate||"";
}
saveMeso.onclick=()=>{
  state.mesocycle.name=mesoNameInput.value.trim()||"Mesocycle 1";
  state.mesocycle.startDate=mesoStartInput.value;
  state.currentWeek=Math.max(1,Math.min(8,+weekInput.value||1));
  save();renderToday();renderProgram();alert("Mesocycle saved.");
};
completeMeso.onclick=()=>{
  if(!confirm("Archive this mesocycle and begin a new one?"))return;
  const related=state.workouts.filter(w=>(w.mesocycle||state.mesocycle.name)===state.mesocycle.name);
  state.mesocycle.completed.push({
    name:state.mesocycle.name,startDate:state.mesocycle.startDate,endDate:today(),
    workoutCount:related.length
  });
  state.timeline.push({date:today(),type:"mesocycle_completed",text:`Completed ${state.mesocycle.name}`});
  state.mesocycle.name=`Mesocycle ${state.mesocycle.completed.length+1}`;
  state.mesocycle.startDate=today();state.currentWeek=1;save();renderSettings();renderToday();alert("Mesocycle archived.");
};
exportBtn.onclick=()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`brandon-fitness-backup-${today()}.json`;a.click();URL.revokeObjectURL(a.href);
};
importFile.onchange=async e=>{
  try{state=normalize({...DEFAULT,...JSON.parse(await e.target.files[0].text())});save();renderToday();renderProgram();alert("Backup imported.");}
  catch{alert("Could not read that backup.");}
};
resetBtn.onclick=()=>{
  if(confirm("Erase all workouts, check-ins, and mesocycles on this device?")){
    localStorage.removeItem(KEY);state=structuredClone(DEFAULT);save();renderToday();renderProgram();alert("Data erased.");
  }
};

renderToday();renderProgram();
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js"));

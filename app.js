const PROGRAM={
"Pull 1":[["Lat Pulldown",3,"6–10"],["Chest Supported Row",3,"6–10"],["Single Arm Cable Rear Delt",3,"12–20"],["Cable Pullover",2,"10–15"],["Supinated Cable Curl",3,"8–12"],["Rope Hammer Curl",2,"10–15"]],
"Push 1":[["DB Bench",3,"6–10"],["Incline Machine Press",3,"8–12"],["Pec Fly",2,"12–15"],["Cable Lateral Raise",4,"12–20"],["Cable Skull Crusher",3,"10–15"],["Rope Pushdown",2,"12–15"]],
"Legs":[["Hack Squat",3,"6–10"],["Hip Thrust",3,"8–12"],["Seated Leg Curl",3,"8–15"],["Leg Extension",2,"10–15"],["Hip Abductor",3,"15–20"],["Hip Adductor",2,"12–15"],["Standing Calf Raise",4,"8–15"]],
"Pull 2":[["Wide Pulldown",3,"10–15"],["Chest Supported Machine Row",3,"10–15"],["Pec Deck Rear Delt",3,"15–20"],["Cable Pullover",2,"15–20"],["Cable Curl",3,"12–15"],["Hammer Rope Curl",3,"12–15"]],
"Push 2":[["DB Bench",3,"10–15"],["Pec Fly",3,"15–20"],["Cable Lateral Raise",4,"15–20"],["Rope Pushdown",3,"12–15"],["Overhead Cable Extension",3,"12–15"]]
};
const GUIDE={
1:["Base week","3 RIR","Establish a clean baseline."],2:["Build","2 RIR","Add reps; add one set only if recovery is good."],
3:["Build","2 RIR","Continue progressing without forcing volume."],4:["Load","1–2 RIR","Add load after reaching the top of the range."],
5:["High volume","1 RIR","Add an isolation set only where recovery allows."],6:["Peak","0–1 RIR","Failure only on selected isolation sets."],
7:["Highest recoverable volume","0–1 RIR","Push performance without lasting sciatica increase."],
8:["Deload","4–5 RIR","Use about half the sets and 85–90% of normal load."]
};
const KEY="brandonFitnessV1";
const DEFAULT={currentDay:"Pull 1",currentWeek:1,workouts:[],checkins:[]};
let state=load();
function load(){try{return {...DEFAULT,...JSON.parse(localStorage.getItem(KEY))}}catch{return structuredClone(DEFAULT)}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function date(){return new Date().toISOString().slice(0,10)}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function show(id){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id));if(id==="progress")renderProgress();if(id==="settings")weekInput.value=state.currentWeek}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>show(b.dataset.view));

function prior(name){for(let i=state.workouts.length-1;i>=0;i--){const e=state.workouts[i].exercises.find(x=>x.name===name);if(e)return{date:state.workouts[i].date,sets:e.sets}}return null}

function renderToday(){
 dayTitle.textContent=state.currentDay;
 const g=GUIDE[state.currentWeek];weekText.textContent=`Week ${state.currentWeek}: ${g[0]} — ${g[2]}`;rirBadge.textContent=g[1];
 const c=[...state.checkins].reverse().find(x=>x.date===date());
 bw.value=c?.bodyweight??"";sleep.value=c?.sleep??"";back.value=c?.backPain??"";sciatica.value=c?.sciatica??"";
 workout.innerHTML="";
 PROGRAM[state.currentDay].forEach(([name,sets,range])=>{
   const p=prior(name), last=p?`${p.date}: ${p.sets.map(s=>`${s.weight??"-"}×${s.reps??"-"}`).join(", ")}`:"No previous session";
   const card=document.createElement("div");card.className="card exercise";card.dataset.name=name;
   card.innerHTML=`<h3>${esc(name)}</h3><p class="muted">${sets} sets · ${range} reps</p><p class="last">Last: ${esc(last)}</p><div class="sets"></div><label>Notes<input class="note" placeholder="Form, pain, setup..."></label>`;
   for(let i=1;i<=sets;i++){const r=document.createElement("div");r.className="setrow";r.innerHTML=`<span>Set ${i}</span><label>Weight<input class="weight" type="number" step=".5"></label><label>Reps<input class="reps" type="number"></label><label>RIR<input class="rir" type="number" min="0" max="10"></label>`;card.querySelector(".sets").appendChild(r)}
   workout.appendChild(card)
 })
}
saveCheckin.onclick=()=>{const x={date:date(),timestamp:Date.now(),bodyweight:bw.value?+bw.value:null,sleep:sleep.value?+sleep.value:null,backPain:back.value?+back.value:null,sciatica:sciatica.value?+sciatica.value:null};state.checkins=state.checkins.filter(v=>v.date!==x.date);state.checkins.push(x);save();alert("Check-in saved")}
finish.onclick=()=>{const exercises=[...document.querySelectorAll(".exercise")].map(card=>({name:card.dataset.name,notes:card.querySelector(".note").value.trim(),sets:[...card.querySelectorAll(".setrow")].map(r=>({weight:r.querySelector(".weight").value?+r.querySelector(".weight").value:null,reps:r.querySelector(".reps").value?+r.querySelector(".reps").value:null,rir:r.querySelector(".rir").value?+r.querySelector(".rir").value:null})).filter(s=>s.weight!==null||s.reps!==null||s.rir!==null)})).filter(e=>e.sets.length);if(!exercises.length)return alert("Enter at least one set first.");state.workouts.push({date:date(),timestamp:Date.now(),day:state.currentDay,week:state.currentWeek,exercises});save();alert("Workout saved");renderToday()}

changeDay.onclick=()=>{dayChoices.innerHTML="";Object.keys(PROGRAM).forEach(d=>{const b=document.createElement("button");b.textContent=d;b.onclick=()=>{state.currentDay=d;save();dayDialog.close();renderToday()};dayChoices.appendChild(b)});dayDialog.showModal()}

function renderProgram(){const g=GUIDE[state.currentWeek];weekGuide.innerHTML=`<h3>Week ${state.currentWeek}: ${g[0]}</h3><p><strong>${g[1]}</strong></p><p class="muted">${g[2]}</p>`;programList.innerHTML="";Object.entries(PROGRAM).forEach(([d,es])=>{const c=document.createElement("div");c.className="card";c.innerHTML=`<h3>${d}</h3>`+es.map(([n,s,r])=>`<div class="programrow"><span>${esc(n)}</span><strong>${s} × ${r}</strong></div>`).join("");programList.appendChild(c)})}
advanceWeek.onclick=()=>{state.currentWeek=state.currentWeek===8?1:state.currentWeek+1;save();renderProgram();renderToday()}

function chart(canvas,rows,series,min,max){
 const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,p=40;ctx.clearRect(0,0,w,h);ctx.fillStyle="#0e1528";ctx.fillRect(0,0,w,h);ctx.strokeStyle="#2a3552";
 for(let i=0;i<5;i++){let y=p+(h-2*p)*i/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}
 if(rows.length<2){ctx.fillStyle="#aeb8ca";ctx.font="22px sans-serif";ctx.fillText("Add more entries to show a trend",p,h/2);return}
 series.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=4;ctx.beginPath();rows.forEach((r,i)=>{const x=p+(w-2*p)*i/(rows.length-1),y=h-p-(h-2*p)*(r[s.key]-min)/(max-min);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()})
}
function renderProgress(){
 const cs=[...state.checkins].sort((a,b)=>a.timestamp-b.timestamp);
 const b=cs.filter(x=>x.bodyweight!=null).slice(-30);if(b.length){const v=b.map(x=>x.bodyweight);chart(bwChart,b,[{key:"bodyweight",color:"#60a5fa"}],Math.min(...v)-2,Math.max(...v)+2)}else chart(bwChart,[],[],0,1);
 const p=cs.filter(x=>x.backPain!=null||x.sciatica!=null).slice(-30).map(x=>({...x,backPain:x.backPain??0,sciatica:x.sciatica??0}));chart(painChart,p,[{key:"backPain",color:"#f59e0b"},{key:"sciatica",color:"#ef4444"}],0,10);
 const names=[...new Set(Object.values(PROGRAM).flat().map(x=>x[0]))].sort();exerciseSelect.innerHTML=names.map(n=>`<option>${esc(n)}</option>`).join("");exerciseSelect.onchange=renderHistory;renderHistory()
}
function renderHistory(){const n=exerciseSelect.value,rows=[];state.workouts.forEach(w=>{const e=w.exercises.find(x=>x.name===n);if(e)rows.push({date:w.date,sets:e.sets})});history.innerHTML=rows.length?rows.slice(-12).reverse().map(r=>`<div class="historyrow"><strong>${r.date}</strong><div class="muted">${r.sets.map(s=>`${s.weight??"-"} lb × ${s.reps??"-"} @ ${s.rir??"-"} RIR`).join("<br>")}</div></div>`).join(""):"<p class='muted'>No sessions logged yet.</p>"}
saveWeek.onclick=()=>{state.currentWeek=Math.max(1,Math.min(8,+weekInput.value||1));save();renderToday();renderProgram();alert("Week saved")}
exportBtn.onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`brandon-fitness-${date()}.json`;a.click()}
importFile.onchange=async e=>{try{state={...DEFAULT,...JSON.parse(await e.target.files[0].text())};save();renderToday();renderProgram();alert("Backup imported")}catch{alert("Could not read that backup")}}
resetBtn.onclick=()=>{if(confirm("Erase all workout and check-in data?")){localStorage.removeItem(KEY);state=structuredClone(DEFAULT);renderToday();renderProgram()}}
renderToday();renderProgram();if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js"));

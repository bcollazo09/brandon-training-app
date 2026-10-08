'use strict';
(function(root){
 const copy=x=>JSON.parse(JSON.stringify(x));
 function migrate(raw){
  if(!raw||![4,5].includes(raw.version)||(raw.schemaVersion&&raw.schemaVersion>5))throw Error('Unsupported data version; export raw data before repair.');
  const s=copy(raw);
  for(const key of ['workouts','checkins','mesocycles','gyms']){
   if(!Array.isArray(s[key])||s[key].some(x=>!x||typeof x.id!=='string'))throw Error(`Invalid ${key}; original data preserved.`);
  }
  if(s.workouts.some(w=>!Array.isArray(w.exercises)||w.exercises.some(e=>!e||!Array.isArray(e.sets)||e.sets.some(set=>!set||typeof set!=='object'))))throw Error('Malformed workout; original data preserved.');
  if(s.activeSession&&(!Array.isArray(s.activeSession.exercises)||s.activeSession.exercises.some(e=>!e||!Array.isArray(e.sets)||e.sets.some(set=>!set||typeof set!=='object'))))throw Error('Malformed active workout; original data preserved.');
  s.version=5;s.schemaVersion=5;s.migrations=s.migrations||[];
  if(raw.version===4)s.migrations.push({from:4,to:5,at:Date.now()});
  return s;
 }
 root.BFCore={migrate};if(typeof module!=='undefined')module.exports=root.BFCore;
})(typeof window!=='undefined'?window:globalThis);

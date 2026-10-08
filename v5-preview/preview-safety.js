'use strict';
// Deny accidental access to production storage on the site's shared origin.
(function(){
 const allowedDatabase='brandonFitnessV5Preview',allowedKey=key=>String(key).startsWith('brandonFitnessV5Preview');
 for(const operation of ['open','deleteDatabase']){
  const original=indexedDB[operation].bind(indexedDB);
  indexedDB[operation]=function(name,...args){if(name!==allowedDatabase)throw Error('Preview isolation blocked access to another app database');return original(name,...args)};
 }
 for(const operation of ['getItem','setItem','removeItem']){
  const original=Storage.prototype[operation];
  Storage.prototype[operation]=function(key,...args){if(!allowedKey(key))throw Error('Preview isolation blocked access to another app storage key');return original.call(this,key,...args)};
 }
 Storage.prototype.clear=function(){throw Error('Preview isolation blocks clearing shared site storage')};
})();

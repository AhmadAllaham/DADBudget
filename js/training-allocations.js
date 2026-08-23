(function(){
'use strict';
// Load the canonical Fund Center -> Department mapping synchronously before
// the template/runtime scripts build the Training directory.
document.write('<script src="js/training-canonical-department-names.js?v=20260823-canonical-3"></'+'script>');

function activate(which){
  const training=which==='training';
  document.getElementById('trainingTab')?.classList.toggle('active',training);
  document.getElementById('travelTab')?.classList.toggle('active',!training);
  document.getElementById('trainingPanel')?.classList.toggle('active',training);
  document.getElementById('travelPanel')?.classList.toggle('active',!training);
}
function bindTabs(){
  const training=document.getElementById('trainingTab'),travel=document.getElementById('travelTab');
  if(training)training.onclick=()=>activate('training');
  if(travel)travel.onclick=()=>activate('travel');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindTabs);else bindTabs();
})();
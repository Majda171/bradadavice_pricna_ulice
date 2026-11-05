(()=>{'use strict';
 const DB=window.BradaviceDB?.client;
 const train=document.getElementById('boardTrain'),status=document.getElementById('stationStatus');
 const film=document.getElementById('trainFilm'),video=document.getElementById('stationVideo');
 const finish=document.getElementById('finishJourney'),sorting=document.getElementById('toSorting');
 const say=s=>{status.textContent=s};
 let allowed=false,done=false,finishing=false;
 async function verify(){
  try{
   if(!DB)throw new Error('Nepodařilo se připojit k Bradavicím.');
   const {data:userInfo}=await DB.auth.getUser();if(!userInfo?.user)throw new Error('Přihlas se ke svému studentskému účtu.');
   const {data,error}=await DB.rpc('v17_station_status');if(error)throw error;
   if(!data.schoolReady){say('Nejdřív se vrať do Příčné ulice a dokonči nákupy s Hagridem.');return}
   allowed=true;train.disabled=false;
   if(data.stationCompleted){done=true;sorting.hidden=false;say('Cestu už máš za sebou. Můžeš se rozřadit nebo si vlak prohlédnout znovu.')}
   else say('Klikni přímo na Bradavický expres a nastup.');
  }catch(e){console.warn('King’s Cross:',e);say('Nádraží zatím nelze ověřit. Zkontroluj připojení a SQL soubor 03_nadrazi_poklady_a_sovi_posta.sql.');}
 }
 async function complete(){
  if(finishing)return;finishing=true;finish.disabled=true;say('Zaznamenávám cestu do Bradavic…');
  try{
   if(!done){const {data,error}=await DB.rpc('v17_complete_station');if(error||!data?.stationCompleted)throw error||new Error('Potvrzení se nezdařilo');done=true;}
   film.hidden=true;sorting.hidden=false;say('Bradavický expres dorazil. Čeká tě rozřazování!');
  }catch(e){console.warn(e);finish.hidden=false;finish.textContent='Zkusit zapsat příjezd znovu';say('Cestu se nepodařilo zapsat. Zkus to znovu.');}
  finally{finishing=false;finish.disabled=false}
 }
 train.addEventListener('click',()=>{if(!allowed)return;film.hidden=false;finish.hidden=false;finish.textContent='Pokračovat po příjezdu →';finish.hidden=true;video.currentTime=0;video.play().catch(()=>{finish.hidden=false;finish.textContent='Potvrdit příjezd →';say('Spusť video tlačítkem přehrávání.');});});
 video.addEventListener('ended',()=>{finish.hidden=false;complete()});
 finish.addEventListener('click',complete);
 window.addEventListener('pagehide',()=>video.pause());
 verify();
})();

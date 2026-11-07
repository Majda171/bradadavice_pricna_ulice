(()=>{'use strict';
 const DB=window.BradaviceDB?.client;
 const train=document.getElementById('boardTrain'),status=document.getElementById('stationStatus');
 const film=document.getElementById('trainFilm'),video=document.getElementById('stationVideo');
 const finish=document.getElementById('finishJourney'),sorting=document.getElementById('toSorting');
 const say=s=>{status.textContent=s};
 const CASTLE_URL='https://majda171.github.io/skola-car-a-kouzel/hrad.html';
 let allowed=false,done=false,finishing=false,manualPlayback=false,alreadySorted=false;
 async function verify(){
  try{
   if(!DB)throw new Error('Nepodařilo se připojit k Bradavicím.');
   const {data:userInfo}=await DB.auth.getUser();if(!userInfo?.user)throw new Error('Přihlas se ke svému studentskému účtu.');
   // Kolej se ověřuje v databázi, nikoliv v lokální paměti prohlížeče.
   // Rozřazený student už nesmí znovu projít Moudrým kloboukem ani úvodním dopisem.
   const {data:profile,error:profileError}=await DB.from('profiles')
     .select('house_code').eq('id',userInfo.user.id).single();
   if(profileError||!profile)throw profileError||new Error('Studentský profil nebyl nalezen.');
   alreadySorted=Boolean(profile.house_code);
   sorting.href=alreadySorted ? CASTLE_URL : 'https://majda171.github.io/skola-car-a-kouzel/rozrazeni.html';
   sorting.textContent=alreadySorted ? 'Vrátit se do Bradavic →' : 'Pokračovat k Moudrému klobouku →';
   const {data,error}=await DB.rpc('v17_station_status');if(error)throw error;
   if(!data.schoolReady){say('Nejdřív se vrať do Příčné ulice a dokonči nákupy s Hagridem.');return}
   allowed=true;train.disabled=false;
   if(data.stationCompleted){done=true;sorting.hidden=false;say(alreadySorted ? 'Cestu už máš za sebou. Můžeš se vrátit do své koleje nebo si vlak prohlédnout znovu.' : 'Cestu už máš za sebou. Můžeš se rozřadit nebo si vlak prohlédnout znovu.')}
   else say('Klikni přímo na Bradavický expres a nastup.');
  }catch(e){console.warn('King’s Cross:',e);say('Nádraží zatím nelze ověřit. Zkontroluj připojení a SQL soubor 03_nadrazi_poklady_a_sovi_posta.sql.');}
 }
 async function complete(){
  if(finishing)return;
  finishing=true;finish.disabled=true;finish.hidden=true;
  say(alreadySorted ? 'Bradavický expres dorazil. Vracíš se do Bradavic…' : 'Bradavický expres dorazil. Přecházíme k rozřazování…');
  try{
   if(!done){
    const {data,error}=await Promise.race([
     DB.rpc('v17_complete_station'),
     new Promise((_,reject)=>setTimeout(()=>reject(new Error('Potvrzení cesty trvá příliš dlouho.')),6000))
    ]);
    if(error||!data?.stationCompleted)throw error||new Error('Potvrzení se nezdařilo');
    done=true;
   }
   // Po skončení filmu nepřidáváme další tlačítko ani potvrzovací obrazovku.
   if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});
   window.location.assign(sorting.href);
  }catch(e){
   console.warn('King’s Cross: dokončení cesty',e);
   finish.hidden=false;finish.textContent='Zkusit dokončit cestu →';
   say('Cestu se nepodařilo zapsat. Zkontroluj připojení a zkus to znovu.');
  }
  finally{finishing=false;finish.disabled=false}
 }
 train.addEventListener('click',()=>{
  if(!allowed||finishing)return;
  film.hidden=false;
  finish.hidden=true;
  manualPlayback=false;
  video.currentTime=0;
  // Celá obrazovka včetně prohlížeče, pokud ji zařízení dovolí;
  // jinak alespoň celoobrazovková vrstva přes celý viewport.
  film.requestFullscreen?.().catch(()=>{});
  video.play().catch(()=>{
   manualPlayback=true;
   finish.hidden=false;finish.textContent='▶ Přehrát cestu Bradavickým expresem';
   say('Spusť video klepnutím na tlačítko přehrávání.');
  });
 });
 video.addEventListener('ended',complete);
 video.addEventListener('error',()=>{
  if(film.hidden)return;
  manualPlayback=false;finish.hidden=false;
  finish.textContent='Video se nenačetlo – dokončit cestu →';
  say('Video se nepodařilo načíst. Cestu můžeš přesto dokončit.');
 });
 finish.addEventListener('click',()=>{
  if(!manualPlayback){complete();return}
  video.play().then(()=>{manualPlayback=false;finish.hidden=true}).catch(()=>{
   say('Přehrávání je zablokované. Zkus tlačítko ještě jednou.');
  });
 });
 window.addEventListener('pagehide',()=>video.pause());
 verify();
})();

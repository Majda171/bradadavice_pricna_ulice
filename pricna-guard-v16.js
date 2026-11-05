/* Stejné studentské přihlášení pro samostatné GitHub repo Příčné ulice. */
(()=>{'use strict';
 const root=document.documentElement;root.classList.add('access-pending');
 const BRADAVICE='https://majda171.github.io/skola-car-a-kouzel/';
 const signIn=BRADAVICE+'prihlaseni-student.html?next='+encodeURIComponent('https://majda171.github.io/pricna-ulice/');
 const DB=window.BradaviceDB;
 const status=document.createElement('section');status.id='bradavice-access-status';status.className='pricna-access-status';status.textContent='Ověřuji studentský účet…';
 const show=(message)=>{status.textContent=message;if(!status.isConnected)document.body?.append(status)};
 document.addEventListener('DOMContentLoaded',()=>{if(root.classList.contains('access-pending'))show('Ověřuji studentský účet…')});
 (async()=>{
   if(!DB?.client){show('Nepodařilo se připojit k Bradavicím. Obnov stránku.');return}
   try{
     const {data,error}=await DB.client.auth.getUser();
     if(error||!data?.user){location.replace(signIn);return}
     const {data:profile,error:profileError}=await DB.client.from('profiles').select('*').eq('id',data.user.id).maybeSingle();
     if(profileError)throw profileError;
     if(!profile){location.replace(signIn);return}
     if(profile.banned_at){location.replace(BRADAVICE+'vylouceni.html');return}
     await DB.hydrateStudent?.({user:data.user,profile});
     status.remove();root.classList.remove('access-pending');
   }catch(e){console.warn('Ověření Příčné ulice',e);show('Připojení se nepodařilo ověřit. Obnov stránku a zkus to znovu.');}
 })();
})();

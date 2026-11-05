/* Sdílené galeony a nákupy pro dva samostatné GitHub Pages repozitáře.
 * Oba projekty používají stejné přihlášení i Supabase projekt.
 * Žádný zůstatek ani cenu nepřebíráme jako důvěryhodnou z prohlížeče.
 */
(()=>{'use strict';
  const client = window.BradaviceDB?.client;
  const shop = {available:false, snapshot:null, error:null, ready:null};
  async function call(name,args){
    if(!client)throw new Error('Připojení Supabase není dostupné.');
    const {data,error}=await client.rpc(name,args||{});
    if(error)throw new Error(error.message || 'Zápis do Supabase se nepodařil.');
    shop.snapshot=data;
    return data;
  }
  shop.ready=(async()=>{
    try{
      if(!client)throw new Error('Chybí sdílené připojení Supabase.');
      const {data,error}=await client.auth.getUser();
      if(error||!data?.user)throw new Error('Nejdřív se přihlas do studentského účtu v Bradavicích.');
      await call('v16_shop_state');
      shop.available=true;
      return shop.snapshot;
    }catch(e){shop.error=e;console.warn('Příčná ulice: Supabase synchronizace',e);return null}
  })();
  async function change(name,args){
    await shop.ready;
    if(!shop.available)throw shop.error || new Error('Databáze Příčné ulice ještě není připravená.');
    return call(name,args);
  }
  shop.reload=()=>change('v16_shop_state');
  shop.claimGrant=()=>change('v16_claim_school_grant');
  shop.buy=(id)=>change('v16_purchase_product',{p_product_id:id});
  shop.setPetName=(name)=>change('v16_set_pet_name',{p_name:name});
  shop.setProgress=(scene,ready)=>change('v16_save_shop_progress',{p_scene:scene??null,p_school_ready:ready??null});
  window.DiagonSupabase=shop;
})();

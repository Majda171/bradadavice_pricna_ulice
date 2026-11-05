(() => {
  const URL = 'https://iyklgteuwknvrbxfecbv.supabase.co';
  const KEY = 'sb_publishable_b8xb7_X7aucyOqiAoXFcCQ_FIqIQfUr';
  const houseNames = {N:'Nebelvír',H:'Havraspár',M:'Mrzimor',Z:'Zmijozel'};
  const crestNames = {N:'nebelvir-erb.webp',H:'havraspar-erb.webp',M:'mrzimor-erb.webp',Z:'zmijozel-erb.webp'};
  const avatarKeysByHouse = {
    N:['n1','n2','n3','n4','n5','n6','n7','n8','n9','n10'],
    H:['h1','h2','h3','h4','h5','h6','h7','h8','h9','h10'],
    M:['m1','m2','m3','m4','m5','m6','m7','m8','m9','m10'],
    Z:['z1','z2','z3','z4','z5','z6','z7','z8','z9','z10']
  };
  const avatarKeys = Object.values(avatarKeysByHouse).flat();
  const defaultAvatarForHouse = code => (avatarKeysByHouse[code]||avatarKeysByHouse.N)[0];
  const avatarBelongsToHouse = (key,code) => Boolean(code && (avatarKeysByHouse[code]||[]).includes(key));
  const pageToLocation = {
    'velka-sin.html':'velka-sin','ucebna-lektvaru.html':'lektvary','ucebna-premenovani.html':'premenovani',
    'ucebna-obrany.html':'obrana','astronomicka-vez.html':'astronomie','skleniky.html':'skleniky',
    'kuchyne.html':'kuchyne','famfrpal.html':'famfrpal','hagriduv-dum.html':'hagrid-dum',
    'hagriduv-dum-uvnitr.html':'hagrid-uvnitr','vrba-mlaticka.html':'vrba','jezero.html':'jezero',
    'zapovezeny-les.html':'les','nadvori.html':'nadvori','chodby.html':'chodby','chodby-schody.html':'schodiste',
    'chodby-portretni-galerie.html':'severni-galerie','chodby-stara-galerie.html':'vychodni-chodba',
    'chodby-horni.html':'treti-poschodi','sin-slavy.html':'sin-slavy','komnata-nejvyssi-potreby.html':'komnata-potreby',
    'nebelvir-spolecenska.html':'nebelvir-spolecenska','nebelvir-loznice.html':'nebelvir-loznice',
    'havraspar-spolecenska.html':'havraspar-spolecenska','havraspar-loznice.html':'havraspar-loznice',
    'mrzimor-spolecenska.html':'mrzimor-spolecenska','mrzimor-loznice.html':'mrzimor-loznice',
    'zmijozel-spolecenska.html':'zmijozel-spolecenska','zmijozel-loznice.html':'zmijozel-loznice',
    'tajemna-cesta.html':'tajemna-cesta','tajemna-komnata.html':'tajemna-komnata','kamen-mudrcu-chloupek.html':'kamen-mudrcu-chloupek','kamen-mudrcu-zkousky.html':'kamen-mudrcu-zkousky','kamen-mudrcu-zrcadlo.html':'kamen-mudrcu-zrcadlo','reditelna.html':'reditelna','divci-umyvarna.html':'divci-umyvarna','knihovna.html':'knihovna',
    'chodby-podzemni-1.html':'podzemni-chodba-1','chodby-podzemni-2.html':'podzemni-chodba-2'
  };
  const locationToPage = Object.fromEntries(Object.entries(pageToLocation).map(([p,id])=>[id,p]));
  const STUDENT_KEY='bradavice_student_v1';
  const STATE_KEY='bradavice_achievements_v2';
  const QUEST_KEY='bradavice_quests_v1';
  const VISITS_KEY='bradavice_location_visits_v1';
  const scopedProgressKey=(base,uid)=>`${base}_${String(uid||'guest').replace(/[^a-zA-Z0-9@._-]/g,'_')}`;
  let client = null;
  let presenceChannel = null;
  let presenceSynced = false;
  try {
    if (window.supabase?.createClient) client = window.supabase.createClient(URL, KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  } catch (e) { console.warn('Supabase client se nepodařilo vytvořit.', e); }

  const safeWrite=(key,value)=>{ try{localStorage.setItem(key,JSON.stringify(value))}catch{} };
  const safeRead=(key,fallback)=>{ try{const v=JSON.parse(localStorage.getItem(key));return v??fallback}catch{return fallback} };
  const currentPage=()=>location.pathname.split('/').pop()||'index.html';

  async function getUser(){
    if(!client) return null;
    // getSession je lokální a výrazně rychlejší při přecházení mezi místnostmi.
    const {data,error}=await client.auth.getSession();
    if(error) return null;
    return data?.session?.user||null;
  }

  async function getProfile(){
    const user=await getUser(); if(!user) return null;
    const {data,error}=await client.from('profiles').select('*').eq('id',user.id).single();
    if(error) throw error;
    return {user,profile:data};
  }

  async function hydrateStudent(prefetched){
    if(!client) return safeRead(STUDENT_KEY,null);
    // Access guard already queried this profile; no second Supabase request needed.
    const info=(prefetched?.user?.id && prefetched?.profile) ? prefetched : await getProfile(); if(!info) return null;
    const {user,profile}=info,meta=user.user_metadata||{};
    const student={
      version:3,salutation:meta.salutation||'',firstName:profile.first_name||meta.first_name||'Student',lastName:profile.last_name||meta.last_name||'',
      email:user.email||'',registeredAt:profile.created_at||user.created_at||new Date().toISOString(),status:profile.house_code?'sorted':'awaiting-sorting',
      sortingCompleted:Boolean(profile.house_code),house:profile.house_code?houseNames[profile.house_code]:null,houseCode:profile.house_code||null,
      year:profile.school_year||1,points:Number(profile.personal_points||0),supabaseUserId:user.id,bio:profile.bio||'',
      avatarKey:avatarBelongsToHouse(profile.avatar_key,profile.house_code)?profile.avatar_key:defaultAvatarForHouse(profile.house_code||'N'),isAdmin:Boolean(profile.is_admin),bannedAt:profile.banned_at||null,banReason:profile.ban_reason||''
    };
    safeWrite(STUDENT_KEY,student); updateStudentHud(student); return student;
  }

  async function hydrateProgress(){
    if(!client) return false;
    const user=await getUser(); if(!user) return false;
    const [badgesRes,pointsRes,adjustRes,questsRes,visitsRes]=await Promise.all([
      client.from('student_achievements').select('achievement_id,unlocked_at').eq('student_id',user.id),
      client.from('point_events').select('amount,reason,created_at').eq('student_id',user.id).order('created_at',{ascending:false}).limit(80),
      client.from('student_point_adjustments').select('amount,reason,created_at').eq('student_id',user.id).order('created_at',{ascending:false}).limit(80),
      client.from('student_quests').select('quest_id,completed_at').eq('student_id',user.id),
      client.from('student_location_visits').select('location_id,first_visited_at').eq('student_id',user.id)
    ]);
    if(badgesRes.error) throw badgesRes.error;if(pointsRes.error) throw pointsRes.error;if(adjustRes.error&&adjustRes.error.code!=='42P01') console.warn(adjustRes.error);if(questsRes.error) throw questsRes.error;if(visitsRes.error) throw visitsRes.error;
    // Odznaky mohou vzniknout těsně před dokončením síťové synchronizace. Serverový hydrate
    // proto nesmí smazat lokální odemčení aktuálního studenta; sloučíme obě strany a následně
    // achievements.js případné lokální odznaky dopíše do Supabase přes idempotentní RPC.
    const storedStudent=safeRead(STUDENT_KEY,null);
    const aliases=[user.id,storedStudent?.supabaseUserId,storedStudent?.email].filter(Boolean);
    const uniqueAliases=[...new Set(aliases.map(x=>String(x)))];
    const localStates=uniqueAliases.map(id=>safeRead(scopedProgressKey(STATE_KEY,id),null)).filter(Boolean);
    const unlocked={};const localHistory=[];
    for(const st of localStates){Object.assign(unlocked,st?.unlocked||{});localHistory.push(...(st?.history||[]))}
    (badgesRes.data||[]).forEach(x=>unlocked[x.achievement_id]=x.unlocked_at||unlocked[x.achievement_id]||true);
    const serverHistory=[...(badgesRes.data||[]).map(x=>({type:'badge',id:x.achievement_id,at:x.unlocked_at})),...(pointsRes.data||[]).map(x=>({type:'points',amount:Number(x.amount||0),reason:x.reason||'Body',at:x.created_at})),...((adjustRes&&!adjustRes.error?adjustRes.data:[])||[]).map(x=>({type:'points',amount:Number(x.amount||0),reason:x.reason||'Úprava bodů',at:x.created_at}))];
    const mergedHistory=[...localHistory,...serverHistory];
    const seen=new Set();const history=mergedHistory.filter(h=>{const k=h.type==='badge'?`b:${h.id}`:`p:${h.at||''}:${h.amount||0}:${h.reason||''}`;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
    const mergedState={unlocked,history};safeWrite(STATE_KEY,mergedState);for(const id of uniqueAliases)safeWrite(scopedProgressKey(STATE_KEY,id),mergedState);

    // Úkoly ani návštěvy nesmí při pomalejší síti skočit zpět. Serverové záznamy
    // proto doplňují lokální stav aktuálního studenta, nikoli jej bezpodmínečně mažou.
    const quests={};for(const id of uniqueAliases)Object.assign(quests,safeRead(scopedProgressKey(QUEST_KEY,id),{})||{});
    (questsRes.data||[]).forEach(x=>quests[x.quest_id]={done:true,at:x.completed_at||quests[x.quest_id]?.at||new Date().toISOString()});
    safeWrite(QUEST_KEY,quests);for(const id of uniqueAliases)safeWrite(scopedProgressKey(QUEST_KEY,id),quests);
    const visits={};for(const id of uniqueAliases)Object.assign(visits,safeRead(scopedProgressKey(VISITS_KEY,id),{})||{});
    (visitsRes.data||[]).forEach(x=>{const page=locationToPage[x.location_id];if(page)visits[page]=x.first_visited_at||visits[page]||true});
    safeWrite(VISITS_KEY,visits);for(const id of uniqueAliases)safeWrite(scopedProgressKey(VISITS_KEY,id),visits);return true;
  }

  async function syncHouseStandingsLocal(){
    if(!client) return null;const {data,error}=await client.rpc('get_house_standings');if(error) throw error;
    (data||[]).forEach(r=>localStorage.setItem(`bradavice_house_points_v2_${r.house_code}`,String(Number(r.total_points||0))));return data||[];
  }
  async function hydrateAll(){
    try{const student=await hydrateStudent();if(!student)return null;await Promise.all([hydrateProgress(),syncHouseStandingsLocal()]);window.dispatchEvent(new CustomEvent('bradavice:supabase-synced',{detail:{student}}));return student}
    catch(e){console.warn('Synchronizace Supabase selhala.',e);const s=safeRead(STUDENT_KEY,null);updateStudentHud(s);return s}
  }
  async function studentNameAvailable(firstName,lastName){if(!client)return true;const {data,error}=await client.rpc('student_name_available',{p_first:String(firstName||''),p_last:String(lastName||'')});if(error)throw error;return Boolean(data)}
  async function signUp({email,password,firstName,lastName,salutation}){if(!client)throw new Error('Databázové připojení není dostupné.');if(!(await studentNameAvailable(firstName,lastName)))throw new Error('duplicate student name');const {data,error}=await client.auth.signUp({email,password,options:{data:{first_name:firstName,last_name:lastName,salutation}}});if(error)throw error;return data}
  async function signIn(email,password){if(!client)throw new Error('Databázové připojení není dostupné.');const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;return data}
  async function signOut(){
    if(presenceChannel){try{await presenceChannel.untrack();await client?.removeChannel?.(presenceChannel)}catch{}presenceChannel=null;presenceSynced=false}
    // Odhlášení musí zrušit skutečnou Supabase session. Kdyby síťový požadavek
    // selhal, scope:local a následný úklid odstraní token z tohoto prohlížeče.
    try{if(client)await client.auth.signOut({scope:'local'})}catch(e){console.warn('Odhlášení Supabase selhalo, čistím lokální session.',e)}
    try{
      [STUDENT_KEY,STATE_KEY,QUEST_KEY,VISITS_KEY,'bradavice_herbology_v4354','bradavice_achievement_counters_v4363','bradavice_achievement_pending_v4365','bradavice_achievement_pending_v4366','bradavice_progress_owner_v4366'].forEach(k=>localStorage.removeItem(k));
      const projectRef='iyklgteuwknvrbxfecbv';
      for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i)||'';if(k.startsWith(`sb-${projectRef}-auth-token`))localStorage.removeItem(k)}
    }catch{}
    updateStudentHud(null)
  }
  async function setHouseOnce(code){if(!client)return false;const {data,error}=await client.rpc('set_house_once',{p_house_code:code});if(error)throw error;await hydrateAll();return Boolean(data)}
  async function unlockAchievement(id){if(!client)return false;const {data,error}=await client.rpc('unlock_achievement',{p_achievement_id:id});if(error)throw error;await Promise.all([hydrateProgress(),hydrateStudent(),syncHouseStandingsLocal()]);window.dispatchEvent(new CustomEvent('bradavice:progress-synced'));return Boolean(data)}
  async function completeQuest(id){if(!client)return false;const {data,error}=await client.rpc('complete_quest',{p_quest_id:id});if(error)throw error;await Promise.all([hydrateProgress(),hydrateStudent(),syncHouseStandingsLocal()]);window.dispatchEvent(new CustomEvent('bradavice:progress-synced'));return Boolean(data)}
  async function visitLocationByPage(page){if(!client)return false;const id=pageToLocation[page];if(!id)return false;const {error}=await client.rpc('visit_location',{p_location_id:id});if(error)throw error;return true}
  async function getHouseStandings(){if(!client)return null;const {data,error}=await client.rpc('get_house_standings');if(error)throw error;return data||[]}
  async function claimDailyChallenge(){if(!client)return false;const {data,error}=await client.rpc('claim_daily_challenge');if(error)throw error;await Promise.all([hydrateStudent(),hydrateProgress(),syncHouseStandingsLocal()]);window.dispatchEvent(new CustomEvent('bradavice:progress-synced'));return Boolean(data)}

  async function updateOwnProfile({bio='',avatarKey=''}){
    if(!client) throw new Error('Databázové připojení není dostupné.');
    const info=await getProfile();const house=info?.profile?.house_code;if(!house)throw new Error('Profilový obrázek lze vybrat až po rozřazení.');
    if(!avatarBelongsToHouse(avatarKey,house))throw new Error('Vyber profilový obrázek své koleje.');
    const key=avatarKey;
    const cleaned=String(bio||'').trim().slice(0,500);
    const {data,error}=await client.rpc('update_own_profile',{p_bio:cleaned,p_avatar_key:key});if(error)throw error;
    // Nehlásit úspěch, dokud server skutečně nevrátí právě uložený portrét.
    // hydrateStudent() znovu přečte profil a obnoví lokální cache.
    const updated=await hydrateStudent();
    if(!updated||updated.avatarKey!==key){
      throw new Error('Změna portrétu se neuložila. Zkus to znovu později.');
    }
    window.dispatchEvent(new CustomEvent('bradavice:profile-updated'));return data;
  }
  async function isAdmin(){if(!client)return false;const {data,error}=await client.rpc('is_admin_user');if(error)return false;return Boolean(data)}
  async function adminStats(){const {data,error}=await client.rpc('admin_dashboard_stats');if(error)throw error;return data||{}}
  async function adminSearchStudents(query='',limit=50){const {data,error}=await client.rpc('admin_search_students',{p_query:String(query||''),p_limit:Math.min(100,Math.max(1,Number(limit)||50))});if(error)throw error;return data||[]}
  async function adminStudentDetail(id){const {data,error}=await client.rpc('admin_student_detail',{p_student_id:id});if(error)throw error;return data||null}
  async function getAccessState(){
    const denied={authenticated:false,banned:false,is_admin:false,house_code:null};
    if(!client)return denied;
    // Ochrana hradu musí ověřit uživatele proti Supabase Auth, ne jen proti lokálně
    // uložené session. Stará/poškozená session proto už nikoho do hradu nepustí.
    let verifiedUser=null;
    try{
      const {data,error}=await client.auth.getUser();
      if(error||!data?.user)return denied;
      verifiedUser=data.user;
    }catch{return denied}
    try{
      const {data,error}=await client.rpc('student_access_state');
      if(!error&&data?.authenticated===true)return data;
    }catch{}
    // Fallback pro databázi, kde ještě není RPC z v37/v41. I zde se profil načítá
    // až po serverově ověřeném Auth uživateli a při chybě se přístup zamítne.
    try{
      const {data:p,error}=await client.from('profiles').select('house_code,is_admin,banned_at,ban_reason').eq('id',verifiedUser.id).maybeSingle();
      if(error||!p)return denied;
      return {authenticated:true,banned:Boolean(p.banned_at),banned_at:p.banned_at||null,reason:p.ban_reason||'',is_admin:Boolean(p.is_admin),house_code:p.house_code||null};
    }catch{return denied}
  }
  async function adminSetBan(id,banned,reason=''){const {data,error}=await client.rpc('admin_set_student_ban',{p_student_id:id,p_banned:Boolean(banned),p_reason:String(reason||'')});if(error)throw error;return Boolean(data)}
  async function adminAdjustPoints(id,amount,reason=''){const {data,error}=await client.rpc('admin_adjust_student_points',{p_student_id:id,p_amount:Number(amount),p_reason:String(reason||'')});if(error)throw error;return Number(data||0)}
  async function adminDeleteStudent(id){const {data,error}=await client.rpc('admin_delete_student',{p_student_id:id});if(error)throw error;return Boolean(data)}
  async function hagridStatus(){const {data,error}=await client.rpc('hagrid_niffler_status');if(error)throw error;return data||{accepted:false,found:0,completed:false,rewarded:false,ids:[]}}
  async function hagridAccept(){const {data,error}=await client.rpc('hagrid_accept_quest');if(error)throw error;return Boolean(data)}
  async function hagridFind(id){const {data,error}=await client.rpc('hagrid_find_niffler',{p_niffler_id:id});if(error)throw error;return Number(data||0)}
  async function hagridReturn(){const {data,error}=await client.rpc('hagrid_return_nifflers');if(error)throw error;await Promise.all([hydrateStudent(),hydrateProgress(),syncHouseStandingsLocal()]);window.dispatchEvent(new CustomEvent('bradavice:progress-synced'));return Boolean(data)}


  async function postChatMessage(scope,message){
    if(!client) throw new Error('Databázové připojení není dostupné.');
    const {data,error}=await client.rpc('v40_post_chat_message',{p_scope:String(scope||'school'),p_message:String(message||'')});
    if(error)throw error;return data;
  }
  async function getChatMessages(scope='school',limit=80){
    if(!client)return[];const {data,error}=await client.rpc('v40_get_chat_messages',{p_scope:String(scope||'school'),p_limit:Math.min(100,Math.max(1,Number(limit)||80))});
    if(error)throw error;return data||[];
  }
  async function claimV40Activity(key){
    if(!client)return false;const {data,error}=await client.rpc('v40_claim_activity',{p_activity_key:String(key||'')});if(error)throw error;
    await Promise.all([hydrateStudent(),hydrateProgress(),syncHouseStandingsLocal()]);window.dispatchEvent(new CustomEvent('bradavice:progress-synced'));return Boolean(data);
  }
  async function snapePenalty(){
    if(!client)return null;const {data,error}=await client.rpc('v41_snape_penalty');if(error)throw error;await Promise.all([hydrateStudent(),hydrateProgress(),syncHouseStandingsLocal()]);window.dispatchEvent(new CustomEvent('bradavice:progress-synced'));return Number(data);
  }
  async function claimV42Activity(key,score=0){
    if(!client)return null;const {data,error}=await client.rpc('v42_claim_activity',{p_activity_key:String(key||''),p_score:Math.max(0,Number(score)||0)});if(error)throw error;
    await Promise.all([hydrateStudent(),hydrateProgress(),syncHouseStandingsLocal()]);window.dispatchEvent(new CustomEvent('bradavice:progress-synced'));return Number(data);
  }
  async function submitTournamentScore(tournamentId,score){
    if(!client)return false;const {data,error}=await client.rpc('v40_submit_tournament_score',{p_tournament_id:String(tournamentId||''),p_score:Math.max(0,Math.min(100,Number(score)||0))});if(error)throw error;return Boolean(data);
  }
  async function getTournamentBoard(tournamentId,limit=10){
    if(!client)return[];const {data,error}=await client.rpc('v40_get_tournament_board',{p_tournament_id:String(tournamentId||''),p_limit:Math.min(50,Math.max(1,Number(limit)||10))});if(error)throw error;return data||[];
  }


  async function createChessRoom(state){if(!client)throw new Error('Databázové připojení není dostupné.');const {data,error}=await client.rpc('v40_create_chess_room',{p_state:state||{}});if(error)throw error;return data}
  async function joinChessRoom(code){if(!client)throw new Error('Databázové připojení není dostupné.');const {data,error}=await client.rpc('v40_join_chess_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return data}
  async function getChessRoom(code){if(!client)return null;const {data,error}=await client.rpc('v40_get_chess_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return data}
  async function updateChessRoom(code,state,version){if(!client)return null;const {data,error}=await client.rpc('v40_update_chess_room',{p_room_code:String(code||'').toUpperCase(),p_state:state||{},p_expected_version:Number(version||0)});if(error)throw error;return data}
  async function leaveChessRoom(code){if(!client||!code)return false;const {data,error}=await client.rpc('v40_leave_chess_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return Boolean(data)}

  async function createMemoryRoom(pairCount,state){if(!client)throw new Error('Databázové připojení není dostupné.');const {data,error}=await client.rpc('v422_create_memory_room',{p_pair_count:Number(pairCount)||20,p_state:state||{}});if(error)throw error;return data}
  async function joinMemoryRoom(code){if(!client)throw new Error('Databázové připojení není dostupné.');const {data,error}=await client.rpc('v422_join_memory_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return data}
  async function getMemoryRoom(code){if(!client)return null;const {data,error}=await client.rpc('v422_get_memory_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return data}
  async function updateMemoryRoom(code,state,version){if(!client)return null;const {data,error}=await client.rpc('v422_update_memory_room',{p_room_code:String(code||'').toUpperCase(),p_state:state||{},p_expected_version:Number(version||0)});if(error)throw error;return data}
  async function leaveMemoryRoom(code){if(!client||!code)return false;const {data,error}=await client.rpc('v422_leave_memory_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return Boolean(data)}

  async function createPotionDuelRoom(state){if(!client)throw new Error('Databázové připojení není dostupné.');const {data,error}=await client.rpc('v435_create_potion_duel_room',{p_state:state||{}});if(error)throw error;return data}
  async function joinPotionDuelRoom(code){if(!client)throw new Error('Databázové připojení není dostupné.');const {data,error}=await client.rpc('v435_join_potion_duel_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return data}
  async function getPotionDuelRoom(code){if(!client)return null;const {data,error}=await client.rpc('v435_get_potion_duel_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return data}
  async function updatePotionDuelRoom(code,state,version){if(!client)return null;const {data,error}=await client.rpc('v435_update_potion_duel_room',{p_room_code:String(code||'').toUpperCase(),p_state:state||{},p_expected_version:Number(version||0)});if(error)throw error;return data}
  async function leavePotionDuelRoom(code){if(!client||!code)return false;const {data,error}=await client.rpc('v435_leave_potion_duel_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return Boolean(data)}

  async function createTchorickyRoom(state){if(!client)throw new Error('Databázové připojení není dostupné.');const {data,error}=await client.rpc('v4366_create_tchoricky_room',{p_state:state||{}});if(error)throw error;return data}
  async function joinTchorickyRoom(code){if(!client)throw new Error('Databázové připojení není dostupné.');const {data,error}=await client.rpc('v4366_join_tchoricky_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return data}
  async function getTchorickyRoom(code){if(!client)return null;const {data,error}=await client.rpc('v4366_get_tchoricky_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return data}
  async function updateTchorickyRoom(code,state,version){if(!client)return null;const {data,error}=await client.rpc('v4366_update_tchoricky_room',{p_room_code:String(code||'').toUpperCase(),p_state:state||{},p_expected_version:Number(version||0)});if(error)throw error;return data}
  async function leaveTchorickyRoom(code){if(!client||!code)return false;const {data,error}=await client.rpc('v4366_leave_tchoricky_room',{p_room_code:String(code||'').toUpperCase()});if(error)throw error;return Boolean(data)}

  function ensureHudStyles(){if(document.querySelector('link[data-student-hud]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='student-hud.css';l.dataset.studentHud='1';document.head.appendChild(l)}
  function updateStudentHud(student=safeRead(STUDENT_KEY,null)){
    if(!document.body)return;const page=currentPage();if(page.startsWith('admin')||page==='index.html'||page==='registrace.html'||page==='prihlaseni-student.html'||page==='zapomenute-heslo.html'||page==='obnoveni-hesla.html'||page==='vylouceni.html')return;
    let hud=document.getElementById('studentHouseHud');
    if(!student?.houseCode){hud?.remove();return}
    ensureHudStyles();if(!hud){hud=document.createElement('aside');hud.id='studentHouseHud';hud.className='student-house-hud';hud.innerHTML='<a class="student-house-card" href="profil.html"><img alt=""><span><small>Moje kolej</small><strong></strong></span></a><div class="student-hud-actions"><a href="profil.html">Profil</a><a href="chat.html">Chat</a><a href="social.html">Nástěnka a přátelé</a><a href="kontakt.html">Dotazy</a><button type="button" class="student-logout">Odhlásit se</button></div>';document.body.appendChild(hud);hud.querySelector('.student-logout')?.addEventListener('click',async()=>{await signOut();location.replace('index.html')})}
    hud.querySelector('img').src=`img/${crestNames[student.houseCode]||crestNames.N}`;hud.querySelector('img').alt=`Erb koleje ${houseNames[student.houseCode]||''}`;hud.querySelector('strong').textContent=houseNames[student.houseCode]||'';
  }

  function presenceStateCount(){if(!presenceChannel)return 0;const st=presenceChannel.presenceState?.()||{};return Object.keys(st).length}
  function getStudentPresence(){return {ready:presenceSynced,ids:Object.keys(presenceChannel?.presenceState?.()||{})}}
  function emitStudentPresence(){const state=presenceChannel?.presenceState?.()||{};window.dispatchEvent(new CustomEvent('bradavice:presence',{detail:{count:Object.keys(state).length,state,ready:presenceSynced}}))}
  async function startPresence(){
    if(!client||presenceChannel||currentPage().startsWith('admin'))return presenceChannel;
    const user=await getUser();if(!user)return null;
    presenceChannel=client.channel('bradavice-online',{config:{presence:{key:user.id}}});
    presenceChannel.on('presence',{event:'sync'},()=>{presenceSynced=true;emitStudentPresence()});
    presenceChannel.subscribe(async status=>{if(status==='SUBSCRIBED'){try{await presenceChannel.track({user_id:user.id,page:currentPage(),online_at:new Date().toISOString()})}catch(e){console.warn('Přítomnost studenta:',e)}emitStudentPresence()}
      else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){presenceSynced=false;emitStudentPresence()}});
    return presenceChannel;
  }
  async function createAdminPresenceViewer(callback){
    if(!client)return null;const ch=client.channel('bradavice-online');
    const emit=()=>{const state=ch.presenceState?.()||{};const ids=Object.keys(state);callback?.({count:ids.length,ids,state})};
    ch.on('presence',{event:'sync'},emit).subscribe(status=>{if(status==='SUBSCRIBED')emit()});return ch;
  }

  function boot(){if(['zapomenute-heslo.html','obnoveni-hesla.html'].includes(currentPage()))return;updateStudentHud();startPresence().catch(()=>{});if(client)client.auth.onAuthStateChange((_e,session)=>{if(session?.user){setTimeout(()=>{hydrateStudent().catch(()=>{});startPresence().catch(()=>{})},0)}else updateStudentHud(null)})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.BradaviceDB={url:URL,client,houseNames,crestNames,avatarKeys,avatarKeysByHouse,defaultAvatarForHouse,pageToLocation,getUser,getProfile,hydrateStudent,hydrateProgress,hydrateAll,studentNameAvailable,signUp,signIn,signOut,setHouseOnce,unlockAchievement,completeQuest,visitLocationByPage,getHouseStandings,syncHouseStandingsLocal,claimDailyChallenge,updateOwnProfile,isAdmin,adminStats,adminSearchStudents,adminStudentDetail,getAccessState,adminSetBan,adminAdjustPoints,adminDeleteStudent,hagridStatus,hagridAccept,hagridFind,hagridReturn,postChatMessage,getChatMessages,claimV40Activity,snapePenalty,claimV42Activity,submitTournamentScore,getTournamentBoard,createChessRoom,joinChessRoom,getChessRoom,updateChessRoom,leaveChessRoom,createMemoryRoom,joinMemoryRoom,getMemoryRoom,updateMemoryRoom,leaveMemoryRoom,createPotionDuelRoom,joinPotionDuelRoom,getPotionDuelRoom,updatePotionDuelRoom,leavePotionDuelRoom,createTchorickyRoom,joinTchorickyRoom,getTchorickyRoom,updateTchorickyRoom,leaveTchorickyRoom,startPresence,getStudentPresence,createAdminPresenceViewer,updateStudentHud};
})();

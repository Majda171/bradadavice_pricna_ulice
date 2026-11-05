/* Příčná ulice v16. Herní scény lokálně, galeony a nákupy transakčně v Supabase. */
(() => {
  'use strict';

  const data = window.BRADAVICE_DATA;
  if (!data?.katalog?.predmety || !data?.navigace?.lokace) {
    document.body.insertAdjacentHTML('afterbegin', '<p class="noscript">Nepodařilo se načíst data. Ujisti se, že je vedle index.html také data.js.</p>');
    return;
  }

  const items = data.katalog.predmety;
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const scenes = [...data.navigace.lokace, ...data.navigace.ostatni_interiery];
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));
  function schoolStudent() {
    try {return JSON.parse(localStorage.getItem('bradavice_student_v1') || 'null');}
    catch {return null;}
  }
  const knownStudent = schoolStudent();
  const schoolId = knownStudent?.supabaseUserId || knownStudent?.id || knownStudent?.email;
  const storageKey = 'bradavice_pricna_ulice_demo_v1' + (schoolId ? '_' + String(schoolId).replace(/[^a-zA-Z0-9_-]/g,'_') : '');
  const schoolName = [knownStudent?.firstName || knownStudent?.first_name, knownStudent?.lastName || knownStudent?.last_name].filter(Boolean).join(' ').slice(0,40);
  const schoolGender = String(knownStudent?.salutation || '').toLocaleLowerCase('cs-CZ').includes('sle') ? 'studentka' :
    String(knownStudent?.salutation || '').toLocaleLowerCase('cs-CZ').includes('pan') ? 'student' : '';
  const defaultState = () => ({current: 'kotel_vchod', balance: 0, grantClaimed: false, inventory: {}, schoolPurchases: {}, history: [],
    profile: {name:schoolName || '', gender:schoolGender, pet:null, wandId:''}, brickOpened:false, chosenWandId:'', schoolReady:false,
    tomMet:false,hagridMet:false,hagridFarewell:false,bankGreetingMet:false,bankIntroSeen:false,bankIntroSeenV10:false});
  let state = loadState();
  const shopDB = window.DiagonSupabase;
  let purchasePending = false;
  let currentDrawer = null;
  let activeDialogue = null;
  let wandSession = null;
  let wandEffectTimer = null;
  let wandSoundsOn = true;
  let brickTaps = 0;
  let toastTimer;
  let bankIntroActive = false;
  let bankIntroNeedsGreeting = false;
  let bankIntroMusicWasPlaying = false;

  const $ = (id) => document.getElementById(id);
  const image = $('scene-image');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  const descriptions = {
    kotel_vchod: 'Nenápadný londýnský hostinec skrývá cestu do světa kouzel. Vejdi dovnitř a najdi zadní dvorek.',
    kotel_prizemi: 'Staré trámy, vůně večeře a hostinský Tom. Odtud vede cesta na dvorek i po schodech do pokojů.',
    kotel_patro: 'Úzká chodba vrže pod nohama. Za dveřmi s číslem 11 čeká pokoj pro hosty.',
    kotel_pokoj_11: 'Pokoj s mosaznou postelí, krbem a výhledem na kouzelnické střechy. Chvíli se tu můžeš rozhlížet.',
    kotel_dvorek: 'Cihlová zeď vypadá obyčejně. Správné poklepání však odhalí vstup do Příčné ulice.',
    kotel_cihly: 'Najdi dole na zdi cihlu označenou hvězdou. Od ní počítej tři řady nahoru a dvě cihly doprava. Na výslednou cihlu třikrát poklepej.',
    kotel_pruchod: 'Cihly se před tebou rozestoupily. Za průchodem se klikatí Příčná ulice plná kouzelnických obchodů.',
    ulice_1: 'Tady začínají školní nákupy. Najdeš hůlky, hábity, kotlíky i soví obchod.',
    ulice_2: 'Knihkupectví, lektvarové přísady, kouzelnické pomůcky a zvěřinec stojí jen pár kroků od sebe.',
    ulice_3: 'Vůně zmrzliny se mísí s novým pergamenem. Naproti stojí obchod pro milovníky famfrpálu.',
    ulice_4: 'Dům Freda a George září všemi barvami. Nedaleko odbočuje ponurá Obrtlá ulice.',
    obrtla: 'Za rohem světla ubývá. V obchodech této ulice je třeba být obezřetný.',
    gringott_vchod: 'Bílá budova Gringottovy banky ukrývá nespočet trezorů hluboko pod Londýnem.',
    gringott_hala: 'Za vysokými přepážkami pracují skřeti. Pro školní příspěvek se musíš vydat do podzemí.',
    gringott_koleje: 'S Griphookem sedíš v důlním vozíku. Koleje se řítí nad temnými propastmi až k trezoru 713.',
    gringott_713_dvere: 'Těžké dveře nesou číslo 713. Otevřít je může jen skřet svým dotykem.',
    gringott_713_vnitr: 'V této herní verzi slouží trezor 713 k výdeji školního příspěvku pro nové studenty.',
    ollivanderovi: 'Ve vysokých policích odpočívají stovky krabiček. Pan Ollivander ti pomůže vybrat jedinou hůlku.',
    madam_malkinova: 'Pracovní hábity, zimní pláště a kouzelnické čapky čekají na zkoušení.',
    kotliky: 'Cínové kotlíky všech velikostí se lesknou ve světle starých lamp.',
    sovy: 'Z vysokých bidel na tebe shlížejí sovy. Zde si můžeš prohlédnout ptačí posly.',
    knihkupectvi: 'Krucánky a Kaňoury nabízejí všech osm povinných učebnic pro první ročník.',
    apoteka: 'Ve vzduchu je cítit směs sušených bylin, kořenů a nejpodivnějších lektvarových přísad.',
    zverinec: 'Ve zvěřinci si můžeš vybrat sovu, kočku nebo ropuchu. Jen jednoho oficiálního školního mazlíčka.',
    wiseacre: 'Staré dalekohledy, mosazné váhy a drobné laboratorní vybavení plní tento obchod.',
    famfrpal: 'Výstavní košťata, závodní modely a vybavení pro famfrpál. Koště si můžeš koupit, ale prvák ho nesmí vozit do školy.',
    zmrzlina: 'Florean Fortescue podává kouzelnickou zmrzlinu. Vyber si něco na osvěžení do dalších cest.',
    pisarstvi: 'Pero, inkoust a pergamen patří do školní brašny stejně jako učebnice.',
    weasleyovi: 'Fred a George prodávají věci, které by školník Filch nejraději zakázal.',
    twilfitt: 'Společenské hábity pro dívky i chlapce, od slavnostních rób až po poněkud staromódní kousky.',
    borgin: 'Podivné předměty a staré relikvie si v tomto krámku zaslouží pořádnou opatrnost.'
  };

  const storeForScene = {
    ollivanderovi: 'ollivanderovi',
    madam_malkinova: 'madam_malkinova',
    kotliky: 'u_potage',
    knihkupectvi: 'krucanky_a_kanoury',
    wiseacre: 'wiseacrovy_potreby',
    zverinec: 'kouzelny_zverinec',
    sovy: 'kouzelny_zverinec',
    pisarstvi: 'brky_a_pergameny',
    weasleyovi: 'kratochvilne_kejkle',
    famfrpal: 'famfrpalove_potreby',
    apoteka: 'slug_a_jigger',
    zmrzlina: 'florean_fortescue',
    twilfitt: 'twilfitt_a_tatting'
  };

  // Každý obchod má vlastní přímý návrat na úsek Příčné ulice, ze kterého se do něj vstupuje.
  const streetForShop = {
    ollivanderovi:'ulice_1', madam_malkinova:'ulice_1', kotliky:'ulice_1', sovy:'ulice_1',
    knihkupectvi:'ulice_2', apoteka:'ulice_2', zverinec:'ulice_2', wiseacre:'ulice_2',
    famfrpal:'ulice_3', zmrzlina:'ulice_3', pisarstvi:'ulice_3',
    weasleyovi:'ulice_4', twilfitt:'ulice_4', borgin:'obrtla'
  };

  const hotspots = {
    kotel_vchod: [['kotel_prizemi',51,63,'Vstoupit']],
    kotel_prizemi: [['kotel_patro',70,45,'Schody do patra'],['kotel_dvorek',84,65,'Zadní dvorek']],
    kotel_patro: [['kotel_pokoj_11',66,49,'Pokoj 11'],['kotel_prizemi',18,64,'Zpět dolů']],
    kotel_pokoj_11: [['kotel_patro',10,58,'Na chodbu']],
    kotel_dvorek: [['kotel_cihly',52,47,'Prohlédnout cihlovou zeď']],
    kotel_pruchod: [['ulice_1',55,56,'Vstoupit do Příčné ulice']],
    ulice_1: [['ollivanderovi',17,54,'Ollivanderovi'],['madam_malkinova',36,53,'Madam Malkinová'],['sovy',68,54,'Sovy'],['kotliky',86,54,'Kotlíky']],
    ulice_2: [['knihkupectvi',17,52,'Knihkupectví'],['apoteka',37,52,'Lektvary'],['wiseacre',69,53,'Pomůcky'],['zverinec',86,53,'Zvěřinec']],
    ulice_3: [['famfrpal',17,53,'Famfrpál'],['zmrzlina',36,54,'Zmrzlina'],['pisarstvi',70,56,'Pergameny']],
    ulice_4: [['weasleyovi',21,55,'Fred a George'],['twilfitt',87,56,'Krejčovství'],['obrtla',69,49,'Obrtlá ulice']],
    // Vchod Borgina a Burkese je na levé straně ulice pod nápisem obchodu.
    obrtla: [['borgin',31,53,'Borgin a Burkes']],
    gringott_vchod: [['gringott_hala',50,61,'Do banky']],
    gringott_hala: [['gringott_koleje',74,62,'Do podzemí']],
    gringott_koleje: [['gringott_713_dvere',59,52,'K trezoru 713']],
    gringott_713_dvere: [['gringott_713_vnitr',60,49,'Otevřít 713']]
  };

  // Souřadnice odpovídají skutečné pozici postavy v interiéru. Každý portrét je samostatný WebP.
  const character = (imageName, name, x=81, height=58, lines=[], options=[], placement={}) => ({imageName, name, x, height, lines, options, ...placement});
  const characters = {
    kotel_prizemi: [character('hostinsky_tom.webp','Hostinský Tom',43,63,
      ['Vítej v Děravém kotli. Zastavil ses cestou do Bradavic, že?','Rubeus Hagrid už čeká na zadním dvorku. Projdi kolem baru a dveřmi ven.','A až se vrátíš z nákupů, můžeš se tady zase zastavit.'],['profil','dvorek'],{floor:6})],
    kotel_dvorek: [character('hagrid.webp','Rubeus Hagrid',79,87,
      ['Á, tak tys ten náš novej prvák! Já sem Rubeus Hagrid, klíčník a šafář v Bradavicích. Říkej mi prostě Hagrid.','Tak hele, máš s sebou ten seznam věcí, co ti přišel v dopise? Než se vydáme po obchodech, musíme se kouknout, co všechno budeš potřebovat.','A prvně se stav v Gringottově bance. V trezoru číslo 713 na tebe čeká pět set galeonů od Bradavic. S těma pak pořídíš všechno, co je na seznamu.','Teď koukej na tu zeď. Najdi cihlu se zlatou hvězdou, tři nahoru a dvě doprava. Pak na ni třikrát klepni. Uvidíš, co se stane!'],['list','inventory','hagrid-check','cihly'],{floor:0})],
    ollivanderovi: [character('ollivander.webp','Garrick Ollivander',74,74,
      ['Á, nový zákazník. Od roku 382 před naším letopočtem se zde vyrábějí nejvybranější hůlky.','Dřevo, jádro, délka i pružnost jsou důležité. Ale nejpodstatnější je, komu se hůlka rozhodne sloužit.','Pojďme jednu po druhé vyzkoušet. Vy jen mávnete — a uvidíme, co se stane.'],['wand','list'])],
    madam_malkinova: [character('madam_malkinova.webp','Madam Malkinová',76,73,
      ['Bradavice? Jak jinak! Postav se prosím sem na stoličku, hned ti vezmu míry.','Tři černé pracovní hábity, špičatou čapku, ochranné rukavice a zimní plášť. Všechno musí dobře sedět.'],['shop','list'])],
    weasleyovi: [character('fred_weasley.webp','Fred Weasley',59,73,
      ['Vítej v nejlepším obchodě s žertíky široko daleko!','Naše bomby hnojůvky jsou po deseti. U Filche zaručeně vzbudí zájem.'],['shop']),
      character('george_weasley.webp','George Weasley',82,73,
      ['Fred ti samozřejmě zapomněl říct o dávivých dortíčcích a horečnatých hrudkách.','A jestli tě někdo uvidí, jak zkoušíš naše výrobky, my dva o ničem nevíme!'],['shop'])],
    zmrzlina: [character('florean_fortescue.webp','Florean Fortescue',76,75,['Dáš si zmrzlinu? Máme příchutě, o kterých se mudlům ani nesní.','Vyber si z nabídky a udělej si chvilku volna od nákupů.'],['shop'])],
    gringott_hala: [character('skret_bogrod_v10.webp','Bankovní skřet Bogrod',46,56,
      ['Ááá, zajisté! Student Bradavic, nemýlím-li se? Už o tobě víme.','Škola u nás pro nové studenty uložila příspěvek. Je nutné dostavit se osobně k trezoru číslo 713.','Griphooku! Odveď prosím našeho mladého návštěvníka k trezoru 713 a dohlédni, aby všechno proběhlo podle předpisů.'],['call-griphook']),
      character('skret_griphook.webp','Skřet Griphook',76,55,
      ['Pojďte prosím za mnou. Cesta do podzemí bývá poněkud… rychlá.','Vozík už je přichystaný. U trezoru nic neotevírejte beze mě.'],['bank'])],
    gringott_koleje: [character('skret_griphook.webp','Skřet Griphook',67,49,
      ['Pevně se drž. Vozíky tu nedbají na pohodlí cestujících.','Za další zatáčkou je trezor 713.'],['trezor'],{spriteHidden:true})],
    gringott_713_dvere: [character('skret_griphook.webp','Skřet Griphook',79,54,
      ['Trezor číslo 713. Ustup, prosím.','Žádný klíč. Na tento zámek postačí dotyk skřetí ruky.'],['open-vault'])],
    gringott_713_vnitr: [character('skret_griphook.webp','Skřet Griphook',39,54,
      ['Bradavice uložily pro nového studenta pět set galeonů. Vyzvednout je můžeš jen jednou.','Nalož s nimi uvážlivě. Povinné pomůcky nejsou levné.'],['grant'])],
    borgin: [character('pan_borgin.webp','Pan Borgin',77,75,
      ['Nuže… co zaválo mladého návštěvníka do Borgina a Burkese?','Staré skříně, záhadné šperky, temné artefakty. Některých věcí je lépe se vůbec nedotýkat.','Toto není obchod pro školní seznam. Doporučuji vrátit se na Příčnou ulici.'])],
    kotliky: [character('pan_potage_kotliky.webp','Pan Potage',77,73,['Pro první ročník je předepsaný cínový kotlík, velikost dvě.','Žádné ozdobné měděné kotlíky — ty si nech až na později.'],['shop'])],
    knihkupectvi: [character('pani_pismilova_knihy.webp','Prodavačka knih',77,72,['Krucánky a Kaňoury, dobrý den! Osm knih pro prváky? Už je mám připravené.','S knihami zacházej opatrně. Některé jsou živější, než se na první pohled zdá.'],['shop','list'])],
    apoteka: [character('mistr_jigger_lektvary.webp','Mistr Jigger',80,75,['Vítej u Sluga a Jiggera. Nedotýkej se nádoby s žabími prsty.','Máme i sušené byliny a kořeny do lektvarů. Tvoje nákupy se uloží přímo do brašny.'],['shop','list'])],
    zverinec: [character('pani_tvoreckova_zverinec.webp','Prodavačka zvěřince',77,72,['Zdravím! Hledáš nového přítele?','Do Bradavic je dovoleno vzít jednu sovu, jednu kočku nebo jednu ropuchu. Rozhodnutí si pořádně rozmysli.'],['shop'])],
    sovy: [character('pani_peroutkova_sovy.webp','Prodavačka sov',77,72,['Velkoprodejna Mžourov. Naše sovy jsou skvělé pošťačky.','Jestli si vybereš sovu, může být tvým jediným školním mazlíčkem.'],['shop'])],
    wiseacre: [character('prodavac_wiseacre.webp','Prodavač kouzelnických potřeb',77,73,['Mosazné váhy, skleněné lahvičky a dalekohled máme skladem.','Všechny pomůcky najdeš přehledně na policích.'],['shop'])],
    pisarstvi: [character('prodavacka_pisarstvi.webp','Prodavačka psacích potřeb',76,73,['Dobrý brk, inkoust a čistý pergamen se ve škole vždycky hodí.','Doporučuji pořídit zásobu ještě před odjezdem.'],['shop'])],
    famfrpal: [character('pan_kostal_famfrpal.webp','Prodavač famfrpálových potřeb',76,74,['Přišel ses podívat na košťata? Skvělá volba!','Koště ti rád prodám. Ale pozor, prváci je do Bradavic zatím vozit nesmějí.'],['shop','list'])],
    twilfitt: [character('krejcova_twilfitt.webp','Krejčová',77,73,
      ['Vítám tě u Twilfitta a Tattinga. Vyber si společenský hábit pro slavnostní příležitosti.',
       'Máme krásné modely pro mladé čarodějky i kouzelníky. A vzadu visí jeden velmi staromódní kus za neodolatelnou cenu.',
       'Na obyčejné školní hábity ale raději zajdi k Madam Malkinové.'],['shop'])]
  };

  // Individuální umístění podle volné podlahy na skutečném pozadí dané scény.
  // x: poloha zleva, height: výška postavy vůči scéně, floor: odstup chodidel od dolního okraje.
  const characterPlacements = {
    kotel_prizemi: [{x:48,height:70,floor:6},{x:75,height:85,floor:3}],
    kotel_dvorek: [{x:79,height:89,floor:0}],
    // Ollivander stojí až za pravým pultem; spodní část postavy zakryje přední hrana pultu.
    // Ollivander stojí celý na podlaze před regály, nikoliv za prodejním pultem.
    ollivanderovi: [{x:61,height:74,floor:2}],
    madam_malkinova: [{x:56,height:70,floor:3}],
    weasleyovi: [{x:35,height:70,floor:1},{x:73,height:70,floor:1}],
    zmrzlina: [{x:61,height:67,floor:2}],
    gringott_hala: [{x:47,height:41,floor:11},{x:70,height:39,floor:9}],
    gringott_713_dvere: [{x:74,height:44,floor:4}],
    gringott_713_vnitr: [{x:43,height:46,floor:2}],
    borgin: [{x:53,height:71,floor:2}],
    kotliky: [{x:59,height:68,floor:2}],
    knihkupectvi: [{x:61,height:71,floor:2}],
    apoteka: [{x:72,height:69,floor:2}],
    zverinec: [{x:63,height:70,floor:2}],
    sovy: [{x:59,height:70,floor:2}],
    wiseacre: [{x:59,height:71,floor:2}],
    pisarstvi: [{x:59,height:72,floor:2}],
    famfrpal: [{x:72,height:68,floor:2}],
    twilfitt: [{x:57,height:72,floor:2}]
  };

  function placedCharacters(sceneId, sceneCharacters) {
    return sceneCharacters.map((npc, index) => ({...npc,...(characterPlacements[sceneId]?.[index] || {})}));
  }

  function visibleCharacters(sceneId) {
    if (!state.brickOpened) return placedCharacters(sceneId, characters[sceneId] || []);
    if (sceneId === 'kotel_dvorek') return [];
    if (sceneId === 'kotel_prizemi') return placedCharacters(sceneId, [
      {...characters.kotel_prizemi[0],
        lines:['Tak tě tu zase vidím! Jak šly nákupy?','Hagrid už je zpátky v hostinci a čeká, až mu ukážeš, co sis pořídil(a).','Až budete mít všechno ze seznamu, můžete pokračovat do Bradavic.'],
        options:['list','inventory']},
      {...characters.kotel_dvorek[0],
        lines:['Tak co, jak se ti líbila Příčná ulice? Už máš nakoupeno?',
          'Ukaž mi brašnu a školní seznam, ať na něco důležitýho nezapomeneme.'],
        options:['hagrid-check','list','inventory']}
    ]);
    return placedCharacters(sceneId, characters[sceneId] || []);
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!stored) return defaultState();
      // Ve starší verzi byly kejkle omylem ve dvou obchodech. Nákupy a postup zůstávají zachované.
      if (stored.current === 'zerty') stored.current = 'weasleyovi';
      if (!sceneMap.has(stored.current)) return defaultState();
      // Starší verze ukládala i školní potřeby do batohu. Rozdělíme je beze ztráty nákupů.
      const inventory = {};
      const schoolPurchases = stored.schoolPurchases && typeof stored.schoolPurchases === 'object' ? {...stored.schoolPurchases} : {};
      // Zachování již nakoupených hůlek ze starého katalogu s 15 variantami.
      const oldWands={hulka_12:'hulka_02',hulka_13:'hulka_07',hulka_14:'hulka_09',hulka_15:'hulka_11'};
      for(const [legacy,newId] of Object.entries(oldWands))if(Number(schoolPurchases[legacy])>0){
        schoolPurchases[newId]=Math.max(Number(schoolPurchases[newId])||0,Number(schoolPurchases[legacy]));
        delete schoolPurchases[legacy];
      }
      const mapWandId=id=>oldWands[id]||id;
      let pet = stored.profile?.pet && typeof stored.profile.pet === 'object' ? {
        id:String(stored.profile.pet.id || ''), name:String(stored.profile.pet.name || '').slice(0,35)
      } : null;
      for (const [id,quantity] of Object.entries(stored.inventory || {})) {
        const mappedId=mapWandId(id);
        const item = itemMap.get(mappedId);
        if (!item || !(Number(quantity) > 0)) continue;
        if (item.obchod === 'kratochvilne_kejkle' || ['prisada','obcerstveni','koste','spolecensky_habit'].includes(item.kategorie))
          inventory[mappedId] = Number(quantity);
        else if (item.kategorie === 'mazlicek') pet ||= {id,name:''};
        else schoolPurchases[mappedId] = Number(quantity);
      }
      return {
        current: stored.current,
        balance: Number.isFinite(stored.balance) && stored.balance >= 0 ? stored.balance : 0,
        grantClaimed: stored.grantClaimed === true,
        inventory, schoolPurchases,
        history: Array.isArray(stored.history) ? stored.history.filter((id) => sceneMap.has(id)).slice(-40) : [],
        profile: {name:String(stored.profile?.name || '').slice(0,40),gender:['student','studentka'].includes(stored.profile?.gender) ? stored.profile.gender : '',
          pet:pet && itemMap.get(pet.id)?.kategorie === 'mazlicek' ? pet : null,
          wandId:String(mapWandId(stored.profile?.wandId) || Object.keys(schoolPurchases).find(id=>itemMap.get(id)?.kategorie==='hulka') || '')},
        brickOpened: stored.brickOpened === true,
        chosenWandId: itemMap.get(mapWandId(stored.chosenWandId))?.kategorie === 'hulka' ? mapWandId(stored.chosenWandId) : '',
        schoolReady: stored.schoolReady === true,
        tomMet: stored.tomMet === true,
        hagridMet: stored.hagridMet === true,
        hagridFarewell: stored.hagridFarewell === true,
        bankGreetingMet: stored.bankGreetingMet === true,
        bankIntroSeen: stored.bankIntroSeen === true,
        bankIntroSeenV10: stored.bankIntroSeenV10 === true
      };
    } catch { return defaultState(); }
  }

  function saveState() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Offline režim může blokovat úložiště. */ }
  }

  // Supabase je autoritativní pro finance i výbavu. Lokální zůstává jen průchod scénami.
  function applyServerState(snapshot,restoreScene=false) {
    if (!snapshot) return;
    const purchases = snapshot.purchases || {};
    state.inventory = {};
    state.schoolPurchases = {};
    for (const [id,qty] of Object.entries(purchases)) {
      const item = itemMap.get(id);
      if (!item || !(Number(qty)>0)) continue;
      if (item.obchod === 'kratochvilne_kejkle' || ['prisada','obcerstveni','koste','spolecensky_habit'].includes(item.kategorie))
        state.inventory[id] = Number(qty);
      else state.schoolPurchases[id] = Number(qty);
    }
    state.balance = Number(snapshot.balance || 0);
    state.grantClaimed = snapshot.grantClaimed === true;
    state.profile.wandId = snapshot.wandId || '';
    state.profile.pet = snapshot.petId ? {id:snapshot.petId,name:snapshot.petName || ''} : null;
    state.schoolReady = snapshot.schoolReady === true;
    if (restoreScene && snapshot.lastScene && sceneMap.has(snapshot.lastScene) && snapshot.lastScene !== 'kotel_vchod') state.current = snapshot.lastScene;
    saveState();
    renderHud();renderScene();
    if (currentDrawer === 'shop') renderShop();
    if (currentDrawer === 'inventory') renderInventory();
    if (currentDrawer === 'list') renderChecklist();
  }
  async function serverChange(operation) {
    if (purchasePending) return null;
    purchasePending = true;
    try {
      if (!shopDB) throw new Error('Chybí propojení s databází.');
      const snapshot = await operation();
      applyServerState(snapshot);
      return snapshot;
    } catch (error) {
      console.warn('Supabase nákup',error);
      toast(error.message || 'Nákup se nepodařilo uložit.');
      return null;
    } finally { purchasePending = false; }
  }

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3100);
  }

  function displayName(id) {
    return sceneMap.get(id)?.nazev || id;
  }

  function isOwned(item) { return itemQuantity(item) > 0; }
  function equipmentReady() { return categoryOwned('hulka') && items.filter((item) => item.povinnost === 'povinne').every(isOwned); }
  function categoryOwned(category) {
    return items.some((item) => item.kategorie === category && isOwned(item));
  }
  function itemQuantity(item) {
    if (item.kategorie === 'mazlicek') return state.profile.pet?.id === item.id ? 1 : 0;
    return Number(state.inventory[item.id] || state.schoolPurchases[item.id]) || 0;
  }
  function isUniqueItem(item) {
    return item.povinnost === 'povinne' || ['hulka','mazlicek','spolecensky_habit'].includes(item.kategorie);
  }
  function canBuy(item) {
    if (state.balance < item.cena) return false;
    if (item.kategorie === 'hulka' && categoryOwned('hulka')) return false;
    if (item.kategorie === 'mazlicek' && categoryOwned('mazlicek')) return false;
    if (isUniqueItem(item) && isOwned(item)) return false;
    return true;
  }
  async function buyItem(id) {
    const item = itemMap.get(id);
    if (!item) return;
    if (item.kategorie === 'hulka') { toast('U Ollivandera si hůlku nelze vybrat z regálu. Musí si vybrat ona tebe.'); return; }
    if (!canBuy(item)) {
      toast(state.balance < item.cena ? 'Nemáš dost galeonů. Nejdřív navštiv Gringottovu banku.' : 'Tuto položku už máš, nebo je povolen jen jeden výběr.');
      return;
    }
    const result = await serverChange(()=>shopDB.buy(id));
    if (!result) return;
    if (item.kategorie === 'mazlicek') showPetNaming();
    else toast(`Zakoupeno: ${item.nazev} (−${item.cena} galeonů)`);
  }

  async function claimGrant() {
    if (state.current !== 'gringott_713_vnitr') return;
    if (state.grantClaimed) { toast('Svůj školní příspěvek už sis vyzvedl(a).'); return; }
    const result=await serverChange(()=>shopDB.claimGrant());
    if (!result) return;
    renderSceneActions();
    toast('Bradavice ti poskytly 500 galeonů. Můžeš začít nakupovat!');
  }

  function finishBankIntro() {
    if (!bankIntroActive) return;
    bankIntroActive = false;
    const video = $('bank-intro-video');
    video.pause();
    video.currentTime = 0;
    $('bank-intro').hidden = true;
    $('bank-intro-play').hidden = true;
    $('street-music').muted = false;
    if (bankIntroMusicWasPlaying && $('street-music').paused) {
      $('street-music').play().catch(() => {});
    }
    const greet = bankIntroNeedsGreeting && state.current === 'gringott_hala';
    bankIntroNeedsGreeting = false;
    state.bankIntroSeen = true;
    state.bankIntroSeenV10 = true;
    if (greet) state.bankGreetingMet = true;
    saveState();
    if (greet) startNpcDialogue(0);
  }

  function startBankIntro() {
    if (bankIntroActive) return;
    bankIntroActive = true;
    bankIntroNeedsGreeting = !state.bankGreetingMet;
    const video = $('bank-intro-video');
    const music = $('street-music');
    bankIntroMusicWasPlaying = !music.paused;
    music.muted = true;
    video.currentTime = 0;
    video.muted = false;
    $('bank-intro-play').hidden = true;
    $('bank-intro').hidden = false;
    // Vstup je spuštěn kliknutím hráče; při blokování autoplay nabídneme vlastní tlačítko.
    try {
      const playback = video.play();
      if (playback?.catch) playback.catch(() => {
        if (bankIntroActive) $('bank-intro-play').hidden = false;
      });
    } catch {
      $('bank-intro-play').hidden = false;
    }
  }

  function navigate(id, pushHistory = true) {
    if (!sceneMap.has(id) || id === state.current) return;
    if ((id === 'ulice_1' && ['kotel_dvorek','kotel_cihly'].includes(state.current) || id === 'kotel_pruchod') && !state.brickOpened) {
      toast('Nejdřív musíš objevit tajemství cihlové zdi.'); return;
    }
    if (pushHistory) state.history.push(state.current);
    state.history = state.history.slice(-40);
    state.current = id;
    brickTaps = 0;
    saveState();
    shopDB?.setProgress(id,null).catch((e)=>console.warn('Uložení poslední lokace:',e));
    closeDrawer();
    closeDialogue();
    closeWandGame();
    renderScene();
    if (id === 'kotel_prizemi' && !state.tomMet) {
      state.tomMet = true; saveState(); startNpcDialogue(0);
    }
    if (id === 'kotel_dvorek' && !state.hagridMet) {
      state.hagridMet = true; saveState(); startNpcDialogue(0);
    }
    if (id === 'kotel_pruchod' && !state.hagridFarewell) {
      state.hagridFarewell = true; saveState(); showHagridFarewell();
    }
    if (id === 'gringott_hala' && !state.bankIntroSeenV10) {
      startBankIntro();
    } else if (id === 'gringott_hala' && !state.bankGreetingMet) {
      state.bankGreetingMet = true; saveState(); startNpcDialogue(0);
    }
  }

  function goBack() {
    const previous = state.history.pop();
    if (previous && sceneMap.has(previous)) navigate(previous, false);
    else navigate('kotel_vchod', false);
  }

  function renderHud() {
    $('wallet-count').textContent = state.balance.toLocaleString('cs-CZ');
    $('inventory-badge').textContent = Object.values(state.inventory).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }

  function renderScene() {
    const scene = sceneMap.get(state.current) || sceneMap.get('kotel_vchod');
    document.querySelector('.scene-frame').dataset.scene = scene.id;
    image.src = scene.obrazek;
    image.alt = scene.nazev;
    $('scene-image').classList.toggle('wall-closeup',scene.id === 'kotel_cihly');
    $('scene-title').textContent = scene.nazev;
    $('scene-description').textContent = descriptions[scene.id] || 'Rozhlédni se a prozkoumej kouzelnické zákoutí.';
    $('scene-breadcrumb').textContent = scene.id.startsWith('gringott') ? 'Gringottova banka · Londýn' : scene.id.startsWith('kotel') ? 'Děravý kotel · Londýn' : 'Příčná ulice · kouzelnický Londýn';

    const sceneHotspots = scene.id === 'kotel_dvorek' && state.brickOpened
      ? [['kotel_pruchod',52,47,'Projít otevřenou zdí']] : (hotspots[scene.id] || []);
    const nodes = sceneHotspots.map(([id, x, y, label]) => `
      <button type="button" class="hotspot" style="left:${x}%;top:${y}%" data-go="${escapeHtml(id)}" aria-label="${escapeHtml(label)}">
        <span class="hotspot-dot">✦</span><span class="hotspot-name">${escapeHtml(label)}</span>
      </button>`).join('');
    $('hotspots').innerHTML = nodes;
    renderBrickPuzzle();
    renderCharacters(scene.id);
    renderSceneActions();
    renderTravel(scene);
    renderHud();
    document.title = `${scene.nazev} | Bradavice`;
  }

  function renderCharacters(sceneId) {
    $('characters').innerHTML = visibleCharacters(sceneId).map((npc, index) => npc.spriteHidden ? '' : `
      <button type="button" class="character-button" style="left:${npc.x}%;height:${npc.height}%;--npc-floor:${npc.floor ?? 0}%" data-npc="${index}" title="Promluvit s postavou ${escapeHtml(npc.name)}" aria-label="Promluvit s postavou ${escapeHtml(npc.name)}">
        <img src="postavy/${escapeHtml(npc.imageName)}" alt="${escapeHtml(npc.name)}" loading="eager" decoding="async">
      </button>`).join('');
  }

  function renderSceneActions() {
    const id = state.current;
    const buttons = [];
    if (streetForShop[id]) {
      buttons.push(`<button type="button" class="primary-action" data-go="${streetForShop[id]}">← Zpět ${streetForShop[id] === 'obrtla' ? 'do Obrtlé ulice' : 'na Příčnou ulici'}</button>`);
    }
    if (/^ulice_[1-4]$/.test(id)) {
      buttons.push('<button type="button" class="primary-action" data-go="gringott_vchod">Navštívit Gringottovu banku →</button>');
      const number = Number(id.slice(-1));
      if (number < 4) buttons.push(`<button type="button" class="primary-action" data-go="ulice_${number+1}">Pokračovat dál Příčnou ulicí →</button>`);
      else buttons.push('<button type="button" class="primary-action" data-go="weasleyovi">Navštívit Freda a George →</button>');
      if (number === 3) buttons.push('<button type="button" class="primary-action" data-go="pisarstvi">Brky a pergameny →</button>');
    }
    if (storeForScene[id]) buttons.push(`<button type="button" class="primary-action" data-action="${id === 'ollivanderovi' ? 'wand' : 'shop'}">${id === 'ollivanderovi' ? 'Vyzkoušet kouzelnické hůlky' : 'Prohlédnout zboží · Nakupovat'}</button>`);
    visibleCharacters(id).forEach((npc,index) => {
      buttons.push(`<button type="button" class="secondary-action" data-npc-open="${index}">Promluvit: ${escapeHtml(npc.name)}</button>`);
    });
    if (id === 'gringott_713_vnitr') {
      buttons.push(`<button type="button" class="primary-action" data-action="grant" ${state.grantClaimed ? 'disabled' : ''}>${state.grantClaimed ? 'Příspěvek už vyzvednut' : 'Vyzvednout 500 galeonů'}</button>`);
    }
    if (id === 'gringott_hala') {
      buttons.push('<button type="button" class="primary-action" data-go="gringott_koleje">S Griphookem k trezoru 713 →</button>');
      buttons.push('<button type="button" class="secondary-action" data-action="bank-intro">▶ Přehrát uvítání znovu</button>');
    }
    if (id === 'kotel_vchod') buttons.push('<button type="button" class="primary-action" data-go="kotel_prizemi">Vstoupit do Děravého kotle</button>');
    if (id === 'kotel_prizemi') buttons.push('<button type="button" class="primary-action" data-go="kotel_dvorek">Na zadní dvorek →</button>');
    if (id === 'kotel_dvorek') buttons.push(`<button type="button" class="primary-action" data-go="${state.brickOpened ? 'kotel_pruchod' : 'kotel_cihly'}">${state.brickOpened ? 'Projít otevřenou zdí' : 'Prozkoumat tajemnou zeď'}</button>`);
    if (id === 'kotel_cihly' && state.brickOpened) buttons.push('<button type="button" class="primary-action" data-go="kotel_pruchod">Projít otevřenou zdí</button>');
    if (id === 'kotel_pruchod') buttons.push('<button type="button" class="primary-action" data-go="ulice_1">Vstoupit do Příčné ulice</button>');
    if ((id === 'kotel_dvorek' && !state.brickOpened) || (id === 'kotel_prizemi' && state.brickOpened))
      buttons.push('<button type="button" class="secondary-action" data-action="hagrid-check">Promluvit s Hagridem o nákupech</button>');
    $('scene-actions').innerHTML = buttons.join('');
  }

  function renderTravel(scene) {
    if (scene.id === 'obrtla') {
      // Nesmí tu být druhý plovoucí vstup do Borgina: jediný vstup je přímo na dveřích.
      $('travel-links').innerHTML = '<button type="button" class="travel-link nav-prev" data-go="ulice_4">Zpět na Příčnou ulici</button>';
      $('go-back').disabled = false;
      return;
    }
    if (streetForShop[scene.id]) {
      const target = streetForShop[scene.id];
      $('travel-links').innerHTML = `<button type="button" class="travel-link nav-prev" data-go="${target}">Zpět ${target === 'obrtla' ? 'do Obrtlé ulice' : 'na Příčnou ulici'}</button>`;
      $('go-back').disabled = false;
      return;
    }
    const streetNumber = /^ulice_([1-4])$/.exec(scene.id);
    if (streetNumber) {
      const number = Number(streetNumber[1]);
      const previous = number === 1 ? 'kotel_pruchod' : `ulice_${number-1}`;
      const next = number === 4 ? 'weasleyovi' : `ulice_${number+1}`;
      $('travel-links').innerHTML = `<button type="button" class="travel-link nav-prev" data-go="${previous}">Zpět ${number === 1 ? 'k průchodu' : 'o část ulice'}</button>
        <button type="button" class="travel-link nav-next" data-go="${next}">${number === 4 ? 'Fred a George' : 'Dál Příčnou ulicí'}</button>`;
      $('go-back').disabled = false;
      return;
    }
    let destinations = scene.prechody || [];
    if (scene.id === 'kotel_dvorek' && state.brickOpened) destinations=['kotel_prizemi','kotel_pruchod'];
    if (!state.brickOpened && ['kotel_dvorek','kotel_cihly'].includes(scene.id)) destinations = destinations.filter((id) => id !== 'ulice_1');
    if (!destinations.length) destinations = [state.history.at(-1) || 'ulice_1'];
    const shortened = (name) => name.replace('Příčná ulice – ', '').replace('Gringottova banka – ', '').replace('Děravý kotel – ', '');
    const known = destinations.filter((id) => sceneMap.has(id));
    const back = known.find((id) => id === state.history.at(-1)) || (scene.id === 'kotel_vchod' ? null : known[0]);
    const forward = known.find((id) => id !== back);
    const links = [];
    if (back) links.push(`<button type="button" class="travel-link nav-prev" data-go="${escapeHtml(back)}">${escapeHtml(shortened(displayName(back)))}</button>`);
    if (forward || (!back && known[0])) {
      const id = forward || known[0];
      links.push(`<button type="button" class="travel-link nav-next" data-go="${escapeHtml(id)}">${escapeHtml(shortened(displayName(id)))}</button>`);
    }
    $('travel-links').innerHTML = links.join('');
    $('go-back').disabled = state.history.length === 0 && state.current === 'kotel_vchod';
  }

  function openDrawer(which) {
    closeDialogue();
    closeWandGame();
    currentDrawer = which;
    $('drawer').className = `drawer ${which === 'list' ? 'is-letter' : which === 'inventory' ? 'is-bag' : 'is-shop'}`;
    $('drawer').hidden = false;
    $('drawer-scrim').hidden = false;
    document.body.style.overflow = 'hidden';
    if (which === 'shop') renderShop();
    if (which === 'inventory') renderInventory();
    if (which === 'list') renderChecklist();
    $('close-drawer').focus();
  }

  function closeDrawer() {
    currentDrawer = null;
    $('drawer').className = 'drawer';
    $('drawer').hidden = true;
    $('drawer-scrim').hidden = true;
    document.body.style.overflow = '';
  }

  function renderShop() {
    const store = storeForScene[state.current];
    if (!store) { closeDrawer(); return; }
    const products = items.filter((item) => item.obchod === store);
    $('drawer-overline').textContent = 'Kouzelnický obchod';
    $('drawer-title').textContent = data.katalog.obchody[store] || 'Obchod';
    const intro = store === 'twilfitt_a_tatting'
      ? 'Slavnostní hábity pro dívky i chlapce. Nejsou povinnou školní výbavou a po zakoupení je najdeš v batohu. Paní krejčová má i jeden neobyčejně staromódní model za nejnižší cenu.'
      : state.grantClaimed
      ? 'Prohlédni si nabídku. Povinné školní potřeby se odškrtnou na seznamu; lektvarové přísady, kouzelné kejkle, košťata a dobroty zůstanou v brašně.'
      : 'Zboží si můžeš prohlédnout už teď. Před nákupem je potřeba vyzvednout peníze v Gringottově bance.';
    const pet = state.profile.pet && itemMap.get(state.profile.pet.id);
    const petInfo = store === 'kouzelny_zverinec' && pet ? `<div class="pet-profile">Tvůj společník: <strong>${escapeHtml(state.profile.pet.name || pet.nazev)}</strong>
      <button type="button" class="small-button" data-action="pet-name">${state.profile.pet.name ? 'Přejmenovat mazlíčka' : 'Pojmenovat mazlíčka'}</button></div>` : '';
    $('drawer-content').innerHTML = `<p class="drawer-intro">${escapeHtml(intro)}</p>${petInfo}<div class="product-grid">${products.map((item, index) => {
      const uniqueOwned = isUniqueItem(item) && (isOwned(item) || (item.kategorie === 'hulka' && categoryOwned('hulka')) || (item.kategorie === 'mazlicek' && categoryOwned('mazlicek')));
      const label = uniqueOwned ? 'Vybráno' : state.balance < item.cena ? 'Málo galeonů' : 'Koupit';
      const groupHeading = store === 'twilfitt_a_tatting' && (index === 0 || products[index - 1].pohlavi !== item.pohlavi)
        ? `<h3 class="product-group-heading">${item.pohlavi === 'divci' ? 'Dámské a dívčí hábity' : 'Chlapecké hábity'}</h3>` : '';
      return `${groupHeading}<article class="product-card">
        <div class="product-image"><img src="${escapeHtml(item.obrazek)}" alt="${escapeHtml(item.nazev)}" loading="lazy">${item.id === 'spol_chlap_staromodni' ? '<span class="product-bargain-note">Nejlevnější</span>' : ''}</div>
        <div class="product-body"><h3 class="product-title">${escapeHtml(item.nazev)}</h3>
          ${item.autor ? `<p class="product-description">${escapeHtml(item.autor)}</p>` : ''}
          ${item.vlastnost ? `<p class="product-description">${escapeHtml(item.vlastnost)}</p>` : ''}
          ${item.popis ? `<p class="product-description">${escapeHtml(item.popis)}</p>` : ''}
          ${item.jadro ? `<p class="product-description">${escapeHtml(item.delka_cm)} cm · ${escapeHtml(item.jadro)}</p>` : ''}
          <div class="product-meta"><strong class="price">${item.cena} G</strong>
            <button type="button" class="buy-button" data-buy="${escapeHtml(item.id)}" ${canBuy(item) ? '' : 'disabled'}>${label}</button></div>
          ${item.povinnost === 'povinne' ? '<small class="product-note">Povinné pro první ročník</small>' : ''}
        </div></article>`;
    }).join('')}</div>`;
  }

  function renderInventory() {
    $('drawer-overline').textContent = 'Výbava studenta';
    $('drawer-title').textContent = 'Kouzelný batoh';
    const owned = items.filter((item) => Number(state.inventory[item.id]) > 0);
    const emptyCount = Math.max(0,8-owned.length);
    $('drawer-content').innerHTML = `<div class="bag-wallet"><span class="galleon-symbol">G</span><strong>${state.balance.toLocaleString('cs-CZ')} galeonů</strong><small>Školní peníze</small></div>
      <p class="bag-description">Tady zůstávají kouzelné kejkle, lektvarové přísady, společenské hábity, košťata a další použitelné věci. Povinné školní vybavení je pouze označeno na seznamu.</p>
      <p class="bag-usage">V brašně: ${owned.length} druhů předmětů</p>
      <div class="bag-items">${owned.map((item) => `<article class="bag-item"><img src="${escapeHtml(item.obrazek)}" alt="">
        <strong>${escapeHtml(item.nazev)}</strong><small>${escapeHtml(data.katalog.obchody[item.obchod] || item.obchod)}</small>
        <b class="bag-quantity">${itemQuantity(item)} ks</b></article>`).join('')}
        ${Array.from({length:emptyCount},()=>'<div class="bag-item bag-empty" aria-label="Volné místo">✧</div>').join('')}</div>
      <p class="bag-hint">Zatím se nákupy a galeony uchovávají v tomto prohlížeči. Po propojení s Bradavicemi se budou používat i v hlavní hře.</p>
      <button type="button" class="small-button" data-action="reset">Vrátit se na začátek ulice</button>`;
  }

  function renderChecklist() {
    $('drawer-overline').textContent = 'Dopis z Bradavic';
    $('drawer-title').textContent = 'Seznam pro první ročník';
    const requiredItems = items.filter((item) => item.povinnost === 'povinne');
    const wandDone = categoryOwned('hulka');
    const doneCount = requiredItems.filter(isOwned).length + Number(wandDone);
    const totalCount = requiredItems.length + 1;
    const groups = [
      ['Hůlka', [{nazev: 'Jedna kouzelnická hůlka', done: wandDone}]],
      ['Školní oděv', requiredItems.filter((item) => item.kategorie === 'odev').map((item) => ({nazev:item.nazev, done:isOwned(item)}))],
      ['Osm předepsaných knih', requiredItems.filter((item) => item.kategorie === 'ucebnice').map((item) => ({nazev:item.nazev, done:isOwned(item)}))],
      ['Další vybavení', requiredItems.filter((item) => item.kategorie === 'vybaveni').map((item) => ({nazev:item.nazev, done:isOwned(item)}))]
    ];
    $('drawer-content').innerHTML = `<article class="school-parchment">
      <img class="letter-crest" src="assets/bradavice-erb.webp" alt="Erb Bradavic">
      <p class="letter-school">BRADAVICKÁ ŠKOLA ČAR A KOUZEL</p>
      <h2>Seznam potřeb</h2>
      <p class="letter-year">pro první ročník</p>
      <div class="letter-message">Vážený studente, vážená studentko, před nástupem do školy je třeba obstarat následující pomůcky.</div>
      <div class="check-progress">Připraveno <strong>${doneCount} z ${totalCount}</strong> povinných položek. ${doneCount === totalCount ? 'Výbava je kompletní.' : 'Chybějící věci je potřeba dokoupit.'}</div>
      ${groups.map(([title, rows]) => `<section class="check-section"><h3 class="drawer-section-title">${escapeHtml(title)}</h3>${rows.map((row) => `<div class="check-item ${row.done ? 'is-done' : ''}"><span class="check-symbol">${row.done ? '✓' : '□'}</span><span>${escapeHtml(row.nazev)}</span></div>`).join('')}</section>`).join('')}
      <p class="letter-note">Studentům je povolena jedna sova, kočka nebo ropucha. Studenti prvního ročníku si nesmějí přivést vlastní koště do školy.</p>
      <p class="letter-note">Povinná školní výbava stojí 405 galeonů. Nezapomeň si také vybrat školního mazlíčka.</p>
      <p class="letter-signature">S přáním úspěšného školního roku<br>Vedení Bradavic</p>
    </article>`;
  }

  function renderBrickPuzzle() {
    const active = state.current === 'kotel_cihly';
    const puzzle = $('brick-puzzle');
    puzzle.hidden = !active || state.brickOpened;
    $('courtyard-portal').hidden = !active || !state.brickOpened;
    if (!active || state.brickOpened) return;
    puzzle.innerHTML = `<p class="brick-instructions">Začni u cihly označené <b>zlatou hvězdou ✦</b> ve spodní části zdi. Od ní počítej <b>tři cihly nahoru a dvě doprava</b>. Na nalezenou cihlu třikrát klepni.<strong>Poklepání ${brickTaps} / 3</strong></p>
      <div class="brick-grid" role="group" aria-label="Cihly u kouzelného průchodu">
      ${Array.from({length:42},(_,i) => {
        const row = Math.floor(i / 7), col = i % 7;
        return `<button type="button" data-brick="${col}-${row}" class="brick ${col === 2 && row === 5 ? 'brick-start' : ''} ${col === 4 && row === 2 && brickTaps ? 'brick-active' : ''}" aria-label="${col === 2 && row === 5 ? 'Výchozí cihla se zlatou hvězdou' : `Cihla, sloupec ${col+1}, řada ${row+1}`}"></button>`;
      }).join('')}</div>`;
  }

  function tapBrick(position) {
    if (state.current !== 'kotel_cihly' || state.brickOpened) return;
    if (position !== '4-2') {
      brickTaps = 0;
      renderBrickPuzzle();
      toast('Ozvalo se duté klepnutí, ale nic se nestalo. Zkus jinou cihlu.');
      return;
    }
    brickTaps++;
    playNotes([420 + brickTaps * 90],0.11);
    if (brickTaps < 3) {
      renderBrickPuzzle();
      toast(`Klepnutí ${brickTaps} ze 3. Zeď jako by se zachvěla…`);
      return;
    }
    state.brickOpened = true;
    saveState();
    playNotes([392,523,659,784,1046],0.14);
    toast('Cihly se rozestoupily! Před tebou se otevírá Příčná ulice.');
    navigate('kotel_pruchod');
  }

  function closeDialogue() {
    activeDialogue = null;
    $('dialogue-box').hidden = true;
    $('dialogue-box').innerHTML = '';
  }

  function showPetNaming() {
    const pet = state.profile.pet && itemMap.get(state.profile.pet.id);
    if (!pet) return;
    closeDrawer();
    closeWandGame();
    activeDialogue = {mode:'pet-naming',npc:characters.zverinec[0],index:0,scene:state.current};
    $('dialogue-box').hidden = false;
    $('dialogue-box').innerHTML = `<div class="dialogue-head"><img src="postavy/pani_tvoreckova_zverinec.webp" alt=""><strong>Jméno pro tvého mazlíčka</strong>
      <button type="button" class="dialogue-x" data-talk="close" aria-label="Zavřít">×</button></div>
      <p class="dialogue-speech">„Taková krásná ${escapeHtml(pet.nazev.toLowerCase())}! A jak jí budeme říkat? Jméno jí zůstane i v tvém studentském profilu.“</p>
      <label class="dialogue-label" for="pet-name">Jméno mazlíčka</label>
      <input id="pet-name" class="dialogue-field" maxlength="35" autocomplete="off" placeholder="Například Hedvika" value="${escapeHtml(state.profile.pet.name || '')}">
      <div class="dialogue-choices"><button type="button" class="dialogue-choice main" data-talk="pet-name-save">Uložit jméno</button>
      <button type="button" class="dialogue-choice quiet" data-talk="close">Pojmenuji ho později</button></div>`;
    $('pet-name')?.focus();
  }

  function greetingFor(npc) {
    if (npc.name === 'Hostinský Tom') {
      const title = state.profile.gender === 'studentka' ? 'mladá studentko' : state.profile.gender === 'student' ? 'mladý studente' : 'vítaná návštěvo';
      return `Vítám tě v Děravém kotli, ${state.profile.name ? escapeHtml(state.profile.name) : title}! Hagrid už tě čeká na dvorku.`;
    }
    if (npc.name === 'Rubeus Hagrid' && (state.brickOpened || state.grantClaimed))
      return `Vida, ${escapeHtml(state.profile.name || 'prváku')}! Tak co, jak nám jdou ty nákupy?`;
    return npc.lines[0];
  }

  function startNpcDialogue(index) {
    const npc = visibleCharacters(state.current)[index];
    if (!npc) return;
    closeWandGame();
    activeDialogue = {npc,index:0,scene:state.current};
    renderDialogue();
  }

  function showHagridFarewell() {
    activeDialogue = null;
    $('dialogue-box').hidden = false;
    $('dialogue-box').innerHTML = `<div class="dialogue-head"><img src="postavy/hagrid.webp" alt=""><strong>Rubeus Hagrid</strong>
      <button type="button" class="dialogue-x" data-talk="close" aria-label="Ukončit rozhovor">×</button></div>
      <p class="dialogue-speech">„No vida! Tak už víš, kudy se chodí do Příčný ulice. Běž si ji pořádně prohlídnout, já mám ještě nějakou prácičku pro Bradavice. Sejdem se zase v lokále U Děravýho kotle, až budeš mít nakoupeno!“</p>
      <div class="dialogue-choices"><button type="button" class="dialogue-choice main" data-talk="close">Vydat se do Příčné ulice →</button></div>`;
  }

  function renderDialogue() {
    if (!activeDialogue) return;
    const {npc,index} = activeDialogue;
    const line = index === 0 ? greetingFor(npc) : npc.lines[index];
    const next = index < npc.lines.length - 1;
    const choices = next ? '<button type="button" class="dialogue-choice main" data-talk="next">Pokračovat →</button>' :
      (npc.options || []).map((action) => {
        const labels = {profil:'Představit se',dvorek:'Jít na dvorek',cihly:'Podívat se na zeď',list:'Ukázat školní seznam',
          inventory:'Otevřít brašnu','hagrid-check':'Už mám nakoupeno',wand:'Vyzkoušet hůlky',shop:'Prohlédnout zboží',
          bank:'Nastoupit do vozíku', 'call-griphook':'Promluvit si s Griphookem',trezor:'K trezoru 713','open-vault':'Odemknout trezor',grant:'Vyzvednout příspěvek'};
        return `<button type="button" class="dialogue-choice" data-talk="${action}">${escapeHtml(labels[action]||action)}</button>`;
      }).join('');
    const profileEntry = !next && npc.name === 'Hostinský Tom' && !state.profile.name
      ? '<p class="dialogue-hint">Jak ti máme v Bradavicích říkat?</p>' : '';
    $('dialogue-box').hidden = false;
    $('dialogue-box').innerHTML = `<div class="dialogue-head"><img src="postavy/${escapeHtml(npc.imageName)}" alt=""><strong>${escapeHtml(npc.name)}</strong>
      <button type="button" class="dialogue-x" data-talk="close" aria-label="Ukončit rozhovor">×</button></div>
      <p class="dialogue-speech">„${line}“</p>${profileEntry}
      <div class="dialogue-choices">${choices}<button type="button" class="dialogue-choice quiet" data-talk="close">Rozloučit se</button></div>`;
  }

  async function handleDialogueAction(action) {
    if (action === 'close') { closeDialogue(); return; }
    if (!activeDialogue) return;
    if (action === 'pet-name-save' && activeDialogue.mode === 'pet-naming') {
      const name = $('pet-name')?.value?.trim().replace(/[<>]/g,'').slice(0,35);
      if (!name) { toast('Nejdřív vyber jméno pro svého mazlíčka.'); return; }
      const result=await serverChange(()=>shopDB.setPetName(name));
      if(!result)return;
      closeDialogue();
      toast(`Tvůj mazlíček se teď jmenuje ${name}. Jméno je uložené do profilu.`);
      return;
    }
    if (action === 'next') { activeDialogue.index = Math.min(activeDialogue.index+1,activeDialogue.npc.lines.length-1); renderDialogue(); return; }
    if (action === 'profil') {
      const npc = activeDialogue.npc;
      $('dialogue-box').innerHTML = `<div class="dialogue-head"><img src="postavy/${escapeHtml(npc.imageName)}" alt=""><strong>Kdo přichází do Bradavic?</strong></div>
        <label class="dialogue-label" for="student-name">Tvoje jméno</label><input id="student-name" class="dialogue-field" maxlength="40" autocomplete="off" placeholder="Jméno studenta" value="${escapeHtml(state.profile.name)}">
        <label class="dialogue-label" for="student-gender">Oslovení</label><select id="student-gender" class="dialogue-field">
        <option value="student" ${state.profile.gender==='student'?'selected':''}>Student</option><option value="studentka" ${state.profile.gender==='studentka'?'selected':''}>Studentka</option></select>
        <div class="dialogue-choices"><button type="button" class="dialogue-choice main" data-talk="profile-save">Uložit a představit se</button><button type="button" class="dialogue-choice quiet" data-talk="close">Zavřít</button></div>`;
      $('student-name').focus(); return;
    }
    if (action === 'profile-save') {
      const name = $('student-name')?.value?.trim().replace(/[<>]/g,'').slice(0,40);
      if (!name) { toast('Napiš prosím své jméno.'); return; }
      state.profile = {...state.profile,name,gender:$('student-gender').value};
      saveState();
      closeDialogue();
      toast(`Vítej, ${name}! Hagrid tě čeká za hostincem.`);
      return;
    }
    if (action === 'call-griphook') { closeDialogue(); startNpcDialogue(1); return; }
    if (action === 'hagrid-check') { showHagridCheck(); return; }
    if (action === 'school-depart') {
      const result=await serverChange(()=>shopDB.setProgress(state.current,true));
      if(!result)return;
      $('dialogue-box').innerHTML = `<div class="dialogue-head"><strong>✦ Cesta do Bradavic ✦</strong><button type="button" class="dialogue-x" data-talk="close" aria-label="Zavřít">×</button></div>
        <p class="dialogue-speech">„Výborně, ${escapeHtml(state.profile.name || 'prváku')}! Všechno máš. Tak se drž, na nástupišti devět a tři čtvrtě na nás čeká Bradavický expres. A pak tě ve škole čeká rozřazování!“</p>
        <p class="dialogue-hint">Nákupy jsou hotové. Můžeš pokračovat do hlavní hry a později se sem vrátit.</p>
        <div class="dialogue-choices"><a class="dialogue-choice main" href="https://majda171.github.io/skola-car-a-kouzel/rozrazeni.html">Pokračovat do Bradavic →</a><button type="button" class="dialogue-choice quiet" data-talk="close">Ještě se porozhlédnout</button></div>`;
      return;
    }
    closeDialogue();
    if (action === 'shop') openDrawer('shop');
    else if (action === 'wand') openWandGame();
    else if (action === 'inventory') openDrawer('inventory');
    else if (action === 'list') openDrawer('list');
    else if (action === 'cihly') navigate('kotel_cihly');
    else if (action === 'dvorek') navigate('kotel_dvorek');
    else if (action === 'bank') navigate('gringott_koleje');
    else if (action === 'trezor') navigate('gringott_713_dvere');
    else if (action === 'open-vault') navigate('gringott_713_vnitr');
    else if (action === 'grant') claimGrant();
  }

  function showHagridCheck() {
    closeDialogue();
    const hagrid = characters.kotel_dvorek[0];
    const missing = items.filter((item) => item.povinnost === 'povinne' && !isOwned(item));
    if (!categoryOwned('hulka')) missing.unshift({nazev:'jedna kouzelnická hůlka'});
    activeDialogue = {npc:hagrid,index:0,scene:state.current};
    const message = !state.grantClaimed ? 'No ne! Nejdřív se vydej do Gringottů pro pět set galeonů. Bez peněz ti žádnej obchod nic neprodá.' :
      missing.length ? `Koukám na tvůj školní seznam, a pořád ti toho dost chybí! Hlavně ${missing.slice(0,3).map(i=>i.nazev.toLowerCase()).join(', ')}${missing.length>3 ? ' a další věci' : ''}. Mrkni na seznam a vrať se, až to budeš mít.` :
      'No paráda! Všechno ze seznamu máš. Bradavice budou mít radost! Jestli chceš, můžeme vyrazit na nástupiště devět a tři čtvrtě.';
    $('dialogue-box').hidden = false;
    $('dialogue-box').innerHTML = `<div class="dialogue-head"><img src="postavy/hagrid.webp" alt=""><strong>Rubeus Hagrid</strong>
      <button type="button" class="dialogue-x" data-talk="close" aria-label="Zavřít">×</button></div>
      <p class="dialogue-speech">„${escapeHtml(message)}“</p><div class="dialogue-choices">
      <button type="button" class="dialogue-choice" data-talk="list">Zkontrolovat seznam</button>
      ${equipmentReady() ? '<button type="button" class="dialogue-choice main" data-talk="school-depart">Vyrazit do Bradavic</button>' : ''}
      <button type="button" class="dialogue-choice quiet" data-talk="close">Rozloučit se</button></div>`;
  }

  // Poklepání na cihlovou zeď používá tento původní zvukový doprovod.
  // Funkce musí zůstat dostupná i po výměně efektů Ollivanderových hůlek.
  function playNotes(frequencies, step=.13, type='sine') {
    try {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioClass) return;
      const context = playNotes.context || (playNotes.context = new AudioClass());
      if (context.state === 'suspended') context.resume();
      frequencies.forEach((freq,i) => {
        const osc=context.createOscillator(),gain=context.createGain();
        const t=context.currentTime+i*step;
        osc.type=type;osc.frequency.setValueAtTime(freq,t);
        gain.gain.setValueAtTime(.0001,t);
        gain.gain.exponentialRampToValueAtTime(.095,t+.03);
        gain.gain.exponentialRampToValueAtTime(.0001,t+step*2);
        osc.connect(gain);gain.connect(context.destination);
        osc.start(t);osc.stop(t+step*2+.01);
      });
    } catch { /* Zvuk není nezbytný pro hratelnost. */ }
  }

  // Každá hůlka reaguje vlastním kouzlem. Zvuky jsou vytvořené v prohlížeči,
  // takže nepotřebují externí soubory, a lze je nezávisle vypnout.
  function playWandSound(effect) {
    if (!wandSoundsOn) return;
    try {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioClass) return;
      const context = playWandSound.context || (playWandSound.context = new AudioClass());
      if (context.state === 'suspended') context.resume();
      const start = context.currentTime + .018;
      const tone = (frequency, endFrequency, delay, duration, volume=.09, type='sine') => {
        const osc=context.createOscillator(),gain=context.createGain(),t=start+delay;
        osc.type=type;
        osc.frequency.setValueAtTime(frequency,t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40,endFrequency),t+duration);
        gain.gain.setValueAtTime(.0001,t);
        gain.gain.exponentialRampToValueAtTime(volume,t+.018);
        gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
        osc.connect(gain);gain.connect(context.destination);
        osc.start(t);osc.stop(t+duration+.02);
      };
      const noise = (delay,duration,frequency,volume=.09,sweep=.45) => {
        const count=Math.ceil(context.sampleRate*(duration+.015));
        const buffer=context.createBuffer(1,count,context.sampleRate);
        const data=buffer.getChannelData(0);
        for(let i=0;i<count;i++) data[i]=(Math.random()*2-1)*(.7+.3*Math.sin(i*.012));
        const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
        const t=start+delay;
        source.buffer=buffer;
        filter.type='bandpass';filter.Q.value=.65;
        filter.frequency.setValueAtTime(frequency,t);
        filter.frequency.exponentialRampToValueAtTime(Math.max(90,frequency*sweep),t+duration);
        gain.gain.setValueAtTime(.0001,t);
        gain.gain.exponentialRampToValueAtTime(volume,t+Math.min(.07,duration*.2));
        gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
        source.connect(filter);filter.connect(gain);gain.connect(context.destination);
        source.start(t);source.stop(t+duration+.01);
      };
      if (effect === 'papers') {
        noise(0,1.25,1300,.18,.35);
        [0,.21,.43,.67,.91].forEach((t,i)=>noise(t,.14,900+i*270,.043,.55));
        tone(440,240,.09,.62,.033,'triangle');
      } else if (effect === 'sparks') {
        tone(1080,230,0,.48,.09,'sawtooth');
        [0,.08,.17,.28,.39,.53,.67].forEach((t,i)=>{
          noise(t,.09,2200+i*170,.062,.48);
          tone(1200-i*105,540-i*45,t,.11,.027,'square');
        });
      } else if (effect === 'boxes') {
        noise(0,.55,550,.06,.3);
        [.26,.51,.77,1.03].forEach((t,i)=>{
          tone(166-i*18,65,t,.2,.14,'triangle');
          noise(t,.14,520-i*75,.095,.4);
        });
      } else {
        noise(0,1.6,2100,.045,1.55);
        [523.25,659.25,783.99,1046.5,1318.5,1567.98].forEach((freq,i)=>{
          tone(freq,freq*.995,i*.19,1.25,.083,'sine');
          tone(freq*2,freq*1.98,i*.19,.7,.023,'sine');
        });
      }
    } catch { /* Nezbytné herní akce fungují i bez zvukové podpory. */ }
  }

  function wandParticles(effect) {
    if (effect === 'papers') return Array.from({length:14},(_,i)=>
      `<span class="wand-paper" style="--i:${i};--sx:${18+(i*31)%66}%;--dx:${(i%2?1:-1)*(75+(i*37)%240)}px;--dy:${-50-(i*23)%190}px;--rot:${(i%2?1:-1)*(310+i*35)}deg"></span>`).join('');
    if (effect === 'sparks') return Array.from({length:38},(_,i)=>{
      const angle=i*2.39996, radius=48+(i*17)%250;
      return `<span class="wand-spark" style="--i:${i};--dx:${Math.cos(angle)*radius|0}px;--dy:${Math.sin(angle)*radius|0}px;--turn:${(i%2?1:-1)*75}deg"></span>`;
    }).join('');
    if (effect === 'boxes') return Array.from({length:8},(_,i)=>
      `<span class="wand-box" style="--i:${i};--sx:${12+(i*31)%77}%;--fall:${110+(i*27)%110}px;--slide:${(i%2?1:-1)*(35+i*13)}px;--rot:${(i%2?1:-1)*(95+i*37)}deg"></span>`).join('');
    // Správná hůlka: pomalé filmové světlo, jemný zvířený prach a několik světelných paprsků.
    // Žádný výbuch hvězdiček; záře se postupně soustředí přímo kolem hůlky.
    const motes = Array.from({length:58},(_,i) =>
      `<span class="wand-mote" style="--i:${i};--x:${18+(i*43)%77}%;--y:${32+(i*29)%42}%;--dx:${(i*71)%165-82}px;--dy:${-35-(i*31)%140}px;--size:${2+i%4}px"></span>`).join('');
    const rays = Array.from({length:11},(_,i) =>
      `<span class="wand-ray" style="--i:${i};--angle:${-120+i*24}deg;--length:${55+(i*17)%80}px"></span>`).join('');
    return `${motes}${rays}<span class="wand-light-arc wand-light-arc-one"></span><span class="wand-light-arc wand-light-arc-two"></span>`;
  }

  function closeWandGame() {
    if (wandEffectTimer) clearTimeout(wandEffectTimer);
    wandEffectTimer = null;
    wandSession = null;
    $('wand-game').hidden = true;
    $('wand-scrim').hidden = true;
    document.body.style.overflow = currentDrawer ? 'hidden' : '';
    $('wand-effects').innerHTML = '';
    $('wand-stage').className = 'wand-stage';
    $('wand-effect-caption').textContent='';
  }

  function openWandGame() {
    closeDialogue();closeDrawer();
    if (categoryOwned('hulka')) { toast('Ollivander: „Tvá hůlka už si tě vybrala. Dobře se o ni starej!“'); return; }
    if (state.balance < 35) { toast('Ollivander: „Nejprve prosím navštiv Gringottovy. Hůlka stojí 35 galeonů.“'); return; }
    const wands = items.filter((item) => item.kategorie === 'hulka');
    if (!state.chosenWandId) {
      state.chosenWandId = wands[Math.floor(Math.random()*wands.length)].id;
      saveState();
    }
    const pool = wands.filter((item) => item.id !== state.chosenWandId);
    for (let i=pool.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]; }
    wandSession = {attempts:[...pool.slice(0,3),itemMap.get(state.chosenWandId)],index:0,phase:'ready'};
    $('wand-game').hidden = false;$('wand-scrim').hidden = false;
    document.body.style.overflow = 'hidden';
    $('wand-sound-toggle').textContent = wandSoundsOn ? '♪ Zvuky kouzel: zapnuté' : '♪ Zvuky kouzel: vypnuté';
    $('wand-sound-toggle').setAttribute('aria-pressed',String(wandSoundsOn));
    renderWandGame();
  }

  function renderWandGame() {
    if (!wandSession) return;
    const {index,attempts,phase} = wandSession;
    const wand = attempts[index];
    $('wand-current-image').src = wand.obrazek;
    $('wand-current-image').alt = wand.nazev;
    $('wand-item-name').textContent = wand.nazev;
    $('wand-item-details').textContent = `${wand.delka_cm} cm · jádro: ${wand.jadro}`;
    $('wand-item-character').textContent = wand.vlastnost || '';
    $('wand-progress').textContent = phase === 'success'
      ? `Hůlka si tě vybrala · cena ${wand.cena} galeonů`
      : `Zkouška ${index+1} ze ${attempts.length} · hůlka si teprve vybírá`;
    if (phase === 'ready') {
      $('wand-stage').className='wand-stage';$('wand-effects').innerHTML='';
      $('wand-effect-caption').textContent='';
      $('wand-ollivander-quote').textContent = index === 0
        ? `Tak tedy, ${state.profile.name || 'mladý kouzelníku'}… ${wand.nazev.toLowerCase()}, ${wand.delka_cm} centimetru. Jádro tvoří ${wand.jadro}. Jen ji vezmi do ruky. A teď… mávni s ní!`
        : `Zkusíme něco jiného. ${wand.nazev}, ${wand.delka_cm} centimetru, jádro ${wand.jadro}. Dobrá, zkus s ní mávnout.`;
      $('wand-controls').innerHTML='<button type="button" class="primary-action" data-wand="wave">✦ Mávni hůlkou</button>';
    } else if (phase === 'wrong') {
      const responses = [
        'Ale ne! Všechny pergameny mi létají po obchodě! Ne, ne, tuhle určitě ne.',
        'Ach, ty rudé jiskry! Ta má příliš prudkou povahu. Tuhle také ne.',
        'Pozor na ty krabičky! Už zase padají z polic… Ne, tato také není tvá.'
      ];
      $('wand-ollivander-quote').textContent=responses[index];
      $('wand-controls').innerHTML='<button type="button" class="primary-action" data-wand="next">Ollivander přinese další hůlku →</button>';
    } else if (phase === 'success') {
      $('wand-effect-caption').textContent='✦ Tahle hůlka si tě vybrala ✦';
      $('wand-ollivander-quote').textContent='No výborně! Tahle je ta správná! Tušil jsem to od samého začátku. Jen nezapomeň: hůlka si vybírá svého kouzelníka. A myslím, že od tebe můžeme očekávat velké věci…';
      $('wand-controls').innerHTML=`<button type="button" class="primary-action" data-wand="accept">Koupit svou vyvolenou hůlku · ${wand.cena} galeonů</button>`;
    }
  }

  function waveWand() {
    if (!wandSession || wandSession.phase !== 'ready') return;
    const session=wandSession;
    const correct=session.index===session.attempts.length-1;
    const effects=['papers','sparks','boxes','golden'];
    const current=effects[session.index];
    $('wand-stage').className=`wand-stage effect-${current}`;
    $('wand-effects').innerHTML=wandParticles(current);
    const captions={papers:'Pergameny se rozvířily po celém obchodě!',sparks:'Z hůlky vyšlehly rudé jiskry!',boxes:'Krabičky padají z polic!',golden:'Jemné světlo prostupuje obchod…'};
    $('wand-effect-caption').textContent=captions[current];
    $('wand-ollivander-quote').textContent=correct ? 'Ach… ano. Cítíš to? Hůlka odpovídá právě tobě.' : 'Moment! Jen klid… podíváme se, co se stalo.';
    $('wand-controls').innerHTML='<button type="button" class="primary-action" disabled>✦ Kouzlo právě působí…</button>';
    session.phase='animating';
    playWandSound(current);
    wandEffectTimer=setTimeout(()=>{
      if (wandSession !== session) return;
      session.phase=correct?'success':'wrong';
      wandEffectTimer=null;
      renderWandGame();
    },correct?4050:1700);
  }

  async function handleWandAction(action) {
    if (!wandSession) return;
    if (action === 'wave') {waveWand();return;}
    if (action === 'next' && wandSession.phase === 'wrong') {
      wandSession.index++;
      wandSession.phase='ready';
      renderWandGame();return;
    }
    if (action === 'accept' && wandSession.phase === 'success') {
      const wand = wandSession.attempts[wandSession.index];
      if (!canBuy(wand)) {toast('Nákup už nelze dokončit. Zkontroluj galeony a inventář.');return;}
      const result=await serverChange(()=>shopDB.buy(wand.id));
      if(!result)return;
      closeWandGame();renderHud();
      toast(`Hůlka si tě vybrala: ${wand.nazev}. Přidána do školní výbavy (−${wand.cena} G).`);
    }
  }

  function resetDemo() {
    if (!confirm('Vrátit se na začátek Příčné ulice? Nakoupené věci a galeony zůstanou na studentském účtu.')) return;
    state.current='kotel_vchod';state.history=[];
    saveState();
    shopDB?.setProgress('kotel_vchod',null).catch(e=>console.warn(e));
    closeDrawer();
    renderScene();
    toast('Jsi zpátky v Děravém kotli. Nákupy zůstaly uložené.');
  }

  document.addEventListener('click', (event) => {
    const talk = event.target.closest('[data-talk]');
    if (talk) { handleDialogueAction(talk.dataset.talk); return; }
    const wand = event.target.closest('[data-wand]');
    if (wand) { handleWandAction(wand.dataset.wand); return; }
    const brick = event.target.closest('[data-brick]');
    if (brick) { tapBrick(brick.dataset.brick); return; }
    const buyButton = event.target.closest('[data-buy]');
    if (buyButton) { buyItem(buyButton.dataset.buy); return; }
    const moveButton = event.target.closest('[data-go]');
    if (moveButton) { navigate(moveButton.dataset.go); return; }
    const npcButton = event.target.closest('[data-npc]');
    if (npcButton) {
      startNpcDialogue(Number(npcButton.dataset.npc));
      return;
    }
    const npcAction = event.target.closest('[data-npc-open]');
    if (npcAction) { startNpcDialogue(Number(npcAction.dataset.npcOpen)); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'shop') openDrawer('shop');
    if (action === 'wand') openWandGame();
    if (action === 'hagrid-check') showHagridCheck();
    if (action === 'grant') claimGrant();
    if (action === 'pet-name') showPetNaming();
    if (action === 'reset') resetDemo();
    if (action === 'bank-intro' && state.current === 'gringott_hala') { closeDialogue(); startBankIntro(); }
  });

  $('bank-intro-skip').addEventListener('click', finishBankIntro);
  $('bank-intro-play').addEventListener('click', () => {
    const video = $('bank-intro-video');
    video.play().then(() => { $('bank-intro-play').hidden = true; }).catch(() => {
      toast('Video se nepodařilo přehrát. Můžeš úvod přeskočit.');
    });
  });
  $('bank-intro-video').addEventListener('ended', finishBankIntro);
  $('bank-intro-video').addEventListener('error', () => {
    if (bankIntroActive) {
      finishBankIntro();
      state.bankIntroSeenV10 = false;
      saveState();
      toast('Úvodní video se nepodařilo načíst. Při příští návštěvě to zkusíme znovu.');
    }
  });

  $('open-inventory').addEventListener('click', () => openDrawer('inventory'));
  $('open-list').addEventListener('click', () => openDrawer('list'));
  $('close-drawer').addEventListener('click', closeDrawer);
  $('close-wand').addEventListener('click', closeWandGame);
  $('wand-scrim').addEventListener('click', closeWandGame);
  $('wand-sound-toggle').addEventListener('click', () => {
    wandSoundsOn = !wandSoundsOn;
    $('wand-sound-toggle').textContent = wandSoundsOn ? '♪ Zvuky kouzel: zapnuté' : '♪ Zvuky kouzel: vypnuté';
    $('wand-sound-toggle').setAttribute('aria-pressed',String(wandSoundsOn));
  });
  $('drawer-scrim').addEventListener('click', closeDrawer);
  $('go-back').addEventListener('click', goBack);
  $('home-button').addEventListener('click', () => navigate('kotel_vchod'));
  $('fullscreen-button').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { toast('V tomto prohlížeči není celá obrazovka dostupná.'); }
  });
  $('toggle-music').addEventListener('click', async () => {
    const player=$('street-music'), button=$('toggle-music');
    if (!player.paused) { player.pause();button.setAttribute('aria-pressed','false');button.textContent='🔊 Hudba';return; }
    try { player.volume=.28;await player.play();button.setAttribute('aria-pressed','true');button.textContent='🔇 Vypnout hudbu'; }
    catch { toast('Hudbu se nepodařilo spustit. Zkus to znovu.'); }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (bankIntroActive) { finishBankIntro(); return; }
      closeWandGame();closeDialogue();closeDrawer();
    }
  });
  renderScene();
  (async()=>{
    const hadLocalPurchases=state.grantClaimed || Object.keys(state.inventory).length>0 || Object.keys(state.schoolPurchases).length>0;
    const snapshot=await shopDB?.ready;
    if(snapshot){
      const serverEmpty=!snapshot.grantClaimed && !Object.keys(snapshot.purchases||{}).length;
      applyServerState(snapshot,true);
      if(serverEmpty && hadLocalPurchases)toast('Pozor: starší místní zkušební nákupy nejsou ještě převedené do Supabase.');
    } else toast('Supabase není připravené. Pro nákupy je nutné spustit databázovou migraci.');
  })();
  // Při návratu do rozehrané hry už hráč může být přímo v hale.
  // Úvod proto nabídneme i po načtení uložené pozice, nejen po kliknutí na vstup.
  if (state.current === 'gringott_hala' && !state.bankIntroSeenV10) startBankIntro();
})();

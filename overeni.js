/* Jednoduchá kontrola hry bez připojení k internetu: node overeni.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = __dirname;
const context = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), context);
const data = context.window.BRADAVICE_DATA;
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'katalog_obchodu.json'), 'utf8'));
const navigation = JSON.parse(fs.readFileSync(path.join(root, 'navigace_lokaci.json'), 'utf8'));
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style-bradavice.css'), 'utf8');

const scenes = [...data.navigace.lokace, ...data.navigace.ostatni_interiery];
const allScenes = new Set(scenes.map(scene => scene.id));
assert.equal(scenes.length, allScenes.size, 'Scény musí mít jedinečné názvy.');
assert.equal(allScenes.has('zerty'), false, 'Dvojitý obchod dvojčat nesmí zůstat ve hře.');
assert.equal(allScenes.has('weasleyovi'), true);
assert.equal(data.navigace.lokace.find(scene => scene.id === 'ulice_3').prechody.includes('zerty'), false);
assert.equal(data.katalog.predmety.length, 75);
assert.equal(data.katalog.predmety.length, catalog.predmety.length);
assert.equal(data.katalog.pocatecni_prispevek_od_bradavic, 500);
assert.equal(data.katalog.rozpocet.povinne_vybaveni_celkem, 405);
assert.equal(data.katalog.predmety.filter(item => item.kategorie === 'hulka').length, 11);
assert.equal(data.katalog.predmety.filter(item => item.kategorie === 'koste').length, 3);
assert.equal(data.katalog.predmety.filter(item => item.obchod === 'kratochvilne_kejkle').length, 10);
const formalRobes = data.katalog.predmety.filter(item => item.obchod === 'twilfitt_a_tatting');
assert.equal(formalRobes.length, 13, 'Krejčovství musí nabízet třináct společenských hábitů.');
assert.equal(formalRobes.filter(item => item.pohlavi === 'divci').length, 7);
assert.equal(formalRobes.filter(item => item.pohlavi === 'chlapecky').length, 6);
assert(formalRobes.every(item => item.kategorie === 'spolecensky_habit' && item.povinnost === 'volitelne'));
assert.equal(formalRobes.find(item => item.id === 'spol_chlap_staromodni').cena, Math.min(...formalRobes.map(item => item.cena)));
assert.equal(formalRobes.find(item => item.id === 'spol_chlap_staromodni').cena, 40);
assert.equal(data.katalog.predmety.filter(item => item.kategorie === 'mazlicek').length, 9);

for (const scene of scenes) {
  assert(fs.existsSync(path.join(root, scene.obrazek)), `Chybí obrázek lokace: ${scene.id}`);
  for (const target of scene.prechody || []) assert(allScenes.has(target), `Neplatný přechod: ${scene.id} → ${target}`);
}
for (const scene of [...navigation.lokace, ...navigation.ostatni_interiery]) {
  assert(allScenes.has(scene.id), `Scéna chybí v data.js: ${scene.id}`);
}
for (const item of data.katalog.predmety) {
  assert(fs.existsSync(path.join(root, item.obrazek)), `Chybí obrázek zboží: ${item.id}`);
  assert(item.cena > 0 && item.cena < 500, `Neplatná cena: ${item.id}`);
  assert(data.katalog.obchody[item.obchod], `Neznámý obchod: ${item.obchod}`);
  const twin = catalog.predmety.find(other => other.id === item.id);
  assert(twin && twin.cena === item.cena, `Rozdílné údaje katalogů: ${item.id}`);
}
for (const file of [
  'postavy/hostinsky_tom.webp', 'postavy/hagrid.webp',
  'postavy/ollivander.webp', 'postavy/madam_malkinova.webp',
  'postavy/fred_weasley.webp', 'postavy/george_weasley.webp',
  'postavy/skret_bogrod.webp', 'postavy/skret_bogrod_v10.webp', 'postavy/skret_griphook.webp',
  'postavy/krejcova_twilfitt.webp', 'postavy/prodavac_wiseacre.webp',
  'postavy/prodavacka_pisarstvi.webp'
]) assert(fs.existsSync(path.join(root, file)), `Chybí postava: ${file}`);

assert(!app.includes('<span>${escapeHtml(npc.name)}</span>'), 'Nesmí se zobrazovat štítky pod postavami.');
assert(app.includes('npc.spriteHidden'), 'Griphook nesmí stát ve vzduchu nad tratí.');
assert(app.includes("famfrpal: 'famfrpalove_potreby'"), 'Famfrpálová prodejna musí být aktivní.');
assert(app.includes("stored.current === 'zerty'"), 'Uložená hra musí přejít ze staré prodejny na novou.');
assert(css.includes('flex:0 0 215px') && css.includes('object-fit:contain!important'), 'Zboží se musí zobrazovat celé.');
assert(fs.existsSync(path.join(root, 'banka/bogrod_uvod_v10.mp4')), 'Chybí uvítací video Gringottovy banky.');
assert(fs.existsSync(path.join(root, 'banka/bogrod_uvod_v10_poster.webp')), 'Chybí náhled videa.');
assert(fs.existsSync(path.join(root, 'SPUSTIT_HRU.html')), 'Chybí přímý spouštěč verze 10.');
assert(app.includes("character('skret_bogrod_v10.webp'"), 'Hra musí používat nového Bogroda.');
assert(app.includes("if (state.current === 'gringott_hala' && !state.bankIntroSeenV10) startBankIntro();"), 'Video se musí nabídnout i po znovunačtení rozehrané haly.');
assert(app.includes('Přehrát uvítání znovu'), 'V hale musí být možnost video opět přehrát.');
assert(app.includes('characterPlacements'), 'Pro každou scénu musí být samostatně určeno měřítko a pozice postav.');
assert(app.includes('Hagrid už je zpátky v hostinci'), 'Tom nesmí po návratu chybně tvrdit, že je Hagrid na dvorku.');
assert(app.includes('weasleyovi: [{x:35,height:70,floor:1},{x:73,height:70,floor:1}]'), 'Fred a George musí stát na opačných stranách obchodu.');
assert(app.includes("obrtla: [['borgin',31,53"), 'Vstup k Borginovi a Burkesovi musí být na dveřích vlevo.');
assert(app.includes("if (scene.id === 'obrtla')"), 'Duplicitní navigační odkaz do obchodu nesmí zůstat v Obrtlé ulici.');
assert(app.includes('ollivanderovi: [{x:72,height:62,floor:15}]'), 'Ollivander musí mít přiměřené měřítko za pultem.');
assert(app.includes("'spolecensky_habit'"), 'Společenské hábity musí být vedeny v batohu, odděleně od povinných věcí.');
for (const asset of ['kings-cross.html','assets/kings-cross-platform.webp','assets/kings-cross-arrival.mp4'])
  assert(fs.existsSync(path.join(root,asset)),`Chybí scéna nádraží: ${asset}`);

console.log(`V pořádku: ${scenes.length} lokací, ${data.katalog.predmety.length} položek, 3 košťata, 11 nových hůlek, nový Bogrod, české video a přechody.`);

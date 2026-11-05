// Mechanická synchronizace cen a nových mazlíčků do herních dat i SQL seed souboru.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const catalogPath=path.join(root,'katalog_obchodu.json');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const newPrices={
  spol_divci_hvezdna_noc:110,spol_divci_rubinovy:145,spol_divci_smaragdovy:125,
  spol_divci_ohniva:85,spol_divci_ledova:175,spol_divci_rokoko:75,
  spol_divci_streleny_mesic:95,spol_chlap_pulnocni:105,
  spol_chlap_zlaty:170,spol_chlap_staromodni:40,
  spol_chlap_lesni:115,spol_chlap_fialovy:135,spol_chlap_stribrny:125,
  koste_zametac_sedm:145,koste_kometa_260:230,koste_nimbus_2000:420
};
for(const item of catalog.predmety)if(item.id in newPrices)item.cena=newPrices[item.id];
fs.writeFileSync(catalogPath,JSON.stringify(catalog,null,2)+'\n');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),ctx);
const game=JSON.parse(JSON.stringify(ctx.window.BRADAVICE_DATA));
game.katalog.predmety=catalog.predmety;
fs.writeFileSync(path.join(root,'data.js'),'window.BRADAVICE_DATA = '+JSON.stringify(game,null,2)+';\n');
require('./generate-seed.cjs');
console.log('v17: ceny a nový zvěřinec synchronizovány.');

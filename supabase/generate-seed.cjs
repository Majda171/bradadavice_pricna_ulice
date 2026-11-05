// Mechanický převod herního katalogu na SQL. Při změně cen znovu vygeneruj 02_katalog.sql.
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../katalog_obchodu.json');
const sql = (v) => v == null ? 'null' : "'" + String(v).replace(/'/g, "''") + "'";
const shops = Object.entries(catalog.obchody);
const products = catalog.predmety;
const lines = [
  '-- Generováno z katalog_obchodu.json; spusť po 01_schema_a_funkce.sql.',
  '-- Upsert aktualizuje současný katalog bez mazání nákupů.',
  'insert into public.shops(id,title) values',
  shops.map(([id,name])=>`  (${sql(id)},${sql(name)})`).join(',\n') + ' on conflict(id) do update set title=excluded.title;',
  '',
  'insert into public.shop_products(id,shop_id,title,category,price,pack_quantity,is_unique,is_required,image_path,active) values',
  products.map((p)=>{
    const unique = p.povinnost==='povinne' || ['hulka','mazlicek','spolecensky_habit'].includes(p.kategorie);
    return `  (${sql(p.id)},${sql(p.obchod)},${sql(p.nazev)},${sql(p.kategorie)},${Number(p.cena)},${Number(p.mnozstvi)||1},${unique},${p.povinnost==='povinne'},${sql(p.obrazek)},true)`;
  }).join(',\n') + ` on conflict(id) do update set shop_id=excluded.shop_id,title=excluded.title,category=excluded.category,price=excluded.price,
     pack_quantity=excluded.pack_quantity,is_unique=excluded.is_unique,is_required=excluded.is_required,image_path=excluded.image_path,active=true;`,
  ''
];
fs.writeFileSync(path.join(__dirname,'02_katalog.sql'),lines.join('\n'));
console.log(`Seed: ${shops.length} obchodů, ${products.length} výrobků.`);

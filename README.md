# Příčná ulice v16 — samostatný GitHub Pages projekt

Příčná ulice je **samostatný repozitář**. Není vnořená do souborů Bradavic.

## Co je hotové

- 31 lokací; Děravý kotel, obchody, Obrtlá ulice i Gringottova banka.
- 69 druhů zboží včetně 11 samostatně vyobrazených kouzelnických hůlek a rozdílných společenských hábitů.
- Supabase: jeden studentský účet jako v Bradavicích, jednorázových 500 galeonů, nákupy a postup uložené do databáze.
- Kontrola zůstatku, cen a jedinečných nákupů na serveru. Dvojité kliknutí neudělí příspěvek znovu.
- Zpětná cesta **z Příčné ulice do Bradavic** používá existující adresu hlavního projektu.
- Odkazy **z Bradavic do Příčné ulice se zatím nepřidávají**. Až bude nový GitHub Pages odkaz zveřejněný, doplní se do hlavního projektu.

## Instalace do Supabase (nutná)

V projektu, který už používají Bradavice, otevři **SQL Editor → New query**:

1. Vlož celý obsah `supabase/01_schema_a_funkce.sql` a spusť **Run**.
2. Vlož obsah `supabase/02_katalog.sql` a spusť **Run**.

SQL vytvoří tabulky `shops`, `shop_products`, `student_wallets`, `shop_purchases`, `student_shop_progress`, `student_raddle_progress`, přístupová pravidla a databázové funkce pro bezpečné nákupy. Nespouštěj ho v cizím Supabase projektu. **Bez těchto dvou kroků nakupování nepoběží.**

> Důležité: zkušební nákupy dříve uložené jen do `localStorage` nejsou automaticky převedené do nové databáze. U účtů s důležitými staršími nákupy je nutné udělat kontrolovanou migraci — nechtěli jsme umožnit hráči libovolně si připsat galeony importem z prohlížeče.

## Nahrání na GitHub

1. Založ samostatný repozitář pro Příčnou ulici.
2. Do **kořene** repozitáře nahraj obsah tohoto balíčku: `index.html`, `app.js`, `data.js`, složky `assets/`, `banka/`, `interiery/`, `postavy/`, `ulice/`, `zbozi/`, `hudba/` a zbývající soubory.
3. V GitHubu zapni **Settings → Pages → Deploy from a branch → main / (root)**.
4. Přihlas se jako student do Bradavic, otevři veřejnou Příčnou ulici a vyzkoušej školní příspěvek a nákup.
5. Pošli adresu zveřejněné Příčné ulice; teprve pak přidáme vstupní odkazy do Bradavic.

Oba weby je nejlepší provozovat pod stejným účtem GitHub Pages (`majda171.github.io`) a používat **jeden Supabase projekt**. Soubor `supabase-config.js` obsahuje veřejný *publishable key*, nikoli tajný servisní klíč.

## Ověření

Lokální kontrolu katalogu a propojení spustíš `node overeni.js`. Skutečné načtení Supabase je možné ověřit až po spuštění SQL a nasazení na GitHub Pages. Samotné dvojkliknutí na `index.html` jako `file://` nestačí pro přihlášení a online nákupy.

## Tajemná komnata / Aragog

Tyto soubory patří do **hlavních Bradavic**, ne do tohoto samostatného repozitáře. V hlavní hře je připravená tajná lokace `aragogova-mytina.html` a `img/aragogova-mytina-v15.webp` s nenápadným průchodem v Zapovězeném lese. Databázové schéma výše obsahuje také `student_raddle_progress` a funkci `v16_advance_raddle_phase` pro pozdější serverové propojení tohoto úkolu.

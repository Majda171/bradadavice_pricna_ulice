# Příčná ulice v17 – nasazení

Tento ZIP patří do samostatného GitHub Pages repozitáře `majda171/bradadavice_pricna_ulice`.
Nekopíruj ho do složky hlavních Bradavic. Na GitHub nahraj **obsah** složky, aby `index.html`
byl v kořeni repozitáře. Nové `kings-cross.html` je součástí Příčné ulice.

## Supabase

Ve **stejném projektu Supabase**, který už používají Bradavice, spusť v SQL Editoru postupně:

1. `supabase/01_schema_a_funkce.sql` – nejprve vytvoří obchody a peněženky;
2. `supabase/02_katalog.sql` – všechny aktuální obchody, ceny, košťata a noví mazlíčci;
3. `supabase/03_nadrazi_poklady_a_sovi_posta.sql` – Kings Cross, nové poklady, inventář a doručování hnojůvek.

Soubory jsou připravené k opakovanému spuštění při aktualizaci katalogu bez mazání nákupů.
Třetí SQL očekává také původní bradavické tabulky `student_inventory` a
`v446_story_progress`. Pokud je Supabase projekt úplně nový, je nutné nejprve
vytvořit původní databázi hlavní hry.

Pokud se objeví `relation public.shops does not exist`, první SQL ještě nebylo
úspěšně dokončeno **v tomtéž projektu**, ve kterém spouštíš druhé SQL.

## Jak funguje vstup do školy

Sova a přijímací dopis se seznamem pomůcek → Příčná ulice a kontrola Hagrida →
King's Cross (kliknutí na vlak a video) → Moudrý klobouk v hlavní hře.

Po aktualizaci GitHub Pages obnov stránku pomocí Ctrl+Shift+R.


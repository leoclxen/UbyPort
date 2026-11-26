# Přehled změn (CHANGELOG)

Všechny významné změny projektu **UbyExport** jsou zaznamenávány v tomto souboru.
Číslo verze se řídí schématem `2.X.Y` (hlavní větev `2`, funkční novinky `X`, opravy `Y`) a čte se z jediného místa v `package.json`.

## [2.7.1] - 2026-11-26

### Opraveno
- Oprava GitHub Pages workflow (`deploy.yml`): oddělené `build` a `deploy` joby dle doporučení GitHubu, zakázání rušení rozběhlých nasazení (`cancel-in-progress: false`), deterministická instalace závislostí podle `bun.lock` (se záložním `npm install`) a kontrola typů před sestavením.
- Přidána automatická detekce režimu GitHub Pages (`GitHub Actions` vs větev `/docs`), zajištění `.nojekyll` v `dist/` a přenositelná resoluce cest ve `vite.config.ts`.

## [2.7.0] - 2026-11-25

### Přidáno
- Automatický GitHub Actions workflow pro vydávání verzí: po každé synchronizaci do hlavní větve se při změně verze v `package.json` automaticky vytvoří Git tag `v2.X.Y` a GitHub Release.
- Soubor `CHANGELOG.md` s historií změn, ze kterého si automatické vydání na GitHubu přebírá popis pro konkrétní verzi (včetně zálohy z historie commitů).
- Možnost kdykoliv přepnout na libovolnou starší verzi kódu v rozhraní GitHubu přes záložku **Tags** nebo stáhnout zdrojový archiv ze sekce **Releases**.

### Změněno
- Zvýšení verze aplikace na `2.7.0` (hlavní stránka zobrazuje `UbyExport 2.7`, záložka Nápověda `UbyExport 2.7.0`).
- Doplnění návodu pro práci se staršími verzemi na GitHubu do projektové dokumentace a vestavěné nápovědy.

## [2.6.1] - 2026-11-25

### Opraveno
- Sjednocení čtení verze z jediného zdroje pravdy (`package.json`) pro frontend, HTML titulek i server.
- Zavedeno jednotné zobrazení 2ciferné verze na hlavní stránce a 3ciferné verze v nápovědě.
- Odstraněny pozůstatky starší verze `2.0` a interní verze `3.1` napříč aplikací a dokumentací při zachování zpětné kompatibility pro vyhledání dříve vytvořeného Google Sheetu.

## [2.5.0] - 2026-11-24

### Přidáno
- Sjednocený systém pro Klíčenku (Apple Hesla / Face ID) a KeePass s čistým názvem účtu (`UbyExport Google API`) a volitelným druhým záznamem (`UbyExport Firebase`).
- Přepínač jediného aktivního napojení Google Sheetu (Veřejný odkaz / OAuth 2.0 / Firebase) a export/obnova nastavení přes **Poznámku bez hesel**.
- Ověřování existence jmen, příjmení a adres bydliště (vč. RÚIAN a OpenStreetMap) po vytěžení dokladu přes Gemini OCR.
- Oficiální 16polový export UNL (`A` + `U`) v kódování CP1250 s příponou `.unl` a blokující validací před stažením.

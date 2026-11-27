# UbyExport 2.10 (v2.10.0)

Webová aplikace pro evidenci ubytovaných cizinců, rychlé vytěžení ubytovacích lístků přes Gemini OCR a generování či kontrolu **UNL** souborů pro systém **UbyPort** Ředitelství služby cizinecké policie ČR.

---

## Pravidla verzování a historie na GitHubu

- Číslo verze se upravuje **pouze na jediném místě** – v poli `"version"` v souboru `package.json` (aktuálně `2.10.0`).
- **Schéma `2.X.Y`**:
  - První číslo `2` zůstává pevně zachováno.
  - Druhé číslo (`X`) se zvyšuje při přidání či změně funkcionality (např. `2.9` → `2.10`).
  - Třetí číslo (`Y`) se zvyšuje při opravách a úpravách (např. `2.7.1` → `2.7.2`).
- **Zobrazení v UI**:
  - Na hlavní stránce (hlavička a titulek) se zobrazuje vždy **2ciferná verze** (`UbyExport 2.10`).
  - V záložce **Nápověda / Info** se zobrazuje plná **3ciferná verze** (`UbyExport 2.10.0`).
- **Automatické Git tagy a GitHub Releases**:
  - Při synchronizaci (pushi) do hlavní větve GitHub Action automaticky zkontroluje verzi v `package.json`.
  - Pokud tag `v2.X.Y` ještě neexistuje, automaticky jej vytvoří, načte popis změn z `CHANGELOG.md` (případně z historie commitů) a publikuje **GitHub Release**.
  - **Prohlížení starších verzí**: V horním přepínači větví na GitHubu přepněte na záložku **Tags** a vyberte libovolnou verzi (např. `v2.6.1` nebo `v2.7.0`), nebo otevřete sekci **Releases** pro přehled změn a stažení zdrojového archivu.

---

## Hlavní funkce

- **Gemini OCR skener ubytovacích lístků**
  - Rozpoznání fotografií a naskenovaných formulářů (*REGISTRATION FORM*) bez ohledu na natočení snímku.
  - Automatický převod jmen a příjmení, zachování povolené diakritiky **CP1250**, mapování 3místných kódů států (ISO 3166-1 alpha-3) a 2ciferných účelů pobytu dle číselníku UbyPort.
- **Ověření existence jmen a adres po OCR**
  - Kontrola existence rozpoznaného křestního jména a příjmení (vč. detekce OCR překlepů z rukopisu a sémantické kontroly).
  - Kontrola a normalizace adresy trvalého bydliště (zahraniční adresy přes OpenStreetMap Nominatim, české adresy přes RÚIAN / PSČ a okresy).
- **Oficiální UNL export (Příloha č. 3 IA Ubyport)**
  - Struktura `1 soubor = 1 ubytování`: povinný 16polový záznam typu `A` následovaný 16polovými záznamy typu `U`.
  - Skutečné bajty kódování **Windows-1250 (CP1250)**, konce řádků `CRLF`, oddělovač `|`, bezpečný export s příponou **`.unl`**.
  - Automatické vyloučení občanů ČR (`CZE`) a blokující validace před stažením (IDUB, 5místná zkratka zařízení, číslo dokladu `6–30` znaků `[A-Z0-9]`, datum odjezdu po příjezdu).
- **Bezpečná práce s klíči (Apple Hesla / Face ID / KeePass)**
  - V repozitáři ani v `localStorage` / Google Sheetu nejsou uloženy žádné tajné API klíče ani tokeny – po načtení zůstávají pouze v operační paměti (**RAM**).
  - **1 čistý název účtu** v poli `username` (výchozí `UbyExport Google API`) pro plnou kompatibilitu s Klíčenkou na iPhonu, Macu i s KeePassem na PC.
  - Při použití Firebase s odděleným Web API klíčem podporuje aplikace **2. samostatný záznam** (`UbyExport Firebase`) s automatickým směrováním načteného hesla ke správnému poli; při sdíleném klíči stačí jediný záznam.
- **Sjednocené napojení Google Sheetu & Poznámka bez hesel**
  - Výběr jednoho aktivního režimu synchronizace: **Veřejný odkaz** (bez přihlášení), **Google OAuth 2.0 (GIS)**, nebo **Firebase**.
  - Export a obnova všech nešifrovaných nastavení (režim Sheetu, URL Sheetu, OAuth Client ID, Firebase Project ID, názvy účtů, zvolený OCR model) jedním blokem **Poznámky bez hesel**, který automaticky filtruje jakékoliv tajné klíče.

---

## Lokální vývoj

```bash
npm install
npm run dev
```

Vývojový server běží na portu `3000` (`tsx server.ts` + Vite middleware).

## Sestavení a nasazení (GitHub Pages)

```bash
npm run build
```

Příkaz sestaví produkční balíček do `dist/` a zrcadlí jej do `docs/`. Automatické nasazení zajišťuje workflow `.github/workflows/deploy.yml` (v repozitáři na GitHubu doporučujeme v **Settings → Pages → Source** zvolit **GitHub Actions**).

---

## Právní poznámka

Dle **§ 102 zákona č. 326/1999 Sb.** je ubytovatel povinen oznámit ubytování cizince cizinecké policii do **3 pracovních dnů** od ubytování. Občané ČR se přes systém UbyPort nehlásí.

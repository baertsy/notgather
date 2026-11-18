# NotGather – virtuális iroda

Kis csapatnak (kb. 10–15 fő) szóló, böngészőben futó 2D virtuális iroda.
Fut sima osztott tárhelyen (PHP + MySQL), nem kell hozzá npm, Node, build vagy külső szolgáltatás.

## Mit tud

- **Szobák a térképen.** Akik ugyanabban a szobában vannak, hallják egymást. Belépsz, és egyből hallod őket: nincs külön meeting, nincs csatlakozás gomb.
- **Csendes szobák** (pl. fókusz): ott senki nem hall senkit. A nyitott térben szintén csend van.
- **Kettes hívás** bárkivel, bárhonnan (kattints a kollégára → Hívás). Ilyenkor csak ketten hallják egymást.
- **Kamera és képernyőmegosztás** a szobán vagy a híváson belül. A képernyőmegosztás automatikusan nagyban jelenik meg.
- **Chat:** közös csatorna, szobánkénti csatorna és privát üzenetek, előzményekkel és olvasatlan-jelzéssel. Háttérben lévő fülön asztali értesítést küld.
- **Állapot:** Elérhető / Elfoglalt (szobában sem hallanak) / Távol.
- **Rajzolt avatarok** négy irányból, lépésanimációval. Állítható a bőrszín, a frizura, a hajszín, a felső, a nadrág és a kiegészítő (szemüveg, napszemüveg, fejhallgató, sapka).
- **Mozgás Gather-módra:** csak fel/le/jobbra/balra (nyilak vagy WASD). Kattintásra L alakú úton megy oda.
- **Bökés:** kattints egy kollégára → Bökés. Hangjelzést és értesítést kap, az avatarja megrázkódik. Akkor is eljut hozzá, ha nincs közvetlen kapcsolat.
- **Profil:** név, avatar, jelszócsere.
- **Térkép- és berendezésszerkesztő:** szobák (név, típus, szín, padló: parketta, szőnyegpadló, csempe, beton, fű) és közel 40 féle bútor: asztalok, székek, laptop, monitor, szekrények, polcok, kanapé, fotel, szőnyeg, konyha, növények, képek, falak, ajtók, ablakok, feliratok. Forgatás, átméretezés, színezés, másolás. Egy kattintással betölthető mintairoda.
- **Külön jogosultságok:** „térkép szerkesztése” és „felhasználók kezelése” külön adható.
- **Erős zajszűrés (RNNoise):** a mikrofon hangját a saját gépen szűri, mielőtt elküldené. Kikapcsolható, vagy választható helyette a böngésző alap szűrője.
- **Takarékos mód:** kikapcsolja az animációkat, kevesebb gépterheléssel (beállítások).
- Billentyűk: nyilak vagy WASD a mozgáshoz, **M** a némításhoz, **C** a chathez. A szerkesztőben: **R** forgatás, **Del** törlés, **⌘/Ctrl+D** másolás, nyilak finom mozgatás.

## Hogyan működik (és miért nem fagy)

- A hang és a kép **közvetlenül a gépek között** megy (WebRTC), a szerveren nem halad át.
- Mindenki mindenkivel egy állandó kapcsolatot tart. Hogy kinek megy hang, azt csak az dönti el, ki van egy szobában: a szobaváltás azonnali, és akinek nem szabad hallania, annak a gépére el sem jut a hang.
- A mozgás és a chat is a gépek közötti kapcsolaton megy, késés nélkül.
- A PHP-hoz csak kb. 3 másodpercenként megy egy rövid kérés fejenként (jelenlét, kapcsolatfelépítés, mentés). **Nincs PHP session és nincs long-polling**, a kérések soha nem várnak egymásra.
- Gépalvás, wifi-váltás vagy netkiesés után a kapcsolatok maguktól újraépülnek.

## Telepítés a tárhelyre

1. Hozz létre egy MySQL adatbázist és felhasználót a tárhely kezelőfelületén (cPanel → MySQL adatbázisok).
2. Töltsd fel a fájlokat a tárhelyre, például egy `iroda` mappába. **HTTPS kötelező**, mert a böngésző csak HTTPS-en engedi a mikrofont.
3. Az `api/config.sample.php` fájlt másold le `api/config.php` néven, és írd bele az adatbázis adatait.
4. Nyisd meg böngészőben: `https://domain.hu/iroda/install.php`. Ez létrehozza a táblákat, az alap térképet és az első admin felhasználót.
5. **Töröld az `install.php` fájlt** a tárhelyről.
6. Lépj be, és a Felhasználók menüben vedd fel a kollégákat. A térképszerkesztőben a „Mintairoda betöltése” gombbal egy kész, berendezett iroda tölthető be.

**Frissítés régebbi verzióról:** elég feltölteni az új fájlokat (az `api/config.php` maradjon). Az adatbázis első belépéskor magától frissül, a korábbi adminok mindkét jogot megkapják.

PHP 7.4 vagy újabb kell (PDO MySQL bővítménnyel), ez minden mai tárhelyen alap.

## Használat

- Ajánlott böngésző: **Chrome** (vagy Edge). Macen az első alkalommal engedélyezni kell a mikrofont: a böngésző rákérdez, és a Rendszerbeállítások › Adatvédelem és biztonság › Mikrofon menüben is engedélyezni kell a Chrome-ot. Képernyőmegosztáshoz ugyanitt a „Képernyőfelvétel” engedély kell.
- Tipp egész napos használathoz: Chrome-ban a ⋮ menü › „Mentés és megosztás” › „Parancsikon létrehozása…” › „Megnyitás ablakként”. Így az iroda saját ablakban fut, és nem vész el a fülek között.
- Fejhallgatóval a legjobb a hangminőség.

## Ha valakit nem hallasz

Ha egy kolléga avatarján sárga figyelmeztető jel van, vele nem jött létre közvetlen kapcsolat. Otthoni neteknél ez ritka. Mobilnetes hotspotnál, céges VPN-nél vagy szigorú routernél előfordulhat.

Megoldás: egy ingyenes TURN szerver (pl. a Metered.ca ingyenes kerete). A regisztráció után kapott adatokat az `api/config.php` `ice_servers` részébe kell beírni (a minta benne van, csak ki kell venni a megjegyzésből). Más teendő nincs.

## Fájlok

```
index.html              az alkalmazás
install.php             egyszeri telepítő (telepítés után törlendő)
api/index.php           az összes szerveroldali művelet
api/config.php          beállítások (ezt te hozod létre)
api/inc/                belső fájlok (böngészőből nem elérhetők)
assets/js/              kliens: app, rtc (WebRTC), map, editor, avatar, furniture, chat, ui, media, store, util
assets/vendor/rnnoise/  zajszűrő (MIT licenc, a forrás a SOURCE.txt-ben)
assets/css/app.css      megjelenés
```

Hibakereséshez a böngésző konzoljában elérhető a `__ng` objektum (pl. `__ng.pm.peers`, `__ng.S.users`).

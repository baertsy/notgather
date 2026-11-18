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
- **Profil:** név, szín, emoji az avataron, jelszócsere.
- **Térképszerkesztő (admin):** szobák létrehozása, mozgatása, átméretezése, átnevezése, színe és típusa, a térkép mérete.
- **Felhasználókezelés (admin):** felvétel, szerkesztés, jelszó visszaállítás, törlés.
- **Zajszűrés és visszhangszűrés:** a böngésző beépített szűrői, a beállításokban kapcsolhatók. Ott választható a mikrofon, a hangszóró és a kamera is.
- Billentyűk: nyilak vagy WASD a mozgáshoz (vagy kattints oda, ahová menni akarsz), **M** a némításhoz, **C** a chathez.

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
6. Lépj be, és az Admin → Felhasználók menüben vedd fel a kollégákat.

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
assets/js/              kliens: app, rtc (WebRTC), map, chat, ui, media, store, util
assets/css/app.css      megjelenés
```

Hibakereséshez a böngésző konzoljában elérhető a `__ng` objektum (pl. `__ng.pm.peers`, `__ng.S.users`).

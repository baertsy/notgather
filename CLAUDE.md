# NotGather – munkamenet-szabályok

- A tulajdonos kérése: **minden változás közvetlenül a `main` ágra megy** (nincs külön ág, nincs pull request). Az appot egyedül Claude fejleszti.
- Futtatási környezet: osztott tárhely (Rackforest), PHP 7.4+ és MySQL. **Nincs npm, nincs build lépés**: a kliens sima ES modulokból áll (`assets/js`), a külső könyvtárakat az `assets/vendor` mappába kell bemásolni.
- A felhasználók MacBookon, Chrome-ban használják. Az app nyelve magyar.
- Adatbázis-változás csak az `api/inc/bootstrap.php` `ng_migrate()` függvényében, új verziószámmal, mert a meglévő telepítések magától frissülnek.
- Helyi teszthez: MariaDB + `PHP_CLI_SERVER_WORKERS=32 php -S 127.0.0.1:8080`, Playwright kamu mikrofonnal és kamerával. A hibakereső objektum: `window.__ng`.

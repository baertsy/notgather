<?php
// Egyszeri telepítő: létrehozza a táblákat, az alap térképet és az első admin felhasználót.
// Ha már van felhasználó, csak a táblák frissítését végzi el, új admint nem hoz létre.

declare(strict_types=1);
require __DIR__ . '/api/inc/bootstrap.php';

header('Content-Type: text/html; charset=utf-8');

function page(string $body): void
{
    echo '<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>NotGather telepítés</title><link rel="stylesheet" href="assets/css/app.css"></head>'
        . '<body class="install"><div class="card install-card"><h1>NotGather telepítés</h1>' . $body . '</div></body></html>';
    exit;
}

if (!is_file(__DIR__ . '/api/config.php')) {
    page('<p>Hiányzik az <code>api/config.php</code>. Másold le az <code>api/config.sample.php</code> fájlt '
        . '<code>config.php</code> néven, írd be az adatbázis adatait, majd töltsd újra ezt az oldalt.</p>');
}

try {
    $pdo = db();
} catch (Throwable $e) {
    page('<p class="err">Nem sikerült csatlakozni az adatbázishoz. Ellenőrizd az <code>api/config.php</code> adatait.</p>');
}

// Táblák létrehozása (többször is futtatható)
$sql = (string)file_get_contents(__DIR__ . '/api/inc/schema.sql');
foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
    $pdo->exec($stmt);
}

// Alap térkép, ha még nincs egy szoba sem
if ((int)$pdo->query('SELECT COUNT(*) FROM ng_zones')->fetchColumn() === 0) {
    $ins = $pdo->prepare('INSERT INTO ng_zones (name, kind, x, y, w, h, color) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $ins->execute(['Közös iroda', 'talk', 60, 60, 760, 460, '#34d399']);
    $ins->execute(['Tárgyaló', 'talk', 900, 60, 420, 300, '#60a5fa']);
    $ins->execute(['Fókusz (csend)', 'quiet', 900, 420, 420, 240, '#a78bfa']);
    $ins->execute(['Konyha', 'talk', 60, 600, 380, 300, '#fb923c']);
    ng_set_setting('world_w', '1600');
    ng_set_setting('world_h', '1000');
    ng_set_setting('map_version', '1');
}

$hasUsers = (int)$pdo->query('SELECT COUNT(*) FROM ng_users')->fetchColumn() > 0;
if ($hasUsers) {
    page('<p class="ok">Az adatbázis rendben van.</p><p>Már van felhasználó, ezért a telepítő nem hoz létre újat. '
        . 'Biztonsági okból <strong>töröld az <code>install.php</code> fájlt</strong> a tárhelyről.</p>'
        . '<p><a class="btn primary" href="./">Tovább az irodába</a></p>');
}

$error = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $username = strtolower(ng_str($_POST['username'] ?? '', 64));
    $name = ng_str($_POST['name'] ?? '', 40);
    $pass = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';
    if (!preg_match('/^[a-z0-9._-]{2,64}$/', $username)) {
        $error = 'A felhasználónév csak kisbetűt, számot, pontot, kötőjelet és aláhúzást tartalmazhat.';
    } elseif (strlen($pass) < 6) {
        $error = 'A jelszó legalább 6 karakter legyen.';
    } else {
        $pdo->prepare('INSERT INTO ng_users (username, pass_hash, display_name, color, is_admin, created_at) VALUES (?, ?, ?, ?, 1, ?)')
            ->execute([$username, password_hash($pass, PASSWORD_DEFAULT), $name === '' ? $username : $name, '#3b82f6', time()]);
        page('<p class="ok">Kész! Létrejött az admin felhasználó.</p><p>Most <strong>töröld az <code>install.php</code> fájlt</strong> '
            . 'a tárhelyről, majd lépj be. A többi kollégát az irodában, az Admin menüben veheted fel.</p>'
            . '<p><a class="btn primary" href="./">Belépés</a></p>');
    }
}

page('<p>Az adatbázis táblái elkészültek. Hozd létre az első, admin jogú felhasználót.</p>'
    . ($error ? '<p class="err">' . htmlspecialchars($error) . '</p>' : '')
    . '<form method="post" class="form">'
    . '<label>Felhasználónév<input name="username" required autocomplete="username"></label>'
    . '<label>Megjelenített név<input name="name" placeholder="pl. Kovács Anna"></label>'
    . '<label>Jelszó<input name="password" type="password" required minlength="6" autocomplete="new-password"></label>'
    . '<button class="btn primary" type="submit">Létrehozás</button></form>');

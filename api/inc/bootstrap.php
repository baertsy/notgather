<?php
// Közös segédfüggvények. PHP 7.4+ kompatibilis.
// Szándékosan NINCS PHP session: a belépést saját token kezeli, így a
// párhuzamos kérések soha nem várnak egymásra (ez okozta a régi fagyást).

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

const NG_COOKIE = 'ng_auth';
const NG_TOKEN_DAYS = 30;

function ng_config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/../config.php';
        if (!is_file($file)) {
            ng_fail('not_configured', 500);
        }
        $cfg = require $file;
    }
    return $cfg;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $c = ng_config()['db'];
        $pdo = new PDO(
            'mysql:host=' . $c['host'] . ';dbname=' . $c['name'] . ';charset=utf8mb4',
            $c['user'],
            $c['pass'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    }
    return $pdo;
}

function ng_json($data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function ng_fail(string $error, int $code = 400): void
{
    ng_json(['error' => $error], $code);
}

function ng_body(): array
{
    static $body = null;
    if ($body === null) {
        $raw = file_get_contents('php://input');
        $body = $raw === '' || $raw === false ? [] : json_decode($raw, true);
        if (!is_array($body)) {
            $body = [];
        }
    }
    return $body;
}

function ng_str($v, int $max): string
{
    $s = trim(is_scalar($v) ? (string)$v : '');
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, $max);
    }
    return substr($s, 0, $max);
}

function ng_color($v): string
{
    $s = is_string($v) ? $v : '';
    return preg_match('/^#[0-9a-fA-F]{6}$/', $s) ? strtolower($s) : '#3b82f6';
}

function ng_peer_id($v): string
{
    $s = is_string($v) ? $v : '';
    return preg_match('/^[A-Za-z0-9_-]{8,40}$/', $s) ? $s : '';
}

// Az ugyanarról az oldalról érkező POST kérések egyedi fejlécet küldenek.
// Másik oldalról ilyet a böngésző nem enged előzetes engedély nélkül (CSRF védelem).
function ng_require_csrf(): void
{
    if (($_SERVER['HTTP_X_NG'] ?? '') !== '1') {
        ng_fail('bad_request', 400);
    }
}

function ng_set_cookie(string $value, int $expires): void
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    setcookie(NG_COOKIE, $value, [
        'expires' => $expires,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function ng_issue_token(int $userId): void
{
    $token = bin2hex(random_bytes(32));
    $expires = time() + NG_TOKEN_DAYS * 86400;
    db()->prepare('INSERT INTO ng_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
        ->execute([hash('sha256', $token), $userId, $expires]);
    ng_set_cookie($token, $expires);
}

function ng_current_user(): ?array
{
    static $user = false;
    if ($user !== false) {
        return $user;
    }
    $user = null;
    $token = $_COOKIE[NG_COOKIE] ?? '';
    if (!is_string($token) || !preg_match('/^[0-9a-f]{64}$/', $token)) {
        return null;
    }
    $st = db()->prepare(
        'SELECT u.id, u.username, u.display_name, u.color, u.emoji, u.avatar, u.perm_map, u.perm_users, t.expires_at
         FROM ng_tokens t JOIN ng_users u ON u.id = t.user_id
         WHERE t.token_hash = ?'
    );
    $st->execute([hash('sha256', $token)]);
    $row = $st->fetch();
    if (!$row || (int)$row['expires_at'] < time()) {
        return null;
    }
    // A tokent naponta legfeljebb egyszer hosszabbítjuk meg.
    if ((int)$row['expires_at'] < time() + (NG_TOKEN_DAYS - 1) * 86400) {
        $exp = time() + NG_TOKEN_DAYS * 86400;
        db()->prepare('UPDATE ng_tokens SET expires_at = ? WHERE token_hash = ?')
            ->execute([$exp, hash('sha256', $token)]);
        ng_set_cookie($token, $exp);
    }
    $user = [
        'id' => (int)$row['id'],
        'username' => $row['username'],
        'name' => $row['display_name'],
        'color' => $row['color'],
        'emoji' => $row['emoji'],
        'avatar' => ng_avatar_decode($row['avatar']),
        'perms' => ['map' => (bool)$row['perm_map'], 'users' => (bool)$row['perm_users']],
    ];
    return $user;
}

function ng_require_user(): array
{
    $u = ng_current_user();
    if (!$u) {
        ng_fail('auth_required', 401);
    }
    return $u;
}

// Jogosultság ellenőrzése: 'map' (térkép szerkesztése) vagy 'users' (felhasználók kezelése).
function ng_require_perm(string $perm): array
{
    $u = ng_require_user();
    if (empty($u['perms'][$perm])) {
        ng_fail('forbidden', 403);
    }
    return $u;
}

// ---------------------------------------------------------------- avatar

const NG_AVATAR_OPTIONS = [
    'skin' => ['#f8d7b5', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'],
    'hair' => ['short', 'long', 'bun', 'curly', 'spiky', 'ponytail', 'bob', 'bald'],
    'acc' => ['none', 'glasses', 'sunglasses', 'headphones', 'cap'],
];

function ng_avatar_default(): array
{
    return ['skin' => '#f1c27d', 'hair' => 'short', 'hairColor' => '#3b2416', 'shirt' => '#3b82f6', 'pants' => '#334155', 'acc' => 'none', 'accColor' => '#ef4444'];
}

function ng_avatar_clean($a): array
{
    $d = ng_avatar_default();
    if (!is_array($a)) {
        return $d;
    }
    $out = [];
    foreach ($d as $k => $def) {
        $v = $a[$k] ?? $def;
        if (isset(NG_AVATAR_OPTIONS[$k])) {
            $out[$k] = in_array($v, NG_AVATAR_OPTIONS[$k], true) ? $v : $def;
        } elseif (in_array($k, ['skin'], true)) {
            $out[$k] = $def;
        } else {
            $out[$k] = is_string($v) && preg_match('/^#[0-9a-fA-F]{6}$/', $v) ? strtolower($v) : $def;
        }
    }
    return $out;
}

function ng_avatar_decode($json): array
{
    if (!is_string($json) || $json === '') {
        return ng_avatar_default();
    }
    return ng_avatar_clean(json_decode($json, true));
}

// ---------------------------------------------------------------- adatbázis-frissítések

/**
 * Automatikus adatbázis-frissítés. Minden oldalbetöltéskor egy olcsó ellenőrzés;
 * ha a séma régebbi, egyszer lefutnak a hiányzó lépések. Így frissítéskor elég
 * a fájlokat feltölteni, nem kell újra telepíteni.
 */
function ng_migrate(): void
{
    $pdo = db();
    $ver = (int)ng_setting('schema', '1');
    if ($ver < 2) {
        $cols = $pdo->query('SHOW COLUMNS FROM ng_users')->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('perm_map', $cols, true)) {
            $pdo->exec('ALTER TABLE ng_users ADD perm_map TINYINT(1) NOT NULL DEFAULT 0, ADD perm_users TINYINT(1) NOT NULL DEFAULT 0');
            $pdo->exec('UPDATE ng_users SET perm_map = is_admin, perm_users = is_admin');
        }
        if (!in_array('avatar', $cols, true)) {
            $pdo->exec('ALTER TABLE ng_users ADD avatar TEXT NULL');
        }
        $zcols = $pdo->query('SHOW COLUMNS FROM ng_zones')->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('floor', $zcols, true)) {
            $pdo->exec("ALTER TABLE ng_zones ADD floor VARCHAR(16) NOT NULL DEFAULT 'none'");
        }
        $pdo->exec('CREATE TABLE IF NOT EXISTS ng_items (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(32) NOT NULL,
            x SMALLINT NOT NULL, y SMALLINT NOT NULL,
            w SMALLINT NOT NULL, h SMALLINT NOT NULL,
            rot SMALLINT NOT NULL DEFAULT 0,
            color VARCHAR(16) NOT NULL DEFAULT \'\',
            label VARCHAR(64) NOT NULL DEFAULT \'\'
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        ng_set_setting('schema', '2');
        $ver = 2;
    }
    if ($ver < 3) {
        $icols = $pdo->query('SHOW COLUMNS FROM ng_items')->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('uid', $icols, true)) {
            $pdo->exec("ALTER TABLE ng_items ADD uid VARCHAR(16) NOT NULL DEFAULT '', ADD url VARCHAR(500) NOT NULL DEFAULT ''");
        }
        $ids = $pdo->query("SELECT id FROM ng_items WHERE uid = ''")->fetchAll(PDO::FETCH_COLUMN);
        $upd = $pdo->prepare('UPDATE ng_items SET uid = ? WHERE id = ?');
        foreach ($ids as $id) {
            $upd->execute([ng_new_uid(), $id]);
        }
        $pdo->exec('CREATE TABLE IF NOT EXISTS ng_item_state (
            uid VARCHAR(16) NOT NULL PRIMARY KEY,
            state MEDIUMTEXT NOT NULL,
            updated_at INT UNSIGNED NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        ng_set_setting('schema', '3');
    }
}

function ng_new_uid(): string
{
    return substr(bin2hex(random_bytes(8)), 0, 12);
}

function ng_items(): array
{
    $rows = db()->query('SELECT uid, type, x, y, w, h, rot, color, label, url FROM ng_items ORDER BY id')->fetchAll();
    foreach ($rows as &$r) {
        foreach (['x', 'y', 'w', 'h', 'rot'] as $k) {
            $r[$k] = (int)$r[$k];
        }
    }
    return $rows;
}

// ---------------------------------------------------------------- tárgyak közös állapota

// A titkos mezők (pl. az ajtó jelszavának hash-e) soha nem mennek ki a kliensnek.
function ng_public_state(array $st): array
{
    unset($st['pw']);
    return $st;
}

function ng_item_states(): array
{
    $out = [];
    foreach (db()->query('SELECT uid, state FROM ng_item_state')->fetchAll() as $r) {
        $st = json_decode($r['state'], true);
        if (is_array($st)) {
            $out[$r['uid']] = ng_public_state($st);
        }
    }
    return $out;
}

function ng_get_state(string $uid): array
{
    $st = db()->prepare('SELECT state FROM ng_item_state WHERE uid = ?');
    $st->execute([$uid]);
    $v = json_decode((string)$st->fetchColumn(), true);
    return is_array($v) ? $v : [];
}

function ng_put_state(string $uid, array $state): void
{
    $json = json_encode($state, JSON_UNESCAPED_UNICODE);
    if ($json === false || strlen($json) > 400000) {
        ng_fail('state_too_large');
    }
    db()->prepare('INSERT INTO ng_item_state (uid, state, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE state = VALUES(state), updated_at = VALUES(updated_at)')
        ->execute([$uid, $json, time()]);
    ng_set_setting('state_version', (string)((int)ng_setting('state_version', '0') + 1));
}

// Növény nedvessége: naponta kb. 30 egységet veszít, egy locsolás 35-öt ad.
const NG_PLANT_DECAY_PER_DAY = 30.0;

function ng_plant_moisture(array $st, int $now): float
{
    $m = isset($st['m']) ? (float)$st['m'] : 80.0;
    $t = isset($st['t']) ? (int)$st['t'] : $now;
    return max(0.0, $m - NG_PLANT_DECAY_PER_DAY * max(0, $now - $t) / 86400);
}

function ng_setting(string $k, string $default = ''): string
{
    $st = db()->prepare('SELECT v FROM ng_settings WHERE k = ?');
    $st->execute([$k]);
    $v = $st->fetchColumn();
    return $v === false ? $default : (string)$v;
}

function ng_set_setting(string $k, string $v): void
{
    db()->prepare('INSERT INTO ng_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)')
        ->execute([$k, $v]);
}

function ng_zones(): array
{
    $rows = db()->query('SELECT id, name, kind, x, y, w, h, color, floor FROM ng_zones ORDER BY id')->fetchAll();
    foreach ($rows as &$r) {
        foreach (['id', 'x', 'y', 'w', 'h'] as $k) {
            $r[$k] = (int)$r[$k];
        }
    }
    return $rows;
}

function ng_world(): array
{
    return [
        'w' => (int)ng_setting('world_w', '1600'),
        'h' => (int)ng_setting('world_h', '1000'),
        'version' => (int)ng_setting('map_version', '1'),
    ];
}

function ng_message_row(array $m): array
{
    return [
        'id' => (int)$m['id'],
        'senderId' => (int)$m['sender_id'],
        'scope' => $m['scope'],
        'targetId' => (int)$m['target_id'],
        'body' => $m['body'],
        'at' => (int)$m['created_at'],
    ];
}

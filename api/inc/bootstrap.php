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
        'SELECT u.id, u.username, u.display_name, u.color, u.emoji, u.is_admin, t.expires_at
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
        'isAdmin' => (bool)$row['is_admin'],
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

function ng_require_admin(): array
{
    $u = ng_require_user();
    if (!$u['isAdmin']) {
        ng_fail('forbidden', 403);
    }
    return $u;
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
    $rows = db()->query('SELECT id, name, kind, x, y, w, h, color FROM ng_zones ORDER BY id')->fetchAll();
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

<?php
// Egyetlen belépési pont az összes API híváshoz: api/?a=<művelet>

declare(strict_types=1);
require __DIR__ . '/inc/bootstrap.php';

$action = isset($_GET['a']) && is_string($_GET['a']) ? $_GET['a'] : '';
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';

// A "leave" sendBeacon-nel érkezik, ami nem tud egyedi fejlécet küldeni.
// Ártalmatlan művelet (csak offline-nak jelöl), ezért kivétel.
if ($isPost && $action !== 'leave') {
    ng_require_csrf();
}

try {
    switch ($action) {
        case 'login':
            action_login();
            break;
        case 'logout':
            action_logout();
            break;
        case 'me':
            action_me();
            break;
        case 'sync':
            action_sync();
            break;
        case 'leave':
            action_leave();
            break;
        case 'chat_send':
            action_chat_send();
            break;
        case 'chat_history':
            action_chat_history();
            break;
        case 'profile':
            action_profile();
            break;
        case 'password':
            action_password();
            break;
        case 'item_states':
            ng_require_user();
            ng_json(['states' => ng_item_states(), 'version' => (int)ng_setting('state_version', '0')]);
            break;
        case 'item_op':
            action_item_op();
            break;
        case 'map_save':
            action_map_save();
            break;
        case 'users_list':
            action_users_list();
            break;
        case 'user_save':
            action_user_save();
            break;
        case 'user_delete':
            action_user_delete();
            break;
        default:
            ng_fail('unknown_action', 404);
    }
} catch (Throwable $e) {
    error_log('[notgather] ' . $action . ': ' . $e->getMessage());
    ng_fail('server_error', 500);
}

// ---------------------------------------------------------------------------

function action_login(): void
{
    $b = ng_body();
    $username = ng_str($b['username'] ?? '', 64);
    $password = is_string($b['password'] ?? null) ? $b['password'] : '';
    $st = db()->prepare('SELECT id, pass_hash FROM ng_users WHERE username = ?');
    $st->execute([$username]);
    $row = $st->fetch();
    if (!$row || !password_verify($password, $row['pass_hash'])) {
        usleep(700000); // lassítja a jelszópróbálgatást
        ng_fail('invalid_login', 401);
    }
    // régi, lejárt tokenek takarítása
    db()->prepare('DELETE FROM ng_tokens WHERE expires_at < ?')->execute([time()]);
    ng_issue_token((int)$row['id']);
    ng_json(['ok' => true]);
}

function action_logout(): void
{
    $token = $_COOKIE[NG_COOKIE] ?? '';
    if (is_string($token) && $token !== '') {
        db()->prepare('DELETE FROM ng_tokens WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    }
    $u = ng_current_user();
    if ($u) {
        db()->prepare('UPDATE ng_presence SET last_seen = 0 WHERE user_id = ?')->execute([$u['id']]);
    }
    ng_set_cookie('', time() - 3600);
    ng_json(['ok' => true]);
}

function action_me(): void
{
    ng_migrate();
    $u = ng_require_user();
    $cfg = ng_config();
    $st = db()->prepare('SELECT x, y FROM ng_presence WHERE user_id = ?');
    $st->execute([$u['id']]);
    $pos = $st->fetch();
    ng_json([
        'user' => $u,
        'appName' => $cfg['app_name'] ?? 'NotGather',
        'iceServers' => $cfg['ice_servers'] ?? [],
        'world' => ng_world(),
        'zones' => ng_zones(),
        'items' => ng_items(),
        'itemStates' => ng_item_states(),
        'stateVersion' => (int)ng_setting('state_version', '0'),
        'lastPos' => $pos ? ['x' => (int)$pos['x'], 'y' => (int)$pos['y']] : null,
    ]);
}

/**
 * A kliens 1–3 másodpercenként hívja. Egy kérésben:
 *  - elküldi a saját állapotát (jelenlét),
 *  - leadja a kimenő WebRTC jelzéseket,
 *  - megkapja a neki szóló jelzéseket, a többiek állapotát és az új üzeneteket.
 * Azonnal válaszol, soha nem várakozik.
 */
function action_sync(): void
{
    $u = ng_require_user();
    $b = ng_body();
    $now = time();
    $timeout = (int)(ng_config()['presence_timeout'] ?? 20);
    $peer = ng_peer_id($b['peer'] ?? '');
    if ($peer === '') {
        ng_fail('bad_peer');
    }
    $pdo = db();

    // Másik ablak/gép átvette a helyet?
    $st = $pdo->prepare('SELECT peer_id, last_seen FROM ng_presence WHERE user_id = ?');
    $st->execute([$u['id']]);
    $cur = $st->fetch();
    if ($cur && $cur['peer_id'] !== $peer && (int)$cur['last_seen'] >= $now - $timeout && empty($b['claim'])) {
        ng_json(['kicked' => true]);
    }

    $s = is_array($b['state'] ?? null) ? $b['state'] : [];
    $status = in_array($s['status'] ?? '', ['available', 'busy', 'away'], true) ? $s['status'] : 'available';
    $zone = isset($s['zone']) && is_numeric($s['zone']) ? (int)$s['zone'] : null;
    $call = isset($s['call']) && is_numeric($s['call']) ? (int)$s['call'] : null;
    $pdo->prepare(
        'INSERT INTO ng_presence (user_id, peer_id, x, y, zone_id, status, mic, cam, screen, call_with, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE peer_id = VALUES(peer_id), x = VALUES(x), y = VALUES(y), zone_id = VALUES(zone_id),
           status = VALUES(status), mic = VALUES(mic), cam = VALUES(cam), screen = VALUES(screen),
           call_with = VALUES(call_with), last_seen = VALUES(last_seen)'
    )->execute([
        $u['id'], $peer,
        max(0, min(30000, (int)($s['x'] ?? 0))), max(0, min(30000, (int)($s['y'] ?? 0))),
        $zone, $status,
        empty($s['mic']) ? 0 : 1, empty($s['cam']) ? 0 : 1, empty($s['screen']) ? 0 : 1,
        $call, $now,
    ]);

    // Kimenő jelzések
    $out = is_array($b['out'] ?? null) ? array_slice($b['out'], 0, 50) : [];
    if ($out) {
        $ins = $pdo->prepare('INSERT INTO ng_signals (to_peer, from_peer, from_user, payload, created_at) VALUES (?, ?, ?, ?, ?)');
        foreach ($out as $sig) {
            $to = ng_peer_id($sig['to'] ?? '');
            $payload = json_encode($sig['data'] ?? null, JSON_UNESCAPED_UNICODE);
            if ($to === '' || $payload === false || strlen($payload) > 65000) {
                continue;
            }
            $ins->execute([$to, $peer, $u['id'], $payload, $now]);
        }
    }

    // Bejövő jelzések (kiolvasás után törlődnek)
    $st = $pdo->prepare('SELECT id, from_peer, from_user, payload FROM ng_signals WHERE to_peer = ? ORDER BY id LIMIT 100');
    $st->execute([$peer]);
    $signals = [];
    $ids = [];
    foreach ($st->fetchAll() as $r) {
        $ids[] = (int)$r['id'];
        $signals[] = ['from' => $r['from_peer'], 'user' => (int)$r['from_user'], 'data' => json_decode($r['payload'], true)];
    }
    if ($ids) {
        $pdo->exec('DELETE FROM ng_signals WHERE id IN (' . implode(',', $ids) . ')');
    }
    if (mt_rand(1, 30) === 1) {
        $pdo->prepare('DELETE FROM ng_signals WHERE created_at < ?')->execute([$now - 120]);
    }

    // Mindenki állapota (kis csapat, ezért egyszerűen mindenkit visszaadunk)
    $rows = $pdo->query(
        'SELECT u.id, u.display_name, u.color, u.avatar, p.peer_id, p.x, p.y, p.zone_id, p.status,
                p.mic, p.cam, p.screen, p.call_with, p.last_seen
         FROM ng_users u LEFT JOIN ng_presence p ON p.user_id = u.id ORDER BY u.display_name'
    )->fetchAll();
    $users = [];
    foreach ($rows as $r) {
        $online = $r['last_seen'] !== null && (int)$r['last_seen'] >= $now - $timeout;
        $users[] = [
            'id' => (int)$r['id'],
            'name' => $r['display_name'],
            'color' => $r['color'],
            'avatar' => ng_avatar_decode($r['avatar']),
            'online' => $online,
            'peerId' => $online ? $r['peer_id'] : null,
            'x' => (int)$r['x'],
            'y' => (int)$r['y'],
            'zone' => $r['zone_id'] === null ? null : (int)$r['zone_id'],
            'status' => $r['status'] ?? 'available',
            'mic' => (bool)$r['mic'],
            'cam' => (bool)$r['cam'],
            'screen' => (bool)$r['screen'],
            'call' => $r['call_with'] === null ? null : (int)$r['call_with'],
        ];
    }

    // Új üzenetek: közös, szobák, és a saját privát beszélgetések
    $last = (int)($b['lastMsg'] ?? 0);
    $messages = [];
    if ($last > 0) {
        $st = $pdo->prepare(
            "SELECT * FROM ng_messages WHERE id > ? AND (scope IN ('global','zone') OR (scope = 'dm' AND (target_id = ? OR sender_id = ?)))
             ORDER BY id LIMIT 200"
        );
        $st->execute([$last, $u['id'], $u['id']]);
        $messages = array_map('ng_message_row', $st->fetchAll());
    }

    ng_json([
        'now' => $now,
        'users' => $users,
        'signals' => $signals,
        'messages' => $messages,
        'mapVersion' => (int)ng_setting('map_version', '1'),
        'stateVersion' => (int)ng_setting('state_version', '0'),
    ]);
}

function action_leave(): void
{
    $u = ng_current_user();
    if (!$u) {
        ng_json(['ok' => true]);
    }
    $raw = file_get_contents('php://input');
    $b = json_decode($raw === false ? '' : $raw, true);
    $peer = ng_peer_id(is_array($b) ? ($b['peer'] ?? '') : '');
    db()->prepare('UPDATE ng_presence SET last_seen = 0 WHERE user_id = ? AND peer_id = ?')->execute([$u['id'], $peer]);
    ng_json(['ok' => true]);
}

function action_chat_send(): void
{
    $u = ng_require_user();
    $b = ng_body();
    $scope = in_array($b['scope'] ?? '', ['global', 'zone', 'dm'], true) ? $b['scope'] : 'global';
    $target = $scope === 'global' ? 0 : (int)($b['targetId'] ?? 0);
    $body = ng_str($b['body'] ?? '', 4000);
    if ($body === '' || ($scope !== 'global' && $target <= 0)) {
        ng_fail('empty');
    }
    $now = time();
    db()->prepare('INSERT INTO ng_messages (sender_id, scope, target_id, body, created_at) VALUES (?, ?, ?, ?, ?)')
        ->execute([$u['id'], $scope, $target, $body, $now]);
    $id = (int)db()->lastInsertId();
    ng_json(['message' => [
        'id' => $id, 'senderId' => $u['id'], 'scope' => $scope, 'targetId' => $target, 'body' => $body, 'at' => $now,
    ]]);
}

// Az utolsó üzenetek betöltése belépéskor (közös + szobák + saját privátok).
function action_chat_history(): void
{
    $u = ng_require_user();
    $st = db()->prepare(
        "SELECT * FROM (
           SELECT * FROM ng_messages
           WHERE scope IN ('global','zone') OR (scope = 'dm' AND (target_id = ? OR sender_id = ?))
           ORDER BY id DESC LIMIT 300
         ) t ORDER BY id"
    );
    $st->execute([$u['id'], $u['id']]);
    $rows = array_map('ng_message_row', $st->fetchAll());
    $maxId = (int)db()->query('SELECT COALESCE(MAX(id), 0) FROM ng_messages')->fetchColumn();
    ng_json(['messages' => $rows, 'lastId' => $maxId]);
}

function action_profile(): void
{
    $u = ng_require_user();
    $b = ng_body();
    $name = ng_str($b['name'] ?? '', 40);
    if ($name === '') {
        ng_fail('name_required');
    }
    $avatar = ng_avatar_clean($b['avatar'] ?? null);
    $color = $avatar['shirt'];
    db()->prepare('UPDATE ng_users SET display_name = ?, color = ?, avatar = ? WHERE id = ?')
        ->execute([$name, $color, json_encode($avatar), $u['id']]);
    ng_json(['ok' => true, 'user' => ['name' => $name, 'color' => $color, 'avatar' => $avatar]]);
}

function action_password(): void
{
    $u = ng_require_user();
    $b = ng_body();
    $old = is_string($b['old'] ?? null) ? $b['old'] : '';
    $new = is_string($b['new'] ?? null) ? $b['new'] : '';
    if (strlen($new) < 6) {
        ng_fail('password_too_short');
    }
    $st = db()->prepare('SELECT pass_hash FROM ng_users WHERE id = ?');
    $st->execute([$u['id']]);
    if (!password_verify($old, (string)$st->fetchColumn())) {
        ng_fail('invalid_password', 403);
    }
    db()->prepare('UPDATE ng_users SET pass_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $u['id']]);
    ng_json(['ok' => true]);
}

function action_map_save(): void
{
    ng_require_perm('map');
    $b = ng_body();
    $w = max(600, min(6000, (int)($b['world']['w'] ?? 1600)));
    $h = max(400, min(6000, (int)($b['world']['h'] ?? 1000)));
    $zones = is_array($b['zones'] ?? null) ? array_slice($b['zones'], 0, 100) : [];
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $keep = [];
        $upd = $pdo->prepare('UPDATE ng_zones SET name = ?, kind = ?, x = ?, y = ?, w = ?, h = ?, color = ?, floor = ? WHERE id = ?');
        $ins = $pdo->prepare('INSERT INTO ng_zones (name, kind, x, y, w, h, color, floor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($zones as $z) {
            if (!is_array($z)) {
                continue;
            }
            $name = ng_str($z['name'] ?? '', 64);
            $vals = [
                $name === '' ? 'Szoba' : $name,
                ($z['kind'] ?? '') === 'quiet' ? 'quiet' : 'talk',
                max(0, min($w - 40, (int)($z['x'] ?? 0))),
                max(0, min($h - 40, (int)($z['y'] ?? 0))),
                max(40, min($w, (int)($z['w'] ?? 200))),
                max(40, min($h, (int)($z['h'] ?? 150))),
                ng_color($z['color'] ?? ''),
                in_array($z['floor'] ?? '', ['none', 'wood', 'carpet', 'tile', 'grass', 'concrete'], true) ? $z['floor'] : 'none',
            ];
            $id = (int)($z['id'] ?? 0);
            if ($id > 0) {
                $upd->execute(array_merge($vals, [$id]));
                $keep[] = $id;
            } else {
                $ins->execute($vals);
                $keep[] = (int)$pdo->lastInsertId();
            }
        }
        if ($keep) {
            $pdo->exec('DELETE FROM ng_zones WHERE id NOT IN (' . implode(',', array_map('intval', $keep)) . ')');
        } else {
            $pdo->exec('DELETE FROM ng_zones');
        }
        // Bútorok: ha a kérés tartalmazza, lecseréljük az egészet (ha nem, maradnak).
        $hasItems = is_array($b['items'] ?? null);
        if ($hasItems) {
            $pdo->exec('DELETE FROM ng_items');
        }
        $items = $hasItems ? array_slice($b['items'], 0, 3000) : [];
        $insItem = $pdo->prepare('INSERT INTO ng_items (uid, type, x, y, w, h, rot, color, label, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $seenUids = [];
        foreach ($items as $it) {
            if (!is_array($it) || !preg_match('/^[a-z0-9_]{1,32}$/', (string)($it['type'] ?? ''))) {
                continue;
            }
            $color = (string)($it['color'] ?? '');
            $uid = (string)($it['uid'] ?? '');
            if (!preg_match('/^[a-z0-9]{6,16}$/', $uid) || isset($seenUids[$uid])) {
                $uid = ng_new_uid();
            }
            $seenUids[$uid] = true;
            $url = trim((string)($it['url'] ?? ''));
            if ($url !== '' && !preg_match('#^https?://#i', $url)) {
                $url = 'https://' . $url;
            }
            $insItem->execute([
                $uid,
                $it['type'],
                max(-200, min($w + 200, (int)($it['x'] ?? 0))),
                max(-200, min($h + 200, (int)($it['y'] ?? 0))),
                max(4, min(2000, (int)($it['w'] ?? 40))),
                max(4, min(2000, (int)($it['h'] ?? 40))),
                in_array((int)($it['rot'] ?? 0), [0, 90, 180, 270], true) ? (int)$it['rot'] : 0,
                preg_match('/^#[0-9a-fA-F]{6}$/', $color) ? strtolower($color) : '',
                ng_str($it['label'] ?? '', 64),
                substr($url, 0, 500),
            ]);
        }
        // a törölt tárgyak állapota is törlődik
        if ($hasItems) {
            $pdo->exec('DELETE FROM ng_item_state WHERE uid NOT IN (SELECT uid FROM ng_items)');
        }
        ng_set_setting('world_w', (string)$w);
        ng_set_setting('world_h', (string)$h);
        ng_set_setting('map_version', (string)((int)ng_setting('map_version', '1') + 1));
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    ng_json(['ok' => true, 'world' => ng_world(), 'zones' => ng_zones(), 'items' => ng_items()]);
}

/**
 * Műveletek a tárgyak közös állapotán (ajtó, növény, jegyzetek, lámpa...).
 * A válasz a tárgy új, nyilvános állapota.
 */
function action_item_op(): void
{
    $u = ng_require_user();
    $b = ng_body();
    $uid = (string)($b['uid'] ?? '');
    $op = (string)($b['op'] ?? '');
    $pdo = db();
    $q = $pdo->prepare('SELECT type FROM ng_items WHERE uid = ?');
    $q->execute([$uid]);
    $type = $q->fetchColumn();
    if ($type === false) {
        ng_fail('no_item', 404);
    }
    $doorOps = ['door', 'lock', 'unlock_check', 'unlock'];
    $doors = ['door', 'double_door', 'glass_door'];
    $plants = ['plant', 'big_plant', 'cactus', 'flowers', 'flower_bed', 'bonsai', 'hanging_plant', 'monstera'];
    $pets = ['aquarium', 'cat', 'dog'];
    if ((in_array($op, $doorOps, true) && !in_array($type, $doors, true))
        || ($op === 'water' && !in_array($type, $plants, true))
        || ($op === 'feed' && !in_array($type, $pets, true))) {
        ng_fail('bad_op');
    }
    $now = time();
    $st = ng_get_state($uid);
    $extra = [];
    $keyOk = function ($k) {
        return is_string($k) && preg_match('/^[a-zA-Z][a-zA-Z0-9_]{0,23}$/', $k) && !in_array($k, ['pw', 'locked', 'lockZone', 'lockId', 'lockedBy', 'm', 't', 'fedAt'], true);
    };

    switch ($op) {
        case 'set':
            $patch = is_array($b['patch'] ?? null) ? $b['patch'] : [];
            foreach ($patch as $k => $v) {
                if (!$keyOk($k)) {
                    continue;
                }
                if ($v === null) {
                    unset($st[$k]);
                } else {
                    $st[$k] = $v;
                }
            }
            break;

        case 'list_add':
            $key = $b['key'] ?? '';
            if (!$keyOk($key)) {
                ng_fail('bad_key');
            }
            $val = $b['value'] ?? null;
            if (strlen((string)json_encode($val)) > 30000) {
                ng_fail('too_large');
            }
            $max = max(1, min(800, (int)($b['max'] ?? 100)));
            $list = is_array($st[$key] ?? null) ? $st[$key] : [];
            $entry = ['id' => substr(bin2hex(random_bytes(6)), 0, 10), 'by' => $u['name'], 'byId' => $u['id'], 'at' => $now, 'v' => $val];
            $list[] = $entry;
            if (count($list) > $max) {
                $list = array_slice($list, -$max);
            }
            $st[$key] = $list;
            $extra['entry'] = $entry;
            break;

        case 'list_remove':
            $key = $b['key'] ?? '';
            if (!$keyOk($key)) {
                ng_fail('bad_key');
            }
            $id = (string)($b['id'] ?? '');
            $st[$key] = array_values(array_filter(is_array($st[$key] ?? null) ? $st[$key] : [], function ($e) use ($id) {
                return ($e['id'] ?? '') !== $id;
            }));
            break;

        case 'list_clear':
            $key = $b['key'] ?? '';
            if (!$keyOk($key)) {
                ng_fail('bad_key');
            }
            $st[$key] = [];
            break;

        // ---- ajtó
        case 'door':
            if (!empty($st['locked'])) {
                ng_fail('locked', 423);
            }
            $st['open'] = !empty($b['open']);
            break;

        case 'lock':
            $pw = (string)($b['password'] ?? '');
            if ($pw === '' || strlen($pw) > 64) {
                ng_fail('bad_password');
            }
            if (!empty($st['locked'])) {
                ng_fail('already_locked', 409);
            }
            // A kliens küldi, melyik szobában van (a jelenlét csak pár másodpercenként frissül).
            if (isset($b['zone']) && is_numeric($b['zone'])) {
                $zone = (int)$b['zone'];
            } else {
                $z = $pdo->prepare('SELECT zone_id FROM ng_presence WHERE user_id = ?');
                $z->execute([$u['id']]);
                $zone = $z->fetchColumn();
            }
            $st['locked'] = true;
            $st['open'] = false;
            $st['pw'] = password_hash($pw, PASSWORD_DEFAULT);
            $st['lockZone'] = ($zone === false || $zone === null) ? null : (int)$zone;
            $st['lockedBy'] = $u['name'];
            $st['lockId'] = substr(bin2hex(random_bytes(6)), 0, 10);
            break;

        case 'unlock_check':
            // Kívülről érkezők: a jelszóval "kulcsot" kapnak, a zár marad.
            if (empty($st['locked'])) {
                ng_json(['ok' => true, 'state' => ng_public_state($st)]);
            }
            if (!password_verify((string)($b['password'] ?? ''), (string)($st['pw'] ?? ''))) {
                usleep(600000);
                ng_fail('wrong_password', 403);
            }
            ng_json(['ok' => true, 'lockId' => $st['lockId'], 'state' => ng_public_state($st)]);
            break;

        case 'unlock':
            if (empty($st['locked'])) {
                break;
            }
            if (isset($b['zone']) && is_numeric($b['zone'])) {
                $zone = (int)$b['zone'];
            } else {
                $z = $pdo->prepare('SELECT zone_id FROM ng_presence WHERE user_id = ?');
                $z->execute([$u['id']]);
                $zone = $z->fetchColumn();
            }
            $inside = $zone !== false && $zone !== null && isset($st['lockZone']) && (int)$zone === (int)$st['lockZone'];
            // a térképért felelősök vészhelyzetben jelszó nélkül is feloldhatják (pl. elfelejtett jelszó)
            if (!empty($u['perms']['map'])) {
                $inside = true;
            }
            if (!$inside && !password_verify((string)($b['password'] ?? ''), (string)($st['pw'] ?? ''))) {
                usleep(600000);
                ng_fail('wrong_password', 403);
            }
            unset($st['pw'], $st['lockZone'], $st['lockedBy'], $st['lockId']);
            $st['locked'] = false;
            break;

        // ---- növény locsolása
        case 'water':
            $m = ng_plant_moisture($st, $now);
            $st['m'] = min(170.0, $m + 35.0);
            $st['t'] = $now;
            $st['wateredBy'] = $u['name'];
            $st['wateredAt'] = $now;
            break;

        // ---- etetés (akvárium, macska, kutya)
        case 'feed':
            $last = (int)($st['fedAt'] ?? 0);
            if ($now - $last < 3600) {
                $extra['alreadyFed'] = true;
            } else {
                $st['fedAt'] = $now;
                $st['fedBy'] = $u['name'];
            }
            break;

        default:
            ng_fail('bad_op');
    }
    ng_put_state($uid, $st);
    ng_json(array_merge(['ok' => true, 'state' => ng_public_state($st)], $extra));
}

function action_users_list(): void
{
    ng_require_perm('users');
    $rows = db()->query('SELECT id, username, display_name, perm_map, perm_users FROM ng_users ORDER BY display_name')->fetchAll();
    ng_json(['users' => array_map(function ($r) {
        return ['id' => (int)$r['id'], 'username' => $r['username'], 'name' => $r['display_name'],
            'perms' => ['map' => (bool)$r['perm_map'], 'users' => (bool)$r['perm_users']]];
    }, $rows)]);
}

function action_user_save(): void
{
    $me = ng_require_perm('users');
    $b = ng_body();
    $id = (int)($b['id'] ?? 0);
    $username = strtolower(ng_str($b['username'] ?? '', 64));
    $name = ng_str($b['name'] ?? '', 40);
    $password = is_string($b['password'] ?? null) ? $b['password'] : '';
    $permMap = empty($b['perms']['map']) ? 0 : 1;
    $permUsers = empty($b['perms']['users']) ? 0 : 1;
    if (!preg_match('/^[a-z0-9._-]{2,64}$/', $username)) {
        ng_fail('bad_username');
    }
    if ($name === '') {
        $name = $username;
    }
    $pdo = db();
    $st = $pdo->prepare('SELECT id FROM ng_users WHERE username = ? AND id <> ?');
    $st->execute([$username, $id]);
    if ($st->fetch()) {
        ng_fail('username_taken', 409);
    }
    if ($id > 0) {
        if ($id === $me['id']) {
            $permUsers = 1; // a saját felhasználókezelési jogát nem veheti el
        }
        $pdo->prepare('UPDATE ng_users SET username = ?, display_name = ?, perm_map = ?, perm_users = ?, is_admin = ? WHERE id = ?')
            ->execute([$username, $name, $permMap, $permUsers, ($permMap || $permUsers) ? 1 : 0, $id]);
        if ($password !== '') {
            if (strlen($password) < 6) {
                ng_fail('password_too_short');
            }
            $pdo->prepare('UPDATE ng_users SET pass_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
            $pdo->prepare('DELETE FROM ng_tokens WHERE user_id = ?')->execute([$id]);
        }
    } else {
        if (strlen($password) < 6) {
            ng_fail('password_too_short');
        }
        $colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
        $avatar = ng_avatar_default();
        $avatar['shirt'] = $colors[array_rand($colors)];
        $avatar['skin'] = NG_AVATAR_OPTIONS['skin'][array_rand(NG_AVATAR_OPTIONS['skin'])];
        $avatar['hair'] = ['short', 'long', 'bun', 'curly', 'spiky', 'ponytail', 'bob'][mt_rand(0, 6)];
        $pdo->prepare('INSERT INTO ng_users (username, pass_hash, display_name, color, avatar, perm_map, perm_users, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $name, $avatar['shirt'], json_encode($avatar), $permMap, $permUsers, ($permMap || $permUsers) ? 1 : 0, time()]);
    }
    ng_json(['ok' => true]);
}

function action_user_delete(): void
{
    $me = ng_require_perm('users');
    $id = (int)(ng_body()['id'] ?? 0);
    if ($id <= 0 || $id === $me['id']) {
        ng_fail('cannot_delete');
    }
    $pdo = db();
    $pdo->prepare('DELETE FROM ng_tokens WHERE user_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM ng_presence WHERE user_id = ?')->execute([$id]);
    $pdo->prepare('DELETE FROM ng_users WHERE id = ?')->execute([$id]);
    ng_json(['ok' => true]);
}

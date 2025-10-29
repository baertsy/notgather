<?php
require 'db.php';
session_start();
if (!isset($_SESSION['user_id'])) { http_response_code(403); exit; }

$action = $_GET['action'] ?? '';
if ($action === 'list') {
    $rooms = $pdo->query("SELECT id, name FROM rooms")->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rooms);
    exit;
}
if ($action === 'create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = trim($_POST['name'] ?? '');
    if (!$name) { echo json_encode(['status' => 'error', 'error' => 'No name']); exit; }
    $stmt = $pdo->prepare("INSERT INTO rooms (name) VALUES (?)");
    $stmt->execute([$name]);
    $room_id = $pdo->lastInsertId();
    $stmt = $pdo->prepare("INSERT INTO room_users (room_id, user_id) VALUES (?, ?)");
    $stmt->execute([$room_id, $_SESSION['user_id']]);
    echo json_encode(['room_id' => $room_id]);
    exit;
}
if ($action === 'join' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $room_id = intval($_POST['room_id'] ?? 0);
    if (!$room_id) { echo json_encode(['status' => 'error']); exit; }
    $stmt = $pdo->prepare("INSERT IGNORE INTO room_users (room_id, user_id) VALUES (?, ?)");
    $stmt->execute([$room_id, $_SESSION['user_id']]);
    echo json_encode(['joined' => true]);
    exit;
}
echo json_encode(['status' => 'error', 'error' => 'Invalid action']);
?>

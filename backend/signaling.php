<?php
require 'db.php';
session_start();
if (!isset($_SESSION['user_id'])) { http_response_code(403); exit; }

$action = $_GET['action'] ?? '';
if ($action === 'send' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $room_id = intval($_POST['room_id'] ?? 0);
    $message_type = $_POST['message_type'] ?? '';
    $message = $_POST['message'] ?? '';
    if (!$room_id || !$message_type) { echo json_encode(['status' => 'error']); exit; }
    $stmt = $pdo->prepare("INSERT INTO signaling_messages (room_id, user_id, message_type, message) VALUES (?, ?, ?, ?)");
    $stmt->execute([$room_id, $_SESSION['user_id'], $message_type, $message]);
    echo json_encode(['status' => 'ok']);
    exit;
}
if ($action === 'fetch') {
    $room_id = intval($_GET['room_id'] ?? 0);
    $last_id = intval($_GET['last_id'] ?? 0);
    $stmt = $pdo->prepare("SELECT * FROM signaling_messages WHERE room_id=? AND id>? ORDER BY id ASC");
    $stmt->execute([$room_id, $last_id]);
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    exit;
}
echo json_encode(['status' => 'error', 'error' => 'Invalid action']);
?>

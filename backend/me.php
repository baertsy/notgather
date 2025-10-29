<?php
require 'db.php';
session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    exit;
}
$stmt = $pdo->prepare("SELECT id, username FROM users WHERE id=?");
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if ($user) {
    echo json_encode($user);
} else {
    http_response_code(403);
}
?>

<?php
require 'db.php';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = trim($_POST['password'] ?? '');
    if (!$username || !$password) {
        echo json_encode(['status' => 'error', 'error' => 'Missing fields']);
        exit;
    }
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username=?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        echo json_encode(['status' => 'error', 'error' => 'Username exists']);
        exit;
    }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT INTO users (username, password) VALUES (?, ?)");
    $stmt->execute([$username, $hash]);
    echo json_encode(['status' => 'ok']);
}
?>

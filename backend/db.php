<?php
$pdo = new PDO('mysql:host=localhost;dbname=notgather;charset=utf8mb4', 'notgather', 'notgather');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
?>

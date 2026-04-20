<?php
    header('Content-Type: application/json');

    try {
        require_once('shared.php');
        $mysqli = @makeMysqli();
        if ($mysqli->connect_errno) {
            http_response_code(503);
            echo json_encode(['status' => 'degraded', 'db' => 'error']);
            exit();
        }
        $result = @$mysqli->query('SELECT 1');
        if ($result === false) {
            http_response_code(503);
            echo json_encode(['status' => 'degraded', 'db' => 'error']);
            exit();
        }
        $result->free();
        $mysqli->close();
        http_response_code(200);
        echo json_encode(['status' => 'ok', 'db' => 'ok']);
    } catch (Throwable $e) {
        http_response_code(503);
        echo json_encode(['status' => 'degraded', 'db' => 'error']);
    }
?>

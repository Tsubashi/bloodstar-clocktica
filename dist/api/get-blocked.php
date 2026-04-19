<?php
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $request = getPayload();
    $token = requireField($request, 'token');
    $tokenPayload = verifySession($token);

    $blocker = $tokenPayload['username'];
    validateUsername($blocker);

    $mysqli = makeMysqli();
    $escapedBlocker = $mysqli->real_escape_string($blocker);
    $result = $mysqli->query("SELECT `blockee` FROM `block` WHERE `blocker` = '$escapedBlocker';");
    if (false===$result){
        echo json_encode(array("error" => 'sql error'));
        exit();
    }

    $results = $result->fetch_all();
    $users = array();
    foreach ($results as $row) {
        list($user) = $row;
        array_push($users, $user);
    }

    echo json_encode(array("users" => $users));
?>
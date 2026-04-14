<?php
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $request = getPayload();
    $token = requireField($request, 'token');
    $tokenPayload = verifySession($token);

    $blocker = $tokenPayload['username'];
    validateUsername($blocker);

    $blockee = requireField($request, 'username');
    validateUsername($blockee);

    $mysqli = makeMysqli();
    $escapedBlocker = $mysqli->real_escape_string($blocker);
    $escapedBlockee = $mysqli->real_escape_string($blockee);

    $result = $mysqli->query("DELETE FROM `block` WHERE `blocker` = '$escapedBlocker' AND `blockee` = '$escapedBlockee';");

    if (false===$result){
        echo json_encode(array("error" => 'sql error'));
        exit();
    }
    echo json_encode(true);
?>
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

    // don't add yourself
    if ($blocker === $blockee) {
        echo json_encode(array("error" => 'can\'t block yourself'));
        exit();
    }

    // user has to exist
    $result = $mysqli->query("SELECT 1 FROM `users` WHERE `name` = '$escapedBlockee';");
    if (false===$result){
        echo json_encode(array("error" => 'sql error'));
        exit();
    }
    if (0===$result->num_rows){
        echo json_encode(array("error" => 'no such user'));
        exit();
    }

    // user has to not already be added
    $result = $mysqli->query("SELECT 1 FROM `block` WHERE `blocker` = '$escapedBlocker' AND `blockee` = '$escapedBlockee';");
    if (false===$result){
        echo json_encode(array("error" => 'sql error'));
        exit();
    }
    if (0!==$result->num_rows){
        echo json_encode(array("error" => 'user already added'));
        exit();
    }

    // finally go ahead and do it
    $result = $mysqli->query("INSERT INTO `block` (`blocker`, `blockee`) VALUES ('$escapedBlocker', '$escapedBlockee');");

    if (false===$result){
        echo json_encode(array("error" => 'sql error'));
        exit();
    }
    echo json_encode(true);
?>
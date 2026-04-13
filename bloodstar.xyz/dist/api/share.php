<?php
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $request = getPayload();
    $token = requireField($request, 'token');
    $tokenPayload = verifySession($token);

    $owner = $tokenPayload['username'];
    validateUsername($owner);

    $saveName = requireField($request, 'saveName');
    validateFilename($saveName);

    $mysqli = makeMysqli();
    $escapedOwner = $mysqli->real_escape_string($owner);
    $escapedEdition = $mysqli->real_escape_string($saveName);

    // specific user
    $user = requireField($request, 'user');
    validateUsername($user);
    $escapedUser = $mysqli->real_escape_string($user);

    // don't add yourself
    if ($user === $owner) {
        echo json_encode(array("error" => 'can\'t add yourself'));
        exit();
    }

    // user has to exist
    $result = $mysqli->query("SELECT 1 FROM `users` WHERE `name` = '$escapedUser';");
    if (false===$result){
        echo json_encode(array("error" => 'sql error'));
        exit();
    }
    if (0===$result->num_rows){
        echo json_encode(array("error" => 'no such user'));
        exit();
    }

    // user has to not already be added
    $result = $mysqli->query("SELECT 1 FROM `share` WHERE `owner` = '$escapedOwner' AND `edition` = '$escapedEdition' AND `user` = '$escapedUser';");
    if (false===$result){
        echo json_encode(array("error" => 'sql error'));
        exit();
    }
    if (0!==$result->num_rows){
        echo json_encode(array("error" => 'user already added'));
        exit();
    }

    // do insert
    $result = $mysqli->query("INSERT INTO `share` (`owner`, `edition`, `user`) VALUES ('$escapedOwner', '$escapedEdition', '$escapedUser');");
    if (false===$result){
        echo json_encode(array("error" => 'sql error'));
        exit();
    }
    echo json_encode(true);
?>
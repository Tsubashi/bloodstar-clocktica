<?php
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $request = getPayload();
    $token = requireField($request, 'token');
    $tokenPayload = verifySession($token);

    $user = $tokenPayload['username'];
    validateUsername($user);

    $owner = requireField($request, 'owner');
    validateUsername($owner);

    $saveName = requireField($request, 'saveName');
    validateFilename($saveName);

    $mysqli = makeMysqli();
    $escapedUser = $mysqli->real_escape_string($user);
    $escapedOwner = $mysqli->real_escape_string($owner);
    $escapedEdition = $mysqli->real_escape_string($saveName);

    $result = $mysqli->query("DELETE FROM `share` WHERE `share`.`owner` = '$escapedOwner' AND `share`.`edition` = '$escapedEdition' AND `share`.`user` = '$escapedUser';");
    if (false===$result){
        echo json_encode(array("error" => 'sql error'));
        exit();
    }
    echo json_encode(true);
?>
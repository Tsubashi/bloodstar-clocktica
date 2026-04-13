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

    // unshare with all
    if (array_key_exists('all', $request)) {
        $result = $mysqli->query("DELETE FROM `share` WHERE `share`.`owner` = '$escapedOwner' AND `share`.`edition` = '$escapedEdition';");
        if (false===$result){
            echo json_encode(array("error" => 'sql error'));
            exit();
        }
        echo json_encode(true);
        exit();
    }

    // unshare with specific user
    $user = requireField($request, 'user');
    validateUsername($user);
    $escapedUser = $mysqli->real_escape_string($user);
    $result = $mysqli->query("DELETE FROM`share` WHERE `share`.`owner` = '$escapedOwner' AND `share`.`edition` = '$escapedEdition' AND `share`.`user` = '$escapedUser';");
    if (false===$result){
        echo json_encode(array("error" => 'sql error'));
        exit();
    }
    echo json_encode(true);
?>
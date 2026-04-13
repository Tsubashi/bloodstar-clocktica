<?php
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $request = getPayload();
    $token = requireField($request, 'token');
    $tokenPayload = verifySession($token);

    $username = $tokenPayload['username'];
    validateUsername($username);

    $saveName = requireField($request, 'saveName');
    validateFilename($saveName);

    $mysqli = makeMysqli();
    $escapedOwner = $mysqli->real_escape_string($username);
    $escapedEdition = $mysqli->real_escape_string($saveName);
    $result = $mysqli->query("SELECT `share`.`user` FROM `share` WHERE `share`.`owner` = '$escapedOwner' AND `share`.`edition` = '$escapedEdition';");
    if (false===$result){
        echo json_encode(array("error" => 'sql error'));
        exit();
    }

    // easy case of empty result
    if (0===$result->num_rows){
        echo('{"users":[]}');
        exit();
    }

    // build array to return
    $users = array();

    $results = $result->fetch_all();
    foreach ($results as $row) {
        list($user) = $row;

        array_push($users, $user);
    }

    echo json_encode(array("users" => $users));
?>
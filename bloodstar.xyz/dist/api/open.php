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

    // opening your own saves
    if (!is_array($saveName)) {
        validateFilename($saveName);
        $data = readEditionFile($username, $saveName);
        // it's already JSON, so we just need to wrap it
        echo('{"data":'.$data.'}');
        exit();
    }

    // otherwise, your opening a shared save
    include('permission.php');
    list($owner, $saveName) = $saveName;
    validateUsername($owner);
    validateFilename($saveName);
    validatePermission($username, $owner, $saveName);
    $data = readEditionFile($owner, $saveName);
    // it's already JSON, so we just need to wrap it
    echo('{"data":'.$data.'}');
?>
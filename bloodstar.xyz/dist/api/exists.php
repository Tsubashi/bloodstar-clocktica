<?php
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $request = getPayload();
    $token = requireField($request, 'token');
    $tokenPayload = verifySession($token);

    $saveName = requireField($request, 'saveName');
    validateFilename($saveName);
    $username = $tokenPayload['username'];
    validateUsername($username);

    $userSaveDir = join_paths('../usersave', $username);
    $editionFolder = join_paths($userSaveDir, $saveName);
    $editionFilePath = join_paths($editionFolder, 'edition');
    echo json_encode(file_exists($editionFilePath));
?>
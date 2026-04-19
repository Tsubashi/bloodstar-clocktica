<?php
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $request = getPayload();
    $token = requireField($request, 'token');
    $tokenPayload = verifySession($token);
    $username = $tokenPayload['username'];
    $userSaveDir = join_paths('../usersave', $username);

    if (!file_exists($userSaveDir)) {
        mkdir($userSaveDir, 0777, true);
    }

    $items = scandir($userSaveDir);
    if (!$items) {
        echo json_encode(array('error' => 'could not scan directory'));
        exit();
    }

    $yourFiles = array();
    foreach ($items as $item) {
        if (startsWith($item, '.')) {continue;}
        $filepath = join_paths($userSaveDir, $item);
        if (is_dir($filepath)) {
            array_push($yourFiles, $item);
        }
    }

    // old client expects only a 'files' field
    if (!array_key_exists('includeShared', $request)) {
        echo json_encode(array('files' => $yourFiles));
        exit();
    }

    $sharedFiles = getSharedFiles($username);
    echo json_encode(array('files' => $yourFiles, 'shared' => $sharedFiles));

    function getSharedFiles($username) {
        $blockList = getBlockList($username);

        $mysqli = makeMysqli();
        $escapedUser = $mysqli->real_escape_string($username);
        $result = $mysqli->query("SELECT `share`.`owner`, `share`.`edition` FROM `share` WHERE `owner` <> '$escapedUser' AND `share`.`user` = '$escapedUser';");
        if (false===$result){
            echo json_encode(array("error" => 'sql error'));
            exit();
        }
        $sharedFiles = array();
        $results = $result->fetch_all();
        foreach ($results as $row) {
            list($owner, $edition) = $row;
            // filter out blocked users
            if (!in_array($owner, $blockList, true)) {
                if (!array_key_exists($owner, $sharedFiles)) {
                    $sharedFiles[$owner] = array();
                }
                array_push($sharedFiles[$owner], $edition);
            }
        }

        return $sharedFiles;
    }

    // users blocked by username
    function getBlockList($blocker) {
        $mysqli = makeMysqli();
        $escapedBlocker = $mysqli->real_escape_string($blocker);
        $result = $mysqli->query("SELECT `blockee` FROM `block` WHERE `blocker` = '$escapedBlocker';");
        if (false===$result){
            echo json_encode(array("error" => 'sql error'));
            exit();
        }
        $results = $result->fetch_all();
        $blockList = array();
        foreach ($results as $row) {
            list($blockee) = $row;
            array_push($blockList, $blockee);
        }
        return $blockList;
    }
?>
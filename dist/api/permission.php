<?php
    // error out if this edition is not marked for sharing with this user
    function validatePermission($username, $owner, $edition) {
        $mysqli = makeMysqli();
        $escapedUser = $mysqli->real_escape_string($username);
        $escapedOwner = $mysqli->real_escape_string($owner);
        $escapedEdition = $mysqli->real_escape_string($edition);
        $result = $mysqli->query("SELECT 1 FROM `share` WHERE `owner` = '$escapedOwner' AND `edition` = '$escapedEdition' AND `user` = '$escapedUser';");
        if (false===$result){
            echo json_encode(array("error" => 'sql error','debug'=>"SELECT 1 FROM `share` WHERE `owner` = '$escapedOwner' AND `edition` = '$escapedEdition' AND `user` = '$escapedUser');"));
            exit();
        }
        if (0===$result->num_rows){
            echo json_encode(['error' => 'this file is not shared with you','debug'=>"$escapedOwner, $escapedEdition, $escapedUser"]);
            exit();
        }
    }
?>
<?php
    ini_set('display_errors', '1');
    ini_set('display_startup_errors', '1');
    error_reporting(E_ALL);
    
    $days = 365;
    $time = time();
    $deleted = array();

    header('Content-Type: application/json;');
    
    include('shared.php');

    $publishDir = '../p';
    $saveDir = '../usersave';
    $publishedUsers = scandir($publishDir);
    if (!$publishedUsers) {
        echo '{"error":"could not scan directory"}';
        exit();
    }
    $savedUsers = scandir($saveDir);
    if (!$savedUsers) {
        echo '{"error":"could not scan directory"}';
        exit();
    }

    // clearing old saves
    /*$keptCount = 0;
    $deletedCount = 0;
    foreach ($savedUsers as $user) {
        if (startsWith($user, '.')) {continue;}
        $userpath = join_paths($saveDir, $user);
        if (!is_dir($userpath)) {continue;}
        $editions = scandir($userpath);
        if (!$editions) {
            echo '{"error":"could not scan directory"}';
            exit();
        }
        foreach ($editions as $edition) {
            if (startsWith($edition, '.')) {continue;}
            $editionpath = join_paths($userpath, $edition);
            if (!is_dir($editionpath)) {continue;}
            $editionFilePath = join_paths($editionpath, "edition");
            if (file_exists($editionFilePath)) {
                if (($time - fileatime($editionFilePath)) < ($days *86400)) {
                    $keptCount += 1;
                    continue;
                } else {
                    $deletedCount += 1;
                    //deleteDirectory($editionpath);
                }
            }
        }
    }
    echo json_encode(['deleted'=>$deletedCount, 'kept'=>$keptCount]);*/

    // clearing old publishes
    foreach ($publishedUsers as $user) {
        if (startsWith($user, '.')) {continue;}
        $userpath = join_paths($publishDir, $user);
        if (!is_dir($userpath)) {continue;}
        $editions = scandir($userpath);
        if (!$editions) {
            echo '{"error":"could not scan directory"}';
            exit();
        }
        foreach ($editions as $edition) {
            if (startsWith($edition, '.')) {continue;}
            $editionpath = join_paths($userpath, $edition);
            if (!is_dir($editionpath)) {continue;}
            $scriptPath = join_paths($editionpath, "script.json");
            if (file_exists($scriptPath)) {
                if (($time - fileatime($scriptPath)) < ($days *86400)) {
                    continue;
                }
            }
            $almanacPath = join_paths($editionpath, "almanac.html");
            if (file_exists($almanacPath)) {
                if (($time - fileatime($almanacPath)) < ($days *86400)) {
                    continue;
                }
            }
            // didn't hit a continue case, so it must be ok to delete.
            deleteDirectory($editionpath);
            array_push($deleted, $editionpath);
        }
    }

    echo json_encode(['deleted'=>$deleted]);

    // remove a directory and its files and subdirectories from the server
    function deleteDirectory($path) {
        if (is_dir($path)) {
            $subPaths = glob(join_paths($path, '*'));
            foreach ($subPaths as $subPath) {
                if (is_dir($subPath)){
                    deleteDirectory($subPath);
                } else {
                    unlink($subPath);
                }
            }
            rmdir($path);
        }
    }
?>
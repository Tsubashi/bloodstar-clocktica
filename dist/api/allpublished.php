<?php
    ini_set('display_errors', '1');
    ini_set('display_startup_errors', '1');
    error_reporting(E_ALL);

    header('Content-Type: application/json;');
    require_once('shared.php');

    $results = array();

    $publishDir = '../p';
    $users = scandir($publishDir);
    if (!$users) {
        echo '{"error":"could not scan directory"}';
        exit();
    }
    foreach ($users as $user) {
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
            $scriptPath = SITE_ROOT."/p/$user/$edition/script.json";
            $almanacPath = SITE_ROOT."/p/$user/$edition/almanac.html";
            $entry = array();
            if (file_exists(join_paths($editionpath, 'script.json'))) {
                array_push($entry, $scriptPath);
            }
            if (file_exists(join_paths($editionpath, 'almanac.html'))) {
                array_push($entry, $almanacPath);
            }
            if (0 < count($entry)) {
                array_push($results, $entry);
            }
        }
    }

    echo json_encode($results);
?>
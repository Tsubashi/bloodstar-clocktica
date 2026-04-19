<?php
    header('Content-Type: application/json;');
    
    $saveDir = '../save';
    
    if (!file_exists($saveDir)) {
        mkdir($saveDir, 0777, true);
    }

    function join_paths($a, $b) {
        return join('/', array(trim($a, '/'), trim($b, '/')));
    }

    $items = scandir($saveDir);
    if (!$items) {
        echo json_encode(array('error' => 'could not scan directory'));
        exit();
    }

    $list = array();
    foreach ($items as $key => $value) {
        if ($value == '.') {continue;}
        if ($value == '..') {continue;}
        $filepath = join_paths($saveDir, $value);
        if (is_dir($filepath)) {
            array_push($list, $value);
        }
    }

    echo json_encode(array('files' => $list));
?>
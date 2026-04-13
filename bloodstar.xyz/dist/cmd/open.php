<?php
    require_once('shared.php');
    requirePost();
    $request = getPayload();

    $saveName = requireField($request, 'saveName');

    $data = readEditionFile($saveName);

    echo('{"data":'.$data.'}');
?>
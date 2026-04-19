<?php
    require_once('shared.php');
    requirePost();
    $data = getPayload();

    $saveName = requireField($data, 'saveName');
    $id = requireField($data, 'id');
    if (!is_string($id) || ($id==='')) {
        echo json_encode(array('error' =>"Missing id for image"));
        exit();
    }

    $isSource = false;
    if (array_key_exists('isSource', $data)) {
        $isSource = $data['isSource'];
    }

    $dataUri = requireField($data, 'image');
    $base64 = preg_replace('/^.*,/', '', $dataUri);

    writeImage($saveName, $id, $isSource, base64_decode($base64));

    echo json_encode(array('success' => true));
?>
<?php
    require_once('shared.php');
    requirePost();
    $data = getPayload();

    $saveName = requireField($data, 'saveName');

    deleteEdition($saveName);

    echo json_encode(array('success' => true));

    // remove an entire edition from the server
    function deleteEdition($saveName) {
        global $saveDir;
        validateFilename($saveName);

        // edition save directory
        deleteDirectory(join_paths($saveDir, $saveName));

        // publish directory
        deleteDirectory(join_paths('../p', $saveName));
    }

    // remove a directoy and files within from the server
    // NOTE: does not handle subdirectories yet, just files
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
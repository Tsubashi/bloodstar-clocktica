<?php
    require_once('shared.php');
    requirePost();
    $data = getPayload();

    $saveName = requireField($data, 'saveName');
    $clobber = requireField($data, 'clobber');

    $customEdition = requireField($data, 'edition');
    writeEditionFile($saveName, $customEdition, $clobber);

    echo json_encode(array('success' => true));

    // encode as json and write to save directory
    function writeEditionFile($saveName, $data, $clobber) {
        global $saveDir;
        validateFilename($saveName);

        // ensure directory exists
        if (!file_exists($saveDir)) {
            mkdir($saveDir, 0777, true);
        }
        $editionFolder = join_paths($saveDir, $saveName);
        if (!file_exists($editionFolder)) {
            $success = mkdir($editionFolder, 0777, true);
            if (!$success) {
                echo json_encode(array('error' =>"could not make directory for '$saveName'"));
                exit();
            }
        }

        $editionFile = join_paths($editionFolder, 'edition');

        if (!$clobber && file_exists($editionFile)) {
            echo json_encode(array('clobberWarning' => "Save file '$saveName' already exists"));
            exit();
        }

        try {
            file_put_contents($editionFile, json_encode($data));
        } catch (Exception $e) {
            echo json_encode(array('error' =>"error writing file '$saveName'"));
            exit();
        }

        // delete any unused images
        if (is_dir($editionFolder)) {
            $usedImages = getUsedImages($data);
            foreach (glob(join_paths($editionFolder, '*.png')) as $subPath) {
                if (!array_key_exists(getFilename($subPath), $usedImages)) {
                    unlink($subPath);
                }
            }
        }
    }

    // examine edition data to see what images are used. returns an array where the keys are filenames of all the images that are in use
    function getUsedImages($data){
        $usedImages = array();

        // logo image
        if (array_key_exists('meta', $data)){
            $meta = $data['meta'];
            if (array_key_exists('logo', $meta)){
                $logoUri = $meta['logo'];
                if (!startsWith($logoUri,'data:')){
                    $filename = getFilename($logoUri);
                    $usedImages[$filename] = true;
                }
            }
        }

        // character images
        if (array_key_exists('characterList', $data)){
            $characterList = $data['characterList'];
            foreach ($characterList as $character) {
                if (array_key_exists('styledImage', $character)) {
                    $imageUri = $character['styledImage'];
                    if (!startsWith($imageUri,'data:')){
                        $filename = getFilename($imageUri);
                        $usedImages[$filename] = true;
                    }
                }
                if (array_key_exists('unStyledImage', $character)) {
                    $imageUri = $character['unStyledImage'];
                    if (!startsWith($imageUri,'data:')){
                        $filename = getFilename($imageUri);
                        $usedImages[$filename] = true;
                    }
                }
            }
        }

        return $usedImages;
    }
?>
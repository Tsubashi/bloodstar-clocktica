<?php
    $maxEditions = 30;
    $maxCharacters = 200;
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $request = getPayload();
    $token = requireField($request, 'token');
    $tokenPayload = verifySession($token);

    $username = $tokenPayload['username'];
    validateUsername($username);

    $clobber = optionalField($request, 'clobber', false);
    validateBoolean($clobber);
    $customEdition = requireField($request, 'edition');
    validateEdition($customEdition);
    $saveName = requireField($request, 'saveName');
    validateFilename($saveName);

    validateEditionLimit($maxEditions, $username, $saveName);
    validateCharacterLimit($maxCharacters, $customEdition);

    writeEditionFile($username, $saveName, $customEdition, $clobber);

    echo json_encode(array('success' => true));

    // encode as json and write to save directory
    function writeEditionFile($username, $saveName, $data, $clobber) {
        $userSaveDir = join_paths('../usersave', $username);
        if (!file_exists($userSaveDir)) {
            mkdir($userSaveDir, 0777, true);
        }
        $editionFolder = join_paths($userSaveDir, $saveName);
        if (!file_exists($editionFolder)) {
            $success = mkdir($editionFolder, 0777, true);
            if (!$success) {
                echo json_encode(array('error' =>"could not make directory for '$saveName'"));
                exit();
            }
        }
        $editionFilePath = join_paths($editionFolder, 'edition');

        if (!$clobber && file_exists($editionFilePath)) {
            echo '"clobber"';
            exit();
        }

        try {
            file_put_contents($editionFilePath, json_encode($data));
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

    // bail with an error if there are too many
    function validateEditionLimit($maxEditions, $username, $saveName) {
        $userSaveDir = join_paths('../usersave', $username);
        $editionFolder = join_paths($userSaveDir, $saveName);
        $editionFilePath = join_paths($editionFolder, 'edition');
        $isGrandfathered = file_exists($editionFilePath) ?? false;
        $numEditions = count(glob(join_paths($userSaveDir, '*')));
        if (($numEditions > $maxEditions) && (!$isGrandfathered)) {
            echo json_encode(['error'=>"too many save files ($numEditions / $maxEditions)"]);
            exit();
        }
    }

    // bail with an error if there are too many
    function validateCharacterLimit($maxCharacters, $customEdition) {
        if (!array_key_exists('characterList', $customEdition)) {return;}
        $characterList = $customEdition['characterList'];
        $numCharacters = count($characterList);
        if ($numCharacters > $maxCharacters) {
            echo "{\"error\":\"too many characters ($numCharacters / $maxCharacters)\"}";
            exit();
        }
    }
?>
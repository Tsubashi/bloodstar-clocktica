<?php
    $imageSizeMax = 512*1024;
    $maxImages = 200;
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $data = getPayload();
    $token = requireField($data, 'token');
    $tokenPayload = verifySession($token);

    $saveName = requireField($data, 'saveName');
    validateFilename($saveName);

    $id = requireField($data, 'id');
    validateCharacterId($id);

    $isSource = requireField($data, 'isSource');
    validateBoolean($isSource);

    $dataUri = requireField($data, 'image');
    $base64 = preg_replace('/^.*,/', '', $dataUri);
    $decodedImage = base64_decode($base64);
    if (false === $decodedImage) {
        echo '{"error":"invalid image data"}';
        exit();
    }

    // validate image size
    $size = strlen($decodedImage);
    if ($size > $imageSizeMax) {
        echo "{\"error\":\"image too large ($size B)\"}";
        exit();
    }

    $username = $tokenPayload['username'];
    validateUsername($username);

    // validate image limit
    validateImageLimit($maxImages, $username, $saveName);

    writeImage($username, $saveName, $id, $isSource, $decodedImage);

    echo json_encode(array('success' => true));

    // binary data to ${id}.png in save directory
    function writeImage($username, $saveName, $id, $isSource, $binaryData) {
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

        $suffix = $isSource ? '.src.png.temp' : '.png.temp';

        $path = join_paths($editionFolder, $id.$suffix);

        try {
            # write to a temp file and then rename to make sure we break hard links
            file_put_contents($path, $binaryData);
            rename($path, join_paths($editionFolder, $id.($isSource ? '.src.png' : '.png')));
        } catch (Exception $e) {
            echo json_encode(array('error' =>"error writing file '$saveName'"));
            exit();
        }
    }

    // bail with an error if there are a too many images
    function validateImageLimit($maxImages, $username, $saveName) {
        $userSaveDir = join_paths('../usersave', $username);
        $editionFolder = join_paths($userSaveDir, $saveName);
        if (is_dir($editionFolder)) {
            $numImages = count(glob(join_paths($editionFolder, '*.png')));
            if ($numImages > $maxImages) {
                echo "{\"error\":\"too many images ($numImages / $maxImages)\"}";
                exit();
            }
        }
    }
?>

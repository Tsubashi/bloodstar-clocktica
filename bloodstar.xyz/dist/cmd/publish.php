<?php
    require_once('shared.php');
    include('almanac.php');
    requirePost();
    $data = getPayload();

    $saveName = requireField($data, 'saveName');

    // read save file
    $data = readEditionFile($saveName);
    $data = json_decode($data, true);

    // build script.json from it
    $script = makeScript($data, $saveName);

    // ensure directory exists
    $publishDir = join_paths('../p', $saveName);
    if (!file_exists($publishDir)) {
        mkdir($publishDir, 0777, true);
    }

    // write file
    try {
        file_put_contents(
            join_paths($publishDir, 'script.json'),
            json_encode($script)
        );
    } catch (Exception $e) {
        echo json_encode(array('error' =>"error writing script.json"));
        exit();
    }

    // move images
    $editionFolder = join_paths($saveDir, $saveName);
    foreach ($script as $character) {
        $id = $character['id'];
        $filename = $id.'.png';
        $sourcePath = join_paths($editionFolder, $filename);
        $destinationPath = join_paths($publishDir, $filename);
        if (is_file($sourcePath)) {
            if (!copy($sourcePath, $destinationPath)){
                echo json_encode(array('error' =>'error copying '.$sourcePath.' to '.$destinationPath));
                exit();
            }
        }
    }
    // edition logo
    {
        $filename = '_meta.png';
        $sourcePath = join_paths($editionFolder, $filename);
        $destinationPath = join_paths($publishDir, $filename);
        if (is_file($sourcePath)) {
            if (!copy($sourcePath, $destinationPath)){
                echo json_encode(array('error' =>'error copying '.$sourcePath.' to '.$destinationPath));
                exit();
            }
        }
    }

    // almanac
    try {
        $almanac = makeAlmanac($data, $saveName);
        file_put_contents(join_paths($publishDir, 'almanac.html'), $almanac);
    } catch (Exception $e) {
        echo json_encode(array('error' =>"error writing almanac.html"));
        exit();
    }

    // cleanup unused
    try {
        deleteUnusedImages($script, $publishDir);
    } catch (Exception $e) {
        // ignoring errors in deleting unused images
    }

    echo json_encode(array(
        'success' => true,
        'script'=> SITE_ROOT . '/p/' . $saveName . '/script.json',
        'almanac'=> SITE_ROOT . '/p/' . $saveName . '/almanac.html')
    );

    // examine script to see what images are used. delete any that are unused
    function deleteUnusedImages($script, $publishDir){
        $usedImages = array();

        // collect set of used images
        foreach ($script as $character) {
            if (array_key_exists('logo', $character)) {
                $filename = getFilename($character['logo']);
                $usedImages[$filename] = true;
            }
            if (array_key_exists('image', $character)) {
                $filename = getFilename($character['image']);
                $usedImages[$filename] = true;
            }
        }

        // delete any that don't match
        if (is_dir($publishDir)) {
            $subPaths = glob(join_paths($publishDir, '*.png'));
            foreach ($subPaths as $subPath) {
                if (!array_key_exists(getFilename($subPath), $usedImages)) {
                    unlink($subPath);
                }
            }
        }
    }

    // copy field if it is present
    function copyField($srcArray, $srcName, &$dstArray, $dstName) {
        if (array_key_exists($srcName, $srcArray)){
            $dstArray[$dstName] = $srcArray[$srcName];
        }
    }

    // build the script object to convert to json
    function makeScript($saveData, $saveName) {
        $scriptData = array();

        if (array_key_exists('meta', $saveData)){
            $inMeta = $saveData['meta'];
            $outMeta = array('id'=>'_meta');

            copyField($inMeta, 'name', $outMeta, 'name');
            copyField($inMeta, 'author', $outMeta, 'author');

            // edition logo
            if (array_key_exists('logo', $inMeta)){
                if (preg_match("/^data:$/", $inMeta['logo'])) {
                    $outMeta['logo'] = $inMeta['logo'];
                } else {
                    $outMeta['logo'] = 'https://bloodstar.18m250.org/p/'.$saveName.'/_meta.png';
                }
            }

            $scriptData[] = &$outMeta;
        }

        $charactersById = array();

        if (array_key_exists('characterList', $saveData)){
            $characterList = $saveData['characterList'];
            foreach ($characterList as $inCharacter) {
                unset($outCharacter); // make sure it's a new variable each time through the loop, because we need to pass out references

                $id = $inCharacter['id'];

                // skip if not supposed to be exported
                if (array_key_exists('export', $inCharacter)) {
                    if (!$inCharacter['export']) {continue;}
                }

                $outCharacter = array();
                if (array_key_exists('id', $inCharacter)) {
                    $outCharacter['id'] = $id;
                    $charactersById[$id] = &$outCharacter;
                }

                // copy image over to publish directory
                if (array_key_exists('styledImage', $inCharacter)) {
                    if (preg_match("/^data:$/", $inCharacter['styledImage'])) {
                        $outCharacter['image'] = $inCharacter['styledImage'];
                    } else {
                        $outCharacter['image'] = 'https://bloodstar.18m250.org/p/'.$saveName.'/'.$id.'.png';
                    }
                }

                copyField($inCharacter, 'edition', $outCharacter, 'edition');
                copyField($inCharacter, 'firstNightReminder', $outCharacter, 'firstNightReminder');
                copyField($inCharacter, 'otherNightReminder', $outCharacter, 'otherNightReminder');
                if (array_key_exists('characterReminderTokens', $inCharacter)){
                    $outCharacter['reminders'] = explode("\n", $inCharacter['characterReminderTokens']);
                }
                if (array_key_exists('globalReminderTokens', $inCharacter)){
                    $outCharacter['remindersGlobal'] = explode("\n", $inCharacter['globalReminderTokens']);
                }
                copyField($inCharacter, 'setup', $outCharacter, 'setup');
                copyField($inCharacter, 'name', $outCharacter, 'name');
                copyField($inCharacter, 'team', $outCharacter, 'team');
                copyField($inCharacter, 'ability', $outCharacter, 'ability');

                $scriptData[] = &$outCharacter;
            }
        }

        // night order
        if (array_key_exists('firstNightOrder', $saveData)){
            $firstNightOrder = $saveData['firstNightOrder'];
            $i = 1;
            foreach ($firstNightOrder as $id) {
                if (array_key_exists($id, $charactersById)) {
                    $character = &$charactersById[$id];
                    if (array_key_exists('firstNightReminder', $character) && $character['firstNightReminder']!=='') {
                        $character['firstNight'] = $i + 1;
                        $i = $i + 1;
                    }
                }
            }
        }
        if (array_key_exists('otherNightOrder', $saveData)){
            $otherNightOrder = $saveData['otherNightOrder'];
            $i = 1;
            foreach ($otherNightOrder as $id) {
                if (array_key_exists($id, $charactersById)) {
                    $character = &$charactersById[$id];
                    if (array_key_exists('otherNightReminder', $character) && $character['otherNightReminder']!=='') {
                        $character['otherNight'] = $i + 1;
                        $i = $i + 1;
                    }
                }
            }
        }

        return $scriptData;
    }
?>
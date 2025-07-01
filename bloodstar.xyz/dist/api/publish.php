<?php
    header('Content-Type: application/json;');
    include('shared.php');
    include('almanac.php');
    requirePost();
    $request = getPayload();
    $token = requireField($request, 'token');
    $tokenPayload = verifySession($token);
    $username = $tokenPayload['username'];
    validateUsername($username);

    $saveName = requireField($request, 'saveName');
    validateFilename($saveName);
    
    // read save file
    $data = readEditionFile($username, $saveName);
    $data = json_decode($data, true);

    // build script.json from it
    $script = makeScript($data, $saveName, $username);

    // ensure publish directory exists
    $publishDir = "../p/$username/$saveName";
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

    // images
    $userSaveDir = join_paths('../usersave', $username);
    $editionFolder = join_paths($userSaveDir, $saveName);
    moveImages($script, $editionFolder, $publishDir);

    // almanac
    try {
        $almanac = makeAlmanac($data, $username, $saveName);
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

    // dump ALL THE DATA
    try {
        file_put_contents(
            join_paths($publishDir, 'full.json'),
            json_encode(makeFullJson($data, $saveName, $username))
        );
    } catch (Exception $e) {
    }

    echo json_encode(array(
        'success' => true,
        'script'=>SITE_ROOT."/p/$username/$saveName/script.json",
        'almanac'=>SITE_ROOT."/p/$username/$saveName/almanac.html")
    );

    // copy field if it is present
    function copyField($srcArray, $srcName, &$dstArray, $dstName) {
        if (array_key_exists($srcName, $srcArray)){
            $dstArray[$dstName] = $srcArray[$srcName];
        }
    }

    // special handling for the special field
    function copySpecial($srcArray, &$dstArray) {
        if (array_key_exists('special', $srcArray)) {
            $special = $srcArray['special'];
            if ($special == 'showGrimoire') {
                $dstArray['special'] = [
                    array(
                        'name' => 'grimoire',
                        'type' => 'signal',
                        'time' => 'night',
                    )
                ];
            } elseif ($special == 'point') {
                $dstArray['special'] = [
                    array(
                        'name' => 'pointing',
                        'type' => 'ability',
                        'time' => 'day',
                    )
                ];
            }
        }
    }

    function copyFieldWithSubstitutions(
        $character,
        $sourceField,
        &$dstArray,
        $dstName
    ) {
        if (!array_key_exists($sourceField, $character)){return;}
        $originalText = $character[$sourceField];
        $text = doSubstitutions($character, $originalText);
        $dstArray[$dstName] = $text;
    }

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

    // build the script object to convert to json
    function makeScript($saveData, $saveName, $username) {
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
                    $outMeta['logo'] = "https://bloodstar.18m250.org/p/$username/$saveName/_meta.png";
                }
            }

            $outMeta['almanac'] = "https://bloodstar.18m250.org/p/$username/$saveName/almanac.html";

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
                        $outCharacter['image'] = "https://bloodstar.18m250.org/p/$username/$saveName/$id.png";
                    }
                }

                copyField($inCharacter, 'edition', $outCharacter, 'edition');
                copyFieldWithSubstitutions($inCharacter, 'firstNightReminder', $outCharacter, 'firstNightReminder');
                copyFieldWithSubstitutions($inCharacter, 'otherNightReminder', $outCharacter, 'otherNightReminder');
                if (array_key_exists('characterReminderTokens', $inCharacter)){
                    $outCharacter['reminders'] = explode("\n", $inCharacter['characterReminderTokens']);
                }
                if (array_key_exists('globalReminderTokens', $inCharacter)){
                    $outCharacter['remindersGlobal'] = explode("\n", $inCharacter['globalReminderTokens']);
                }
                copyField($inCharacter, 'setup', $outCharacter, 'setup');
                copyField($inCharacter, 'name', $outCharacter, 'name');
                copyField($inCharacter, 'team', $outCharacter, 'team');
                copyFieldWithSubstitutions($inCharacter, 'ability', $outCharacter, 'ability');
                copySpecial($inCharacter, $outCharacter);
                copyFieldWithSubstitutions($inCharacter, 'attribution', $outCharacter, 'attribution');
                
                if (array_key_exists('almanac', $inCharacter)) {
                    $almanac = $inCharacter['almanac'];
                    copyField($almanac, 'flavor', $outCharacter, 'flavor');
                }

                $scriptData[] = &$outCharacter;
            }
        }

        // night order
        if (array_key_exists('firstNightOrder', $saveData)){
            $firstNightOrder = $saveData['firstNightOrder'];
            $i = 10; // start higher so that it's after Demon/Minion info
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

    // all the extras
    function makeFullJson($saveData, $saveName, $username) {
        // php is weird and I guess this automagically does a copy-on-write deep copy for me???
        $clone = $saveData;

        // add links
        $clone['links'] = array(
            'script' => "https://bloodstar.18m250.org/p/$username/$saveName/script.json",
            'almanac' => "https://bloodstar.18m250.org/p/$username/$saveName/almanac.html"
        );

        // convert logo path to point at published version
        if (array_key_exists('meta', $clone)){
            $meta = $clone['meta'];
            if (array_key_exists('logo', $meta)){
                if (!preg_match("/^data:$/", $meta['logo'])) {
                    $meta['logo'] = "https://bloodstar.18m250.org/p/$username/$saveName/_meta.png";
                }
            }
            // reassign so the changes stick
            $clone['meta'] = $meta;
        }

        function includeCharacterInExport($character) {
            if (array_key_exists('export', $character)) {
                if (!$character['export']) {
                    return false;
                }
            }
            return true;
        }

        // convert character image paths, remove source images
        if (array_key_exists('characterList', $clone)){

            // filter out any which are not supposed to be exported
            $characterList = array_values(array_filter($clone['characterList'], "includeCharacterInExport"));

            foreach (array_keys($characterList) as $key) {
                $character = $characterList[$key];
                $id = $character['id'];
                if (array_key_exists('styledImage', $character)) {
                    if (!preg_match("/^data:$/", $character['styledImage'])) {
                        $character['styledImage'] = "https://bloodstar.18m250.org/p/$username/$saveName/$id.png";
                    }
                }
                if (array_key_exists('unStyledImage', $character)) {
                    unset($character['unStyledImage']);
                }
                // reassign so the changes stick
                $characterList[$key] = $character;
            }

            // reassign so the changes stick
            $clone['characterList'] = $characterList;
        }

        return $clone;
    }

    // copy over images used by the script
    function moveImages($script, $editionFolder, $publishDir) {
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
?>

<?php
    include('../parsedown/Parsedown.php');
    require_once('shared.php');

    $Parsedown = new Parsedown();

    // build html for the almanac
    function makeAlmanac($saveData, $username, $saveName) {
        $name = $saveData['meta']['name'];

        return
'<!DOCTYPE html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css?family=Roboto+Condensed&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=PT+Serif&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Nova+Script&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=MedievalSharp&display=swap" rel="stylesheet">
<link rel="stylesheet" type="text/css" media="screen" href="'. SITE_ROOT .'/p/almanac.css">
<link rel="stylesheet" type="text/css" media="print" href="'. SITE_ROOT .'/p/print.css">
<title>'.$name.' Almanac - Bloodstar</title>
</head><body><div class="almanac-row">
<ol class="nav">'
.makeNavItems($saveData)
.'</ol><ol class="almanac-viewport">'
.makeAlmanacItems($saveData, $username, $saveName)
.makeNightOrder($saveData, $username, $saveName)
.'<li class="generated-by">this almanac generated using <a href="'. SITE_ROOT .'">Bloodstar Clocktica</a></li>'
.'<li class="donate"><span>Enjoying Bloodstar? Donate to help with hosting!</span><a href="https://ko-fi.com/tsubashi" target="_blank"><img alt="Donate!" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" /></a></li>'
.'</ol></div></body></html>';
    }

    // build html for night order pages
    function makeNightOrder($saveData, $username, $saveName) {
        if (!array_key_exists('characterList', $saveData)){return '';}
        if (!array_key_exists('firstNightOrder', $saveData)){return '';}

        $almanacHtml = '';

        // build character map
        $firstNightCharacterMap = array();
        $otherNightCharacterMap = array();
        $characterList = $saveData['characterList'];
        foreach ($characterList as $character) {
            // skip if not supposed to be exported
            if (array_key_exists('export', $character)) {
                if (!$character['export']) {continue;}
            }
            $id = $character['id'] ?? 'newcharacter';
            // first night order
            if (array_key_exists('firstNightReminder', $character) && ($character['firstNightReminder'] !== '')) {
                $firstNightCharacterMap[$id] = $character;
            }
            // other night order
            if (array_key_exists('otherNightReminder', $character) && ($character['otherNightReminder'] !== '')) {
                $otherNightCharacterMap[$id] = $character;
            }
        }

        // begin page
        $almanacHtml .= "<li class=\"page\" id=\"nightOrder\"><div class=\"page-contents\"><h2>Night Order</h2><div class=\"nightOrder\">";

        // begin first night column
        $almanacHtml .= "<div class=\"firstNightColumn\"><h3>First Night</h3><div class=\"nightOrderList\">";

        // each character in first night
        $firstNightOrder = $saveData['firstNightOrder'];
        foreach ($firstNightOrder as $characterId) {
            if (!array_key_exists($characterId, $firstNightCharacterMap)) {continue;}
            $character = $firstNightCharacterMap[$characterId];
            $name = $character['name'] ?? 'New Character';
            $id = $character['id'] ?? 'newcharacter';

            // character image
            if (array_key_exists('styledImage', $character)){
                $image = "/p/$username/$saveName/$id.png";
                $almanacHtml .= "<img class=\"nightOrderListIcon\" src=\"$image\" alt=\"\"/>";
            } else {
                $almanacHtml .= "<div></div>";
            }

            // character name
            $almanacHtml .= "<div class=\"nightOrderListName\">$name</div>";
        }

        // end first night column
        $almanacHtml .= "</div></div>";

        // begin other nights column
        $almanacHtml .= "<div class=\"otherNightsColumn\"><h3>Other Nights</h3><div class=\"nightOrderList\">";

        // each character in other nights
        $otherNightOrder = $saveData['otherNightOrder'];
        foreach ($otherNightOrder as $characterId) {
            if (!array_key_exists($characterId, $otherNightCharacterMap)) {continue;}
            $character = $otherNightCharacterMap[$characterId];
            $name = $character['name'] ?? 'New Character';
            $id = $character['id'] ?? 'newcharacter';

            // character image
            if (array_key_exists('styledImage', $character)){
                $image = "/p/$username/$saveName/$id.png";
                $almanacHtml .= "<img class=\"nightOrderListIcon\" src=\"$image\" alt=\"\"/>";
            } else {
                $almanacHtml .= "<div></div>";
            }

            // character name
            $almanacHtml .= "<div class=\"nightOrderListName\">$name</div>";
        }

        // end other nights column
        $almanacHtml .= "</div></div>";

        // end page
        $almanacHtml .= "</div></div></li>";
        return $almanacHtml;
    }

    // build html for almanac content
    function makeAlmanacItems($saveData, $username, $saveName) {
        global $Parsedown;
        $almanacHtml = '';
        $name = $saveName;
        $hasLogo = false;

        if (array_key_exists('meta', $saveData)) {
            $meta = $saveData['meta'];
            $name = $meta['name'];
            $hasLogo = array_key_exists('logo', $meta);
        }

        if (array_key_exists('almanac', $saveData)) {
            $almanac = $saveData['almanac'];
            if (array_key_exists('synopsis', $almanac)) {
                $almanacHtml .= '<li class="page" id="synopsis"><div class="page-contents">';
                $almanacHtml .= $Parsedown->text($almanac['synopsis']);
                if ($hasLogo) {
                    $almanacHtml .= "<img src=\"/p/$username/$saveName/_meta.png\" alt=\"$name\"/>";
                }
                $almanacHtml .= '</div></li>';
            }
            if (array_key_exists('overview', $almanac)) {
                $almanacHtml .= '<li class="page" id="overview"><div class="page-contents">';
                $overview = $Parsedown->text($almanac['overview']);
                if ($hasLogo) {
                    $inlineLogo = "<img src=\"/p/$username/$saveName/_meta.png\" alt=\"$name\" class=\"inline-logo\"/>";
                    $insertPos = strpos($overview, '<p>') + 3;
                    $overview = substr_replace($overview, $inlineLogo, $insertPos, 0);
                }
                $almanacHtml .= $overview;
                $almanacHtml .= '</div></li>';
            }
            if (array_key_exists('changelog', $almanac)) {
                $almanacHtml .= '<li class="page" id="changelog"><div class="page-contents">';
                $almanacHtml .= '<h2>Changelog</h2><hr><div class="overview">';
                $almanacHtml .= $Parsedown->text($almanac['changelog']);
                $almanacHtml .= '</div></div></li>';
            }
        }

        if (array_key_exists('characterList', $saveData)){
            $characterList = $saveData['characterList'];
            foreach ($characterList as $character) {

                // skip if not supposed to be exported
                if (array_key_exists('export', $character)) {
                    if (!$character['export']) {continue;}
                }

                $id = $character['id'] ?? 'newcharacter';
                $team = $character['team'] ?? 'townsfolk';
                $teamDisplay = ucfirst($team);
                $name = $character['name'] ?? 'New Character';

                // begin page
                $almanacHtml .= "<li class=\"page\" id=\"$id\"><div class=\"page-contents $team\">";

                // character image
                if (array_key_exists('styledImage', $character)){
                    $image = "/p/$username/$saveName/$id.png";
                    $almanacHtml .= "<img src=\"$image\" class=\"characterImage\" alt=\"\"/>";
                }

                // name
                $almanacHtml .= "<h2>$name</h2>";

                // ability
                {
                    $abilityHtml = doSubstitutions($character, $character['ability'] ?? '');
                    $almanacHtml .= "<p class=\"ability\">$abilityHtml</p>";
                }

                // line
                $almanacHtml .= '<hr>';

                if (array_key_exists('almanac', $character)) {
                    $almanac = $character['almanac'];

                    // flavor
                    {
                        $flavor = $almanac['flavor'] ?? '';
                        if ($flavor !== '') {
                            $flavorHtml = '“'.$flavor.'”';
                            $almanacHtml .= "<div class=\"flavor\">$flavorHtml</div>";
                        }
                    }

                    // overview
                    {
                        $overview = $almanac['overview'] ?? '';
                        if ($overview !== '') {
                            $almanacHtml .= '<div class="overview">';
                            $almanacHtml .= $Parsedown->text(doSubstitutions($character, $overview));
                            $almanacHtml .= '</div>';
                        }
                    }

                    // examples
                    {
                        $examples = $almanac['examples'] ?? '';
                        if ($examples !== '') {
                            $almanacHtml .= '<h3>Examples</h3>';
                            $almanacHtml .= '<div class="example">';
                            $almanacHtml .= $Parsedown->text(doSubstitutions($character, $examples));
                            $almanacHtml .= '</div>';
                        }
                    }

                    // how to run
                    {
                        $howToRun = $almanac['howToRun'] ?? '';
                        if ($howToRun !== '') {
                            $almanacHtml .= '<h3>How to Run</h3>';
                            $almanacHtml .= '<div class="how-to-run">';
                            $almanacHtml .= $Parsedown->text(doSubstitutions($character, $howToRun));
                            $almanacHtml .= '</div>';
                        }
                    }

                    // tips
                    {
                        $tips = $almanac['tip'] ?? '';
                        if ($tips !== '') {
                            $almanacHtml .= '<div class="tip">';
                            $almanacHtml .= $Parsedown->text(doSubstitutions($character, $tips));
                            $almanacHtml .= '</div>';
                        }
                    }
                }

                // attribution
                if (array_key_exists('attribution', $character)){
                    $attribution = $character['attribution'] ?? '';
                    $almanacHtml .= '<h3>Attribution</h3>';
                    $almanacHtml .= "<div class=\"attribution\">";
                    $almanacHtml .= $Parsedown->text(doSubstitutions($character, $attribution));
                    $almanacHtml .= "</div>";
                }

                // team
                $almanacHtml .= "<p class=\"team\">$teamDisplay</p>";

                // end page tags
                $almanacHtml .= "</div></li>";
            }
        }

        return $almanacHtml;
    }

    // build html for the nav list items
    function makeNavItems($saveData) {
        $items = '';
        $name = '';

        if (array_key_exists('meta', $saveData)) {
            $meta = $saveData['meta'];
            $name = $meta['name'];
        }

        if (array_key_exists('almanac', $saveData)) {
            $almanac = $saveData['almanac'];
            if (array_key_exists('synopsis', $almanac)) {
                $items .= makeNavItem('Synopsis', 'synopsis', '');
            }
            if (array_key_exists('overview', $almanac)) {
                $items .= makeNavItem('Overview', 'overview', '');
            }
            if (array_key_exists('changelog', $almanac)) {
                $items .= makeNavItem('Changelog', 'changelog', '');
            }
        }

        if (array_key_exists('characterList', $saveData)){
            $characterList = $saveData['characterList'];

            foreach ($characterList as $character) {

                // skip if not supposed to be exported
                if (array_key_exists('export', $character)) {
                    if (!$character['export']) {continue;}
                }

                if (array_key_exists('name', $character) && array_key_exists('id', $character)){
                    $team = $character['team'] ?? '';
                    $items .= makeNavItem($character['name'], $character['id'], $team);
                }
            }

            $items .= makeNavItem('Night Order', 'nightOrder', '');
        }

        return $items;
    }

    // html for a single nav item
    function makeNavItem($label,$id,$class){
        return "<li class=\"$class\"><a href=\"#$id\">$label</a></li>";
    }

    // variable substitutions
    function doSubstitutions($character, $originalText) {
        $name = $character['name'] ?? 'New Character';
        return str_replace('$capname', strtoupper($name),
            str_replace('$name', $name, $originalText));
    }
?>
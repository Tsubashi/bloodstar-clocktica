<?php
    include('../parsedown/Parsedown.php');
    include('shared.php');

    $Parsedown = new Parsedown();

    // build html for the almanac
    function makeAlmanac($saveData, $saveName) {
        $name = $saveData['meta']['name'];

        return 
'<!DOCTYPE html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css?family=Roboto+Condensed&display=swap" rel="stylesheet">
<link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=PT+Serif&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Nova+Script&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=MedievalSharp&display=swap" rel="stylesheet">
<link rel="stylesheet" type="text/css" href="<?= SITE_ROOT ?>/p/almanac.css">
<title>'.$name.' Almanac</title>
</head><body><div class="almanac-row">
<ol class="nav">'
.makeNavItems($saveData)
.'</ol><ol class="almanac-viewport">'
.makeAlmanacItems($saveData, $saveName)
.'<li class="generated-by">this almanac generated using <a href="<?= SITE_ROOT ?>">Bloodstar Clocktica</a></li>'
.'</ol></div></body></html>';
    }

    // build html for almanac content
    function makeAlmanacItems($saveData, $saveName) {
        global $Parsedown;
        $almanacHtml = '';
        $name = $saveName;

        if (array_key_exists('meta', $saveData)) {
            $meta = $saveData['meta'];
            $name = $meta['name'];
        }

        if (array_key_exists('almanac', $saveData)) {
            $almanac = $saveData['almanac'];
            if (array_key_exists('synopsis', $almanac)) {
                $almanacHtml .= '<li class="page" id="synopsis"><div class="page-contents">';
                $almanacHtml .= $Parsedown->text($almanac['synopsis']);
                $almanacHtml .= "<img src=\"/p/$saveName/_meta.png\" alt=\"$name\">";
                $almanacHtml .= '</div></li>';
            }
            if (array_key_exists('overview', $almanac)) {
                $almanacHtml .= '<li class="page" id="overview"><div class="page-contents">';
                $inlineLogo = "<img src=\"/p/$saveName/_meta.png\" alt=\"$name\" class=\"inline-logo\">";
                $overview = $Parsedown->text($almanac['overview']);
                $insertPos = strpos($overview, '<p>') + 3;
                $overview = substr_replace($overview, $inlineLogo, $insertPos, 0);
                $almanacHtml .= $overview;
                $almanacHtml .= '</div></li>';
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
                $almanacHtml .= "<li class=\"page\" id=\"$id\"><div class=\"page-contents $team\" ";

                // character image
                if (array_key_exists('styledImage', $character)){
                    $image = $character['styledImage'];
                    $almanacHtml .= "style=\"background-image:url('$image');\"><div class=\"spacer\"></div";
                }
                $almanacHtml .= '>';

                // name
                $almanacHtml .= "<h2>$name</h2>";

                // ability
                {
                    $abilityHtml = doSubstitutions($character, $character['ability'] ?? '');
                    $almanacHtml .= "<p class=\"ability\">$abilityHtml</p>";
                }

                // line
                $almanacHtml .= '<hr>';

                if (!array_key_exists('almanac', $character)) {continue;}
                $almanac = $character['almanac'];

                // flavor
                {
                    $flavor = $almanac['flavor'] ?? '';
                    if ($flavor !== '') {
                        $flavorHtml = $Parsedown->text('“'.$flavor.'”');
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
                

                // team, end page tags
                $almanacHtml .= "<p class=\"team\">$teamDisplay</p></div></li>";
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
                $items .= makeNavItem('Synopsis', 'synopsis');
            }
            if (array_key_exists('overview', $almanac)) {
                $items .= makeNavItem('Overview', 'overview');
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
                    $items .= makeNavItem($character['name'], $character['id']);
                }
            }
        }

        return $items;
    }

    // html for a single nav item
    function makeNavItem($label,$id){
        return "<li><a href=\"#$id\">$label</a></li>";
    }

    // variable substitutions
    function doSubstitutions($character, $originalText) {
        $name = $character['name'] ?? 'New Character';
        return str_replace('$capname', strtoupper($name), 
            str_replace('$name', $name, $originalText));
    }
?>
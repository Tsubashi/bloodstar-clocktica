<?php
    header('Content-Type: application/json;');
    include('shared.php');
    requirePost();
    $request = getPayload();
    $usernameOrEmail = requireField($request, 'usernameOrEmail');
    $email = $usernameOrEmail;
    $username = $usernameOrEmail;
    $mysqli = makeMysqli();

    // if the email didn't have an @, assume it is the username instead and fetch the email from it
    if (false === strpos($usernameOrEmail, '@')) {
        $escapedUsername = $mysqli->real_escape_string($usernameOrEmail);
        $result = $mysqli->query("SELECT `email`,`name` FROM `users` WHERE `users`.`name` = '$escapedUsername' LIMIT 1;");
        if (false===$result){
            echo json_encode(array("error" => 'error looking up email'));
            exit();
        }
        if (0===$result->num_rows){
            echo json_encode(array("error" => "no such username or email \"$usernameOrEmail\""));
            exit();
        }
        $results = $result->fetch_all();
        $email = $results[0][0];
        $username = $results[0][1];
    }

    // insert into reset table so we can see it when we verify
    $sqlEscapedEmail = $mysqli->real_escape_string($email);
    $htmlEscapedEmail = htmlspecialchars($email);
    $urlEscapedEmail = urlencode($email);
    $confirmCode = sprintf('%06d', random_int(0,999999));
    $confirmHash = password_hash("$confirmCode:$email", PASSWORD_BCRYPT, ['cost'=>10]);
    $escapedConfirmHash = $mysqli->real_escape_string($confirmHash);
    $secondsPerDay = 60 * 60 * 24;
    $timeLimit = 1 * $secondsPerDay;
    $expiration = time() + $timeLimit;
    $result = $mysqli->query(
        'INSERT INTO `reset` (`email`, `expiration`, `confirmHash`) '
        ."VALUES ('$sqlEscapedEmail', $expiration, '$escapedConfirmHash') "
        .'ON DUPLICATE KEY UPDATE '
        .'`expiration`=VALUES(`expiration`), '
        .'`confirmHash`=VALUES(`confirmHash`)'
        .';');
    if (false===$result){
        $error = $mysqli->error;
        echo json_encode(array('error' => 'Could not reset password'));
        exit();
    }

    // send email with the code
    $headers = "MIME-Version: 1.0\r\n"
             . "Content-type: text/html; charset=iso-8859-1\r\n"
             . "From: no-reply@bloodstar.xyz\r\n"
             . "Reply-To: no-reply@bloodstar.xyz\r\n"
             . "X-Mailer: PHP/" . phpversion();
    $body = '<html><body>'
        . '<p>Use the code below to finish resetting your password.</p>'
        . "<p style=\"font-size:larger;\">$confirmCode</a>"
        . '</body></html>';
    if (!mail($email, 'Bloodstar Clocktica password reset', $body, $headers)){
        echo json_encode(array('error'=>'failed to send password reset email'));
        exit();
    }

    echo json_encode(array('username'=>$username));

    $leeway = 60;
    $killTime = time() + $leeway;
    try {
        $result = $mysqli->query("DELETE FROM `reset` WHERE `reset`.`expiration` < $killTime;");
    } catch (Exception $e) {
        // ignore
    }
?>
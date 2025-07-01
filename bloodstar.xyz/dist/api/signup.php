<?php
    header('Content-Type: application/json;');
    include('shared.php');
    require('../mailer/shared_setup.php');
    requirePost();
    $request = getPayload();
    $username = requireField($request, 'username');
    $password = requireField($request, 'password');
    $email = requireField($request, 'email');

    $mysqli = makeMysqli();

    validateUsername($username);
    validateEmail($email);

    // verify name & email not taken
    $escapedUsername = $mysqli->real_escape_string($username);
    $escapedEmail = $mysqli->real_escape_string($email);
    $result = $mysqli->query("SELECT `name`,`email` FROM `users` WHERE `users`.`name` = '$escapedUsername' OR `users`.`email` = '$escapedEmail' LIMIT 1;");
    if (0!==$result->num_rows){
        list($foundName,$foundEmail) = $result->fetch_all()[0];

        if (($foundName===$username)&&($foundEmail===$email)){
            $result = $mysqli->query("SELECT 1 FROM `hash` WHERE `hash`.`email` = '$escapedEmail' LIMIT 1;");
            if (0===$result->num_rows) {
                // not confirmed. restarting is fine
            } else {
                // if they are already confirmed, it's not valid to sign up again
                echo json_encode('emailTaken');
                exit();
            }
        } else if ($foundEmail===$email){
            echo json_encode('emailTaken');
            exit();
        } else {
            echo json_encode('usernameTaken');
            exit();
        }
    }

    // insert into unconfirmed table for the next step to see
    $secondsPerDay = 60 * 60 * 24;
    $reservationDuration = 1 * $secondsPerDay;
    $expiration = time() + $reservationDuration;
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost'=>10]);
    $confirmCode = sprintf('%06d', random_int(0,999999));
    $confirmHash = password_hash("$confirmCode:$email", PASSWORD_BCRYPT, ['cost'=>10]);
    if (false===$mysqli->query("INSERT IGNORE INTO `users` (`email`, `name`) VALUES ('$escapedEmail', '$escapedUsername');")){
        $error = $mysqli->error;
        echo json_encode(['error'=>'Error creating user']);
        exit();
    }
    $escapedHash = $mysqli->real_escape_string($hash);
    $escapedConfirmHash = $mysqli->real_escape_string($confirmHash);
    if (false === $mysqli->query('INSERT INTO `unconfirmed` (`email`, `expiration`, `hash`, `confirmHash`) '
                                ."VALUES ('$escapedEmail', $expiration, '$escapedHash', '$escapedConfirmHash') "
                                .'ON DUPLICATE KEY UPDATE '
                                .'`expiration`=VALUES(`expiration`), '
                                .'`hash`=VALUES(`hash`), '
                                .'`confirmHash`=VALUES(`confirmHash`) '
                                .';')){
        $error = $mysqli->error;
        echo json_encode(['error'=>'Error storing confirmation code hash']);
        exit();
    }

    // send email with the code
    try {
        $mail = getMailer();
        $mail->addAddress($email, $username);
        $mail->Subject = 'Bloodstar Clocktica sign-up confirmation';
        $mail->isHTML(true);
        $mail->Body = '<html><body>'
                    . '<p>Use the code below to finish creating your account.</p>'
                    . "<p style=\"font-size:larger;\">$confirmCode</a>"
                    . '</body></html>';
        $mail->AltBody = 'Use the code below to finish creating your account: ' . $confirmCode;
        $mail->send();
    } catch (Exception $e) {
        echo json_encode(array('error'=>'failed to send confirmation email: ' . $e->getMessage()));
        exit();
    }

    echo 'true';

    // clean up old unconfirmed accounts
    $leeway = 60;
    $killTime = time() + $leeway;
    try {
        $result = $mysqli->query("DELETE FROM `unconfirmed` WHERE `unconfirmed`.`expiration` < $killTime;");
    } catch (Exception $e) {
        // ignore
    }
?>

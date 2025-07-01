<?php
    header('Content-Type: application/json;');
    include('shared.php');
    require('../mailer/shared_setup.php');
    requirePost();
    $request = getPayload();
    $email = requireField($request, 'email');
    validateEmail($email);

    $mysqli = makeMysqli();

    // verify signup in progress
    $escapedEmail = $mysqli->real_escape_string($email);
    $result = $mysqli->query("SELECT 1 FROM `unconfirmed` WHERE `unconfirmed`.`email` = '$escapedEmail' LIMIT 1;");
    if (0===$result->num_rows){
        echo json_encode(['error'=>'no sign-up in progress for this email']);
        exit();
    }

    // make new code, insert new hash into unconfirmed table for the next step to see
    $secondsPerDay = 60 * 60 * 24;
    $reservationDuration = 1 * $secondsPerDay;
    $expiration = time() + $reservationDuration;
    $confirmCode = sprintf('%06d', random_int(0,999999));
    $confirmHash = password_hash("$confirmCode:$email", PASSWORD_BCRYPT, ['cost'=>10]);
    $escapedHash = $mysqli->real_escape_string($hash);
    $escapedConfirmHash = $mysqli->real_escape_string($confirmHash);
    if (false === $mysqli->query('INSERT INTO `unconfirmed` (`email`, `expiration`, `hash`, `confirmHash`) '
                                ."VALUES ('$escapedEmail', $expiration, '$escapedHash', '$escapedConfirmHash') "
                                .'ON DUPLICATE KEY UPDATE '
                                .'`expiration`=VALUES(`expiration`), '
                                .'`confirmHash`=VALUES(`confirmHash`) '
                                .';')){
        $error = $mysqli->error;
        echo json_encode(['error'=>'Error storing confirmation code hash']);
        exit();
    }

    // send email with the code
    try {
        $mail = getMailer();
        $mail->addAddress($email);
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

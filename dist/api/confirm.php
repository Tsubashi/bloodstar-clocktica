<?php
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $request = getPayload();
    $email = requireField($request, 'email');
    $confirmCode = requireField($request, 'code');

    validateConfirmCode($confirmCode);
    validateEmail($email);

    // get signup data
    $mysqli = makeMysqli();
    $escapedEmail = $mysqli->real_escape_string($email);
    $result = $mysqli->query("SELECT `expiration`,`hash`,`confirmHash` FROM `unconfirmed` WHERE `unconfirmed`.`email` = '$escapedEmail' LIMIT 1;");
    if (0===$result->num_rows){
        $result = $mysqli->query("SELECT 1 FROM `hash` WHERE `hash`.`email` = '$escapedEmail' LIMIT 1;");
        if (0!==$result->num_rows){
            echo json_encode('alreadyConfirmed');
            exit();
        }
        echo json_encode('notSignedUp');
        exit();
    }
    list($expiration,$hash,$confirmHash) = $result->fetch_all()[0];

    // verify code
    if (!password_verify("$confirmCode:$email", $confirmHash)){
        echo json_encode('badCode');
        exit();
    }

    // expiration
    $timestamp = time();
    $leeway = 60;
    if (($timestamp - $leeway) >= $expiration) {
        $mysqli->query("DELETE FROM `users` WHERE `users`.`email` = \'$escapedEmail\';");
        echo json_encode('expired');
        exit();
    }

    // looks good. move to confirmed
    $escapedHash = $mysqli->real_escape_string($hash);
    $mysqli->query("INSERT INTO `hash` (`email`,`hash`) VALUES ('$escapedEmail', '$escapedHash');");
    if (!$mysqli->query("DELETE FROM `unconfirmed` WHERE `unconfirmed`.`email` = '$escapedEmail';")){
        $error = $mysqli->error;
        echo json_encode(['error'=>'Could not delete record']);
        exit();
    }

    $username = lookUpUsername($mysqli, $escapedEmail);
    $token = createToken($email, $username, $expiration);
    echo json_encode(array('token' => $token,'expiration' => $expiration,'email'=>$email,'username'=>$username));
?>
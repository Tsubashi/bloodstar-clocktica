<?php
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $request = getPayload();
    $code = requireField($request, 'code');
    $email = requireOneOf($request, 'email', 'username');
    $password = requireField($request, 'password');

    $mysqli = makeMysqli();

    validateConfirmCode($code);

    // accept username instead of email, but convert
    if (strpos($email, '@') !== false) {
        validateEmail($email);
    } else {
        validateUsername($email);
        $escapedUsername = $mysqli->real_escape_string($email);
        $result = $mysqli->query("SELECT `users`.`email` FROM `users`WHERE `users`.`name` = '$escapedUsername' LIMIT 1;");
        if (false===$result){
            echo json_encode(array("error" => 'sql error'));
            exit();
        }
        if (0===$result->num_rows){
            echo json_encode([
                'title' => 'Sign-In Error',
                'message' => 'Incorrect username or password.'
            ]);
            exit();
        }
        $email = $result->fetch_all()[0][0];
    }

    // get code hash to validate
    $escapedEmail = $mysqli->real_escape_string($email);
    $result = $mysqli->query("SELECT `expiration`,`confirmHash` FROM `reset` WHERE `reset`.`email` = '$escapedEmail' LIMIT 1;");
    if (false === $result) {
        $error = $mysqli->error;
        echo json_encode(['error'=>'Error retrieving code hash']);
        exit();
    }
    if (0===$result->num_rows){
        echo json_encode(['error'=>'Reset request missing or expired']);
        exit();
    }
    list($expiration,$confirmHash) = $result->fetch_all()[0];

    // verify code
    if (!password_verify("$code:$email", $confirmHash)){
        echo json_encode('badCode');
        exit();
    }

    // expiration
    $timestamp = time();
    $leeway = 60;
    if (($timestamp - $leeway) >= $expiration) {
        $mysqli->query("DELETE FROM `reset` WHERE `reset`.`email` = \'$escapedEmail\';");
        echo json_encode('expired');
        exit();
    }

    // looks good. store new password hash
    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost'=>10]);
    $escapedHash = $mysqli->real_escape_string($hash);
    if (false===$mysqli->query("UPDATE `hash` SET `hash`.`hash`='$escapedHash' WHERE `hash`.`email`='$escapedEmail' LIMIT 1;")){
        $error = $mysqli->error;
        echo json_encode(['error'=>'Could not store password hash']);
        exit();
    }

    if (!$mysqli->query("DELETE FROM `reset` WHERE `reset`.`email` = '$escapedEmail';")){
        $error = $mysqli->error;
        echo json_encode(['error'=>'Could not delete record']);
        exit();
    }

    $username = lookUpUsername($mysqli, $email);
    $token = createToken($email, $username, $expiration);
    echo json_encode(array('token' => $token,'expiration' => $expiration,'email'=>$email,'username'=>$username));
?>
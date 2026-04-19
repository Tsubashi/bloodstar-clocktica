<?php
    header('Content-Type: application/json;');
    require_once('shared.php');
    requirePost();
    $request = getPayload();
    $usernameOrEmail = requireField($request, 'usernameOrEmail');
    $password = requireField($request, 'password');

    $mysqli = makeMysqli();
    if (false === strpos($usernameOrEmail, '@')) {
        $escapedUsername = $mysqli->real_escape_string($usernameOrEmail);
        $result = $mysqli->query("SELECT `hash`,`users`.`email`,`users`.`name` FROM `hash` INNER JOIN `users` ON `users`.`email` = `hash`.`email` WHERE `users`.`name` = '$escapedUsername' LIMIT 1;");
    } else {
        $escapedEmail = $mysqli->real_escape_string($usernameOrEmail);
        $result = $mysqli->query("SELECT `hash`,`users`.`email`,`users`.`name` FROM `hash` INNER JOIN `users` ON `users`.`email` = `hash`.`email` WHERE `hash`.`email` = '$escapedEmail' LIMIT 1;");
    }
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
    $results = $result->fetch_all();
    list($hash, $email, $username) = $results[0];
    if (!password_verify($password, $hash)) {
        echo json_encode([
            'title' => 'Sign-In Error',
            'message' => 'Incorrect username or password.'
        ]);
        exit();
    }

    $secondsPerDay = 60 * 60 * 24;
    $tokenDuration = 1 * $secondsPerDay;
    $expiration = time() + $tokenDuration;

    $token = createToken($email, $username, $expiration);

    echo json_encode(array('token' => $token,'expiration' => $expiration,'email'=>$email,'username'=>$username));
?>
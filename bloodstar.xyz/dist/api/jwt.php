<?php
// bail because the session token didn't check out
function rejectSession($message){
    header('HTTP/1.0 400 Bad Request');
    //if (empty($message)){
    //    echo json_encode(array('error' =>'sign in required'));
    //} else {
    //    echo json_encode(array('error' =>'sign in required', 'message'=>$message));
    //}
    echo '"signInRequired"';
    exit();
    return false;
}

// decode strings that are url-safe base64 encoded
function base64urlDecode($input){
    $remainder = strlen($input) % 4;
    if ($remainder) {
        $padlen = 4 - $remainder;
        $input .= str_repeat('=', $padlen);
    }
    return base64_decode(strtr($input, '-_', '+/'));
}
// encode using base64url encoding
function base64urlEncode($input){
    return rtrim(strtr(base64_encode($input), '+/', '-_'), '=');
}

// verify a session token - returns decoded payload when successful. notably containing the string keys 'username' and 'email'
function verifySession($token){
    try {
        $secretKey = file_get_contents('../../protected/jwt_key.pub');
        if (false === $secretKey){
            echo json_encode(array('error' =>'could not open key file'));
            exit();
        }

        $parts = explode('.',$token);
        if (3 !== count($parts)) {
            return rejectSession('Token not formatted correctly');
        }
        list($header, $payload, $signature) = $parts;
        $decodedHeader = json_decode(base64urlDecode($header));
        $decodedPayload = json_decode(base64urlDecode($payload), true);
        $decodedSignature = base64urlDecode($signature);

        // weird wrinkle for ES256
        if ($decodedHeader->alg !== 'RS256') {
            return rejectSession('hash algorithm not supported');
        }

        if (!verifySig("$header.$payload", $decodedSignature, $secretKey, $decodedHeader->alg)){
            return rejectSession('Signature verification failed');
        }

        $timestamp = time();
        $leeway = 60;
        if (array_key_exists('nbf',$decodedPayload) && $decodedPayload['nbf'] > ($timestamp + $leeway)){
            return rejectSession('Token not valid until '.date(DateTime::ISO8601, $decodedPayload->nbf));
        }
        if (array_key_exists('iat', $decodedPayload) && $decodedPayload['iat'] > ($timestamp + $leeway)) {
            return rejectSession('Token not valid until '.date(DateTime::ISO8601, $decodedPayload->iat));
        }
        if (array_key_exists('exp', $decodedPayload) && ($timestamp - $leeway) >= $decodedPayload['exp']) {
            return rejectSession('Token expired');
        }
        if (!array_key_exists('username', $decodedPayload)){
            return rejectSession('No username specified in token');
        }
        return $decodedPayload;
    } catch (Exception $e) {
        return rejectSession('Error: '.$e->getMessage());
    }
    return false;
}

function verifySig($headerAndPayloadStr, $signatureStr, $secretKey) {
    $success = openssl_verify($headerAndPayloadStr, $signatureStr, $secretKey, 'SHA256');
    if ($success === 1) {
        return true;
    } elseif ($success === 0) {
        return false;
    }
    return rejectSession('OpenSSL error: '.openssl_error_string());
}

// create a token for user session
function createToken($email, $username, $expiration) {
    $header = ['alg'=>'RS256','typ'=>'JWT'];
    $encodedHeader = base64urlEncode(json_encode($header));

    $payload = ['iat'=>time(), 'email'=>$email, 'username'=>$username, 'exp'=>$expiration];
    $encodedPayload = base64urlEncode(json_encode($payload));

    $secretKey = file_get_contents('../../protected/jwt_key.pem');
    if (false === $secretKey){
        echo json_encode(array('error' =>'could not open key file'));
        exit();
    }
    if (!openssl_sign("$encodedHeader.$encodedPayload", $signature, $secretKey, 'SHA256')){
        echo json_encode(array('error' =>'signing token failed: '.openssl_error_string()));
        exit();
    }
    $encodedSignature = base64urlEncode($signature);

    return implode('.',[$encodedHeader, $encodedPayload, $encodedSignature]);
}
?>
<?php
    ini_set('display_errors', '1');
    ini_set('display_startup_errors', '1');
    error_reporting(E_ALL);
    include('jwt.php');
    header('Content-Type: application/json;');

    $privateKey = file_get_contents('../../protected/jwt_key.pem');
    $publicKey = file_get_contents('../../protected/jwt_key.pub');
    $data = "SomeData";
    $signResult = openssl_sign($data,$signature,$privateKey,'SHA256');
    $encodedSignature = base64urlEncode($signature);
    $decodedSignature = base64urlDecode($encodedSignature);
    $verifyResult = openssl_verify($data,$decodedSignature,$publicKey,'SHA256');
    echo json_encode(array('data'=>$data,'signResult'=>$signResult,'verifyResult'=>$verifyResult,'signature'=>$signature));
    echo('{"data":'
        .json_encode($data)
        .',"signResult":'
        .json_encode($signResult)
        .',"verifyResult":'
        .json_encode($verifyResult)
        .',"signature":'
        .json_encode($encodedSignature)
        .',"base64Sig":'
        .json_encode(base64_encode($signature))
        .',"roundTripTest":'
        .json_encode(base64_encode(base64urlDecode(base64urlEncode($signature))))
        .'}');
?>
<?php
// this regex comes from the HTML5 spec https://html.spec.whatwg.org/multipage/input.html#e-mail-state-(type%3Demail)
// it does reject some technically-valid email addresses but it handles the sort I care to support with this app
$VALID_EMAIL_RE = '/^[a-zA-Z0-9.!#$%&\'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/';

$CONFIRM_CODE_RE = '/^[0-9]{6}$/';
$USERNAME_RE = '/^[A-Za-z0-9\-_]{2,}$/';
$CHARACTERID_RE = $USERNAME_RE;
$BANNED_RE = '/Unreleased.*Characters|Hua.*Deng.*Chu.*Shang/i';

// error out if edition json does not look valid
function validateBoolean($value) {
    if ('boolean' !== gettype($value)){
        echo '{"error":"invalid boolean"}';
        exit();
    }
}

// error out if the confirmation code does not look valid
function validateConfirmCode($code) {
    global $CONFIRM_CODE_RE;
    if ('string' !== gettype($code) || !preg_match($CONFIRM_CODE_RE, $code)){
        echo json_encode(['error'=>'invalid confirm code']);
        exit();
    }
}

// error out if edition does not look valid
function validateEdition($edition) {
    if (!is_array($edition) || !array_key_exists('meta', $edition)){
        echo '{"error":"invalid edition data"}';
        exit();
    }
}

// error out if email looks invalid
function validateEmail($email){
    global $VALID_EMAIL_RE;
    if (!preg_match($VALID_EMAIL_RE, $email)){
        echo '{"error":"invalid email"}';
        exit();
    }
}

// error out if character id invalid
function validateCharacterId($id) {
    global $CHARACTERID_RE;
    if (!preg_match($CHARACTERID_RE, $id)){
        echo '{"error":"invalid character id"}';
        exit();
    }
}

// error out if filename invalid
function validateFilename($filename) {
    global $BANNED_RE;
    if (preg_match($BANNED_RE, $filename))
    {
        echo '{"error":"banned saveName"}';
        exit();
    }
    if (($filename==='') ||
        ($filename==='.') ||
        ($filename==='..') ||
        !preg_match("/^[^\\/:\"?<>\\|]+$/", $filename))
    {
        echo '{"error":"invalid saveName"}';
        exit();
    }
}

// error out if username invalid
function validateUsername($username) {
    global $USERNAME_RE;
    if (!preg_match($USERNAME_RE, $username)){
        echo '{"error":"invalid username"}';
        exit();
    }
}

?>
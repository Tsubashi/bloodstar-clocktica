<?php
    include('jwt.php');
    include('validate.php');

    define('SITE_ROOT', getenv('BLOODSTAR_ROOT_URL') ?? 'https://bloodstar.clocktica.com');
    
    function join_paths($a, $b) {
        return join('/', array(trim($a, '/'), trim($b, '/')));
    }

    // error out if not POST
    function requirePost() {
        if (strtolower($_SERVER['REQUEST_METHOD']) === 'options') {
            // support options or else CORS pre-flight won't work, but don't do any work
            echo '{}';
            exit();
        } else if (strtolower($_SERVER['REQUEST_METHOD']) != 'post') {
            echo '{"error":"must use POST request method"}';
            exit();
        }
    }

    // decode payload as json
    function getPayload() {
        return json_decode(file_get_contents('php://input'), true);
    }

    // find username based on email
    function lookUpUsername($mysqli, $email) {
        $escapedEmail = $mysqli->real_escape_string($email);
        $secondsPerDay = 60 * 60 * 24;
        $tokenDuration = 1 * $secondsPerDay;
        $expiration = time() + $tokenDuration;
        $result = $mysqli->query("SELECT `name` FROM `users` WHERE `users`.`email` = '$escapedEmail' LIMIT 1;");
        if (false===$result){
            $error = $mysqli->error;
            echo json_encode(['error'=>'Error looking up username']);
            exit();
        }
        return $result->fetch_all()[0][0];
    }

    // look up database info and connect
    function makeMysqli() {
        $dbInfo = json_decode(file_get_contents('../../protected/db'),true);
        $mysqlHost = requireField($dbInfo, 'host');
        $mysqlUsername = requireField($dbInfo, 'username');
        $mysqlPassword = requireField($dbInfo, 'password');
        $mysqlDb = requireField($dbInfo, 'db');
        return new mysqli($mysqlHost,$mysqlUsername,$mysqlPassword,$mysqlDb);
    }

    // get field if it exists, otherwise use default value
    function optionalField($arr, $fieldName, $defaultValue) {
        return array_key_exists($fieldName, $arr) ? $arr[$fieldName] : $defaultValue;
    }

    // read file in save directory. return as string
    function readEditionFile($username, $saveName) {
        $userSaveDir = join_paths('../usersave', $username);
        $editionFolder = join_paths($userSaveDir, $saveName);
        $editionFile = join_paths($editionFolder, 'edition');
        try {
            $data = file_get_contents($editionFile);
            if ($data !== false) {
                return $data;
            }
        } catch (Exception $e) {
        }
        echo json_encode(array('error' =>"file '$saveName' not found"));
        exit();
    }

    // error if field is not set in array, otherwise, return that field
    function requireField($arr, $fieldName) {
        if (array_key_exists($fieldName, $arr))
        {
            return $arr[$fieldName];
        }
        else
        {
            echo json_encode(array("error" => "field \"$fieldName\" is missing"));
            exit();
        }
    }

    // error if field is not set in array, otherwise, return that field
    function requireOneOf($arr, $fieldNameA, $fieldNameB) {
        if (array_key_exists($fieldNameA, $arr))
        {
            return $arr[$fieldNameA];
        }
        else if (array_key_exists($fieldNameB, $arr))
        {
            return $arr[$fieldNameB];
        }
        else
        {
            echo json_encode(array("error" => "invalid request. must include field \"$fieldNameA\" or  \"$fieldNameB\""));
            exit();
        }
    }

    function startsWith($haystack, $needle) {
        return strncmp($haystack, $needle, strlen($needle)) === 0;
    }

    // split a url or path to a file and return just the filename part
    function getFilename($path){
        $parts = explode('/', $path);
        return array_pop($parts);
    }
?>
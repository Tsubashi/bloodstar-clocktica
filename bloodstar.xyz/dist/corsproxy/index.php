<?php

include('../api/shared.php');

// identify request headers
$request_headers = array( );
foreach ($_SERVER as $key => $value) {
    if (strpos($key, 'HTTP_') === 0  ||  strpos($key, 'CONTENT_') === 0) {
        $headername = str_replace('_', ' ', str_replace('HTTP_', '', $key));
        $headername = str_replace(' ', '-', ucwords(strtolower($headername)));
        if (!in_array($headername, array( 'Host', 'X-Proxy-Url' ))) {
            $request_headers[] = "$headername: $value";
        }
    }
}

// identify request method, url and params
$request_method = $_SERVER['REQUEST_METHOD'];
if ('GET' == $request_method) {
    $request_params = $_GET;
} elseif ('POST' == $request_method) {
    $request_params = $_POST;
    if (empty($request_params)) {
        $data = file_get_contents('php://input');
        if (!empty($data)) {
            $request_params = $data;
        }
    }
} elseif ('PUT' == $request_method || 'DELETE' == $request_method) {
    $request_params = file_get_contents('php://input');
} else {
    $request_params = null;
}

// Get URL from `url` in GET or POST data, before falling back to X-Proxy-URL header.
if (isset($_REQUEST['url'])) {
    $request_url = urldecode($_REQUEST['url']);
} elseif (isset($_SERVER['HTTP_X_PROXY_URL'])) {
    $request_url = urldecode($_SERVER['HTTP_X_PROXY_URL']);
} else {
    header($_SERVER['SERVER_PROTOCOL'] . ' 404 Not Found');
    header('Status: 404 Not Found');
    $_SERVER['REDIRECT_STATUS'] = 404;
    exit;
}

$p_request_url = parse_url($request_url);

// url may exist in GET request methods
if (is_array($request_params) && array_key_exists('url', $request_params)) {
    unset($request_params['url']);
}

// ignore requests for proxy :)
if (preg_match('!' . $_SERVER['SCRIPT_NAME'] . '!', $request_url) || empty($request_url) || count($p_request_url) == 1) {
    exit;
}

// append query string for GET requests
if ($request_method == 'GET' && count($request_params) > 0 && (!array_key_exists('query', $p_request_url) || empty($p_request_url['query']))) {
    $request_url .= '?' . http_build_query($request_params);
}

function getUrl($request_url, $request_method, $request_headers, $count) {
    // limit redirects
    if ($count < 0) {
        return false;
    }

    // let the request begin
    $safeRequestUrl = implode('/', array_map('rawurlencode', explode('/', $request_url)));
    $safeRequestUrl = str_replace('%3A',':', $safeRequestUrl);
    $ch = curl_init($safeRequestUrl);

    curl_setopt($ch, CURLOPT_HTTPHEADER, $request_headers);   // (re-)send headers
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);     // return response
    curl_setopt($ch, CURLOPT_HEADER, true);       // enabled response headers
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION , true); // follow redirects
    curl_setopt($ch, CURLOPT_MAXREDIRS , 10); // follow redirects
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    // add data for POST, PUT or DELETE requests
    if ('POST' == $request_method) {
        $post_data = is_array($request_params) ? http_build_query($request_params) : $request_params;
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
        curl_setopt($ch, CURLOPT_POSTFIELDS, $post_data);
    } elseif ('PUT' == $request_method || 'DELETE' == $request_method) {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $request_method);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $request_params);
    }

    // retrieve response (headers and content)
    $response = curl_exec($ch);
    curl_close($ch);

    // split response to header and content
    list($response_headers, $response_content) = preg_split('/(\r\n){2}/', $response, 2);

    if (startsWith($response_headers, 'HTTP/2 301') || startsWith($response_headers, 'HTTP/2 302') ) {
        $matches = array();
        preg_match('/Location:(.*?)\n/i', $response_headers, $matches);
        if (isset($matches[1])) {
            return getUrl(trim($matches[1]), $request_method, $request_headers, $count - 1);
        }
    }
    return $response;
}

$response = getUrl($request_url, $request_method, $request_headers, 5);
list($response_headers, $response_content) = preg_split('/(\r\n){2}/', $response, 2);

// (re-)send the headers
$response_headers = preg_split('/(\r\n){1}/', $response_headers);
foreach ($response_headers as $key => $response_header) {
    // Rewrite the `Location` header, so clients will also use the proxy for redirects.
    if (preg_match('/^Location:\s*/i', $response_header)) {
        list($header, $value) = preg_split('/: /', $response_header, 2);
        $new_location = SITE_ROOT.'/corsproxy/?url=' . urlencode($value);
        $response_header = 'location: ' . $new_location;
        header($response_header, true);
    }
    // don't copy an Access-Control-Allow-Origin header -- we'd have two
    if (preg_match('/^Access-Control-Allow-Origin:\s*/i', $response_header)) {
    } else if (!preg_match('/^(Transfer-Encoding):/', $response_header)) {
        header($response_header, false);
    }
}

print($response_content);

?>
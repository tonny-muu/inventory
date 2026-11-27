<?php
declare(strict_types=1);

$config = require __DIR__ . '/../config/config.php';
$GLOBALS['config'] = $config;

date_default_timezone_set($config['app']['timezone']);

spl_autoload_register(function (string $class): void {
    foreach (['Core', 'Controllers', 'Models', 'Middleware'] as $dir) {
        $file = __DIR__ . "/$dir/$class.php";
        if (is_file($file)) {
            require $file;
            return;
        }
    }
});

ini_set('display_errors', '0');
error_reporting(E_ALL);

function log_error(string $msg): void
{
    $line = '[' . date('Y-m-d H:i:s') . "] $msg" . PHP_EOL;
    @file_put_contents(__DIR__ . '/../storage/logs/app.log', $line, FILE_APPEND);
}

set_exception_handler(function (Throwable $e) use ($config): void {
    log_error($e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    $msg = $config['app']['debug'] ? $e->getMessage() : 'Server error';
    Response::error($msg, 500);
});

set_error_handler(function (int $no, string $str, string $file, int $line): bool {
    throw new ErrorException($str, 0, $no, $file, $line);
});

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && in_array($origin, $config['cors']['allowed_origins'], true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_name('sb_session');
session_start();
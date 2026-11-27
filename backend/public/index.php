<?php
declare(strict_types=1);

require __DIR__ . '/../src/bootstrap.php';

$request = new Request($GLOBALS['config']['app']['base_path']);
$router  = new Router();

require __DIR__ . '/../routes/api.php';

$router->dispatch($request);
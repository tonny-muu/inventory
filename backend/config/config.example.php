<?php
return [
    'db' => [
        'host'    => 'localhost',
        'name'    => 'stationery_bank',
        'user'    => 'sb_user',
        'pass'    => 'CHANGE_ME',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'timezone'  => 'Africa/Kampala',
        'debug'     => true,
        'base_path' => '/inventory-api',
    ],
    'cors' => [
        'allowed_origins' => [
            'http://localhost:5173',
            'http://localhost:3000',
        ],
    ],
];

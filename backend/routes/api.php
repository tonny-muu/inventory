<?php
declare(strict_types=1);

/** @var Router $router */

$router->get('/health', function (Request $req) {
    Response::success(['php' => PHP_VERSION, 'time' => date('c')], 'API is running');
});

// Accounts
$router->post('/auth/register', [AuthController::class, 'register']);
$router->post('/auth/login',    [AuthController::class, 'login']);
$router->post('/auth/logout',   [AuthController::class, 'logout']);
$router->get('/auth/me',        [AuthController::class, 'me']);

// Admin only
$router->get('/admin/users',                  [AdminController::class, 'list'],       [Auth::admin()]);
$router->post('/admin/users/{id}/approve',    [AdminController::class, 'approve'],    [Auth::admin()]);
$router->post('/admin/users/{id}/reject',     [AdminController::class, 'reject'],     [Auth::admin()]);
$router->post('/admin/users/{id}/disable',    [AdminController::class, 'disable'],    [Auth::admin()]);
$router->post('/admin/users/{id}/enable',     [AdminController::class, 'enable'],     [Auth::admin()]);
$router->post('/admin/users/{id}/dashboards', [AdminController::class, 'dashboards'], [Auth::admin()]);

$router->get('/admin/activity',               [ActivityController::class, 'list'],    [Auth::admin()]);
$router->get('/admin/activity/summary',       [ActivityController::class, 'summary'], [Auth::admin()]);

// Stationery dashboard (staff can add and view; only the admin can edit or delete)
$router->get('/stationery/sales',              [StationeryController::class, 'listSales'],     [Auth::dashboard('stationery')]);
$router->post('/stationery/sales',             [StationeryController::class, 'saveSale'],      [Auth::dashboard('stationery')]);
$router->put('/stationery/sales/{id}',         [StationeryController::class, 'updateSale'],    [Auth::admin()]);
$router->delete('/stationery/sales/{id}',      [StationeryController::class, 'deleteSale'],    [Auth::admin()]);

// Debts (staff can record a payment; payments cannot be edited or deleted)
$router->post('/stationery/sales/{id}/payments', [StationeryController::class, 'receivePayment'], [Auth::dashboard('stationery')]);
$router->get('/stationery/debtors',              [StationeryController::class, 'listDebtors'],    [Auth::dashboard('stationery')]);
$router->get('/stationery/payments',             [StationeryController::class, 'listPayments'],   [Auth::dashboard('stationery')]);

$router->get('/stationery/expenses',           [StationeryController::class, 'listExpenses'],  [Auth::dashboard('stationery')]);
$router->post('/stationery/expenses',          [StationeryController::class, 'saveExpense'],   [Auth::dashboard('stationery')]);
$router->put('/stationery/expenses/{id}',      [StationeryController::class, 'updateExpense'], [Auth::admin()]);
$router->delete('/stationery/expenses/{id}',   [StationeryController::class, 'deleteExpense'], [Auth::admin()]);

// Inventory (items received and their cost)
$router->get('/stationery/inventory',          [StationeryController::class, 'listInventory'],   [Auth::dashboard('stationery')]);
$router->post('/stationery/inventory',         [StationeryController::class, 'saveInventory'],   [Auth::dashboard('stationery')]);
$router->put('/stationery/inventory/{id}',     [StationeryController::class, 'updateInventory'], [Auth::admin()]);
$router->delete('/stationery/inventory/{id}',  [StationeryController::class, 'deleteInventory'], [Auth::admin()]);

// Item list and rates (everyone picks from it; only the admin manages it)
$router->get('/stationery/items',              [StationeryController::class, 'listItems'],     [Auth::dashboard('stationery')]);
$router->get('/stationery/items/all',          [StationeryController::class, 'listAllItems'],  [Auth::admin()]);
$router->post('/stationery/items',             [StationeryController::class, 'saveItem'],      [Auth::admin()]);
$router->put('/stationery/items/{id}',         [StationeryController::class, 'updateItem'],    [Auth::admin()]);

$router->get('/stationery/summary',            [StationeryController::class, 'summary'],       [Auth::dashboard('stationery')]);

// Bank dashboard (staff can add and view; only the admin can edit or delete)
$router->get('/bank/records',         [BankController::class, 'listRecords'],  [Auth::dashboard('bank')]);
$router->post('/bank/records',        [BankController::class, 'saveRecord'],   [Auth::dashboard('bank')]);
$router->put('/bank/records/{id}',    [BankController::class, 'updateRecord'], [Auth::admin()]);
$router->delete('/bank/records/{id}', [BankController::class, 'deleteRecord'], [Auth::admin()]);

$router->get('/bank/entries',         [BankController::class, 'listEntries'],  [Auth::dashboard('bank')]);
$router->post('/bank/entries',        [BankController::class, 'saveEntry'],    [Auth::dashboard('bank')]);
$router->put('/bank/entries/{id}',    [BankController::class, 'updateEntry'],  [Auth::admin()]);
$router->delete('/bank/entries/{id}', [BankController::class, 'deleteEntry'],  [Auth::admin()]);

$router->get('/bank/summary',         [BankController::class, 'summary'],      [Auth::dashboard('bank')]);
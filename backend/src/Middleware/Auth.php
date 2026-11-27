<?php
declare(strict_types=1);

class Auth
{
    /** Returns the logged-in user, or stops with 401/403. */
    public static function user(): array
    {
        $id = $_SESSION['user_id'] ?? null;
        $user = $id ? User::findById((int) $id) : null;

        if (!$user) {
            Response::error('Please log in.', 401);
        }
        if ($user['status'] !== 'approved') {
            $_SESSION = [];
            Response::error('Your account is not active.', 403);
        }
        return $user;
    }

    /** Gatekeeper: any logged-in, approved user. */
    public static function required(): callable
    {
        return function (Request $req): void {
            self::user();
        };
    }

    /** Gatekeeper: admin only. */
    public static function admin(): callable
    {
        return function (Request $req): void {
            $user = self::user();
            if ($user['role'] !== 'admin') {
                Response::error('Admin access only.', 403);
            }
        };
    }

    /** Gatekeeper: user must be assigned this dashboard ('stationery' or 'bank'). Admin passes. */
    public static function dashboard(string $name): callable
    {
        return function (Request $req) use ($name): void {
            $user = self::user();
            if ($user['role'] === 'admin') {
                return;
            }
            if (!in_array($name, User::dashboards((int) $user['id']), true)) {
                Response::error('You do not have access to this dashboard.', 403);
            }
        };
    }
}
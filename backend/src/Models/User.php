<?php
declare(strict_types=1);

class User
{
    public static function findByUsername(string $username): ?array
    {
        $stmt = Database::connect()->prepare('SELECT * FROM users WHERE username = ?');
        $stmt->execute([$username]);
        return $stmt->fetch() ?: null;
    }

    public static function findById(int $id): ?array
    {
        $stmt = Database::connect()->prepare(
            'SELECT id, full_name, username, email, phone, role, status FROM users WHERE id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public static function emailExists(string $email): bool
    {
        $stmt = Database::connect()->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        return (bool) $stmt->fetch();
    }

    public static function create(
        string $fullName,
        string $username,
        string $email,
        string $password,
        ?string $phone = null
    ): int {
        $pdo = Database::connect();
        $stmt = $pdo->prepare(
            "INSERT INTO users (full_name, username, email, phone, password_hash, role, status)
             VALUES (?, ?, ?, ?, ?, 'staff', 'pending')"
        );
        $stmt->execute([$fullName, $username, $email, $phone, password_hash($password, PASSWORD_DEFAULT)]);
        return (int) $pdo->lastInsertId();
    }

    public static function dashboards(int $userId): array
    {
        $stmt = Database::connect()->prepare('SELECT dashboard FROM user_dashboards WHERE user_id = ?');
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    public static function recordAttempt(string $username, string $ip): void
    {
        $stmt = Database::connect()->prepare('INSERT INTO login_attempts (username, ip_address) VALUES (?, ?)');
        $stmt->execute([$username, $ip]);
    }

    public static function tooManyAttempts(string $username, string $ip): bool
    {
        $stmt = Database::connect()->prepare(
            'SELECT COUNT(*) FROM login_attempts
             WHERE (username = ? OR ip_address = ?) AND attempted_at > (NOW() - INTERVAL 15 MINUTE)'
        );
        $stmt->execute([$username, $ip]);
        return (int) $stmt->fetchColumn() >= 5;
    }

    public static function clearAttempts(string $username): void
    {
        $stmt = Database::connect()->prepare('DELETE FROM login_attempts WHERE username = ?');
        $stmt->execute([$username]);
    }

    public static function touchLogin(int $id): void
    {
        $stmt = Database::connect()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = ?');
        $stmt->execute([$id]);
    }
}
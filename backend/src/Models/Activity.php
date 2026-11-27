<?php
declare(strict_types=1);

class Activity
{
    /**
     * Records who did what. A failure here must never stop the real action,
     * so errors are only written to the PHP error log.
     */
    public static function log(int $userId, string $dashboard, string $action, string $description): void
    {
        try {
            $stmt = Database::connect()->prepare(
                'INSERT INTO activity_log (user_id, dashboard, action, description) VALUES (?, ?, ?, ?)'
            );
            $stmt->execute([$userId, $dashboard, $action, mb_substr($description, 0, 255)]);
        } catch (Throwable $e) {
            error_log('Activity log failed: ' . $e->getMessage());
        }
    }
}
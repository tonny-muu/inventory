<?php
declare(strict_types=1);

class AdminController
{
    private const DASHBOARDS = ['stationery', 'bank'];

    public function list(Request $req, array $params): void
    {
        $pdo = Database::connect();
        $status = (string) $req->query('status', '');
        $cols = 'SELECT id, full_name, username, email, phone, role, status, created_at, approved_at, last_login_at FROM users';

        if (in_array($status, ['pending', 'approved', 'rejected', 'disabled'], true)) {
            $stmt = $pdo->prepare("$cols WHERE status = ? ORDER BY created_at DESC");
            $stmt->execute([$status]);
        } else {
            $stmt = $pdo->query("$cols ORDER BY created_at DESC");
        }

        $users = $stmt->fetchAll();
        foreach ($users as &$u) {
            $u['dashboards'] = User::dashboards((int) $u['id']);
        }
        unset($u);

        Response::success($users);
    }

    public function approve(Request $req, array $params): void
    {
        $admin = Auth::user();
        $user  = $this->target($params);
        $dash  = $this->cleanDashboards($req);

        if ($user['status'] !== 'pending') {
            Response::error('Only pending accounts can be approved.', 409);
        }
        if (!$dash) {
            Response::error('Choose at least one dashboard: stationery or bank.', 422);
        }

        $pdo = Database::connect();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                "UPDATE users SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?"
            );
            $stmt->execute([(int) $admin['id'], (int) $user['id']]);
            $this->saveDashboards((int) $user['id'], (int) $admin['id'], $dash);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        Response::success(['id' => (int) $user['id'], 'dashboards' => $dash], 'Account approved.');
    }

    public function reject(Request $req, array $params): void
    {
        $user = $this->target($params);
        if ($user['status'] !== 'pending') {
            Response::error('Only pending accounts can be rejected.', 409);
        }
        $this->setStatus((int) $user['id'], 'rejected');
        Response::success(null, 'Account rejected.');
    }

    public function disable(Request $req, array $params): void
    {
        $user = $this->target($params);
        if ($user['status'] !== 'approved') {
            Response::error('Only approved accounts can be disabled.', 409);
        }
        $this->setStatus((int) $user['id'], 'disabled');
        Response::success(null, 'Account disabled.');
    }

    public function enable(Request $req, array $params): void
    {
        $user = $this->target($params);
        if ($user['status'] !== 'disabled') {
            Response::error('Only disabled accounts can be re-enabled.', 409);
        }
        $this->setStatus((int) $user['id'], 'approved');
        Response::success(null, 'Account enabled.');
    }

    public function dashboards(Request $req, array $params): void
    {
        $admin = Auth::user();
        $user  = $this->target($params);
        $dash  = $this->cleanDashboards($req);

        if ($user['status'] !== 'approved') {
            Response::error('Dashboards can only be changed for approved accounts.', 409);
        }
        if (!$dash) {
            Response::error('Choose at least one dashboard: stationery or bank.', 422);
        }

        $this->saveDashboards((int) $user['id'], (int) $admin['id'], $dash);
        Response::success(['id' => (int) $user['id'], 'dashboards' => $dash], 'Dashboards updated.');
    }

    // ---- helpers ----

    private function target(array $params): array
    {
        $user = User::findById((int) ($params['id'] ?? 0));
        if (!$user) {
            Response::error('User not found.', 404);
        }
        if ($user['role'] === 'admin') {
            Response::error('Admin accounts cannot be changed here.', 403);
        }
        return $user;
    }

    private function cleanDashboards(Request $req): array
    {
        $list = $req->input('dashboards', []);
        if (!is_array($list)) {
            return [];
        }
        $list = array_filter($list, fn($d) => in_array($d, self::DASHBOARDS, true));
        return array_values(array_unique($list));
    }

    private function saveDashboards(int $userId, int $adminId, array $dash): void
    {
        $pdo = Database::connect();
        $pdo->prepare('DELETE FROM user_dashboards WHERE user_id = ?')->execute([$userId]);
        $ins = $pdo->prepare('INSERT INTO user_dashboards (user_id, dashboard, assigned_by) VALUES (?, ?, ?)');
        foreach ($dash as $d) {
            $ins->execute([$userId, $d, $adminId]);
        }
    }

    private function setStatus(int $userId, string $status): void
    {
        Database::connect()->prepare('UPDATE users SET status = ? WHERE id = ?')->execute([$status, $userId]);
    }
}
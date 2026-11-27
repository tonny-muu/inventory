<?php
declare(strict_types=1);

class ActivityController
{
    private const DASHBOARDS = ['stationery', 'bank', 'account'];

    /** Every activity in the chosen range, newest first. */
    public function list(Request $req, array $params): void
    {
        [$from, $to] = $this->range($req);
        [$where, $args] = $this->filters($req, $from, $to);

        $stmt = Database::connect()->prepare(
            "SELECT a.id, a.created_at, a.dashboard, a.action, a.description, a.user_id,
                    COALESCE(u.full_name, 'Unknown user') AS full_name, u.username
             FROM activity_log a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE $where
             ORDER BY a.created_at DESC, a.id DESC
             LIMIT 1000"
        );
        $stmt->execute($args);
        Response::success($stmt->fetchAll());
    }

    /** Totals, a per-user summary and a per-dashboard summary for the same filters. */
    public function summary(Request $req, array $params): void
    {
        [$from, $to] = $this->range($req);
        [$where, $args] = $this->filters($req, $from, $to);
        $pdo = Database::connect();

        $u = $pdo->prepare(
            "SELECT a.user_id,
                    COALESCE(u.full_name, 'Unknown user') AS full_name,
                    SUM(a.action = 'login') AS logins,
                    SUM(a.action = 'create') AS entries,
                    SUM(a.action IN ('update', 'delete')) AS changes,
                    COUNT(*) AS total,
                    MAX(a.created_at) AS last_activity
             FROM activity_log a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE $where
             GROUP BY a.user_id, u.full_name
             ORDER BY total DESC"
        );
        $u->execute($args);
        $users = [];
        $totals = ['activities' => 0, 'logins' => 0, 'entries' => 0, 'changes' => 0, 'users' => 0];
        foreach ($u->fetchAll() as $r) {
            $row = [
                'user_id'       => (int) $r['user_id'],
                'full_name'     => $r['full_name'],
                'logins'        => (int) $r['logins'],
                'entries'       => (int) $r['entries'],
                'changes'       => (int) $r['changes'],
                'total'         => (int) $r['total'],
                'last_activity' => $r['last_activity'],
            ];
            $users[] = $row;
            $totals['activities'] += $row['total'];
            $totals['logins']     += $row['logins'];
            $totals['entries']    += $row['entries'];
            $totals['changes']    += $row['changes'];
        }
        $totals['users'] = count($users);

        $d = $pdo->prepare(
            "SELECT a.dashboard, COUNT(*) AS total, SUM(a.action = 'create') AS entries
             FROM activity_log a
             WHERE $where
             GROUP BY a.dashboard"
        );
        $d->execute($args);
        $dashboards = [];
        foreach ($d->fetchAll() as $r) {
            $dashboards[] = [
                'dashboard' => $r['dashboard'],
                'total'     => (int) $r['total'],
                'entries'   => (int) $r['entries'],
            ];
        }

        Response::success([
            'from'       => $from,
            'to'         => $to,
            'totals'     => $totals,
            'users'      => $users,
            'dashboards' => $dashboards,
        ]);
    }

    // ---------- helpers ----------

    private function filters(Request $req, string $from, string $to): array
    {
        $where = 'a.created_at >= ? AND a.created_at <= ?';
        $args  = [$from . ' 00:00:00', $to . ' 23:59:59'];

        $dash = (string) $req->query('dashboard', '');
        if ($dash !== '') {
            if (!in_array($dash, self::DASHBOARDS, true)) {
                Response::error('Dashboard must be stationery, bank or account.', 422);
            }
            $where .= ' AND a.dashboard = ?';
            $args[] = $dash;
        }

        $uid = (int) $req->query('user_id', 0);
        if ($uid > 0) {
            $where .= ' AND a.user_id = ?';
            $args[] = $uid;
        }

        return [$where, $args];
    }

    private function date(string $v, string $label): string
    {
        $dt = DateTime::createFromFormat('Y-m-d', $v);
        if (!$dt || $dt->format('Y-m-d') !== $v) {
            Response::error("$label must be a valid date (YYYY-MM-DD).", 422);
        }
        return $v;
    }

    /** Date range from ?from=&to=, defaulting to the current month. */
    private function range(Request $req): array
    {
        $from = (string) $req->query('from', date('Y-m-01'));
        $to   = (string) $req->query('to', date('Y-m-d'));
        return [$this->date($from, 'From date'), $this->date($to, 'To date')];
    }
}
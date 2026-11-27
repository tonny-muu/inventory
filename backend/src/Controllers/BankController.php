<?php
declare(strict_types=1);

class BankController
{
    private const TYPES = ['failed', 'debit', 'credit'];
    private const TYPE_LABELS = [
        'failed' => 'unsuccessful transaction',
        'debit'  => 'debit',
        'credit' => 'credit',
    ];

    // ---------- Main records ----------

    public function listRecords(Request $req, array $params): void
    {
        [$from, $to] = $this->range($req);
        $stmt = Database::connect()->prepare(
            'SELECT r.id, r.record_date, r.account_no, r.opening_cash, r.closing_cash,
                    r.expenditure, r.balance, r.created_at, u.full_name AS recorded_by
             FROM bank_records r
             LEFT JOIN users u ON u.id = r.created_by
             WHERE r.record_date BETWEEN ? AND ?
             ORDER BY r.record_date DESC, r.id DESC'
        );
        $stmt->execute([$from, $to]);
        Response::success($stmt->fetchAll());
    }

    public function saveRecord(Request $req, array $params): void
    {
        $user = Auth::user();
        $d    = $this->cleanRecord($req);
        $pdo  = Database::connect();

        $stmt = $pdo->prepare(
            'INSERT INTO bank_records
                (record_date, account_no, opening_cash, closing_cash, expenditure, balance, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $d['record_date'], $d['account_no'], $d['opening_cash'],
            $d['closing_cash'], $d['expenditure'], $d['balance'], (int) $user['id'],
        ]);

        Activity::log(
            (int) $user['id'], 'bank', 'create',
            "Added bank record {$d['account_no']} ({$d['record_date']}): opening " . $this->m($d['opening_cash'])
            . ', closing ' . $this->m($d['closing_cash'])
            . ', expenditure ' . $this->m($d['expenditure'])
            . ', balance ' . $this->m($d['balance'])
        );

        Response::success(['id' => (int) $pdo->lastInsertId(), 'balance' => $d['balance']], 'Bank record saved.');
    }

    public function updateRecord(Request $req, array $params): void
    {
        $user = Auth::user();
        $id   = (int) ($params['id'] ?? 0);
        $this->findRecord($id);
        $d = $this->cleanRecord($req);

        $stmt = Database::connect()->prepare(
            'UPDATE bank_records
             SET record_date = ?, account_no = ?, opening_cash = ?, closing_cash = ?, expenditure = ?, balance = ?
             WHERE id = ?'
        );
        $stmt->execute([
            $d['record_date'], $d['account_no'], $d['opening_cash'],
            $d['closing_cash'], $d['expenditure'], $d['balance'], $id,
        ]);

        Activity::log(
            (int) $user['id'], 'bank', 'update',
            "Edited bank record #$id ({$d['account_no']}, {$d['record_date']}): balance now " . $this->m($d['balance'])
        );

        Response::success(['id' => $id, 'balance' => $d['balance']], 'Bank record updated.');
    }

    public function deleteRecord(Request $req, array $params): void
    {
        $user = Auth::user();
        $id   = (int) ($params['id'] ?? 0);
        $row  = $this->findRecord($id);
        Database::connect()->prepare('DELETE FROM bank_records WHERE id = ?')->execute([$id]);

        Activity::log(
            (int) $user['id'], 'bank', 'delete',
            "Deleted bank record #$id ({$row['account_no']}, {$row['record_date']})"
        );

        Response::success(null, 'Bank record deleted.');
    }

    // ---------- Unsuccessful transactions, debits and credits ----------

    public function listEntries(Request $req, array $params): void
    {
        [$from, $to] = $this->range($req);
        $type = (string) $req->query('type', '');
        if ($type !== '' && !in_array($type, self::TYPES, true)) {
            Response::error('Type must be failed, debit or credit.', 422);
        }

        $sql  = 'SELECT e.id, e.entry_date, e.entry_type, e.description, e.amount,
                        e.created_at, u.full_name AS recorded_by
                 FROM bank_entries e
                 LEFT JOIN users u ON u.id = e.created_by
                 WHERE e.entry_date BETWEEN ? AND ?';
        $args = [$from, $to];
        if ($type !== '') {
            $sql   .= ' AND e.entry_type = ?';
            $args[] = $type;
        }
        $sql .= ' ORDER BY e.entry_date DESC, e.id DESC';

        $stmt = Database::connect()->prepare($sql);
        $stmt->execute($args);
        Response::success($stmt->fetchAll());
    }

    public function saveEntry(Request $req, array $params): void
    {
        $user = Auth::user();
        $d    = $this->cleanEntry($req);
        $pdo  = Database::connect();

        $stmt = $pdo->prepare(
            'INSERT INTO bank_entries (entry_date, entry_type, description, amount, created_by)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$d['entry_date'], $d['entry_type'], $d['description'], $d['amount'], (int) $user['id']]);

        Activity::log(
            (int) $user['id'], 'bank', 'create',
            'Added ' . self::TYPE_LABELS[$d['entry_type']] . " \"{$d['description']}\" of "
            . $this->m($d['amount']) . " ({$d['entry_date']})"
        );

        Response::success(['id' => (int) $pdo->lastInsertId()], 'Entry saved.');
    }

    public function updateEntry(Request $req, array $params): void
    {
        $user = Auth::user();
        $id   = (int) ($params['id'] ?? 0);
        $this->findEntry($id);
        $d = $this->cleanEntry($req);

        $stmt = Database::connect()->prepare(
            'UPDATE bank_entries SET entry_date = ?, entry_type = ?, description = ?, amount = ? WHERE id = ?'
        );
        $stmt->execute([$d['entry_date'], $d['entry_type'], $d['description'], $d['amount'], $id]);

        Activity::log(
            (int) $user['id'], 'bank', 'update',
            'Edited ' . self::TYPE_LABELS[$d['entry_type']] . " #$id \"{$d['description']}\": amount now " . $this->m($d['amount'])
        );

        Response::success(['id' => $id], 'Entry updated.');
    }

    public function deleteEntry(Request $req, array $params): void
    {
        $user = Auth::user();
        $id   = (int) ($params['id'] ?? 0);
        $row  = $this->findEntry($id);
        Database::connect()->prepare('DELETE FROM bank_entries WHERE id = ?')->execute([$id]);

        $label = self::TYPE_LABELS[$row['entry_type']] ?? 'entry';
        Activity::log(
            (int) $user['id'], 'bank', 'delete',
            "Deleted $label #$id \"{$row['description']}\" ({$row['entry_date']})"
        );

        Response::success(null, 'Entry deleted.');
    }

    // ---------- Summary ----------

    public function summary(Request $req, array $params): void
    {
        [$from, $to] = $this->range($req);
        $pdo = Database::connect();

        $r = $pdo->prepare(
            'SELECT COALESCE(SUM(expenditure), 0) AS expenditure, COALESCE(SUM(balance), 0) AS balance
             FROM bank_records WHERE record_date BETWEEN ? AND ?'
        );
        $r->execute([$from, $to]);
        $rec = $r->fetch();

        $e = $pdo->prepare(
            'SELECT entry_type, SUM(amount) AS total
             FROM bank_entries WHERE entry_date BETWEEN ? AND ? GROUP BY entry_type'
        );
        $e->execute([$from, $to]);

        $totals = [
            'expenditure' => (float) $rec['expenditure'],
            'balance'     => (float) $rec['balance'],
            'failed'      => 0.0,
            'debit'       => 0.0,
            'credit'      => 0.0,
        ];
        foreach ($e->fetchAll() as $row) {
            $totals[$row['entry_type']] = (float) $row['total'];
        }

        Response::success(['from' => $from, 'to' => $to, 'totals' => $totals]);
    }

    // ---------- helpers ----------

    private function m($v): string
    {
        return number_format((float) $v, 2);
    }

    private function cleanRecord(Request $req): array
    {
        $account = trim((string) $req->input('account_no', ''));
        if ($account === '' || mb_strlen($account) > 50) {
            Response::error('Account number is required (max 50 characters).', 422);
        }

        $opening = $this->money($req->input('opening_cash', 0), 'Opening cash');
        $closing = $this->money($req->input('closing_cash', 0), 'Closing cash');
        $spent   = $this->money($req->input('expenditure', 0), 'Expenditure');

        // balance = opening - (closing + expenditure)
        $balance = round((float) $opening - ((float) $closing + (float) $spent), 2);

        return [
            'record_date'  => $this->date($req->input('record_date'), 'Date'),
            'account_no'   => $account,
            'opening_cash' => $opening,
            'closing_cash' => $closing,
            'expenditure'  => $spent,
            'balance'      => number_format($balance, 2, '.', ''),
        ];
    }

    private function cleanEntry(Request $req): array
    {
        $type = (string) $req->input('entry_type', '');
        if (!in_array($type, self::TYPES, true)) {
            Response::error('Type must be failed, debit or credit.', 422);
        }

        $desc = trim((string) $req->input('description', ''));
        if ($desc === '' || mb_strlen($desc) > 150) {
            Response::error('Description is required (max 150 characters).', 422);
        }

        return [
            'entry_date'  => $this->date($req->input('entry_date'), 'Date'),
            'entry_type'  => $type,
            'description' => $desc,
            'amount'      => $this->money($req->input('amount'), 'Amount'),
        ];
    }

    private function findRecord(int $id): array
    {
        $stmt = Database::connect()->prepare('SELECT * FROM bank_records WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Bank record not found.', 404);
        }
        return $row;
    }

    private function findEntry(int $id): array
    {
        $stmt = Database::connect()->prepare('SELECT * FROM bank_entries WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Entry not found.', 404);
        }
        return $row;
    }

    private function money($v, string $label): string
    {
        if ($v === null || $v === '' || !is_numeric($v) || (float) $v < 0 || (float) $v > 999999999999) {
            Response::error("$label must be a number of 0 or more.", 422);
        }
        return number_format((float) $v, 2, '.', '');
    }

    private function date($v, string $label): string
    {
        $v  = is_string($v) ? $v : '';
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
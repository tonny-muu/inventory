<?php
declare(strict_types=1);

class StationeryController
{
    /** Total debt payments received per sale (joined as alias p; the sales table is alias s). */
    private const PAID_JOIN =
        'LEFT JOIN (SELECT sale_id, SUM(amount) AS paid FROM stationery_debt_payments GROUP BY sale_id) p ON p.sale_id = s.id';

    // =====================================================================
    // Item list and rates
    // =====================================================================

    /** Active items for the sales dropdown. */
    public function listItems(Request $req, array $params): void
    {
        $stmt = Database::connect()->query(
            'SELECT id, name, rate FROM stationery_items WHERE is_active = 1 ORDER BY sort_order, id'
        );
        Response::success($stmt->fetchAll());
    }

    /** All items including switched-off ones (admin manager). */
    public function listAllItems(Request $req, array $params): void
    {
        $stmt = Database::connect()->query(
            'SELECT id, name, rate, is_active FROM stationery_items ORDER BY sort_order, id'
        );
        Response::success($stmt->fetchAll());
    }

    public function saveItem(Request $req, array $params): void
    {
        $user = Auth::user();
        $d    = $this->cleanItem($req, 0);
        $pdo  = Database::connect();

        $next = (int) $pdo->query('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM stationery_items')->fetchColumn();
        $stmt = $pdo->prepare(
            'INSERT INTO stationery_items (name, rate, sort_order, is_active) VALUES (?, ?, ?, 1)'
        );
        $stmt->execute([$d['name'], $d['rate'], $next]);

        Activity::log(
            (int) $user['id'], 'stationery', 'create',
            sprintf('Added item to price list: %s at %s', $d['name'], $this->n($d['rate']))
        );
        Response::success(['id' => (int) $pdo->lastInsertId()], 'Item added.');
    }

    public function updateItem(Request $req, array $params): void
    {
        $user     = Auth::user();
        $id       = (int) ($params['id'] ?? 0);
        $existing = $this->findItem($id);
        $d        = $this->cleanItem($req, $id);

        $raw    = $req->input('is_active');
        $active = $raw === null
            ? (int) $existing['is_active']
            : (filter_var($raw, FILTER_VALIDATE_BOOLEAN) ? 1 : 0);

        $stmt = Database::connect()->prepare(
            'UPDATE stationery_items SET name = ?, rate = ?, is_active = ? WHERE id = ?'
        );
        $stmt->execute([$d['name'], $d['rate'], $active, $id]);

        Activity::log(
            (int) $user['id'], 'stationery', 'update',
            sprintf('Changed item: %s, rate %s%s', $d['name'], $this->n($d['rate']), $active ? '' : ' (switched off)')
        );
        Response::success(['id' => $id], 'Item updated.');
    }

    // =====================================================================
    // Sales
    // =====================================================================

    public function listSales(Request $req, array $params): void
    {
        [$from, $to] = $this->range($req);
        $stmt = Database::connect()->prepare(
            'SELECT s.id, s.sale_date, s.item_id, s.item, s.qty, s.rate, s.amount, s.balance, s.debt,
                    COALESCE(p.paid, 0) AS paid,
                    (s.debt - COALESCE(p.paid, 0)) AS owing,
                    s.name, s.contact, s.created_at, u.full_name AS recorded_by
             FROM stationery_sales s
             LEFT JOIN users u ON u.id = s.created_by ' . self::PAID_JOIN . '
             WHERE s.sale_date BETWEEN ? AND ?
             ORDER BY s.sale_date DESC, s.id DESC'
        );
        $stmt->execute([$from, $to]);
        Response::success($stmt->fetchAll());
    }

    public function saveSale(Request $req, array $params): void
    {
        $user = Auth::user();
        $d    = $this->cleanSale($req, null);
        $pdo  = Database::connect();

        $stmt = $pdo->prepare(
            'INSERT INTO stationery_sales
                (sale_date, item_id, item, qty, rate, amount, balance, debt, name, contact, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $d['sale_date'], $d['item_id'], $d['item'], $d['qty'], $d['rate'], $d['amount'],
            $d['balance'], $d['debt'], $d['name'], $d['contact'], (int) $user['id'],
        ]);

        $debtNote = (float) $d['debt'] > 0 ? ', debt ' . $this->n($d['debt']) : '';
        Activity::log(
            (int) $user['id'], 'stationery', 'create',
            sprintf('Sale: %s x%d = %s%s', $d['item'], $d['qty'], $this->n($d['amount']), $debtNote)
        );
        Response::success(['id' => (int) $pdo->lastInsertId(), 'amount' => $d['amount']], 'Sale saved.');
    }

    public function updateSale(Request $req, array $params): void
    {
        $user     = Auth::user();
        $id       = (int) ($params['id'] ?? 0);
        $existing = $this->findSale($id);
        $d        = $this->cleanSale($req, $existing);

        $paid = $this->paidFor($id);
        if ((float) $d['debt'] < $paid - 0.001) {
            Response::error('Debt cannot be less than the ' . $this->n($paid) . ' already paid on this sale.', 422);
        }

        $stmt = Database::connect()->prepare(
            'UPDATE stationery_sales
             SET sale_date = ?, item_id = ?, item = ?, qty = ?, rate = ?, amount = ?, balance = ?, debt = ?, name = ?, contact = ?
             WHERE id = ?'
        );
        $stmt->execute([
            $d['sale_date'], $d['item_id'], $d['item'], $d['qty'], $d['rate'], $d['amount'],
            $d['balance'], $d['debt'], $d['name'], $d['contact'], $id,
        ]);

        Activity::log(
            (int) $user['id'], 'stationery', 'update',
            sprintf('Edited sale #%d: %s x%d = %s', $id, $d['item'], $d['qty'], $this->n($d['amount']))
        );
        Response::success(['id' => $id, 'amount' => $d['amount']], 'Sale updated.');
    }

    public function deleteSale(Request $req, array $params): void
    {
        $user = Auth::user();
        $id   = (int) ($params['id'] ?? 0);
        $sale = $this->findSale($id);

        $pdo = Database::connect();
        $pdo->prepare('DELETE FROM stationery_debt_payments WHERE sale_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM stationery_sales WHERE id = ?')->execute([$id]);

        Activity::log(
            (int) $user['id'], 'stationery', 'delete',
            sprintf('Deleted sale #%d: %s x%d = %s', $id, $sale['item'], (int) $sale['qty'], $this->n($sale['amount']))
        );
        Response::success(null, 'Sale deleted.');
    }

    // =====================================================================
    // Debts: receiving payments, list of debtors, list of payments
    // =====================================================================

    /** Records a payment against one sale. The money counts as sales of the day the debt was taken. */
    public function receivePayment(Request $req, array $params): void
    {
        $user   = Auth::user();
        $saleId = (int) ($params['id'] ?? 0);
        $amount = $this->money($req->input('amount'), 'Payment');
        if ((float) $amount <= 0) {
            Response::error('Payment must be more than 0.', 422);
        }

        $pdo = Database::connect();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'SELECT id, sale_date, item, name, debt FROM stationery_sales WHERE id = ? FOR UPDATE'
            );
            $stmt->execute([$saleId]);
            $sale = $stmt->fetch();
            if (!$sale) {
                Response::error('Sale not found.', 404);
            }

            $q = $pdo->prepare('SELECT COALESCE(SUM(amount), 0) FROM stationery_debt_payments WHERE sale_id = ?');
            $q->execute([$saleId]);
            $owing = round((float) $sale['debt'] - (float) $q->fetchColumn(), 2);

            if ($owing <= 0) {
                Response::error('This debt is already cleared.', 422);
            }
            if ((float) $amount > $owing + 0.001) {
                Response::error('Payment is more than the amount owing (' . $this->n($owing) . ').', 422);
            }

            $ins = $pdo->prepare(
                'INSERT INTO stationery_debt_payments (sale_id, amount, paid_date, created_by) VALUES (?, ?, ?, ?)'
            );
            $ins->execute([$saleId, $amount, date('Y-m-d'), (int) $user['id']]);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        $left   = round($owing - (float) $amount, 2);
        $person = $sale['name'] ? ' from ' . $sale['name'] : '';
        Activity::log(
            (int) $user['id'], 'stationery', 'create',
            sprintf(
                'Debt payment %s received%s for %s (sale of %s)%s',
                $this->n($amount), $person, $sale['item'], $sale['sale_date'],
                $left <= 0 ? ', debt cleared' : ', ' . $this->n($left) . ' still owing'
            )
        );
        Response::success(
            ['owing' => $left],
            $left <= 0 ? 'Payment received. Debt cleared.' : 'Payment received.'
        );
    }

    /** Every sale that still has money owing, whatever its date. */
    public function listDebtors(Request $req, array $params): void
    {
        $stmt = Database::connect()->query(
            'SELECT s.id, s.sale_date, s.item, s.amount, s.debt,
                    COALESCE(p.paid, 0) AS paid,
                    (s.debt - COALESCE(p.paid, 0)) AS owing,
                    s.name, s.contact, s.created_at, u.full_name AS recorded_by
             FROM stationery_sales s
             LEFT JOIN users u ON u.id = s.created_by ' . self::PAID_JOIN . '
             WHERE (s.debt - COALESCE(p.paid, 0)) > 0
             ORDER BY s.sale_date ASC, s.id ASC'
        );
        Response::success($stmt->fetchAll());
    }

    /** Payments received in the date range (by the day the money came in). */
    public function listPayments(Request $req, array $params): void
    {
        [$from, $to] = $this->range($req);
        $stmt = Database::connect()->prepare(
            'SELECT pay.id, pay.sale_id, pay.amount, pay.paid_date, pay.created_at,
                    s.sale_date, s.item, s.name, u.full_name AS recorded_by
             FROM stationery_debt_payments pay
             JOIN stationery_sales s ON s.id = pay.sale_id
             LEFT JOIN users u ON u.id = pay.created_by
             WHERE pay.paid_date BETWEEN ? AND ?
             ORDER BY pay.id DESC'
        );
        $stmt->execute([$from, $to]);
        Response::success($stmt->fetchAll());
    }

    // =====================================================================
    // Expenses (many rows per day: description + amount)
    // =====================================================================

    public function listExpenses(Request $req, array $params): void
    {
        [$from, $to] = $this->range($req);
        $stmt = Database::connect()->prepare(
            'SELECT e.id, e.expense_date, e.description, e.amount, e.created_at, u.full_name AS recorded_by
             FROM stationery_expense_items e
             LEFT JOIN users u ON u.id = e.created_by
             WHERE e.expense_date BETWEEN ? AND ?
             ORDER BY e.expense_date DESC, e.id DESC'
        );
        $stmt->execute([$from, $to]);
        Response::success($stmt->fetchAll());
    }

    public function saveExpense(Request $req, array $params): void
    {
        $user = Auth::user();
        $d    = $this->cleanExpense($req);
        $pdo  = Database::connect();

        $stmt = $pdo->prepare(
            'INSERT INTO stationery_expense_items (expense_date, description, amount, created_by)
             VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$d['expense_date'], $d['description'], $d['amount'], (int) $user['id']]);

        Activity::log(
            (int) $user['id'], 'stationery', 'create',
            sprintf('Expense: %s = %s', $d['description'], $this->n($d['amount']))
        );
        Response::success(['id' => (int) $pdo->lastInsertId()], 'Expense saved.');
    }

    public function updateExpense(Request $req, array $params): void
    {
        $user = Auth::user();
        $id   = (int) ($params['id'] ?? 0);
        $this->findExpense($id);
        $d = $this->cleanExpense($req);

        $stmt = Database::connect()->prepare(
            'UPDATE stationery_expense_items SET expense_date = ?, description = ?, amount = ? WHERE id = ?'
        );
        $stmt->execute([$d['expense_date'], $d['description'], $d['amount'], $id]);

        Activity::log(
            (int) $user['id'], 'stationery', 'update',
            sprintf('Edited expense #%d: %s = %s', $id, $d['description'], $this->n($d['amount']))
        );
        Response::success(['id' => $id], 'Expense updated.');
    }

    public function deleteExpense(Request $req, array $params): void
    {
        $user = Auth::user();
        $id   = (int) ($params['id'] ?? 0);
        $row  = $this->findExpense($id);
        Database::connect()->prepare('DELETE FROM stationery_expense_items WHERE id = ?')->execute([$id]);

        Activity::log(
            (int) $user['id'], 'stationery', 'delete',
            sprintf('Deleted expense #%d: %s = %s', $id, $row['description'], $this->n($row['amount']))
        );
        Response::success(null, 'Expense deleted.');
    }

    // =====================================================================
    // Inventory (items received and their cost; separate from sales)
    // =====================================================================

    public function listInventory(Request $req, array $params): void
    {
        [$from, $to] = $this->range($req);
        $stmt = Database::connect()->prepare(
            'SELECT i.id, i.received_date, i.item, i.qty, i.unit_cost, i.total_cost, i.created_at,
                    u.full_name AS recorded_by
             FROM stationery_inventory i
             LEFT JOIN users u ON u.id = i.created_by
             WHERE i.received_date BETWEEN ? AND ?
             ORDER BY i.received_date DESC, i.id DESC'
        );
        $stmt->execute([$from, $to]);
        Response::success($stmt->fetchAll());
    }

    public function saveInventory(Request $req, array $params): void
    {
        $user = Auth::user();
        $d    = $this->cleanInventory($req);
        $pdo  = Database::connect();

        $stmt = $pdo->prepare(
            'INSERT INTO stationery_inventory (received_date, item, qty, unit_cost, total_cost, created_by)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $d['received_date'], $d['item'], $d['qty'], $d['unit_cost'], $d['total_cost'], (int) $user['id'],
        ]);

        Activity::log(
            (int) $user['id'], 'stationery', 'create',
            sprintf('Stock received: %s x%d, cost %s', $d['item'], $d['qty'], $this->n($d['total_cost']))
        );
        Response::success(['id' => (int) $pdo->lastInsertId()], 'Stock saved.');
    }

    public function updateInventory(Request $req, array $params): void
    {
        $user = Auth::user();
        $id   = (int) ($params['id'] ?? 0);
        $this->findInventory($id);
        $d = $this->cleanInventory($req);

        $stmt = Database::connect()->prepare(
            'UPDATE stationery_inventory
             SET received_date = ?, item = ?, qty = ?, unit_cost = ?, total_cost = ? WHERE id = ?'
        );
        $stmt->execute([$d['received_date'], $d['item'], $d['qty'], $d['unit_cost'], $d['total_cost'], $id]);

        Activity::log(
            (int) $user['id'], 'stationery', 'update',
            sprintf('Edited stock #%d: %s x%d, cost %s', $id, $d['item'], $d['qty'], $this->n($d['total_cost']))
        );
        Response::success(['id' => $id], 'Stock updated.');
    }

    public function deleteInventory(Request $req, array $params): void
    {
        $user = Auth::user();
        $id   = (int) ($params['id'] ?? 0);
        $row  = $this->findInventory($id);
        Database::connect()->prepare('DELETE FROM stationery_inventory WHERE id = ?')->execute([$id]);

        Activity::log(
            (int) $user['id'], 'stationery', 'delete',
            sprintf('Deleted stock #%d: %s x%d', $id, $row['item'], (int) $row['qty'])
        );
        Response::success(null, 'Stock deleted.');
    }

    // =====================================================================
    // Summary per day.
    // Sales = money actually received for that day's sales. A debt counts
    // only once it is paid, and then it counts on the day it was taken.
    // =====================================================================

    public function summary(Request $req, array $params): void
    {
        [$from, $to] = $this->range($req);
        $pdo = Database::connect();

        $s = $pdo->prepare(
            'SELECT s.sale_date AS d,
                    SUM(s.amount) AS gross,
                    SUM(s.debt) AS debt,
                    COALESCE(SUM(p.paid), 0) AS paid
             FROM stationery_sales s ' . self::PAID_JOIN . '
             WHERE s.sale_date BETWEEN ? AND ?
             GROUP BY s.sale_date'
        );
        $s->execute([$from, $to]);

        $e = $pdo->prepare(
            'SELECT expense_date AS d, SUM(amount) AS expenses
             FROM stationery_expense_items WHERE expense_date BETWEEN ? AND ? GROUP BY expense_date'
        );
        $e->execute([$from, $to]);

        $days = [];
        foreach ($s->fetchAll() as $r) {
            $owing = max(0.0, round((float) $r['debt'] - (float) $r['paid'], 2));
            $days[$r['d']] = [
                'date'     => $r['d'],
                'sales'    => round((float) $r['gross'] - $owing, 2),
                'debt'     => $owing,
                'expenses' => 0.0,
            ];
        }
        foreach ($e->fetchAll() as $r) {
            $days[$r['d']] ??= ['date' => $r['d'], 'sales' => 0.0, 'debt' => 0.0, 'expenses' => 0.0];
            $days[$r['d']]['expenses'] = (float) $r['expenses'];
        }
        krsort($days);

        $totals = ['sales' => 0.0, 'expenses' => 0.0, 'debt' => 0.0, 'net' => 0.0];
        foreach ($days as &$day) {
            $day['net'] = round($day['sales'] - $day['expenses'], 2);
            $totals['sales']    += $day['sales'];
            $totals['expenses'] += $day['expenses'];
            $totals['debt']     += $day['debt'];
        }
        unset($day);
        $totals['net'] = round($totals['sales'] - $totals['expenses'], 2);

        Response::success(['from' => $from, 'to' => $to, 'totals' => $totals, 'days' => array_values($days)]);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private function cleanSale(Request $req, ?array $existing): array
    {
        $qtyRaw = $req->input('qty');
        if (!is_numeric($qtyRaw) || (int) $qtyRaw != $qtyRaw || (int) $qtyRaw < 1) {
            Response::error('Qty must be a whole number of 1 or more.', 422);
        }
        $qty = (int) $qtyRaw;

        $itemIdRaw = $req->input('item_id');
        $itemId    = null;

        if ($itemIdRaw !== null && $itemIdRaw !== '') {
            // A listed item: the name and rate come from the item list, not from the browser.
            $itemId = (int) $itemIdRaw;
            $row    = $this->findItem($itemId);

            $sameItem = $existing !== null && (int) ($existing['item_id'] ?? 0) === $itemId;
            if (!$sameItem && !(int) $row['is_active']) {
                Response::error('This item is no longer available.', 422);
            }
            $item = (string) $row['name'];
            // When an admin edits an old sale of the same item, keep the rate it was sold at.
            $rate = number_format((float) ($sameItem ? $existing['rate'] : $row['rate']), 2, '.', '');
        } else {
            // "Others": the user types the item name and the rate.
            $item = trim((string) $req->input('item', ''));
            if ($item === '' || mb_strlen($item) > 150) {
                Response::error('Item is required (max 150 characters).', 422);
            }
            $rate = $this->money($req->input('rate'), 'Rate');
        }

        $amount = number_format($qty * (float) $rate, 2, '.', '');
        $debt   = $this->money($req->input('debt', 0), 'Debt');
        if ((float) $debt > (float) $amount + 0.001) {
            Response::error('Debt cannot be more than the sale amount.', 422);
        }

        $name    = trim((string) $req->input('name', ''));
        $contact = trim((string) $req->input('contact', ''));
        if (mb_strlen($name) > 100) {
            Response::error('Name is too long (max 100 characters).', 422);
        }
        if (mb_strlen($contact) > 50) {
            Response::error('Contact is too long (max 50 characters).', 422);
        }

        return [
            'sale_date' => $this->date($req->input('sale_date'), 'Date'),
            'item_id'   => $itemId,
            'item'      => $item,
            'qty'       => $qty,
            'rate'      => $rate,
            'amount'    => $amount,
            'balance'   => $this->money($req->input('balance', 0), 'Balance'),
            'debt'      => $debt,
            'name'      => $name !== '' ? $name : null,
            'contact'   => $contact !== '' ? $contact : null,
        ];
    }

    private function cleanExpense(Request $req): array
    {
        $desc = trim((string) $req->input('description', ''));
        if ($desc === '' || mb_strlen($desc) > 150) {
            Response::error('Description is required (max 150 characters).', 422);
        }

        return [
            'expense_date' => $this->date($req->input('expense_date'), 'Date'),
            'description'  => $desc,
            'amount'       => $this->money($req->input('amount'), 'Amount'),
        ];
    }

    private function cleanInventory(Request $req): array
    {
        $item = trim((string) $req->input('item', ''));
        if ($item === '' || mb_strlen($item) > 150) {
            Response::error('Item is required (max 150 characters).', 422);
        }

        $qtyRaw = $req->input('qty');
        if (!is_numeric($qtyRaw) || (int) $qtyRaw != $qtyRaw || (int) $qtyRaw < 1) {
            Response::error('Qty must be a whole number of 1 or more.', 422);
        }
        $qty      = (int) $qtyRaw;
        $unitCost = $this->money($req->input('unit_cost'), 'Unit cost');

        return [
            'received_date' => $this->date($req->input('received_date'), 'Date'),
            'item'          => $item,
            'qty'           => $qty,
            'unit_cost'     => $unitCost,
            'total_cost'    => number_format($qty * (float) $unitCost, 2, '.', ''),
        ];
    }

    private function cleanItem(Request $req, int $ignoreId): array
    {
        $name = trim((string) $req->input('name', ''));
        if ($name === '' || mb_strlen($name) > 100) {
            Response::error('Item name is required (max 100 characters).', 422);
        }
        $rate = $this->money($req->input('rate'), 'Rate');

        $stmt = Database::connect()->prepare('SELECT id FROM stationery_items WHERE name = ? AND id <> ?');
        $stmt->execute([$name, $ignoreId]);
        if ($stmt->fetch()) {
            Response::error('An item with this name already exists.', 422);
        }

        return ['name' => $name, 'rate' => $rate];
    }

    private function paidFor(int $saleId): float
    {
        $stmt = Database::connect()->prepare(
            'SELECT COALESCE(SUM(amount), 0) FROM stationery_debt_payments WHERE sale_id = ?'
        );
        $stmt->execute([$saleId]);
        return (float) $stmt->fetchColumn();
    }

    private function findSale(int $id): array
    {
        $stmt = Database::connect()->prepare('SELECT * FROM stationery_sales WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Sale not found.', 404);
        }
        return $row;
    }

    private function findExpense(int $id): array
    {
        $stmt = Database::connect()->prepare('SELECT * FROM stationery_expense_items WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Expense not found.', 404);
        }
        return $row;
    }

    private function findInventory(int $id): array
    {
        $stmt = Database::connect()->prepare('SELECT * FROM stationery_inventory WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Stock record not found.', 404);
        }
        return $row;
    }

    private function findItem(int $id): array
    {
        $stmt = Database::connect()->prepare('SELECT * FROM stationery_items WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            Response::error('Item not found.', 404);
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

    /** Whole-number money for activity descriptions, e.g. 1,500. */
    private function n($v): string
    {
        return number_format((float) $v);
    }

    /** Date range from ?from=&to=, defaulting to the current month. */
    private function range(Request $req): array
    {
        $from = (string) $req->query('from', date('Y-m-01'));
        $to   = (string) $req->query('to', date('Y-m-d'));
        return [$this->date($from, 'From date'), $this->date($to, 'To date')];
    }
}
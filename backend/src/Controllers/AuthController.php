<?php
declare(strict_types=1);

class AuthController
{
    public function register(Request $req, array $params): void
    {
        $fullName = trim((string) $req->input('full_name', ''));
        $username = trim((string) $req->input('username', ''));
        $email    = strtolower(trim((string) $req->input('email', '')));
        $phone    = trim((string) $req->input('phone', ''));
        $password = (string) $req->input('password', '');
        $confirm  = (string) $req->input('confirm_password', '');

        $errors = [];

        if ($fullName === '' || mb_strlen($fullName) > 100) {
            $errors['full_name'] = 'Full name is required (max 100 characters).';
        }
        if (!preg_match('/^[A-Za-z0-9_.]{3,50}$/', $username)) {
            $errors['username'] = 'Username must be 3-50 characters: letters, numbers, underscore or dot.';
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
            $errors['email'] = 'A valid email is required.';
        }
        if (!preg_match('/^[0-9+\-() ]{7,20}$/', $phone)) {
            $errors['phone'] = 'A valid phone number is required (7-20 characters: digits, + - ( ) and spaces).';
        }
        if (strlen($password) < 8) {
            $errors['password'] = 'Password must be at least 8 characters.';
        } elseif (!hash_equals($password, $confirm)) {
            $errors['confirm_password'] = 'The two passwords do not match.';
        }

        if (!$errors) {
            if (User::findByUsername($username)) {
                $errors['username'] = 'That username is already taken.';
            }
            if (User::emailExists($email)) {
                $errors['email'] = 'That email is already registered.';
            }
        }

        if ($errors) {
            Response::error('Please correct the highlighted fields.', 422, $errors);
        }

        User::create($fullName, $username, $email, $password, $phone);

        Response::success(null, 'Registration received. Your account is pending admin approval.', 201);
    }

    public function login(Request $req, array $params): void
    {
        $username = trim((string) $req->input('username', ''));
        $password = (string) $req->input('password', '');
        $ip       = $req->ip();

        if ($username === '' || $password === '') {
            Response::error('Username and password are required.', 422);
        }

        if (User::tooManyAttempts($username, $ip)) {
            Response::error('Too many failed attempts. Try again in 15 minutes.', 429);
        }

        $user = User::findByUsername($username);

        if (!$user || !password_verify($password, $user['password_hash'])) {
            User::recordAttempt($username, $ip);
            Response::error('Invalid username or password.', 401);
        }

        if ($user['status'] === 'pending') {
            Response::error('Your account is still waiting for admin approval.', 403);
        }
        if ($user['status'] === 'rejected') {
            Response::error('Your registration was not approved.', 403);
        }
        if ($user['status'] === 'disabled') {
            Response::error('Your account has been disabled. Contact the admin.', 403);
        }

        User::clearAttempts($username);
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        User::touchLogin((int) $user['id']);

        Activity::log((int) $user['id'], 'account', 'login', 'Signed in');

        Response::success([
            'id'         => (int) $user['id'],
            'full_name'  => $user['full_name'],
            'username'   => $user['username'],
            'phone'      => $user['phone'] ?? null,
            'role'       => $user['role'],
            'dashboards' => User::dashboards((int) $user['id']),
        ], 'Login successful');
    }

    public function logout(Request $req, array $params): void
    {
        $id = $_SESSION['user_id'] ?? null;
        if ($id) {
            Activity::log((int) $id, 'account', 'logout', 'Signed out');
        }

        $_SESSION = [];
        session_destroy();
        Response::success(null, 'Logged out');
    }

    public function me(Request $req, array $params): void
    {
        $id = $_SESSION['user_id'] ?? null;
        $user = $id ? User::findById((int) $id) : null;

        if (!$user || $user['status'] !== 'approved') {
            Response::error('Not logged in.', 401);
        }

        $user['dashboards'] = User::dashboards((int) $user['id']);
        Response::success($user);
    }
}
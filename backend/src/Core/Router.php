<?php
declare(strict_types=1);

class Router
{
    private array $routes = [];

    public function add(string $method, string $pattern, callable|array $handler, array $middleware = []): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
        $this->routes[] = [strtoupper($method), $regex, $handler, $middleware];
    }

    public function get(string $p, callable|array $h, array $m = []): void    { $this->add('GET', $p, $h, $m); }
    public function post(string $p, callable|array $h, array $m = []): void   { $this->add('POST', $p, $h, $m); }
    public function put(string $p, callable|array $h, array $m = []): void    { $this->add('PUT', $p, $h, $m); }
    public function delete(string $p, callable|array $h, array $m = []): void { $this->add('DELETE', $p, $h, $m); }

    public function dispatch(Request $request): never
    {
        $pathMatched = false;

        foreach ($this->routes as [$method, $regex, $handler, $middleware]) {
            if (!preg_match($regex, $request->path(), $m)) {
                continue;
            }
            $pathMatched = true;
            if ($method !== $request->method()) {
                continue;
            }

            $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);

            foreach ($middleware as $mw) {
                $mw($request);
            }

            if (is_array($handler)) {
                $handler = [new $handler[0](), $handler[1]];
            }
            $handler($request, $params);
            Response::error('Handler returned no response', 500);
        }

        if ($pathMatched) {
            Response::error('Method not allowed', 405);
        }
        Response::error('Route not found', 404);
    }
}
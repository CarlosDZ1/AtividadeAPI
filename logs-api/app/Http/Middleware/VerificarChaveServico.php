<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerificarChaveServico
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $chaveEsperada = config('services.logs.chave');
        $chaveRecebida = $request->header('X-Service-Key');
        if (
            !is_string($chaveEsperada) ||
            $chaveEsperada === '' ||
            !is_string($chaveRecebida) ||
            !hash_equals($chaveEsperada, $chaveRecebida)
        ) {
            return response()->json([
                'message' => 'Chave de servico invalida.',
            ], 401);
        }
        return $next($request);
    }
}

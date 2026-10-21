<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Log;
class LogController extends Controller
{
    public function store(Request $request)
    {
        $dados = $request->validate([
            'acao' => 'required|string|max:100',
            'detalhe' => 'required|string',
            'usuarioId' => 'nullable|integer|min:1',
        ]);

        $log = Log::create($dados);

        return response()->json([
            'data' => $log,
        ], 201);
    }
}

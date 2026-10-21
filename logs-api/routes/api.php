<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\LogController;
use App\Http\Middleware\VerificarChaveServico;
Route::post('/logs', [LogController::class, 'store'])
    ->middleware(VerificarChaveServico::class);
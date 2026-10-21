<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\LogController;

Route::post('/logs', [LogController::class, 'store']);
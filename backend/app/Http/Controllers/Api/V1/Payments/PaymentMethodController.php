<?php

namespace App\Http\Controllers\Api\V1\Payments;

use App\Http\Controllers\Controller;
use App\Http\Resources\Payments\PaymentMethodResource;
use App\Models\PaymentMethod;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PaymentMethodController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $methods = PaymentMethod::where('is_active', true)->get();

        return PaymentMethodResource::collection($methods);
    }
}

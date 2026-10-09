<?php

namespace App\Models;

use App\Domain\Payments\Enums\PaymentType;
use App\Domain\Support\Casts\MoneyCast;
use App\Domain\Support\Money;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property string $payment_number
 * @property int $payment_method_id
 * @property Money $amount
 * @property PaymentType $payment_type
 * @property string|null $payable_type
 * @property int|null $payable_id
 * @property string|null $notes
 * @property Carbon $paid_at
 * @property int|null $created_by
 */
class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'payment_number',
        'payment_method_id',
        'amount',
        'payment_type',
        'payable_type',
        'payable_id',
        'notes',
        'paid_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => MoneyCast::class,
            'payment_type' => PaymentType::class,
            'paid_at' => 'datetime',
        ];
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function payable(): MorphTo
    {
        return $this->morphTo();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

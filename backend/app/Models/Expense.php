<?php

namespace App\Models;

use App\Domain\Support\Casts\MoneyCast;
use App\Domain\Support\Money;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property int $expense_category_id
 * @property int|null $payment_method_id
 * @property Money $amount
 * @property CarbonInterface $expense_date
 * @property string $description
 * @property string|null $reference_type
 * @property int|null $reference_id
 * @property int|null $created_by
 */
class Expense extends Model
{
    use HasFactory;

    protected $fillable = [
        'expense_category_id',
        'payment_method_id',
        'amount',
        'expense_date',
        'description',
        'reference_type',
        'reference_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => MoneyCast::class,
            'expense_date' => 'date',
        ];
    }

    public function expenseCategory(): BelongsTo
    {
        return $this->belongsTo(ExpenseCategory::class);
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

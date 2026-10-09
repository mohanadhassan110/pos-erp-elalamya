<?php

namespace App\Http\Resources\Catalog;

use App\Models\Product;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Barcode Label Resource for shelf/product packaging labels.
 *
 * Invariants:
 * 1. Preserves exact existing barcode value (never changes or regenerates).
 * 2. Strictly confidential: Omits purchase cost and profit metrics.
 * 3. Formatted retail price for customer display.
 * 4. Showroom branding included.
 *
 * @mixin Product
 */
class BarcodeLabelResource extends JsonResource
{
    protected int $printQuantity;

    public function __construct($resource, int $printQuantity = 1)
    {
        parent::__construct($resource);
        $this->printQuantity = $printQuantity;
    }

    public function toArray(Request $request): array
    {
        $showroomName = Setting::get('showroom_name', 'العالمية للأثاث والموبيليا');

        return [
            'product_id' => $this->id,
            'product_name' => $this->name,
            'barcode' => $this->barcode,
            'category_name' => $this->category?->name ?? 'عام',
            'category_code' => $this->category?->code ?? '',
            'retail_price' => $this->retail_price->toDecimal(),
            'retail_price_formatted' => $this->retail_price->formattedArabic(),
            'wholesale_price' => $this->wholesale_price->toDecimal(),
            'wholesale_price_formatted' => $this->wholesale_price->formattedArabic(),
            'stock_quantity' => $this->stock_quantity->toInt(),
            'print_quantity' => $this->printQuantity,
            'showroom_name' => $showroomName,
        ];
    }
}

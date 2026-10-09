<?php

namespace App\Domain\Catalog\Services;

use App\Models\Category;
use App\Models\Product;
use InvalidArgumentException;
use RuntimeException;

class BarcodeGenerator
{
    /**
     * Maximum number of sequential barcodes per category letter (4 digits = 9999).
     */
    public const MAX_SEQUENCE = 9999;

    /**
     * Generate the next deterministic, sequential barcode for a category.
     * Format: CATEGORY_LETTER + 4 digits (e.g., 'B0001', 'A0042')
     *
     * @throws InvalidArgumentException|RuntimeException
     */
    public static function generateForCategory(Category $category): string
    {
        $letter = strtoupper(trim($category->code));

        if (! preg_match('/^[A-Z]$/', $letter)) {
            throw new InvalidArgumentException("Category letter must be a single uppercase English letter (A-Z), got: '{$letter}'");
        }

        // Lock/query existing barcodes starting with this category letter
        // to find highest sequential number
        $latestBarcode = Product::withTrashed()
            ->where('barcode', 'LIKE', "{$letter}%")
            ->orderBy('barcode', 'desc')
            ->value('barcode');

        $nextNumber = 1;
        if ($latestBarcode && preg_match('/^[A-Z](\d{1,4})$/', $latestBarcode, $matches)) {
            $nextNumber = ((int) $matches[1]) + 1;
        }

        if ($nextNumber > self::MAX_SEQUENCE) {
            throw new RuntimeException("Category '{$letter}' has reached the maximum barcode capacity of ".self::MAX_SEQUENCE.' products.');
        }

        return sprintf('%s%04d', $letter, $nextNumber);
    }

    /**
     * Validate whether a barcode matches the standard format.
     */
    public static function isValid(string $barcode): bool
    {
        return (bool) preg_match('/^[A-Z]\d{4}$/', trim($barcode));
    }
}

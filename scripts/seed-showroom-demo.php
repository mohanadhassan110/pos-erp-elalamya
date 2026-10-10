<?php
use App\Models\Category;
use App\Models\Product;
use App\Models\Customer;

$catL = Category::firstOrCreate(['code' => 'L'], ['name' => 'ألحفة وفيبر', 'is_active' => true]);
$catB = Category::firstOrCreate(['code' => 'B'], ['name' => 'بطاطين شتوية', 'is_active' => true]);
$catM = Category::firstOrCreate(['code' => 'M'], ['name' => 'ملايات ومفروشات سرير', 'is_active' => true]);
$catF = Category::firstOrCreate(['code' => 'F'], ['name' => 'فوط وبشاكير قطن', 'is_active' => true]);

Product::firstOrCreate(['barcode' => 'L0001'], [
    'name' => 'لحاف قطن كينج 3 قطع',
    'category_id' => $catL->id,
    'purchase_cost' => '450.00',
    'wholesale_price' => '600.00',
    'retail_price' => '700.00',
    'stock_quantity' => 15,
    'is_active' => true
]);

Product::firstOrCreate(['barcode' => 'B0001'], [
    'name' => 'بطانية مورانو حفر ليزر 6 كجم',
    'category_id' => $catB->id,
    'purchase_cost' => '650.00',
    'wholesale_price' => '850.00',
    'retail_price' => '950.00',
    'stock_quantity' => 20,
    'is_active' => true
]);

Product::firstOrCreate(['barcode' => 'M0001'], [
    'name' => 'طقم ملاية قطن مطرز 5 قطع',
    'category_id' => $catM->id,
    'purchase_cost' => '200.00',
    'wholesale_price' => '280.00',
    'retail_price' => '350.00',
    'stock_quantity' => 30,
    'is_active' => true
]);

Product::firstOrCreate(['barcode' => 'F0001'], [
    'name' => 'طقم فوط حمام قطن 4 قطع',
    'category_id' => $catF->id,
    'purchase_cost' => '150.00',
    'wholesale_price' => '220.00',
    'retail_price' => '280.00',
    'stock_quantity' => 25,
    'is_active' => true
]);

Customer::firstOrCreate(['phone' => '01022334455'], [
    'name' => 'مؤسسة الهدى لتجارة المفروشات',
    'customer_type' => 'wholesale',
    'address' => 'المنصورة - شارع الجيش',
    'is_active' => true,
    'current_balance' => '0.00'
]);

echo "SEEDED SHOWROOM DATA SUCCESS\n";

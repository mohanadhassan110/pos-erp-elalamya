<?php

namespace Tests\Unit\Domain;

use App\Domain\Support\Money;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class MoneyTest extends TestCase
{
    public function test_can_create_from_decimal_string_and_minor_units(): void
    {
        $m1 = Money::fromDecimal('1250.50');
        $this->assertEquals('1250.50', $m1->toDecimal());
        $this->assertEquals(125050, $m1->toCents());

        $m2 = Money::fromCents(125050);
        $this->assertEquals('1250.50', $m2->toDecimal());
        $this->assertTrue($m1->equals($m2));
    }

    public function test_addition_and_subtraction_maintain_fixed_precision(): void
    {
        $a = Money::fromDecimal('100.25');
        $b = Money::fromDecimal('50.75');

        $sum = $a->add($b);
        $this->assertEquals('151.00', $sum->toDecimal());

        $diff = $a->subtract($b);
        $this->assertEquals('49.50', $diff->toDecimal());
    }

    public function test_multiplication_and_division(): void
    {
        $price = Money::fromDecimal('199.99');
        $total = $price->multiply(3);
        $this->assertEquals('599.97', $total->toDecimal());

        $split = $total->divide(3);
        $this->assertEquals('199.99', $split->toDecimal());
    }

    public function test_arabic_formatting(): void
    {
        $m = Money::fromDecimal('15000.50');
        $this->assertEquals('15,000.50 ج.م', $m->formattedArabic());
    }

    public function test_invalid_decimal_throws_exception(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Money::fromDecimal('abc');
    }
}

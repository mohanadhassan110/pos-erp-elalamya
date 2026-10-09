<?php

namespace Tests\Unit\Domain;

use App\Domain\Support\Quantity;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class QuantityTest extends TestCase
{
    public function test_can_create_from_integer(): void
    {
        $q = Quantity::fromInt(15);
        $this->assertEquals(15, $q->toInt());
        $this->assertTrue($q->isPositive());
    }

    public function test_can_create_from_integer_string(): void
    {
        $q = Quantity::from('42');
        $this->assertEquals(42, $q->toInt());
    }

    public function test_rejects_decimal_quantities(): void
    {
        $this->expectException(InvalidArgumentException::class);
        Quantity::from('3.5');
    }

    public function test_addition_and_subtraction(): void
    {
        $q1 = Quantity::fromInt(10);
        $q2 = Quantity::fromInt(4);

        $this->assertEquals(14, $q1->add($q2)->toInt());
        $this->assertEquals(6, $q1->subtract($q2)->toInt());
    }
}

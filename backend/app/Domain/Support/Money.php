<?php

namespace App\Domain\Support;

use InvalidArgumentException;
use JsonSerializable;
use Stringable;

/**
 * Money Value Object for Al-Alamiya ERP
 *
 * Implements strict fixed-precision decimal arithmetic (scale 2) using BCMath.
 * Never uses floating-point calculations, satisfying AGENTS.md financial invariants.
 */
final class Money implements JsonSerializable, Stringable
{
    private const SCALE = 2;

    private string $amount; // Fixed-precision string e.g. "1250.50"

    private function __construct(string $amount)
    {
        // Normalize decimal string to standard 2-decimal scale
        $this->amount = bcadd($amount, '0', self::SCALE);
    }

    public static function zero(): self
    {
        return new self('0.00');
    }

    /**
     * Create Money from decimal string, integer, or numeric string.
     */
    public static function from(string|int|float $value): self
    {
        return self::fromDecimal($value);
    }

    /**
     * Create Money from decimal string, integer, or numeric string.
     */
    public static function fromDecimal(string|int|float $value): self
    {
        if (is_float($value)) {
            // Prevent float precision drift by formatting with sprintf
            $str = sprintf('%.2f', $value);
        } else {
            $str = (string) $value;
        }

        $trimmed = trim($str);
        if (! preg_match('/^-?\d+(\.\d+)?$/', $trimmed)) {
            throw new InvalidArgumentException("Invalid decimal money representation: '{$value}'");
        }

        return new self($trimmed);
    }

    /**
     * Create Money from minor units (piastres / cents).
     * 100 piastres = 1.00 EGP
     */
    public static function fromCents(int $cents): self
    {
        $sign = $cents < 0 ? '-' : '';
        $abs = abs($cents);
        $units = intdiv($abs, 100);
        $minor = str_pad((string) ($abs % 100), 2, '0', STR_PAD_LEFT);

        return new self("{$sign}{$units}.{$minor}");
    }

    public function toDecimal(): string
    {
        return $this->amount;
    }

    public function toCents(): int
    {
        $scaled = bcmul($this->amount, '100', 0);

        return (int) $scaled;
    }

    public function add(self $other): self
    {
        return new self(bcadd($this->amount, $other->amount, self::SCALE));
    }

    public function subtract(self $other): self
    {
        return new self(bcsub($this->amount, $other->amount, self::SCALE));
    }

    /**
     * Multiply money by integer or fixed-precision factor (e.g. quantity or discount rate).
     */
    public function multiply(int|string $factor): self
    {
        $factorStr = (string) $factor;
        if (! is_numeric($factorStr)) {
            throw new InvalidArgumentException("Multiplier must be numeric: '{$factor}'");
        }

        return new self(bcmul($this->amount, $factorStr, self::SCALE));
    }

    /**
     * Divide money by integer or numeric divisor with rounding.
     */
    public function divide(int|string $divisor): self
    {
        $divStr = (string) $divisor;
        if (! is_numeric($divStr) || bccomp($divStr, '0', self::SCALE) === 0) {
            throw new InvalidArgumentException("Cannot divide by zero or non-numeric divisor: '{$divisor}'");
        }

        return new self(bcdiv($this->amount, $divStr, self::SCALE));
    }

    public function equals(self $other): bool
    {
        return bccomp($this->amount, $other->amount, self::SCALE) === 0;
    }

    public function greaterThan(self $other): bool
    {
        return bccomp($this->amount, $other->amount, self::SCALE) > 0;
    }

    public function greaterThanOrEqual(self $other): bool
    {
        return bccomp($this->amount, $other->amount, self::SCALE) >= 0;
    }

    public function isGreaterThan(self $other): bool
    {
        return $this->greaterThan($other);
    }

    public function isGreaterThanOrEqualTo(self $other): bool
    {
        return $this->greaterThanOrEqual($other);
    }

    public function lessThan(self $other): bool
    {
        return bccomp($this->amount, $other->amount, self::SCALE) < 0;
    }

    public function isLessThan(self $other): bool
    {
        return $this->lessThan($other);
    }

    public function lessThanOrEqual(self $other): bool
    {
        return bccomp($this->amount, $other->amount, self::SCALE) <= 0;
    }

    public function isLessThanOrEqual(self $other): bool
    {
        return $this->lessThanOrEqual($other);
    }

    public function isPositive(): bool
    {
        return bccomp($this->amount, '0.00', self::SCALE) > 0;
    }

    public function isNegative(): bool
    {
        return bccomp($this->amount, '0.00', self::SCALE) < 0;
    }

    public function isZero(): bool
    {
        return bccomp($this->amount, '0.00', self::SCALE) === 0;
    }

    public function abs(): self
    {
        if ($this->isNegative()) {
            return new self(ltrim($this->amount, '-'));
        }

        return $this;
    }

    /**
     * Format as Arabic currency display (e.g. "1,250.50 ج.م")
     */
    public function formattedArabic(): string
    {
        $parts = explode('.', $this->amount);
        $intPart = number_format((int) $parts[0]);
        $decPart = $parts[1] ?? '00';

        return "{$intPart}.{$decPart} ج.م";
    }

    public function jsonSerialize(): string
    {
        return $this->amount;
    }

    public function __toString(): string
    {
        return $this->amount;
    }
}

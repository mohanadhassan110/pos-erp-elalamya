<?php

namespace App\Domain\Support;

use InvalidArgumentException;
use JsonSerializable;
use Stringable;

/**
 * Quantity Value Object for Al-Alamiya ERP
 *
 * Enforces strict whole-number quantities according to AGENTS.md constitution:
 * "Quantities in this ERP are whole numbers unless AGENTS.md explicitly states otherwise.
 *  Never silently introduce decimal quantities."
 */
final class Quantity implements JsonSerializable, Stringable
{
    private int $value;

    private function __construct(int $value)
    {
        $this->value = $value;
    }

    public static function zero(): self
    {
        return new self(0);
    }

    public static function fromInt(int $value): self
    {
        return new self($value);
    }

    /**
     * Create Quantity from numeric representation, strictly rejecting decimals.
     */
    public static function from(int|string $value): self
    {
        if (is_int($value)) {
            return new self($value);
        }

        $trimmed = trim((string) $value);
        if (! preg_match('/^-?\d+$/', $trimmed)) {
            throw new InvalidArgumentException("Quantities must be whole numbers, invalid: '{$value}'");
        }

        return new self((int) $trimmed);
    }

    public function toInt(): int
    {
        return $this->value;
    }

    public function add(self $other): self
    {
        return new self($this->value + $other->value);
    }

    public function subtract(self $other): self
    {
        return new self($this->value - $other->value);
    }

    public function isPositive(): bool
    {
        return $this->value > 0;
    }

    public function isNegative(): bool
    {
        return $this->value < 0;
    }

    public function isZero(): bool
    {
        return $this->value === 0;
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function greaterThan(self $other): bool
    {
        return $this->value > $other->value;
    }

    public function greaterThanOrEqual(self $other): bool
    {
        return $this->value >= $other->value;
    }

    public function lessThan(self $other): bool
    {
        return $this->value < $other->value;
    }

    public function isLessThan(self $other): bool
    {
        return $this->lessThan($other);
    }

    public function isGreaterThan(self $other): bool
    {
        return $this->greaterThan($other);
    }

    public function lessThanOrEqual(self $other): bool
    {
        return $this->value <= $other->value;
    }

    public function isLessThanOrEqual(self $other): bool
    {
        return $this->lessThanOrEqual($other);
    }

    public function jsonSerialize(): int
    {
        return $this->value;
    }

    public function __toString(): string
    {
        return (string) $this->value;
    }
}

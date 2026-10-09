---
name: testing-qa
description: Use after implementing business logic, especially invoices, payments, inventory, ledgers, reports and destructive actions.
---

# Testing & QA

For every business workflow, test:
- happy path
- boundary values
- validation failure
- authorization failure
- duplicate request/idempotency
- transaction rollback
- cancellation reversal
- edit reversal + reapply
- historical profit after product cost changes
- customer underpayment/overpayment
- external product expense and profit
- stock movement correctness
- report inclusion/exclusion

Minimum high-value scenarios:
1. Wholesale invoice fully paid.
2. Wholesale invoice partially paid.
3. Wholesale invoice overpaid.
4. Retail invoice.
5. Price override.
6. External product sale.
7. Invoice cancellation.
8. Invoice edit after posting.
9. Customer standalone payment.
10. Supplier purchase/credit and supplier payment.
11. Expense creation.
12. Barcode generation uniqueness.

Prefer feature/integration tests for workflows and focused unit tests for pure calculations.
Do not mark a task complete until relevant tests pass.

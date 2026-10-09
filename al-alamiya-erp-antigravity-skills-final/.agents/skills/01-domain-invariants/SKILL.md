---
name: domain-invariants
description: Use when implementing or changing sales, invoices, stock, customer/supplier accounts, expenses, external products, payments, profit, cancellation or reporting. Treat this skill as the source of truth for ERP/POS business logic.
---

# Domain Invariants

Before coding, map the requested change to these ledgers:
- Sales/invoice ledger
- Inventory movement ledger
- Customer ledger
- Supplier ledger
- Expense ledger
- Audit/activity ledger

## Required rules
1. Wholesale: customer required; default wholesale prices.
2. Retail: customer optional/not required; default retail prices.
3. Sale price can be overridden per line in both modes.
4. Snapshot `unit_sale_price` and `unit_cost` on invoice lines.
5. Profit is computed from snapshots, never current product price/cost.
6. Normal stock decreases only for stock products.
7. External product does not change stock; its purchase cost becomes a linked expense and its margin contributes to invoice profit.
8. Underpayment creates receivable; overpayment creates customer credit/payment-on-account.
9. Supplier balance changes only through explicit supplier ledger transactions.
10. Invoice cancellation must reverse every financial/inventory effect.
11. Editing a posted invoice must be treated as a controlled adjustment: reverse old effects, apply new effects, preserve audit history.
12. Reports must use authoritative transactions and deterministic filters.

## Never
- Never calculate historical profit from current product cost.
- Never mutate balances only in the frontend.
- Never let a cancelled invoice continue affecting reports.
- Never decrement stock without an inventory movement.

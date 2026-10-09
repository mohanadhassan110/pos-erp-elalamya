---
name: database-integrity
description: Use when designing migrations, relationships, constraints, transactions, inventory, ledgers, money, invoice posting/cancellation or data correction.
---

# Database Integrity

The database is the source of truth.

Recommended core entities:
- users/roles
- categories
- products
- customers
- suppliers
- invoices
- invoice_items
- external_invoice_items or a clearly equivalent representation
- customer_transactions
- supplier_transactions
- expenses
- inventory_movements
- audit_logs
- payments/payment allocations where needed

Rules:
- Define exact ownership of every balance.
- Use foreign keys and restrictive/null-on-delete behavior intentionally.
- Use unique constraints for product barcode.
- Category code must be unique and stable once used in barcode generation.
- Product barcode should follow a deterministic category-code + numeric sequence policy; document the maximum and collision policy.
- Use database transactions for invoice posting, cancellation, edits, supplier/customer transactions and external-product expense creation.
- Prevent negative stock unless an explicitly approved business rule allows it.
- Historical transaction rows must not depend on mutable product master data.
- Avoid storing redundant totals unless there is a demonstrated performance need and a reconciliation strategy.
- Add indexes for barcode, invoice number/date/status, customer/supplier/date and ledger dates.

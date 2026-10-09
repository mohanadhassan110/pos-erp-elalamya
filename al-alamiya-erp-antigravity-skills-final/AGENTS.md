# Al-Alamiya ERP/POS — Project Constitution & Agent Rules

## 1. Purpose and Authority

This file is the authoritative constitution for **العالمية ERP/POS — Al-Alamiya ERP/POS**, an Arabic RTL furniture-showroom ERP/POS built with Laravel/PHP backend, React frontend, and MySQL.

The system covers retail and wholesale sales, inventory, customers, suppliers, stock receiving, returns/exchanges, expenses, reports, barcode printing, invoice printing, authentication, and Owner/Cashier permissions.

**Rule:** If generated code, an AI suggestion, library convention, UI idea, or later prompt conflicts with this constitution, this constitution wins unless the project owner explicitly approves the change.

---

## 2. Absolute Agent Rules

### MUST
- Inspect existing code before modifying it.
- Preserve finalized business rules and existing working behavior.
- Put authoritative business/financial rules on the backend.
- Use DB transactions for operations touching multiple financial, inventory, ledger, payment, or expense records.
- Snapshot historical sale cost/price/profit on posted invoice items.
- Record an inventory movement for every stock mutation.
- Enforce authorization on the backend, not only by hiding frontend menus.
- Keep controllers thin and use Actions/Application Services for business operations.
- Validate external input with Form Requests or equivalent validation.
- Use controlled API Resources/DTO boundaries instead of exposing raw Eloquent models.
- Use fixed-precision decimal money; never floating-point money calculations.
- Use whole-number quantities.
- Keep React as a client of the API, never the financial source of truth.
- Use `/api/v1/...` versioned APIs.
- Add tests for critical business invariants.
- Preserve auditability of edits, cancellations, returns, payments, and stock adjustments.
- Keep the UI Arabic RTL, desktop-first, fast, readable, and operational.

### MUST NOT
- Recalculate historical profit from current product cost.
- Use FIFO or weighted-average costing.
- Allow negative stock.
- Silently mutate posted financial history.
- Hard-delete records that are needed for financial/history integrity.
- Trust client-calculated profit, cost, stock, balance, or totals.
- Put core financial logic inside React components.
- Create one giant generic service/controller.
- Make supplier balance adjustments automatically change stock.
- Treat changing product current cost as a stock receipt.
- Require a supplier-product master relationship.
- Introduce payment gateways unless explicitly requested later.
- Expose external-product purchase cost/profit on customer invoices.
- Use PDF as a required intermediate for printing.
- Introduce excessive gradients, glassmorphism, animation, giant buttons, or generic AI-looking SaaS UI.
- Change framework, database architecture, frontend stack, or domain model without approval.
- Remove history/audit to simplify implementation.

---

## 3. Core Sales Rules

There are exactly two normal sale types:
- `retail` = قطاعي
- `wholesale` = جملة

### Retail
- Customer selection is not required.
- Products default to retail price.
- Line price may be overridden.
- Profit uses the invoice item's historical cost snapshot.
- Retail sales do not create a customer ledger account by default.

### Wholesale
- A registered customer is required.
- Products default to wholesale price.
- Line price may be overridden.
- Invoice is linked to the customer ledger.
- Paid = total: no new outstanding debt.
- Paid < total: remaining becomes receivable/debt.
- Paid > total: excess becomes customer credit.
- Printed invoice includes prior balance, invoice total, paid amount, and resulting balance/credit.

---

## 4. Historical Cost and Profit — FINAL

The system **does not use FIFO or weighted average**.

Each product stores the **current/latest purchase cost**. When the user changes that cost, it affects future sales only.

Every posted invoice item MUST snapshot:
- `product_name`
- `barcode` when applicable
- `quantity`
- `unit_sale_price`
- `unit_cost`
- `subtotal`
- `profit`

Formula:

`Line Profit = (Actual Sale Price - Historical Unit Cost) × Quantity`

Example: cost 500, sale 650, quantity 2 => profit 300. If product cost later changes to 600, the old invoice remains cost 500 and profit 300.

Changing product cost is **not** a purchase and does **not** create stock movement.

---

## 5. Categories, Products and Barcodes

### Categories
- User can create/edit/deactivate categories.
- Each category has a unique single-letter barcode code.
- The code is stable once used by products and must not be casually changed.

### Products
Fields include:
- name
- category
- auto-generated barcode
- current/latest purchase price
- wholesale price
- retail price
- stock quantity
- active/archived status

Products are independent of suppliers.
Used products should be archived/soft-deleted rather than hard-deleted.
All quantities are whole numbers.

### Barcode
Default format:
`CATEGORY_LETTER + up to 4 digits`

Examples: `B0001`, `L0001`.

The sequence must be deterministic and unique per category. Default capacity is 9999 products/category. Do not silently change a barcode already used historically.

Code 128 is preferred for printing because identifiers are alphanumeric.

---

## 6. External Products

POS provides **إضافة منتج خارجي** for a product purchased specifically for a customer and not held as normal showroom stock.

Required:
- product name
- quantity
- purchase cost
- sale price

External product:
- appears as a normal invoice line to the customer;
- does not affect normal product stock;
- does not require a product master record;
- does not reveal purchase cost/profit/external classification to the customer;
- creates a linked expense for the external purchase cost.

Example: qty 2 × cost 300, sold 400 => revenue 800, cost 600, profit 200, normal stock change 0.

The expense must be linked to the invoice/item so cancellation/edit/return can reverse the correct financial effect.

---

## 7. Inventory

`products.stock_quantity` is a cached current balance for fast POS operation.
`inventory_movements` is the historical movement ledger/source of truth for traceability.

Every stock mutation MUST, in one DB transaction:
1. validate the operation;
2. lock the relevant product row when necessary;
3. update `stock_quantity`;
4. create an `inventory_movement`.

No ad-hoc stock arithmetic outside the inventory domain operation/service.

### Negative stock
Forbidden. A sale exceeding available quantity is rejected before financial side effects are committed.

A rejected sale must create none of:
- invoice
- payment
- customer ledger entry
- inventory movement
- external expense

### Movement types
At minimum:
- purchase / stock receipt `+`
- sale `-`
- sale cancellation `+`
- sales return `+`
- adjustment `+/-`
- purchase return if later required

Each movement should have product, quantity, unit cost where relevant, type, reference, reason, actor, and timestamp.

---

## 8. Stock Receiving / Purchasing

Actual physical purchases that enter stock use a dedicated **استلام بضاعة / Stock Receiving** workflow.

A stock receipt may:
- increase stock;
- create inventory movements;
- increase supplier payable when a supplier is selected;
- update the product current/latest purchase cost.

There is no required product-supplier master relationship.

A supplier balance-only adjustment MUST NOT automatically change inventory or product cost.

Purchase returns are rare and do not require a dedicated workflow by default. If stock physically leaves, an inventory movement/adjustment must be recorded.

---

## 9. Customers and Ledgers

Wholesale customers must be registered.

Customer ledger is the source of truth.

`Balance = Total Debits - Total Credits`

Transaction types may include:
- invoice
- payment
- return
- credit
- adjustment

Standalone customer payments are supported. Overpayment becomes customer credit.
Retail customers normally have no account by default.

---

## 10. Suppliers and Ledgers

Suppliers support add/edit/deactivate, pay supplier, add balance, and full ledger history.

- **Pay:** reduces payable.
- **Add Balance:** increases payable.

Balance adjustments must support notes/details such as `فاتورة شراء 20 قطعة لحاف`.

Supplier balance adjustments do not automatically affect stock. Actual purchases use Stock Receiving.

---

## 11. Payments

There are no payment gateways. The system only records how money was received.

Default/configurable methods may include:
- Cash
- Vodafone Cash
- Bank Transfer
- Card
- Other

Payment methods should have `name`, `code`, `is_active`, and `is_cash`.

Multiple payment methods in one invoice are supported/desirable.
Backend validates the final payment state.

---

## 12. Sales Returns and Exchanges — FINAL

Returns are always linked to the original invoice.

A return quantity cannot exceed the remaining eligible quantity sold from the original invoice item.

Supported resolutions:
1. Refund money.
2. Exchange for goods of the same value.
3. Exchange for higher-value goods and collect the difference.
4. Wholesale account deduction/credit treatment.

If replacement value is lower than returned value, the difference cannot disappear. It must become a valid customer credit/refund according to the selected resolution.

A return must:
- restore stock where applicable;
- reverse the appropriate financial effect/profit;
- preserve the original invoice;
- create an auditable return record.

An exchange is a real return + replacement sale/exchange transaction, not a silent edit of the original invoice.

---

## 13. Invoice Lifecycle

Normal statuses:
- `posted`
- `cancelled`

Draft may be introduced only if implementation requires it.

### Cancellation
Cancellation is not deletion. It must:
- restore stock;
- create cancellation inventory movements;
- reverse customer ledger effects;
- reverse linked external expenses;
- reverse/reconcile payment effects;
- preserve invoice history;
- record who/when/why;
- create audit information.

### Editing
Editing a posted invoice is transactional:
1. validate new state;
2. reverse old effects;
3. apply new effects;
4. update snapshots/effects;
5. update inventory/ledger/payment/expense records;
6. audit;
7. commit.

Never silently mutate financial history.

Hard delete is not a normal invoice operation.

---

## 14. Database Blueprint

Core logical tables:

### Auth
`users`

### Catalog
`categories`, `products`

### Sales
`invoices`, `invoice_items`, `invoice_payments`, `payment_methods`

### Customers
`customers`, `customer_transactions`

### Suppliers
`suppliers`, `supplier_transactions`

### Purchasing
`stock_receipts`, `stock_receipt_items`

### Inventory
`inventory_movements`, `stock_adjustments`, `stock_adjustment_items`

### Returns
`sales_returns`, `sales_return_items`

### Expenses
`expense_categories`, `expenses`

### Audit
`audit_logs`

### Settings
`settings`

Important constraints:
- money = `DECIMAL(15,2)` or fixed precision;
- quantity = whole number;
- unique invoice number/barcode/category code as required;
- proper foreign keys/indexes;
- avoid destructive cascades on financial history;
- use soft deletion/archiving where history requires it.

Suggested key fields:

`invoices`: id, invoice_number, customer_id nullable, customer_type, status, subtotal, total, paid_amount, remaining_amount, credit_amount, notes, created_by, cancellation fields, timestamps.

`invoice_items`: id, invoice_id, product_id nullable, item_type (`product|external`), product_name, barcode nullable, quantity, unit_sale_price, unit_cost, subtotal, profit.

`invoice_payments`: invoice_id, amount, payment_method_id, notes, created_by, created_at.

`customer_transactions` / `supplier_transactions`: entity, type, amount, direction, reference_type/id, description, actor, timestamp.

`stock_receipt_items`: receipt, product, quantity, unit_cost, subtotal.

`inventory_movements`: product, type, quantity, unit_cost, reference, reason, actor, timestamp.

`stock_adjustment_items`: product, system quantity, actual quantity, difference.

`sales_return_items`: original invoice item, product, quantity, unit sale price, unit cost, subtotal, profit reversal.

`expenses`: category, amount, payment method, description, date, actor, optional type/reference for linked external cost.

---

## 15. Backend Architecture

Required conceptual flow:

`HTTP Request → Route → Controller → Form Request → Action/Application Service → Domain Rules → Focused Services → Eloquent → DB`

Controllers remain thin.

Recommended Actions:
- `CreateSaleAction`
- `CancelInvoiceAction`
- `UpdateInvoiceAction`
- `CreateSalesReturnAction`
- `ReceiveStockAction`
- `CreateCustomerPaymentAction`
- `CreateSupplierPaymentAction`
- `CreateStockAdjustmentAction`
- `CreateExpenseAction`

Focused services:
- `InventoryService`
- `CustomerLedgerService`
- `SupplierLedgerService`
- `PaymentService`

Do not create a God Service.

---

## 16. API Constitution

All APIs use `/api/v1/...`.

Use API Resources/controlled response DTOs. Do not expose raw models indiscriminately.

Core endpoints include:
- products/categories and product search;
- invoice create/view/update/cancel/return;
- customers and customer ledger/payments;
- suppliers and supplier ledger/payments;
- stock receipts;
- stock adjustments;
- inventory movements;
- expenses;
- reports for sales, profit, expenses, customers, suppliers, inventory, invoices, payments.

Standard error shape:
```json
{
  "message": "لا توجد كمية كافية من المنتج",
  "code": "INSUFFICIENT_STOCK",
  "errors": {
    "product_id": ["المتاح حالياً: 3"]
  }
}
```

Use appropriate HTTP status codes: 200, 201, 400, 401, 403, 404, 422, 500.
Large lists use pagination.

---

## 17. Sale Transaction

A posted sale is atomic.

Inside one DB transaction:
1. validate request;
2. resolve retail/wholesale rules;
3. lock relevant stock rows;
4. verify stock;
5. snapshot sale price and current cost;
6. create invoice;
7. create invoice items;
8. update stock;
9. create inventory movements;
10. create payments;
11. create wholesale ledger entries;
12. create linked external expenses;
13. commit.

Any failure rolls back everything.

Use idempotency/double-submit protection for sale/payment/return submission where practical.

---

## 18. Frontend Architecture

Recommended structure:

```text
frontend/src/
├── app/ (router, providers, config)
├── components/ (ui, forms, tables, modals, feedback)
├── features/
│   ├── auth
│   ├── pos
│   ├── products
│   ├── categories
│   ├── customers
│   ├── suppliers
│   ├── inventory
│   ├── purchasing
│   ├── expenses
│   ├── invoices
│   ├── returns
│   ├── reports
│   └── barcodes
├── services/api
├── hooks
├── types
└── utils
```

API access should be centralized. Do not scatter raw fetch calls across components.

---

## 19. POS UX

The POS is the highest-priority UX and must be fast, simple, dense, readable, keyboard-friendly, Arabic RTL, desktop-first, and tablet-compatible.

Main flow:
1. choose customer type;
2. if wholesale, choose registered customer;
3. search/scan product;
4. add to cart;
5. adjust quantity;
6. override price if applicable;
7. add external product if needed;
8. review totals;
9. enter payment(s);
10. save/print.

Suggested shortcuts:
- F2 search
- F4 customer type
- F8 payment
- F9 save/print
- ESC close

Shortcuts are UX conventions, not business rules.

---

## 20. UI/UX Constitution

The product should feel like a real production ERP/POS used by workers all day, not an AI-generated SaaS landing page.

Use:
- clear hierarchy;
- high contrast;
- dense readable tables;
- restrained spacing;
- obvious primary actions;
- reusable design-system components;
- loading/skeleton states;
- empty states;
- error states;
- success feedback.

Reusable components should include Button, Input, Select, Modal, Table, Badge, Dropdown, DatePicker, MoneyInput, SearchInput, ConfirmDialog, Toast, Loading/Skeleton, EmptyState, ErrorState.

Choose one Arabic-friendly font such as Cairo, IBM Plex Sans Arabic, or Noto Sans Arabic.

Avoid:
- excessive cards;
- gradients everywhere;
- glassmorphism;
- excessive rounded corners;
- giant buttons;
- unnecessary animation;
- huge empty spaces;
- low contrast;
- decorative dashboard noise.

Impeccable-style audits may be used for UI quality, but never override domain rules.

---

## 21. Printing

Printing uses dedicated print layouts, not the screen UI.

Invoice print is Arabic RTL and includes store information, invoice number/date, customer where relevant, items, quantity, price, totals, payment, and balance.

Wholesale additionally includes prior and resulting balance.

External product prints as a normal line and never exposes internal cost/profit/external classification.

Direct printing is preferred. PDF is not required.

Barcode labels are a separate workflow; Code 128 is preferred.

---

## 22. Reports

Reports are Owner-only.

Required:
- total sales;
- total expenses;
- total customer debts;
- total supplier payables;
- total profits;
- stock value;
- invoice history;
- payment methods;
- inventory;
- customer/supplier balances.

Date filters: today, week, month, custom.

Definitions:
`Revenue - COGS = Gross Profit`
`Gross Profit - General Expenses = Net Profit`

Historical COGS/profit uses invoice snapshots.
Cancelled invoices are excluded from active totals. Returns reverse appropriate financial effects.

Stock valuation is current:
`Current Stock × Current Purchase Cost`

It is not historical invoice profit.

---

## 23. Roles and Permissions

Only two default roles:
- Owner
- Cashier

Cashier may perform all operational work:
- POS/sales;
- invoice edit/cancel;
- returns;
- customers/payments;
- suppliers/payments;
- stock receiving/adjustment;
- expenses;
- products/categories;
- barcode printing.

Cashier cannot view or enter Reports.

Owner has full access.

Backend must enforce permissions and return `403` when unauthorized.

Owner-only by default:
- reports;
- users;
- system settings;
- audit logs.

---

## 24. Security

Baseline requirements:
- secure password hashing;
- Laravel/Sanctum-compatible auth;
- backend authorization;
- validation;
- rate limiting where appropriate;
- CSRF protection where applicable;
- Eloquent/query-builder parameterization;
- mass-assignment protection;
- audit logging;
- secure owner-sensitive operations;
- no plaintext secrets/PINs;
- no secrets in Git.

Never trust frontend values for:
- profit;
- unit cost;
- stock;
- ledger balance;
- authoritative totals;
- permissions.

The backend calculates authoritative values.

---

## 25. Testing and QA

### Unit
Test calculations for price, payment, credit, profit, return, exchange difference.

### Feature/API
Test sales, cancellation, editing, returns, stock receiving, customer/supplier payments, expenses, permissions.

### Integration
Test invoice + inventory + customer ledger + supplier ledger + payments + external expenses + reports.

Mandatory scenarios:

1. **Historical cost:** cost 500, sell 2×650 => profit 300; change current cost to 600; old invoice remains cost 500/profit 300.
2. **Negative stock:** stock 2, sell 3 => reject with no invoice/payment/ledger/movement.
3. **Cancellation:** sale decreases stock; cancellation restores stock and creates cancellation movement.
4. **Return:** sold 5, return 2 succeeds; return 6 fails.
5. **External:** qty 2, cost 300, sale 400 => revenue 800, cost 600, profit 200, stock unchanged, linked expense 600.

---

## 26. Auditability

Audit important operations:
- invoice creation/edit/cancel;
- returns;
- customer/supplier payments;
- stock receiving/adjustment;
- expenses;
- permission-sensitive operations.

Audit data may include:
- user;
- action;
- entity/type/id;
- old values;
- new values;
- timestamp;
- IP/user-agent where appropriate.

Audit logs do not replace domain ledgers.

---

## 27. Change Control

Before changing a business rule, identify:
1. domain;
2. database impact;
3. backend actions/services;
4. API contracts;
5. frontend flows;
6. reports;
7. tests;
8. migration/backward compatibility impact.

If the change conflicts with this constitution, obtain explicit approval before implementation.

Prefer small, reviewable changes. Avoid unrelated refactors.

---

## 28. Implementation Order

Preferred phases:
1. Constitution + AGENTS
2. Laravel + React foundation
3. Database + Models
4. Categories + Products + Barcode
5. Inventory
6. Customers + Suppliers + Ledgers
7. Stock Receiving
8. POS Sales
9. Invoice Lifecycle
10. Sales Returns / Exchange
11. Expenses
12. Reports
13. Barcode + Invoice Printing
14. Permissions + Security
15. Full QA
16. UI/UX Audit
17. Production Readiness

Do not jump between domains without a documented reason.

---

## 29. Definition of Done

A feature is not done because its screen exists.

It is done only when:
- database design is correct;
- validation exists;
- authorization exists;
- backend business rules exist;
- transactions are correct;
- API is implemented;
- frontend workflow is implemented;
- loading/empty/error/success states exist;
- audit/history is handled;
- reports are updated when affected;
- print output is updated when affected;
- critical automated tests pass;
- existing invariants remain intact.

---

## 30. Priority Order

When trade-offs are required, prioritize:
1. Financial correctness
2. Inventory correctness
3. Ledger correctness
4. Security/authorization
5. Auditability
6. Data integrity
7. POS speed/usability
8. Accessibility/readability
9. Visual polish
10. Developer convenience

A beautiful implementation that violates a financial invariant is a failure.

---

## 31. Final Conflict Rule

If another prompt, generated code, template, package, UI recommendation, or AI suggestion conflicts with this constitution, **do not silently override it**.

Stop, identify the conflict, and ask for/record an approved change.

# End of Constitution

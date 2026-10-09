# Al-Alamiya ERP/POS — Database Architecture & Schema Specification

## 1. Overview & Principles

The database schema for **Al-Alamiya ERP/POS (العالمية للأثاث)** is engineered for financial correctness, auditability, and data integrity:

1. **Fixed-Precision Decimal Money**: All monetary amounts are defined as `DECIMAL(15,2)` in MySQL/SQLite. Floating-point arithmetic is strictly forbidden.
2. **Whole-Number Quantities**: All product and inventory quantities are non-negative whole numbers (`INTEGER`).
3. **No Destructive Cascades on Financial Records**: Critical operational tables use `restrictOnDelete()` for business entities and `nullOnDelete()` for user/actor references to prevent accidental erasure of financial history.
4. **Authoritative Movement Ledgers**: Balances for customer debts, supplier payables, and showroom stock are historical ledgers (`customer_transactions`, `supplier_transactions`, `inventory_movements`). Cached totals on header rows or products are conveniences and can always be reconciled from ledger history.
5. **Historical Cost Snapshotting**: Invoice items preserve the unit purchase cost and profit snapshot at the exact moment of sale.

---

## 2. Table Catalog

### 2.1 Core Authentication
- **`users`**: id, name, username (unique), email (unique), password, role (`owner` | `cashier`), is_active, timestamps.
- **`personal_access_tokens`**: Sanctum API tokens.

### 2.2 Catalog & Master Data
- **`categories`**:
  - `id`: Primary key.
  - `name`: Category name (e.g. صالونات).
  - `code`: VARCHAR(10) unique single-letter barcode code (e.g. `B`, `S`).
  - `is_active`: Boolean.
  - Timestamps, soft deletes.
- **`products`**:
  - `id`: Primary key.
  - `category_id`: Foreign key to `categories` (`restrictOnDelete`).
  - `name`: Product name.
  - `barcode`: VARCHAR(50) unique deterministic code (format `CATEGORY_LETTER + 4 digits`, e.g. `B0001`).
  - `purchase_cost`: DECIMAL(15,2) latest/current purchase cost.
  - `wholesale_price`: DECIMAL(15,2).
  - `retail_price`: DECIMAL(15,2).
  - `stock_quantity`: INTEGER cached showroom stock balance.
  - `is_active`: Boolean.
  - Timestamps, soft deletes.
  - *Note: Products are independent of suppliers (no mandatory supplier relationship).*

### 2.3 Sales & Invoicing
- **`invoices`**:
  - `id`: Primary key.
  - `invoice_number`: VARCHAR(50) unique index (e.g. `INV-YYYYMMDD-XXXX`).
  - `idempotency_key`: VARCHAR(64) nullable unique index (checkout double-submit protection).
  - `customer_id`: Nullable foreign key to `customers` (`restrictOnDelete`). Null for retail; mandatory for wholesale.
  - `sale_type`: VARCHAR(20) (`retail` | `wholesale`).
  - `status`: VARCHAR(20) (`posted` | `cancelled`).
  - `subtotal`: DECIMAL(15,2).
  - `discount_amount`: DECIMAL(15,2) default 0.00.
  - `total`: DECIMAL(15,2).
  - `paid_amount`: DECIMAL(15,2) default 0.00.
  - `remaining_amount`: DECIMAL(15,2) default 0.00 (underpayment receivable debt).
  - `credit_amount`: DECIMAL(15,2) default 0.00 (overpayment customer credit).
  - `notes`: TEXT nullable.
  - `created_by`, `cancelled_by`: Foreign keys to `users` (`nullOnDelete`).
  - `cancelled_at`: TIMESTAMP nullable.
  - `cancellation_reason`: VARCHAR nullable.
  - Timestamps, soft deletes.
- **`invoice_items`**:
  - `id`: Primary key.
  - `invoice_id`: Foreign key to `invoices` (`cascadeOnDelete`).
  - `product_id`: Nullable foreign key to `products` (`restrictOnDelete`). Null for external products.
  - `item_type`: VARCHAR(20) (`product` | `external`).
  - `product_name`: VARCHAR snapshot of product name.
  - `barcode`: VARCHAR(50) nullable barcode snapshot.
  - `quantity`: INTEGER sold quantity.
  - `unit_sale_price`: DECIMAL(15,2) actual unit sale price.
  - `unit_cost`: DECIMAL(15,2) historical purchase cost snapshot at time of sale.
  - `subtotal`: DECIMAL(15,2) = `unit_sale_price * quantity`.
  - `total_cost`: DECIMAL(15,2) = `unit_cost * quantity`.
  - `profit`: DECIMAL(15,2) = `subtotal - total_cost`.
  - Timestamps.
- **`invoice_payments`**:
  - `id`: Primary key.
  - `invoice_id`: Foreign key to `invoices` (`restrictOnDelete`).
  - `payment_method_id`: Foreign key to `payment_methods` (`restrictOnDelete`).
  - `amount`: DECIMAL(15,2).
  - `notes`: TEXT nullable.
  - `created_by`: Foreign key to `users` (`nullOnDelete`).
  - Timestamps.

### 2.4 Customers & Customer Ledger
- **`customers`**:
  - `id`: Primary key.
  - `name`: Customer name (unique index with phone).
  - `phone`, `address`, `notes`: Contact info.
  - `is_active`: Boolean.
  - Timestamps, soft deletes.
- **`customer_transactions`**:
  - `id`: Primary key.
  - `customer_id`: Foreign key to `customers` (`restrictOnDelete`).
  - `type`: VARCHAR(30) (`invoice`, `payment`, `return`, `credit`, `adjustment`).
  - `direction`: VARCHAR(10) (`debit` = increases debt; `credit` = decreases debt / creates credit).
  - `amount`: DECIMAL(15,2).
  - `reference_type`, `reference_id`: Polymorphic reference to originating record (e.g. `Invoice`, `Payment`, `SalesReturn`).
  - `description`: TEXT.
  - `created_by`: Foreign key to `users` (`nullOnDelete`).
  - Timestamps.
  - **Balance Formula**: `SUM(debits) - SUM(credits)`.

### 2.5 Suppliers & Supplier Ledger
- **`suppliers`**:
  - `id`: Primary key.
  - `name`: Supplier name / workshop name.
  - `phone`, `address`, `notes`: Contact info.
  - `is_active`: Boolean.
  - Timestamps, soft deletes.
- **`supplier_transactions`**:
  - `id`: Primary key.
  - `supplier_id`: Foreign key to `suppliers` (`restrictOnDelete`).
  - `type`: VARCHAR(30) (`stock_receipt`, `payment`, `manual_balance_increase`, `adjustment`).
  - `direction`: VARCHAR(10) (`credit` = increases payable; `debit` = decreases payable).
  - `amount`: DECIMAL(15,2).
  - `reference_type`, `reference_id`: Polymorphic reference (e.g. `StockReceipt`, `Payment`).
  - `description`: TEXT (supports free-form notes such as "فاتورة شراء 20 قطعة لحاف").
  - `created_by`: Foreign key to `users` (`nullOnDelete`).
  - Timestamps.
  - **Payable Formula**: `SUM(credits) - SUM(debits)`.

### 2.6 Payments & Methods
- **`payment_methods`**:
  - `id`: Primary key.
  - `name`: Display name (e.g. نقدي, فودافون كاش, تحويل بنكي, بطاقة بنكية / فيزا).
  - `code`: VARCHAR(50) unique code (`cash`, `vodafone_cash`, `bank_transfer`, `card`).
  - `is_cash`: Boolean.
  - `is_active`: Boolean.
- **`payments`**:
  - `id`: Primary key.
  - `payment_method_id`: Foreign key to `payment_methods` (`restrictOnDelete`).
  - `payable_type`, `payable_id`: Nullable polymorphic link (e.g. Customer, Supplier, Invoice).
  - `amount`: DECIMAL(15,2).
  - `payment_date`: DATE index.
  - `reference_number`: VARCHAR(100) nullable.
  - `notes`: TEXT nullable.
  - `created_by`: Foreign key to `users` (`nullOnDelete`).
  - Timestamps.

### 2.7 Expenses
- **`expense_categories`**:
  - `id`: Primary key.
  - `name`: Category name.
  - `code`: VARCHAR(50) unique nullable.
  - `is_active`: Boolean.
- **`expenses`**:
  - `id`: Primary key.
  - `expense_category_id`: Foreign key to `expense_categories` (`restrictOnDelete`).
  - `payment_method_id`: Foreign key to `payment_methods` (`restrictOnDelete`).
  - `amount`: DECIMAL(15,2).
  - `expense_date`: DATE index.
  - `description`: TEXT.
  - `reference_type`, `reference_id`: Nullable morphs (used for external product cost linking to `InvoiceItem`).
  - `created_by`: Foreign key to `users` (`nullOnDelete`).
  - Timestamps.
  - *Note: External product purchase expenses remain recorded upon customer return by default (Policy C). Customer returns do not automatically delete or reverse this record.*

### 2.8 Inventory & Stock Movements
- **`inventory_movements`**:
  - `id`: Primary key.
  - `product_id`: Foreign key to `products` (`restrictOnDelete`).
  - `type`: VARCHAR(30) (`stock_receipt`, `sale`, `sale_cancellation`, `sales_return`, `adjustment`).
  - `quantity`: INTEGER quantity changed.
  - `unit_cost`: DECIMAL(15,2) historical unit cost at time of movement.
  - `resulting_stock`: INTEGER showroom stock balance after mutation.
  - `reference_type`, `reference_id`: Nullable morphs (Invoice, StockReceipt, SalesReturn, StockAdjustment).
  - `reason`: VARCHAR nullable.
  - `created_by`: Foreign key to `users` (`nullOnDelete`).
  - Timestamps.
- **`stock_receipts`**:
  - `id`: Primary key.
  - `receipt_number`: VARCHAR(50) unique index.
  - `supplier_id`: Nullable foreign key to `suppliers` (`restrictOnDelete`).
  - `received_date`: DATE.
  - `total_cost`: DECIMAL(15,2).
  - `notes`: TEXT nullable.
  - `created_by`: Foreign key to `users` (`nullOnDelete`).
  - Timestamps.
- **`stock_receipt_items`**:
  - `id`: Primary key.
  - `stock_receipt_id`: Foreign key to `stock_receipts` (`restrictOnDelete`).
  - `product_id`: Foreign key to `products` (`restrictOnDelete`).
  - `quantity`: INTEGER received quantity.
  - `unit_cost`: DECIMAL(15,2).
  - `subtotal`: DECIMAL(15,2).
  - Timestamps.
- **`stock_adjustments`** & **`stock_adjustment_items`**:
  - Physical showroom inventory audit tracking system (`system_quantity`, `actual_quantity`, `difference_quantity`).

### 2.9 Sales Returns & Exchanges
- **`sales_returns`**:
  - `id`: Primary key.
  - `return_number`: VARCHAR(50) unique index (format `RET-YYYYMMDD-XXXX`).
  - `idempotency_key`: VARCHAR(100) nullable unique index (prevents duplicate submission).
  - `invoice_id`: Foreign key to `invoices` (`restrictOnDelete`).
  - `customer_id`: Nullable foreign key to `customers` (`restrictOnDelete`).
  - `resolution`: VARCHAR(40) (`refund_cash`, `exchange_equal`, `exchange_upgrade`, `customer_account_credit`).
  - `total_return_amount`: DECIMAL(15,2).
  - `replacement_invoice_id`: Nullable foreign key to replacement `invoices` (`nullOnDelete`).
  - `difference_amount`: DECIMAL(15,2) default 0.00.
  - `notes`: TEXT nullable.
  - `created_by`: Foreign key to `users` (`nullOnDelete`).
  - Timestamps.
  - **Relationships**:
    - `invoice`: BelongsTo `Invoice`.
    - `customer`: BelongsTo `Customer` (nullable).
    - `replacementInvoice`: BelongsTo `Invoice` (nullable).
    - `items`: HasMany `SalesReturnItem`.
    - `payments`: MorphMany `Payment` (`payable_type`, `payable_id`).
    - `inventoryMovements`: MorphMany `InventoryMovement` (`reference_type`, `reference_id`).
    - `customerTransactions`: MorphMany `CustomerTransaction` (`reference_type`, `reference_id`).
    - `creator`: BelongsTo `User` (`created_by`).
- **`sales_return_items`**:
  - `id`: Primary key.
  - `sales_return_id`: Foreign key to `sales_returns` (`restrictOnDelete`).
  - `invoice_item_id`: Foreign key to `invoice_items` (`restrictOnDelete`).
  - `product_id`: Nullable foreign key to `products` (`restrictOnDelete`).
  - `quantity`: INTEGER returned quantity (> 0, <= remaining returnable quantity).
  - `unit_sale_price`: DECIMAL(15,2) snapshot from original `InvoiceItem`.
  - `unit_cost`: DECIMAL(15,2) historical cost snapshot from original `InvoiceItem`.
  - `subtotal`: DECIMAL(15,2) = `unit_sale_price * quantity`.
  - `profit_reversal`: DECIMAL(15,2) = `(unit_sale_price - unit_cost) * quantity`.
  - Timestamps.
  - **Dynamic Returnability**:
    - Remaining returnable quantity is dynamically calculated from `invoice_item.quantity - SUM(sales_return_items.quantity)`. No mutable cached counter column on `invoice_items`.

### 2.10 Audit Logs & System Settings
- **`audit_logs`**:
  - `id`: Primary key.
  - `user_id`: Nullable foreign key to `users` (`nullOnDelete`).
  - `action`: VARCHAR(50) (`created`, `updated`, `cancelled`, `posted`, etc.).
  - `auditable_type`, `auditable_id`: Polymorphic target.
  - `old_values`: JSON nullable.
  - `new_values`: JSON nullable.
  - `ip_address`: VARCHAR(45) nullable.
  - `user_agent`: TEXT nullable.
  - `created_at`: TIMESTAMP useCurrent().
- **`settings`**:
  - `id`: Primary key.
  - `key`: VARCHAR(100) unique index.
  - `value`: TEXT nullable.
  - `type`: VARCHAR(30) (`string`, `integer`, `boolean`, `json`).
  - `group`: VARCHAR(50) index.
  - Timestamps.

### 2.11 Phase 11 Reporting Database Mapping & Query Strategy
- **Sales & Revenue**:
  - Queried from `invoices` where `status = 'posted'` and `created_at BETWEEN start_utc AND end_utc`.
  - Reconciled with `sales_returns` where `created_at BETWEEN start_utc AND end_utc`.
- **Historical COGS & Profit**:
  - Queried from `invoice_items` joined to posted `invoices`, taking snapshotted `total_cost` and `profit`.
  - Reconciled with `sales_return_items` taking snapshotted `unit_cost * quantity` and `profit_reversal`.
- **Operating Expenses & Policy C**:
  - Queried from `expenses` table where `expense_date BETWEEN start_date AND end_date`.
  - Partitioned into `category_code = 'external_product'` (direct COGS) and general expenses.
- **Customer Ledger Balances**:
  - Derived from `customer_transactions` using debit-minus-credit aggregation per customer.
- **Supplier Payables**:
  - Derived from `supplier_transactions` using credit-minus-debit aggregation per supplier.
- **Current Inventory Valuation**:
  - Derived from `products` where `deleted_at IS NULL` using `SUM(stock_quantity * purchase_cost)`.
- **Payments & Cash Movement**:
  - Queried from `payments` using `paid_at` or `created_at` timestamp range, separating positive inflows (`PaymentType::INVOICE_PAYMENT`, `PaymentType::EXCHANGE_PAYMENT`) and outflows (`PaymentType::REFUND`).


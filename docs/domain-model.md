# Al-Alamiya ERP/POS — Core Domain Model Specification

## 1. Domain Entities & Value Objects

The domain layer models the business operations of **العالمية للأثاث والموبيليا** in accordance with the `AGENTS.md` constitution.

### 1.1 Value Objects
- **`Money`** (`App\Domain\Support\Money`):
  - Strict fixed-precision representation using PHP BCMath (scale 2).
  - Handles currency arithmetic (`add`, `subtract`, `multiply`, `divide`).
  - Formats Arabic showroom display (`1,250.50 ج.م`).
  - Rejects malformed strings and protects against floating-point inaccuracies.
- **`Quantity`** (`App\Domain\Support\Quantity`):
  - Strictly enforces whole-number counts.
  - Rejects decimal numbers (`1.5`, `2.25`).
  - Enforces non-negative constraints.

### 1.2 Custom Attribute Casts
- **`MoneyCast`** (`App\Domain\Support\Casts\MoneyCast`): Converts database decimal strings into `Money` value objects when accessed on Eloquent models, and serializes back to standard 2-decimal strings on mutation.
- **`QuantityCast`** (`App\Domain\Support\Casts\QuantityCast`): Converts integer database columns to `Quantity` value objects.

---

## 2. Core Domain Invariants & Rules

### 2.1 Historical Costing & Profit Snapshotting (FINAL)
- **Current Purchase Cost**: Stored on `Product::$purchase_cost`. Represents the showroom's latest purchase price and can change at any time.
- **Sale-Time Cost Snapshot**: When an invoice is created, each item saves `InvoiceItem::$unit_cost = Product::$purchase_cost`.
- **Line Profit**: `Line Profit = (Actual Unit Sale Price - Historical Unit Cost) * Quantity`.
- **Historical Invariant**: Modifying `Product::$purchase_cost` at a later date **never** touches or alters historical `InvoiceItem::$unit_cost` or `InvoiceItem::$profit`.
- **Valuation Separation**:
  - Historical Gross Profit = `SUM(InvoiceItem::$profit)` of posted invoices.
  - Showroom Stock Valuation = `Product::$purchase_cost * Product::$stock_quantity` (Current).

### 2.2 Product Barcode Generation
- **Format**: `CATEGORY_LETTER + 4 digits` (e.g., `B0001`, `S0042`).
- **Deterministic & Sequential**: Handled by `BarcodeGenerator::generateForCategory(Category $category)`.
- **Collisions & Retention**: Soft-deleted products retain their barcode to prevent sequence reuse or duplicate barcode scanning collisions.
- **Capacity**: 9999 products per category.

### 2.3 Customer Ledger
- **Entity**: `CustomerTransaction`.
- **Debits (+)**: Wholesale sales invoices, receivable adjustments.
- **Credits (-)**: Payments, credits, returns credited to account.
- **Account Balance Formula**:
  $$\text{Balance} = \sum \text{Debits} - \sum \text{Credits}$$
  - Positive balance: Customer Debt (مستحق على العميل).
  - Negative balance: Customer Credit (رصيد دائن للعميل).
  - Zero: Settle/Balanced.

### 2.4 Supplier Ledger
- **Entity**: `SupplierTransaction`.
- **Credits (+)**: Purchases, stock receipts, manual payable additions.
- **Debits (-)**: Payments made to the supplier.
- **Payable Balance Formula**:
  $$\text{Payable} = \sum \text{Credits} - \sum \text{Debits}$$
  - Positive payable: Showroom debt owed to supplier (مستحق للمورد).
- **Physical Purchases vs Balance Adjustments**: Adding balance to a supplier does **not** mutate showroom stock. Only physical `StockReceipt` mutations record inventory movements.

### 2.5 External Products
- Represented on `InvoiceItem` with `item_type = InvoiceItemType::EXTERNAL`.
- Does not point to a showroom master product (`product_id = null`).
- Does not affect inventory balances.
- Automatically generates a linked `Expense` referencing `InvoiceItem` for the purchase cost.
- Hidden from the customer on printed invoices (prints as standard item name and sale price).

### 2.6 Inventory Movements
- Primary historical ledger: `InventoryMovement`.
- Types: `STOCK_RECEIPT`, `SALE`, `SALE_CANCELLATION`, `SALES_RETURN`, `ADJUSTMENT`.
- Cached product stock balance `products.stock_quantity` is protected by `restrictOnDelete` on movements.

---

## 3. Domain Enums

| Enum Class | Namespace | Supported Values |
|------------|-----------|------------------|
| `SaleType` | `App\Domain\Sales\Enums` | `retail`, `wholesale` |
| `InvoiceStatus` | `App\Domain\Sales\Enums` | `posted`, `cancelled` |
| `InvoiceItemType` | `App\Domain\Sales\Enums` | `product`, `external` |
| `CustomerTransactionType` | `App\Domain\Customers\Enums` | `invoice`, `payment`, `return`, `credit`, `adjustment` |
| `CustomerTransactionDirection` | `App\Domain\Customers\Enums` | `debit`, `credit` |
| `SupplierTransactionType` | `App\Domain\Suppliers\Enums` | `stock_receipt`, `payment`, `manual_balance_increase`, `adjustment` |
| `SupplierTransactionDirection` | `App\Domain\Suppliers\Enums` | `credit`, `debit` |
| `PaymentType` | `App\Domain\Payments\Enums` | `customer_payment`, `supplier_payment`, `sale_payment`, `expense_payment` |
| `InventoryMovementType` | `App\Domain\Inventory\Enums` | `stock_receipt`, `sale`, `sale_cancellation`, `sales_return`, `adjustment` |
| `SalesReturnResolution` | `App\Domain\Returns\Enums` | `refund_cash`, `exchange_equal`, `exchange_upgrade`, `customer_account_credit` |
| `UserRole` | `App\Domain\Auth\Enums` | `owner`, `cashier` |

---

## 4. Phase 4 — POS Sales, Invoicing & Payment Workflow

### 4.1 Retail vs Wholesale Sales Rules
- **Retail (`retail`)**:
  - Customer selection is optional (`customer_id` nullable).
  - Defaults to `products.retail_price`. Cashier may override unit price per line.
  - Cash/POS transactions: does not create customer ledger account entries by default.
  - Profit is snapshotted from the product's current purchase cost at sale time.
- **Wholesale (`wholesale`)**:
  - Registered active customer is strictly required (`customer_id` mandatory).
  - Defaults to `products.wholesale_price`. Cashier may override unit price per line.
  - Debits customer account with invoice total (`type = invoice`, `direction = debit`).
  - Payments credit customer account (`type = payment`, `direction = credit`).
  - Resulting customer debt / credit remains purely ledger-derived.

### 4.2 Checkout Atomicity & Inventory Mutation
- Executed atomically via `CreateInvoiceAction` within a single database transaction.
- Normal products are locked using row-level `lockForUpdate()`.
- Validates that `quantity <= available_stock`. Rejects checkout atomically on insufficient stock (`INSUFFICIENT_STOCK`).
- Deducts product stock and writes `InventoryMovement` (`type = sale`, `resulting_stock = stock - qty`).

### 4.3 Invoice Numbering & Idempotency
- **Invoice Numbering**: Sequential format `INV-YYYYMMDD-XXXX` with database `lockForUpdate()` and a 5-attempt retry loop on concurrent unique collisions.
- **Idempotency Protection**: Rapid double-clicks are guarded via unique `idempotency_key` and atomic cache locks. Submitting the identical checkout payload with the same key safely returns the existing invoice without duplicate mutations.

### 4.4 External Products & Confidentiality
- Handled with `InvoiceItem::$item_type = InvoiceItemType::EXTERNAL`.
- Does not mutate inventory balances or require product catalog records.
- Automatically creates a linked `Expense` under `external_product` category.
- Customer invoices hide purchase cost, profit, and external classification markers. Cost and profit metrics are strictly restricted to the `owner` role.

### 4.5 Customer Balance Source of Truth
- **Authoritative Ledger**: The `customer_transactions` ledger is the sole authoritative source of truth for customer debt and balance.
- **Dynamic Derivation**: Customer balance is computed exclusively as `SUM(debits) - SUM(credits)`. The `customers` table does NOT contain a static or cached `balance` column to prevent desynchronization anomalies.
- **Operational Snapshot Distinctions**:
  - `invoices.remaining_amount` represents the unpaid balance of a specific invoice.
  - `invoices.credit_amount` represents an overpayment on a specific invoice that flowed into the customer account.
  - Neither of these fields serves as a global customer balance; they are operational invoice lifecycle snapshots only.
- **Validation**: Backend queries always compute or inspect `Customer::calculateBalance()` directly from `CustomerTransaction` records.

---

## 5. Phase 5 — Sales Returns, Refunds, Exchanges & Customer Credit

### 5.1 Return & Exchange Lifecycle
- **Originating Invariant**: A return must strictly originate from an active, posted sales invoice (`Invoice::$status = InvoiceStatus::POSTED`). Returns against cancelled or non-existent invoices are rejected.
- **Atomic Operations**: Every return or exchange executes inside a single database transaction (`DB::transaction`). Any failure rolls back all inventory restoration, stock deductions, return records, replacement invoices, payments, and ledger mutations.

### 5.2 Dynamic Returnability Calculation
- **Audit History as Source of Truth**: The returnable quantity for an invoice item is never stored in a mutable cache column. It is computed dynamically from the return history:
  $$\text{Remaining Returnable} = \text{Sold Quantity} - \sum(\text{SalesReturnItem.quantity})$$
- **Strict Integer Validation**: All return quantities are whole numbers ($> 0$). Over-returns ($\text{requested} > \text{remaining}$) are strictly rejected server-side.

### 5.3 Historical Cost & Profit Reversal Invariant
- **Snapshot Immutability**: Return calculations MUST use the historical `unit_cost` snapshotted on the original `InvoiceItem`.
- **Zero Drift from Current Cost**: Changes to a product's current `purchase_cost` have zero effect on historical return or profit reversal calculations:
  $$\text{Return Value} = \text{Original Unit Sale Price} \times \text{Returned Quantity}$$
  $$\text{Cost Reversal} = \text{Historical Unit Cost} \times \text{Returned Quantity}$$
  $$\text{Profit Reversal} = \text{Return Value} - \text{Cost Reversal}$$

### 5.4 Inventory Restoration
- **Showroom Products**: Restores returned quantity to `products.stock_quantity` and generates an `InventoryMovement` with type `sales_return`, recording historical unit cost and the resulting stock.
- **External Products**: External items (`InvoiceItemType::EXTERNAL`) do NOT mutate showroom stock and never create inventory movements.

### 5.5 Return Resolutions
1. **Cash Refund (`refund_cash`)**: Customer receives the return value in cash via a linked `Payment` (`type = refund`). For wholesale customers, credits the return value and debits the cash payout to ensure zero net balance distortion.
2. **Equal Exchange (`exchange_equal`)**: Customer receives replacement items of exactly matching value. Returned items restore inventory; replacement items deduct inventory and generate a linked replacement `Invoice`.
3. **Higher-Value Exchange (`exchange_upgrade`)**: Replacement items exceed returned value. The customer pays the difference ($\text{Replacement Total} - \text{Return Total}$) through an active payment method.
4. **Wholesale Customer Account Credit (`customer_account_credit`)**: The return value is credited directly to the customer's ledger via `CustomerTransaction` (`type = return`, `direction = credit`), reducing outstanding debt or establishing store credit.

### 5.6 Customer Ledger Mathematical Equilibrium
- Customer balance remains governed exclusively by $\sum(\text{debits}) - \sum(\text{credits})$.
- No static customer balance columns exist.
- In upgrade exchanges: $\text{Debits (Replacement Invoice)} = \text{Credits (Return Value + Difference Payment)}$.

### 5.7 Idempotency & Numbering
- **Numbering**: Format `RET-YYYYMMDD-XXXX` generated with row locking and collision-safe retry loop.
- **Idempotency**: Guarded by `sales_returns.idempotency_key` unique index and atomic cache locking.

### 5.8 External Product Return Expense Policy (Policy C — Case-by-Case Reversal)
- **Separation of Business Events**: Customer returns/refunds and third-party seller refunds are strictly separate business events. Never infer one from the other.
- **Default Retention**: When an external product is returned by a customer, its original linked purchase expense (`expenses` table) remains recorded and intact by default.
- **No Automatic Deletion or Negative Expense**: The customer return does NOT automatically delete, mutate, or create a negative expense entry.
- **Confirmed Vendor Recovery Required**: Reversal of an external purchase expense is only permitted if the third-party seller confirms and documents a refund of the purchase cost.
- **Auditability of Showroom Sunk Cost**: If no third-party refund has been confirmed, the purchase expense remains recognized in audit logs and reports as an incurred showroom cost/loss.
- **No Inferred Supplier Accounting**: Customer returns alone never create supplier reimbursements, supplier credits, or supplier settlements. Full traceability across `InvoiceItem`, `Expense`, and `SalesReturn` is preserved.

---

## 6. Phase 11 — Financial & Operational Reports

Phase 11 implements comprehensive, owner-only financial and operational reporting. In accordance with `AGENTS.md`, all calculations are executed with fixed-precision BCMath decimals on the backend and enforced via `role:owner` authorization.

### 6.0 Report Endpoints Catalog (`/api/v1/reports/*`)
All reporting endpoints are strictly restricted to authenticated users with the `owner` role. Requests by cashiers return `403 Forbidden`, and unauthenticated requests return `401 Unauthorized`.
- `GET /api/v1/reports/overview`: Executive dashboard KPIs (gross sales, net sales, realized profit, net operating result, cash movement, customer debt, supplier payables, inventory valuation).
- `GET /api/v1/reports/sales`: Detailed sales metrics partitioned by retail, wholesale, replacement sales, and sales returns resolutions.
- `GET /api/v1/reports/profit`: Dedicated COGS, returns cost reversals, realized gross profit, and Net Operating Result (accounting for Policy C external product expenses).
- `GET /api/v1/reports/expenses`: Operating expenses breakdown by category and payment method, clearly isolating external product expenses from general overhead.
- `GET /api/v1/reports/customers` & `GET /api/v1/reports/customer-balances`: Authoritative customer ledger balances (`debit - credit`), debtor/creditor categorization, search, and pagination.
- `GET /api/v1/reports/suppliers` & `GET /api/v1/reports/supplier-payables`: Authoritative supplier payables (`credit - debit`), distinguishing commercial stock purchases from manual balance adjustments, search, and pagination.
- `GET /api/v1/reports/inventory` & `GET /api/v1/reports/inventory-valuation`: Current stock valuation (`current stock_quantity * current purchase_cost`) distinct from historical COGS, category aggregation, status filtering (`active`/`inactive`/`all`), search, and pagination.
- `GET /api/v1/reports/payments` & `GET /api/v1/reports/payment-movements`: Period cash and electronic payment movements partitioned into gross inflows and customer return refunds.
- `GET /api/v1/reports/documents`: Unified searchable timeline of posted invoices and sales returns.
- `GET /api/v1/reports/history/invoices`: Paginated invoice audit history with customer and payment information.
- `GET /api/v1/reports/history/returns`: Paginated sales return history with item details and resolution status.

### 6.1 Authoritative Data Sources & Invariants
1. **Sales & Revenue**:
   - Source: `invoices` where `status = posted` within date range. Cancelled invoices are strictly excluded.
   - Formula:
     $$\text{Gross Sales} = \sum \text{posted invoices.total}$$
     $$\text{Total Returns} = \sum \text{sales\_returns.total\_return\_amount}$$
     $$\text{Net Sales} = \text{Gross Sales} - \text{Total Returns}$$
   - **Replacement Invoices**: Replacement invoices generated during exchange workflows are real sale transactions included in gross sales, while the associated return is recorded separately. They are tracked transparently without double-counting.

2. **Cost of Goods Sold (COGS) & Realized Gross Profit**:
   - Source: `invoice_items` cost and profit snapshots, reconciled with `sales_return_items` cost and profit reversals.
   - **Normal Showroom Products**:
     - Stock was restored to showroom inventory (`products.stock_quantity`).
     - Cost is reversed from COGS (restored as warehouse inventory asset):
       $$\text{Normal Returned COGS Reversal} = \sum (\text{normal sales\_return\_items.unit\_cost} \times \text{quantity})$$
     - Profit reversal deducts only the original sale markup:
       $$\text{Normal Profit Reversal} = \sum \text{normal sales\_return\_items.profit\_reversal}$$
   - **External Products (Policy C Compliance)**:
     - Third-party seller has NOT refunded the showroom, and external products do not enter showroom catalog inventory.
     - COGS is **NOT** reversed (the showroom still incurred the purchase cost without recovery):
       $$\text{External Returned COGS Reversal} = 0.00$$
     - The entire refunded revenue (`subtotal`) is deducted from profit:
       $$\text{External Profit Reversal} = \sum \text{external sales\_return\_items.subtotal}$$
     - Result: Net Realized Gross Profit on an unrecovered external product return reflects an exact commercial loss of $-(\text{unit\_cost} \times \text{quantity})$.
   - Aggregated Formulas:
     $$\text{Gross COGS} = \sum \text{posted invoice\_items.total\_cost}$$
     $$\text{Returned COGS Reversal} = \text{Normal Returned COGS Reversal}$$
     $$\text{Net COGS} = \text{Gross COGS} - \text{Returned COGS Reversal}$$
     $$\text{Gross Profit} = \sum \text{posted invoice\_items.profit}$$
     $$\text{Profit Reversal} = \text{Normal Profit Reversal} + \text{External Profit Reversal}$$
     $$\text{Net Realized Gross Profit} = \text{Gross Profit} - \text{Profit Reversal} = \text{Net Sales} - \text{Net COGS}$$
   - Invariant: Current product cost changes **never** alter historical COGS or profit.

3. **Operating Expenses & Policy C Adherence**:
   - Source: `expenses` table grouped by category code and date.
   - Formulas:
     $$\text{Total Recorded Expenses} = \sum \text{expenses.amount}$$
     $$\text{General Operating Expenses} = \sum \text{expenses.amount (category} \ne \text{'external\_product')}$$
     $$\text{External Product Expenses} = \sum \text{expenses.amount (category} = \text{'external\_product')}$$
   - Prevention of Double-Deduction & Unrecovered Loss Recognition:
     External product purchase expenses represent direct cost of goods sold recognized in Net COGS. In the Net Operating Result calculation:
     $$\text{Net Operating Result} = \text{Net Realized Gross Profit} - \text{General Operating Expenses}$$
     When an external product is returned without third-party vendor reimbursement:
     - The unrecovered purchase cost remains in Net COGS, and Net Realized Gross Profit reports $-(\text{cost})$.
     - General Operating Expenses excludes the external product expense, preventing double-deduction.
     - Net Operating Result accurately reflects the unrecovered expenditure as an incurred showroom loss before general expenses.
   - Policy C Confirmation: Under approved Policy C, when an external product is returned by a customer, its purchase expense remains intact and is not silently deleted or reversed.

4. **Customer Receivables & Supplier Payables**:
   - Source: `customer_transactions` and `supplier_transactions` ledgers exclusively.
   - Formulas:
     $$\text{Customer Balance} = \sum \text{Debits} - \sum \text{Credits}$$
     $$\text{Total Receivable Debts} = \sum_{\text{Balance} > 0} \text{Customer Balance}$$
     $$\text{Total Customer Credits} = \sum_{\text{Balance} < 0} |\text{Customer Balance}|$$
     $$\text{Supplier Payable} = \sum \text{Credits} - \sum \text{Debits}$$
     $$\text{Total Supplier Payables} = \sum_{\text{Payable} > 0} \text{Supplier Payable}$$
     $$\text{Total Supplier Overpayments} = \sum_{\text{Payable} < 0} |\text{Supplier Payable}|$$

5. **Current Inventory Valuation**:
   - Source: `products` table current active records.
   - Formula:
     $$\text{Inventory Valuation at Cost} = \sum (\text{products.stock\_quantity} \times \text{products.purchase\_cost})$$
     $$\text{Retail Valuation} = \sum (\text{products.stock\_quantity} \times \text{products.retail\_price})$$
     $$\text{Wholesale Valuation} = \sum (\text{products.stock\_quantity} \times \text{products.wholesale\_price})$$

6. **Payment Methods & Cash Movement**:
   - Source: `payments` table records.
   - Distinction: Tracks inflows (invoice payments, exchange difference payments) versus outflows (refund payments).
   - Scope Limitation: Does not claim to represent physical cash drawer on-hand balance (which would require opening float and physical drawer reconciliation), but reliably reports cash and electronic movement during the period.

7. **Date Filtering**:
   - Boundaries: Computed in the configured `Africa/Cairo` timezone using full-day start (`00:00:00`) and end (`23:59:59.999999`) converted to UTC.

---

## 7. Phase 12 — Barcode Printing & Customer Invoice Printing Specification

### 7.1 Product Barcode Printing Workflow
- **Barcode Symbology**: Scanner-compatible Code 128 (Subset B) rendered via vector SVG with zero external runtime dependencies.
- **Barcode Immutability & Integrity**:
  - Encodes the existing immutable product barcode (`CATEGORY_LETTER + 4 digits`, e.g. `B0001`).
  - Barcodes are **never** regenerated, recalculated, or altered during printing.
  - Generates modulo 103 checksum and embeds standard 10-module quiet zones on both margins.
  - Renders human-readable monospace text centered beneath the bars.
- **Label Formats**:
  1. **Thermal Label Roll (`thermal`)**: Single continuous label roll (50×25 mm or 38×25 mm) for dedicated thermal label printers.
  2. **A4 Label Sheet (3 Columns, `a4-grid-3`)**: 3-column adhesive sticker layout (21 labels / sheet).
  3. **A4 Label Sheet (4 Columns, `a4-grid-4`)**: 4-column dense adhesive sticker layout (32 labels / sheet).
- **Label Options**: User toggles for Showroom Name, Retail Price (Arabic formatted), and Category identifier.
- **Confidentiality Invariant**: Barcode label endpoints and print views strictly omit product purchase costs, profit, and internal notes.

### 7.2 Customer-Facing Invoice Printing Workflow
- **Dedicated Endpoint & Resource**: `GET /api/v1/invoices/{id}/print` returning `InvoicePrintResource`.
- **Supported Layout Formats**:
  1. **Official A4 Invoice (`a4`)**: Standard full-page invoice for official corporate records, wholesale clients, and luxury furniture showroom sales.
     - Complete showroom branding: **العالمية للأثاث والموبيليا**, subtitle, phone, and address.
     - Issue date & time in Arabic.
     - Cashier / sales associate attribution.
     - Dense item table: Product name, barcode, quantity, unit price, and line total.
     - Financial breakdown: Subtotal, discount (if applied), total, paid amount, remaining debt or credit balance.
     - Payments breakdown by payment method.
     - Return policy footer: "البضاعة المباعة ترد وتستبدل خلال 14 يوماً وفقاً لأحكام قانون حماية المستهلك ولائحة المعرض بشرط وجود أصل الفاتورة وسلامة المنتج بحالته الأصلية."
     - Customer and showroom signature / stamp block.
  2. **80mm Thermal Receipt (`thermal`)**: Compact high-contrast receipt for fast POS checkout printers.
     - Store header and invoice metadata.
     - Items and bold grand total.
     - Embedded Code 128 barcode of the invoice number for optical scanner reading at the returns and exchanges desk.
- **Confidentiality & Security (Constitution Section 23 & 24)**:
  - Both Cashier and Owner roles use the customer-facing print resource to prevent accidental data leaks to customers.
  - Customer documents **never** expose: purchase costs, historical costs, line profits, total profit, internal expense IDs, or external supplier identifiers.
  - External products purchased specifically for a client appear as ordinary line items without any "خارجي" markers or workshop purchase prices.
- **Wholesale vs Retail Ledger Transparency & Historical Immutability**:
  - Wholesale sales explicitly show customer prior balance, invoice total, paid amount, and resulting account balance (debt or credit).
  - **Historical Balance Audit Invariant**: `prior_balance` and `resulting_balance` are evaluated from the ledger sequence strictly prior to the invoice's earliest transaction (`min(customer_transactions.id)` for this invoice). Subsequent customer transactions (e.g. later settlements or new sales) never mutate historical invoice reprint figures.
  - Retail sales do not require a customer and print cleanly for anonymous shoppers.
- **Batch Printing Safety Limits**:
  - Maximum of 1,000 total labels per batch print request, enforced at both frontend queue and backend API validation layers (`BarcodePrintPreviewRequest`).
- **Code 128 Symbology Verification & Input Validation**:
  - Implements full Code 128 Subset B specification with 10-module quiet zones, modulo-103 checksum, and 13-module stop pattern (`2331112`).
  - Unsupported or non-ASCII characters (e.g., Arabic characters) are strictly rejected rather than silently substituted with spaces.
- **Print Optimization**:
  - Print-specific CSS (`@media print`) hides application chrome, navigation, headers, and action buttons.
  - Individual table rows, headers, and labels avoid breaks (`break-inside: avoid`), while multi-page containers paginate cleanly without clipping.




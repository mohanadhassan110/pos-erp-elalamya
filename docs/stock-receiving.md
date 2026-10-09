# Al-Alamiya ERP/POS — Stock Receiving Specification (Phase 3)

## 1. Overview
Stock Receiving (**استلام بضاعة**) is the operational mechanism for receiving physical inventory into the showroom.

It executes as a single, atomic database transaction that coordinates:
1. `StockReceipt` and `StockReceiptItem` persistence.
2. Product stock quantity increment with concurrency row locking (`lockForUpdate`).
3. `InventoryMovement` audit records for each product line.
4. Product future purchase cost update (`products.purchase_cost`).
5. Optional `SupplierTransaction` payable creation when a supplier is selected.

---

## 2. Stock Receiving Transaction Architecture

```text
POST /api/v1/stock-receipts
    ↓
ReceiveStockRequest (validation)
    ↓
ReceiveStockAction
    ↓
DB::transaction(function () {
    1. Lock all referenced products: Product::whereIn('id', $ids)->lockForUpdate()->get()
    2. Validate all products are active and exist
    3. Generate sequential human-readable receipt number: SR-YYYYMMDD-XXXX
    4. Calculate authoritative line subtotals and receipt total using Money
    5. Create StockReceipt
    6. For each item line:
       a. Create StockReceiptItem
       b. Increment product stock_quantity
       c. Create InventoryMovement (type: stock_receipt, resulting_stock: updated stock)
       d. Update product current purchase cost: products.purchase_cost = item.unit_cost
       e. Audit log cost change if cost changed
    7. If supplier_id is provided:
       a. Create SupplierTransaction (type: stock_receipt, direction: credit, amount: total_cost)
    8. Commit transaction
})
```

---

## 3. Core Business Invariants

### 3.1 Historical Cost Protection (FINAL)
- Updating `products.purchase_cost` during stock receiving only affects future transactions.
- Historical invoice items snapshot `unit_cost` and `profit` at the time of sale.
- Changing `products.purchase_cost` does **never** alter historical invoice items or historical profit reports.

### 3.2 Atomicity & Rollback Guarantee
- If any line item is invalid (inactive product, negative quantity, invalid cost), the entire operation rolls back.
- No partial receipts, orphan inventory movements, or mismatching supplier payables can ever occur.

### 3.3 Concurrency & Race-Condition Protection
- Products are locked for update (`lockForUpdate`) before reading and mutating current stock balances.
- Resulting stock is calculated deterministically:
  $$\text{resulting\_stock} = \text{locked\_current\_stock} + \text{received\_quantity}$$

### 3.4 Idempotency & Duplicate Prevention
- Receipts follow a sequential numbering schema: `SR-YYYYMMDD-XXXX` (where XXXX is a padded sequence count per day).
- Frontend buttons are disabled during `isSubmitting` to prevent accidental double submissions.

---

## 4. Basic Stock Visibility & Valuation
The `/api/v1/inventory` endpoint provides showroom inventory reporting:
- **Current Stock**: `products.stock_quantity`.
- **Current Purchase Cost**: `products.purchase_cost`.
- **Current Stock Valuation**:
  $$\text{Valuation} = \text{Current Stock} \times \text{Current Purchase Cost}$$
- This represents current replacement valuation, **not** historical COGS.

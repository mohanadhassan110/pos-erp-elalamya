# Al-Alamiya ERP/POS — Master Data Specification (Phase 3)

## 1. Overview
Master data establishes catalog and ledger entities for **Al-Alamiya ERP/POS (العالمية للأثاث والموبيليا)**:
- **Categories (فئات الأصناف)**
- **Products (دليل المنتجات)**
- **Customers (العملاء وحسابات الجملة)**
- **Suppliers (الموردين وورش التصنيع)**

All master data mutations enforce server-side validation, role-based authorization (`owner`, `cashier`), and audit logging.

---

## 2. Categories Workflow & Invariants

### 2.1 Category Code Rules
- **Format**: Exactly 1 uppercase Latin character (`[A-Z]`).
- **Normalized**: Stripped of whitespace and converted to uppercase upon receipt.
- **Uniqueness**: Case-insensitively unique across active and inactive categories (`UNIQUE(code)`).
- **Code Immutability Rule**:
  - If a category already has products (active or soft-deleted), modifying its `code` is **strictly forbidden**.
  - Rationale: Changing category code would break deterministic barcode sequencing (`B0001`, `B0002`) and invalidate barcode label printing and scanner lookups.

### 2.2 Activation & Deactivation
- Categories cannot be hard-deleted if products exist (enforced by foreign key `ON DELETE RESTRICT`).
- Deactivation flags `is_active = false`, hiding category from active creation dropdowns while preserving history.

---

## 3. Product Management Workflow & Invariants

### 3.1 Barcode Generation
- Format: `[CATEGORY_CODE] + 4-digit sequence` (e.g., `B0001`, `C0042`).
- Generated automatically upon product creation via `BarcodeGenerator::generateForCategory($category)`.
- Barcodes are immutable after creation.
- Soft-deleted / archived products retain their barcode to prevent collisions.

### 3.2 Pricing & Valuation Fields
- `purchase_cost`: Current showroom purchase cost.
- `wholesale_price`: Wholesale base price (سعر الجملة).
- `retail_price`: Retail base price (سعر القطاعي).
- All monetary fields use BCMath fixed-point arithmetic (`Money`).

### 3.3 Initial Stock Handling
- When creating a product with `initial_stock > 0`, the system creates an auditable `InventoryMovement`:
  - `type`: `stock_receipt`
  - `quantity`: `initial_stock`
  - `resulting_stock`: `initial_stock`
  - `unit_cost`: `purchase_cost`
  - `reason`: `رصيد افتتاحي عند تعريف المنتج بالمعرض`
- Products with inventory movements cannot be hard-deleted.

---

## 4. Customers & Ledger

### 4.1 Ledger Invariants
- Customer balance is derived from `CustomerTransaction` movements:
  $$\text{Balance} = \sum \text{Debits} - \sum \text{Credits}$$
- **Positive Balance**: Customer Debt (مستحق على العميل).
- **Negative Balance**: Customer Credit (رصيد دائن للعميل).
- **Zero Balance**: Settled (خالص).
- No arbitrary balance mutation allowed outside ledger movements.

---

## 5. Suppliers & Ledger

### 5.1 Ledger Invariants
- Supplier payable is derived from `SupplierTransaction` movements:
  $$\text{Payable} = \sum \text{Credits} - \sum \text{Debits}$$
- Positive payable represents amount owed to supplier (مستحق للمورد).

### 5.2 Add Balance Operation
- Increases amount owed to supplier (`direction = credit`).
- Requires a mandatory description/notes (e.g. `فاتورة شراء 20 قطعة لحاف`).
- **Strict Invariant**: Supplier balance addition does **NOT** touch product stock or generate inventory movements. Physical stock increases must use **Stock Receiving**.

---
name: react-pos-ui
description: Use when building or changing React pages/components for the POS, invoices, products, customers, reports or admin UI.
---

# React POS UI

Design for real shop operators, not a portfolio demo.

## POS priorities
1. Speed
2. Readability
3. Error prevention
4. Keyboard efficiency
5. Barcode/manual search
6. Clear totals and payment state

Prefer:
- persistent sale context
- fast product search
- barcode input focus
- keyboard shortcuts with visible hints
- inline quantity/price editing
- clear wholesale/retail mode
- large primary actions
- compact dense tables where appropriate
- confirmation only for destructive/high-risk actions

Avoid:
- nested modals
- unnecessary page navigation
- decorative animations
- tiny controls
- hidden totals
- excessive cards
- generic dashboard templates

All UI must support Arabic RTL correctly, including numbers, tables, forms, dialogs, print layouts and validation messages.

Every mutation needs pending/success/error states and must not create duplicate requests accidentally.

import React from 'react';
import type { ReturnableInvoice } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { RotateCcw } from 'lucide-react';
import { getReturnEligibility } from './returnEligibility';

export interface InvoiceReturnActionProps {
  /** Backend returnable-invoice response for the open invoice (null while loading or on failure). */
  returnable: ReturnableInvoice | null;
  isLoading?: boolean;
  onStart: (invoice: ReturnableInvoice) => void;
}

/**
 * "عمل مرتجع / استبدال" button in invoice details. Shown enabled only when the
 * backend reports the invoice as returnable; otherwise disabled with the reason.
 */
export const InvoiceReturnAction: React.FC<InvoiceReturnActionProps> = ({ returnable, isLoading = false, onStart }) => {
  if (isLoading) {
    return (
      <Button variant="secondary" size="md" disabled isLoading data-testid="invoice-return-action">
        عمل مرتجع / استبدال
      </Button>
    );
  }

  const { canReturn, reason } = getReturnEligibility(returnable);

  if (canReturn && returnable) {
    return (
      <Button
        variant="outline"
        size="md"
        icon={<RotateCcw size={16} />}
        onClick={() => onStart(returnable)}
        data-testid="invoice-return-action"
      >
        عمل مرتجع / استبدال
      </Button>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <Button
        variant="secondary"
        size="md"
        disabled
        icon={<RotateCcw size={16} />}
        aria-describedby="invoice-return-blocked-reason"
        data-testid="invoice-return-action"
      >
        عمل مرتجع / استبدال
      </Button>
      <span
        id="invoice-return-blocked-reason"
        data-testid="invoice-return-blocked-reason"
        style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-text)', fontWeight: 600 }}
      >
        {reason}
      </span>
    </span>
  );
};

export default InvoiceReturnAction;

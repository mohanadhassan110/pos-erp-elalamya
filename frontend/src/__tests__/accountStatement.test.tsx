import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountStatementModal } from '../components/statement/AccountStatementModal';

describe('AccountStatementModal Component', () => {
  it('renders safely when closed without hook errors', () => {
    const htmlClosed = renderToStaticMarkup(
      <AccountStatementModal
        isOpen={false}
        onClose={() => {}}
        entityType="customer"
        entityId={1}
        entityName="عميل تجريبي"
      />
    );
    expect(htmlClosed).toBe('');
  });

  it('renders safely when open without hook errors', () => {
    const htmlOpen = renderToStaticMarkup(
      <AccountStatementModal
        isOpen={true}
        onClose={() => {}}
        entityType="customer"
        entityId={1}
        entityName="عميل تجريبي"
      />
    );
    expect(htmlOpen).toContain('كشف حساب عميل');
  });
});

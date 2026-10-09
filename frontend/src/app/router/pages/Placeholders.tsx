import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';

interface PlaceholderProps {
  title: string;
  phase: string;
  description: string;
  isOwnerOnly?: boolean;
}

const ModulePlaceholder: React.FC<PlaceholderProps> = ({ title, phase, description, isOwnerOnly }) => (
  <div style={{ maxWidth: '48rem', margin: '1rem auto' }}>
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>{title}</span>
          <Badge variant="neutral" size="sm">
            {phase}
          </Badge>
          {isOwnerOnly && (
            <Badge variant="primary" size="sm">
              خاص بالمالك
            </Badge>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)', lineHeight: 1.6 }}>
          {description}
        </p>
        <div
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            borderRight: '3px solid var(--color-primary-600)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-muted)',
          }}
        >
          هذه الصفحة مجهزة كإطار توجيهي (Routing Placeholder) ضمن المرحلة 1 لتأكيد سلامة البنية التحتية
          والصلاحيات. لا تحتوي على أي منطق تجاري استباقي وفق قواعد الدستور AGENTS.md.
        </div>
      </div>
    </Card>
  </div>
);

export const PosPlaceholderPage: React.FC = () => (
  <ModulePlaceholder
    title="نقطة البيع (POS) — قطاعي وجملة"
    phase="المرحلة 8"
    description="ستشمل واجهة البيع السريعة، قارئ الباركود، بيع القطاعي والجملة، إضافة المنتجات الخارجية، وتسجيل المدفوعات."
  />
);

export const InvoicesPlaceholderPage: React.FC = () => (
  <ModulePlaceholder
    title="فواتير المبيعات ودورة الحياة"
    phase="المرحلة 9"
    description="ستشمل عرض فواتير المبيعات، الإلغاء المحكم، التعديل المعاملاتي، وتجميد التكلفة والأرباح التاريخية."
  />
);

export const CustomersPlaceholderPage: React.FC = () => (
  <ModulePlaceholder
    title="سجل العملاء ودفتر الأستاذ"
    phase="المرحلة 6"
    description="ستشمل إدارة عملاء الجملة، حسابات المديونية والدائنية، وسندات القبض المستقلة."
  />
);

export const SuppliersPlaceholderPage: React.FC = () => (
  <ModulePlaceholder
    title="سجل الموردين وحسابات المشتريات"
    phase="المرحلة 6"
    description="ستشمل إدارة الموردين، سندات الصرف، تسوية الحسابات، وتاريخ المعاملات."
  />
);

export const InventoryPlaceholderPage: React.FC = () => (
  <ModulePlaceholder
    title="إدارة المخزون وحركات البضاعة"
    phase="المرحلة 5"
    description="ستشمل سجل حركات المخزون المعاملاتي، الجرد والتسوية، ومنع الرصيد السالب."
  />
);

export const ExpensesPlaceholderPage: React.FC = () => (
  <ModulePlaceholder
    title="سجل المصروفات العامة"
    phase="المرحلة 11"
    description="ستشمل تسجيل المصروفات التشغيلية، تصنيفات المصروفات، والربط بالمصروفات الخارجية."
  />
);

export const ReportsPlaceholderPage: React.FC = () => (
  <ModulePlaceholder
    title="التقارير المالية والأرباح"
    phase="المرحلة 12"
    description="خاص بالمالك: ستشمل تقارير المبيعات، تكلفة البضاعة المباعة (COGS)، صافي الأرباح، وتقييم المخزون."
    isOwnerOnly
  />
);

export const SettingsPlaceholderPage: React.FC = () => (
  <ModulePlaceholder
    title="إعدادات النظام والمستخدمين"
    phase="المرحلة 14"
    description="خاص بالمالك: ستشمل إدارة مستخدمي النظام وصلاحيات المعرض والنسخ الاحتياطي."
    isOwnerOnly
  />
);

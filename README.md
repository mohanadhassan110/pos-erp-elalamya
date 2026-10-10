# العالمية ERP/POS — Al-Alamiya ERP/POS

نظام شامل ومتكامل لإدارة تخطيط الموارد ونقاط البيع (ERP & Point-of-Sale) مخصص لـ **معرض العالمية للمفروشات** (مفروشات منزلية: ألحفة، بطاطين، فوط، وملايات)، مبني بنواة عربية أصلية بالكامل (Arabic RTL-First) وفق أعلى المعايير المعمارية والمحاسبية.

دستور وقواعد المشروع الحاكمة موثقة في [AGENTS.md](file:///d:/elalamya-main/AGENTS.md).

---

## الميزات والوحدات المكتملة (Phases 1 — 16: جاهز للتشغيل والإنتاج) ✅

1. **الأساس المعماري والصلاحيات (Auth & Roles)**:
   - تقسيم الصلاحيات الصارم بين **المالك (`owner`)** و**الكاشير (`cashier`)** مع حظر الكاشير عن التقارير الحساسة إلا بكلمة مرور مؤقتة (15 دقيقة).
   - حركات مالية بدقة حسابية ثابتة غير عائمة (`fixed-precision decimal`) عبر كائن القيمة `Money`، وكميات صحيحة `Quantity`.

2. **الكتالوج والمنتجات والباركود (Catalog & Products)**:
   - إدارة الفئات والمنتجات بتسعير جملة وقطاعي وتكلفة الشراء الحالية.
   - توليد تسلسلي حتمي لرموز الباركود وفق معيار Code 128 (`[A-Z]\d{4}`).

3. **حركات المخزون والمشتريات (Inventory & Stock Receiving)**:
   - دفتر أستاذ حركات المخزون (`inventory_movements`) كمرجع تاريخي إلزامي لكل حركة.
   - استلام البضائع من الموردين وتحديث التكلفة والمخزون وحسابات الموردين ذرياً داخل DB Transaction مع دعم قفل الصفوف (lockForUpdate).
   - منع المخزون السالب مطلقاً وحماية التزامن عند بيع القطعة الأخيرة من جهازين في نفس اللحظة.

4. **دفاتر أستاذ العملاء والموردين (Customer & Supplier Ledgers)**:
   - تتبع كامل للمديونيات، المقبوضات، المدفوعات، وحسابات الائتمان، مع استقلالية تامة بين حركة الحسابات والمخزون.

5. **نقطة البيع وفواتير المبيعات (POS Sales & Invoices)**:
   - مبيعات قطاعي (كاشير سريع ومجهول اختياري) ومبيعات جملة مرتبطة بحساب العميل.
   - تجميد لقطة تاريخية للتكلفة والربح لحظة إصدار الفاتورة لمنع تشويه الأرباح عند تغير أسعار الشراء لاحقاً.
   - دعم المنتجات الخارجية (`إضافة منتج خارجي`) مع ربط تكلفة الشراء تلقائياً بمصروف مع الاحتفاظ بسريتها التامة وسريان السياسة C (Policy C).
   - حماية ضد الإرسال المزدوج باستخدام `idempotency_key`.

6. **مرتجعات المبيعات والاستبدال (Sales Returns & Exchanges)**:
   - ربط كامل بالفاتورة الأصلية والتحقق من الكميات المؤهلة ومنع الإرجاع الزائد.
   - خيارات متعددة: استرداد نقدي، تسوية حساب، أو استبدال بصنف آخر أعلى أو مساوٍ للقيمة.

7. **المصروفات التشغيلية (Operating Expenses)**:
   - تصنيف المصروفات، دعم ربط التكاليف الخارجية، وفصلها المحاسبي الدقيق.

8. **التقارير المالية وحماية كلمة المرور (Financial Reports & Security Gate)**:
   - لوحة تقارير شاملة: مبيعات، تكلفة بضاعة مباعة (COGS)، أرباح محققة، تقييم مخزون، حركة الدفع، أستاذ العملاء والموردين.
   - بوابة حماية لقسم التقارير بكلمة مرور خادمة للكاشير، والمالك يدخل مباشرة دون كلمة مرور.

9. **طباعة الباركود والفواتير (Barcode & Invoice Printing)**:
   - طباعة فواتير رسمية بحجم **A4** وإيصالات حرارية **80 مم** مع تباعد تغذية الورق لسكين القاطع وسياسة استبدال 14 يوماً.
   - باركود Code 128 رسومي متجه (SVG) مع دعم ملصقات رول 50×25 مم و38×25 مم وورق A4 مقسم.

10. **الجاهزية والتشغيل والشبكة المحلية (Phase 16 — Production Readiness)**:
    - فهارس قاعدة بيانات مضافة لتسريع التقارير وكشوف الحسابات.
    - تشغيل على خادم محلي Windows (MariaDB/MySQL) مع جهاز ثانٍ بالمعرض عبر LAN.
    - سكريبتات نسخ احتياطي واستعادة مؤتمتة ومجربة عبر Task Scheduler مع فترات احتفاظ 30 يوماً.
    - دليل تشغيل شامل `docs/RUNBOOK.md` ودليل طابعات شامل `docs/PRINTING-SETUP.md`.

---

## حزمة التقنيات المستخدمة (Tech Stack)

- **الواجهة الخلفية (Backend)**: Laravel 11.57, MariaDB 10.4+ / MySQL 8.0, Laravel Sanctum, BCMath.
- **الواجهة الأمامية (Frontend)**: React 19, TypeScript, Vite 8.3, CSS Design System (RTL & Cairo Font), Lucide Icons.
- **جودة الكود والاختبارات**: 190 اختبار PHPUnit ناجح بنسبة 100%، 60 اختبار Vitest ناجح بنسبة 100%، Laravel Pint، Oxlint.

---

## أوامر التشغيل والإنتاج (Production Commands)

### 1. إعداد أول مرة (First Run)
```powershell
# 1. إعداد البيئة وقاعدة البيانات
cd backend
Copy-Item .env.production.example .env
php artisan key:generate
php artisan migrate --force

# 2. زرع البيانات المرجعية الأساسية فقط (بدون أي بيانات تجريبية)
php artisan db:seed --class=ProductionSeeder --force

# 3. إنشاء حساب مالك المعرض بأمان
php artisan make:owner
```

### 2. النسخ الاحتياطي والاستعادة (Backup & Restore)
```powershell
# أخذ نسخة احتياطية فورية
powershell -ExecutionPolicy Bypass -File "D:\elalamya-main\scripts\backup-database.ps1"

# استعادة نسخة سابقة في حال الطوارئ
powershell -ExecutionPolicy Bypass -File "D:\elalamya-main\scripts\restore-database.ps1" -DumpFilePath "D:\elalamya-backups\elalamya_production_backup_XXXX.sql"
```

---

## English Quickstart Summary

- **Architecture**: Single Windows Shop PC acts as LAN server (MariaDB + Laravel + React build). Showroom device connects via local LAN IP (`http://<LAN-IP>:3000` or port 8000). Zero public internet exposure.
- **Testing**:
  ```bash
  cd backend && php artisan test
  cd frontend && npm test
  ```
- **Build**:
  ```bash
  cd frontend && npm run build
  ```

---

## التوثيق المفصل
- [دستور وقواعد المشروع (AGENTS.md)](file:///d:/elalamya-main/AGENTS.md)
- [دليل التشغيل والعمليات الإنتاجية (docs/RUNBOOK.md)](file:///d:/elalamya-main/docs/RUNBOOK.md)
- [دليل إعداد الطابعات الحرارية والشبكية (docs/PRINTING-SETUP.md)](file:///d:/elalamya-main/docs/PRINTING-SETUP.md)
- [النموذج المالي ومسارات الأعمال (docs/domain-model.md)](file:///d:/elalamya-main/docs/domain-model.md)
- [مخطط قاعدة البيانات (docs/database.md)](file:///d:/elalamya-main/docs/database.md)

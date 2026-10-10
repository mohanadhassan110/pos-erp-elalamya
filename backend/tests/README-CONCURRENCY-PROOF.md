# إثبات التزامن على مستوى التطبيق وقاعدة البيانات (Application-Level Concurrency Proof)

دليل تشغيل اختبار التزامن والتنافسية الميداني لمعرض العالمية للمفروشات.

---

## 1. ما الذي يُثبته هذا الاختبار وما الذي لا يُثبته؟

### ما يُثبته هذا الاختبار بدقة:
1. **استحالة البيع السالب (No Negative Stock):** عندما يتزامن عميلان أو جهازا بيع في إرسال طلب شراء لنفس القطعة الأخيرة المتبقية في المخزن (`stock_quantity = 1`) عبر بروتوكول HTTP في نفس المللي ثانية، يقبل النظام طلب أحدهما فقط برمز `HTTP 201 Created`، ويرفض الآخر برمز `HTTP 422 Unprocessable Content` مع رمز الخطأ `INSUFFICIENT_STOCK`.
2. **سلامة الحجز وقفل السجلات (Pessimistic Locking):** إثبات عمل `SELECT ... FOR UPDATE` ومعاملات قاعدة بيانات MariaDB (InnoDB Transactions) لحماية السجلات الحيوية على مستوى الخادم.
3. **فرادة أرقام الفواتير (Unique Invoice Numbers):** كل فاتورة تم إصدارها عبر الجولات العشرين تملك رقم فاتورة فريد ومسلسل دون أي تكرار نهائياً.
4. **منع التكرار بالتزامن (Concurrent Idempotency):** عند إرسال طلبين متطابقين يحملان نفس مفتاح منع التكرار (`idempotency_key`) في نفس اللحظة عبر معالجين متوازيين، يُصدر النظام فاتورة واحدة فقط ولا يخصم المخزون مرتين.
5. **خادم محلي فردي (Single Windows Server):** يُثبت سلامة عمل خادم المتجر الوحيد (Windows PC) الذي يخدم أجهزة المعرض عبر الشبكة المحلية (LAN).

### ما لا يُثبته هذا الاختبار:
- لا يختبر بيئة خوادم موزعة متعددة (Multi-server / Multi-master cluster) لأن معمارية المتجر خادم محلي وحيد ومستقل.
- لا يختبر فشل اتصال الشبكة اللاسلكية أثناء النقل (Network dropouts).

---

## 2. متطلبات التشغيل

1. تشغيل خدمة MariaDB (`mysqld.exe`) على المنفذ `3306`.
2. وجود قاعدة بيانات الاختبار `elalamya_test`.
3. تشغيل خادم الويب (Apache على المنفذ 80 أو `php artisan serve --port=8001 --env=testing`).

---

## 3. خطوات التشغيل للمالك (Owner Run Instructions)

### الخطوة 1: التأكد من تشغيل خادم الاختبار
في موجه أوامر PowerShell داخل مجلد `backend`:
```powershell
php artisan serve --host=127.0.0.1 --port=8001 --env=testing
```

### الخطوة 2: تشغيل الاختبار في نافذة أخرى
في نافذة PowerShell ثانية داخل مجلد `backend`:
```powershell
php tests/ApplicationConcurrencyProof.php
```

---

## 4. المخرجات المتوقعة (Expected Output)

يجب أن تنتهي الجولات العشرين (20 rounds) بنتيجة 100% نجاح:
```text
=== APPLICATION-LEVEL CONCURRENCY PROOF (MariaDB Engine) ===
[1] Running migrations on elalamya_test (MariaDB)...
[2] Test product created: ID 1, Barcode K0001, Initial Stock: 1
    Target HTTP Endpoint: http://127.0.0.1:8001/api/v1/invoices
[3] Executing 20 concurrent rounds with 2 parallel HTTP client processes each...

Round  | Process 1    | Process 2    | Winner Invoice  | Final Stock  | Status    
--------------------------------------------------------------------------------
1      | HTTP 201     | HTTP 422     | INV-202610-0001 | 0            | PASS      
2      | HTTP 422     | HTTP 201     | INV-202610-0002 | 0            | PASS      
...
20     | HTTP 201     | HTTP 422     | INV-202610-0020 | 0            | PASS      
--------------------------------------------------------------------------------
Rounds Completed: 20
Total Successful (201 Created): 20 (Expected: 20)
Total Rejected (422 Insufficient Stock): 20 (Expected: 20)
Negative Stock Violations: 0 (Expected: 0)
Duplicate Invoice Numbers: 0 (Expected: 0)
Unique Invoices Created: 20

[4] Testing Concurrent Idempotency Key Reuse...
Process A: HTTP 201 -> Invoice INV-202610-0021
Process B: HTTP 201 -> Invoice INV-202610-0021
Final Stock after Idempotency Round: 0 (Expected: 0, not negative)
IDEMPOTENCY CONCURRENCY CHECK: PASSED (Exact same invoice returned, zero double stock deductions)

OVERALL CONCURRENCY PROOF RESULT: PASSED (100% RELIABILITY)
```

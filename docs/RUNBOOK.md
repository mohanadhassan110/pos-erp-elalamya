# دليل تشغيل وعمليات النظام — معرض العالمية للمفروشات
## Al-Alamiya ERP/POS — Production Operations Runbook

> **طبيعة المعرض:** مفروشات منزلية (لحف، بطاطين، فوط، أطقم ملايات، مفارش). **ليس معرض أثاث.**  
> **بيئة التشغيل المعتمدة:** جهاز كمبيوتر رئيسي داخل المعرض يعمل بنظام **Windows** كخادم محلي (LAN Server) متصل براوتر المعرض، وجهاز ثانٍ في الطابق العلوي متصل عبر الشبكة المحلية (Wi-Fi / Ethernet) بنفس الراوتر لمشاركة نفس المخزون المشترك لحظياً. **بدون استضافة خارجية أو نطاق عام أو كشف على الإنترنت.**

---

## 1. متطلبات جهاز الكمبيوتر الرئيسي (Shop PC - Windows)

1. **نظام التشغيل:** Windows 10 أو Windows 11 (64-bit).
2. **محرك قواعد البيانات:** MariaDB 10.4+ أو MySQL 8.0+ (مثبت عبر XAMPP على المسار `C:\xampp\mysql`).
3. **بيئة PHP:** إصدار PHP 8.2 أو أحدث مع تفعيل ملحقات: `pdo_mysql`, `bcmath`, `mbstring`, `openssl`, `tokenizer`, `curl`, `fileinfo`.
4. **تثبيت Composer:** إصدار 2.x.
5. **بيئة Node.js:** Node.js v20+ لتجميع واجهة React.
6. **مزود طاقة غير منقطع (UPS):** جهاز UPS بقدرة لا تقل عن 650VA إلى 1000VA لتأمين جهاز الخادم الرئيسي والراوتر ضد انقطاع الكهرباء المفاجئ وحماية ملفات قاعدة البيانات من التلف أثناء العمليات المالية.

---

## 2. إعداد وتأمين محرك قاعدة البيانات (Database Hardening)

### أ. فحص إصدار MariaDB وحالة الدعم (EOL Notice)
- محرك XAMPP الافتراضي يحتوي على MariaDB 10.4.32.
- **تنبيه تقني:** إصدار MariaDB 10.4 انتهت فترة دعمه الرسمي (End-of-Life) في يونيو 2024.
- **التوصية الإنتاجية:** يوصى بنقل MariaDB لاحقاً إلى إصدار مدعوم طويل الأجل (LTS) مثل **MariaDB 10.11 LTS** (مدعوم حتى فبراير 2028) أو **MariaDB 11.4 LTS** (مدعوم حتى مايو 2029).
- **خطوات الترقية الآمنة مستقبلاً (بدون لمس البيانات الحقيقية):**
  1. أخذ نسخة احتياطية كاملة عبر `backup-database.ps1`.
  2. إيقاف خدمة MySQL.
  3. استبدال مجلد `C:\xampp\mysql` بالإصدار الحديث وتشغيل `mysql_upgrade.exe`.
  4. استعادة النسخة والتحقق من سلامة الجداول.

### ب. تعيين كلمة مرور قوية لحساب الجذر (MariaDB Root Password)
افتح موجه أوامر XAMPP MySQL ونفذ:
```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'StrongRootPass_AlAlamiya_2026!';
FLUSH PRIVILEGES;
```

### ج. إنشاء مستخدم مخصص للتطبيق بصلاحيات محددة (Dedicated DB User)
لا تجعل التطبيق يتصل بحساب `root`، بل أنشئ مستخدماً مخصصاً بدون صلاحيات إدارة عامة:
```sql
CREATE USER 'elalamya_app'@'127.0.0.1' IDENTIFIED BY 'App_Secure_Pass_2026!#';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER, REFERENCES ON elalamya_production.* TO 'elalamya_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### د. حصر اتصال قاعدة البيانات على الجهاز المحلي فقط (Bind to Localhost)
في ملف `C:\xampp\mysql\bin\my.ini`:
```ini
[mysqld]
bind-address = 127.0.0.1
skip-networking = 0
```
هذا يمنع أي جهاز آخر على الشبكة من محاولة الاتصال بمنفذ 3306 مباشرة.

### هـ. تعطيل أو تقييد phpMyAdmin
- قم بتغيير اسم مجلد `C:\xampp\phpMyAdmin` إلى اسم عشوائي أو احذفه.
- أو عدل ملف `C:\xampp\apache\conf\extra\httpd-xampp.conf` لحظر الوصول إلى phpMyAdmin إلا بكلمة مرور إدارية.

---

## 3. إعداد الشبكة المحلية وتأمين الجدار الناري (LAN & Firewall)

### أ. تثبيت العنوان المحلي للجهاز الرئيسي (Static LAN IP)
يجب تثبيت عنوان IP لجهاز الخادم الرئيسي داخل الراوتر (DHCP Static Lease / IP Reservation):
- **مثال العنوان المعتمد:** `192.168.1.100`.
- يتم تثبيت الـ MAC Address الخاص بكارت الشبكة لجهاز الخادم في صفحة الراوتر (عادة `192.168.1.1`).

### ب. إعداد جدار حماية ويندوز (Windows Defender Firewall)
السماح بالاتصال على منفذ الخادم (المنفذ 80 و 8000) **فقط وحصرياً من داخل الشبكة المحلية (Private Subnet)**:
```powershell
New-NetFirewallRule -DisplayName "Al-Alamiya ERP Production Web" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow -RemoteAddress 192.168.1.0/24 -Profile Private
New-NetFirewallRule -DisplayName "Al-Alamiya ERP Backend API" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow -RemoteAddress 192.168.1.0/24 -Profile Private
```
تأكد أن شبكة المعرض مضبوطة في ويندوز على نوع **Private Network** وليس Public.

### ج. التحقق الصارم من عدم انكشاف النظام على الإنترنت (No Internet Exposure)
- **لا تقم بتفعيل Port Forwarding** لأي منفذ في إعدادات الراوتر (NAT/Virtual Server).
- **لا تقم بتفعيل DMZ** لجهاز المعرض.
- **التحقق العملي:** من خلال موقع فحص المنافذ الخارجي (مثل `canyouseeme.org`) باستخدام IP الإنترنت الخارجي للمعرض، والتأكد أن المنافذ 80 و 8000 و 3306 مغلقة تماماً (Closed / Timed Out).
- **الوصول عن بعد مستقبلاً (اختياري فقط):** في حال الرغبة في فتح النظام من المنزل، يتم استخدام شبكة افتراضية مشفرة مثل **Tailscale** وتثبيتها على جهاز المعرض وهاتف/لابتوب المالك فقط دون فتح منافذ في الراوتر.

---

## 4. إعداد الخادم والتشغيل الإنتاجي (Production Serving Setup)

بدلاً من تشغيل أوامر التطوير (`artisan serve` و `vite`)، يتم تشغيل النظام عبر خادم إنتاجي متكامل على Windows:

### أ. بناء حزمة الواجهة الأمامية (Frontend Production Build)
في مجلد `frontend`:
```powershell
npm run build
```
ينتج عن هذا تجميع كافة ملفات الواجهة في مجلد `frontend/dist`.

### ب. إعداد خادم الويب Apache (XAMPP) لخدمة الواجهة والخلفية
في ملف `C:\xampp\apache\conf\extra\httpd-vhosts.conf`:
```apache
<VirtualHost *:80>
    ServerName elalamya.lan
    DocumentRoot "D:/elalamya-main/frontend/dist"

    <Directory "D:/elalamya-main/frontend/dist">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        # إعادة توجيه مسارات SPA إلى index.html
        FallbackResource /index.html
    </Directory>

    # توجيه طلبات API إلى خادم Laravel الخلفي
    Alias /api "D:/elalamya-main/backend/public"
    <Directory "D:/elalamya-main/backend/public">
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### ج. التخزين المؤقت وتحسين أداء Laravel في الإنتاج
في مجلد `backend`:
```powershell
php artisan config:cache
php artisan route:cache
php artisan event:cache
```

---

## 5. التشغيل التلقائي بعد إعادة التشغيل (Auto-Start Services)

لضمان تشغيل النظام تلقائياً عند فتح جهاز المعرض أو بعد انقطاع الكهرباء:
1. **تثبيت خدمة Apache كخدمة ويندوز:**
   ```powershell
   & "C:\xampp\apache\bin\httpd.exe" -k install
   Set-Service -Name "Apache2.4" -StartupType Automatic
   ```
2. **تثبيت خدمة MariaDB كخدمة ويندوز:**
   ```powershell
   & "C:\xampp\mysql\bin\mysqld.exe" --install "MariaDB"
   Set-Service -Name "MariaDB" -StartupType Automatic
   ```
3. عند إعادة تشغيل الجهاز، تعمل قاعدة البيانات وخادم الويب تلقائياً في الخلفية فور إقلاع ويندوز حتى قبل تسجيل دخول المستخدم.

---

## 6. إجراءات النسخ الاحتياطي اليومي والاستعادة (Backup & Recovery)

### أ. النسخ الاحتياطي اليومي الآمن
- السكريبت: `D:\elalamya-main\scripts\backup-database.ps1`.
- يعتمد السكريبت على ملف إعدادات مؤقت مشفر (`--defaults-extra-file`) ولا يمرر كلمة المرور إطلاقاً في سطر الأوامر لمنع تسريبها في Task Manager.
- يحفظ الملفات في مسار خارج هارد النظام (فلاش ميموري / هارد خارجي `E:\elalamya-backups` أو مجلد متزامن).
- يحتفظ بالنسخ لمدة 30 يوماً ويحذف الأقدم تلقائياً.
- تم تسجيل المهمة بنجاح في Windows Task Scheduler باسم: `AlAlamiya_Daily_Backup` لتعمل يومياً الساعة 11:30 مساءً.

### ب. أمر استعادة قاعدة البيانات (Restore Drill)
```powershell
powershell -ExecutionPolicy Bypass -File "D:\elalamya-main\scripts\restore-database.ps1" -DbName "elalamya_production" -DumpFilePath "D:\elalamya-backups\elalamya_production_backup_YYYY-MM-DD_HHMMSS.sql"
```

### ج. خطة الطوارئ عند تعطل جهاز المعرض بالكامل (Hardware Disaster Recovery)
1. إحضار أي جهاز بديل يعمل بنظام Windows متصل بنفس الراوتر.
2. تثبيت XAMPP ونسخ مجلد المشروع.
3. استعادة آخر ملف نسخة احتياطية `.sql` من الفلاش ميموري الخارجي عبر سكريبت الاستعادة.
4. تثبيت عنوان IP المحلي نفسه على الجهاز البديل (`192.168.1.100`).
5. تشغيل الخدمات وفتح النظام في أقل من 20 دقيقة.

---

## 7. إدارة المستخدمين وكلمات المرور (Users & Credentials)

نظراً لعدم وجود واجهة لإدارة المستخدمين في الإصدار الحالي، تتوفر أوامر سريعة وآمنة عبر سطر الأوامر:
1. **إنشاء حساب كاشير جديد:**
   ```powershell
   php artisan make:cashier
   ```
2. **إعادة تعيين كلمة مرور أي مستخدم (مالك أو كاشير) وإلغاء جلساته النشطة:**
   ```powershell
   php artisan user:reset-password username
   ```
3. **تفعيل أو تعطيل حساب كاشير فورياً:**
   ```powershell
   php artisan user:toggle-status username
   ```

---

## 8. تشغيل الجهاز الثاني بالمعرض (Showroom Upstairs Device)

1. الجهاز الثاني متصل بنفس شبكة الراوتر (واي فاي أو كابل).
2. افتح المتصفح على الجهاز الثاني واكتب:
   ```text
   http://192.168.1.100
   ```
3. تقوم الواجهة تلقائياً بتوجيه طلبات API إلى عنوان الخادم `192.168.1.100`.
4. يسجل الكاشير دخوله، ويشاهد نفس المنتجات والأسعار والمخزون المشترك لحظياً، مع حماية كاملة ضد البيع المزدوج أو بيع القطعة الأخيرة مرتين.

---

## 9. التحديث الآمن والتراجع (Safe Update & Rollback)

### أ. التحديث:
```powershell
# 1. أخذ نسخة احتياطية قبل التحديث
powershell -ExecutionPolicy Bypass -File "D:\elalamya-main\scripts\backup-database.ps1" -DbName "elalamya_production"
# 2. سحب الكود الجديد
git pull origin main
# 3. تحديث التبعيات والهجرات التراكمية
composer install --no-dev --optimize-autoloader
php artisan migrate --force
cd frontend && npm run build
php artisan config:cache && php artisan route:cache
```

### ب. التراجع عند الطوارئ (Rollback):
```powershell
git checkout HEAD~1
php artisan migrate:rollback
# أو استعادة قاعدة البيانات من النسخة الاحتياطية المأخوذة قبل التحديث
```

import { ApiError } from '../types/api';

/**
 * Global Error Message Mapper
 *
 * Translates raw JavaScript errors, network failures, or unlocalized API errors
 * into professional, user-friendly Arabic operational messages.
 * Never exposes raw English exception strings or internal details to users.
 */
export function mapErrorMessage(err: unknown, defaultFallback = 'حدث خطأ غير متوقع، يرجى المحاولة ثانية'): string {
  if (!err) {
    return defaultFallback;
  }

  if (err instanceof ApiError) {
    if (err.errors) {
      const firstField = Object.keys(err.errors)[0];
      if (firstField && err.errors[firstField]?.length) {
        return err.errors[firstField][0];
      }
    }
    if (err.status === 401) {
      return 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً';
    }
    if (err.status === 403) {
      return 'غير مصرح لك بإجراء هذه العملية';
    }
    if (err.status === 404) {
      return 'العنصر المطلوب غير موجود أو تم حذفه';
    }
    if (err.status === 422) {
      return err.message && /[\u0600-\u06FF]/.test(err.message)
        ? err.message
        : 'بيانات غير صالحة، يرجى مراجعة الحقول المطلوبة';
    }
    if (err.status >= 500) {
      return 'تعذر إتمام العملية من جانب الخادم، يرجى المحاولة لاحقاً';
    }
    if (err.message && /[\u0600-\u06FF]/.test(err.message) && !isRawEnglishException(err.message)) {
      return err.message;
    }
    return defaultFallback;
  }

  if (err instanceof Error) {
    const rawMsg = err.message || '';

    // Network & connection errors
    if (
      rawMsg.includes('Failed to fetch') ||
      rawMsg.includes('NetworkError') ||
      rawMsg.includes('Network request failed') ||
      rawMsg.includes('ECONNREFUSED')
    ) {
      return 'تعذر الاتصال بالخادم، يرجى التحقق من اتصال الشبكة وتشغيل الخادم';
    }

    // Property access / runtime undefined errors
    if (
      rawMsg.includes('Cannot read properties of undefined') ||
      rawMsg.includes('Cannot read property') ||
      rawMsg.includes('is undefined') ||
      rawMsg.includes('null is not an object')
    ) {
      return 'تعذر تحميل أو قراءة بعض البيانات، يرجى تحديث الصفحة والمحاولة ثانية';
    }

    // If message is already Arabic, show it
    if (/[\u0600-\u06FF]/.test(rawMsg) && !isRawEnglishException(rawMsg)) {
      return rawMsg;
    }

    return defaultFallback;
  }

  if (typeof err === 'string') {
    if (/[\u0600-\u06FF]/.test(err) && !isRawEnglishException(err)) {
      return err;
    }
    return defaultFallback;
  }

  return defaultFallback;
}

function isRawEnglishException(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('cannot read') ||
    lower.includes('undefined') ||
    lower.includes('null') ||
    lower.includes('uncaught') ||
    lower.includes('syntaxerror') ||
    lower.includes('typeerror') ||
    lower.includes('referenceerror') ||
    lower.includes('stack trace') ||
    lower.includes('exception')
  );
}

export const getFriendlyErrorMessage = mapErrorMessage;

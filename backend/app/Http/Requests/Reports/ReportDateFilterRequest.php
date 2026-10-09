<?php

namespace App\Http\Requests\Reports;

use Carbon\Carbon;
use Illuminate\Foundation\Http\FormRequest;

class ReportDateFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'period' => ['nullable', 'string', 'in:today,this_week,this_month,custom'],
            'range_preset' => ['nullable', 'string', 'in:today,this_week,this_month,custom'],
            'from_date' => ['nullable', 'date_format:Y-m-d'],
            'to_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from_date'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ];
    }

    public function messages(): array
    {
        return [
            'period.in' => 'فترة التقرير المحددة غير صالحة.',
            'range_preset.in' => 'فترة التقرير المحددة غير صالحة.',
            'from_date.date_format' => 'صيغة تاريخ البداية غير صالحة (يجب أن تكون YYYY-MM-DD).',
            'to_date.date_format' => 'صيغة تاريخ النهاية غير صالحة (يجب أن تكون YYYY-MM-DD).',
            'to_date.after_or_equal' => 'تاريخ النهاية يجب أن يكون مساوياً أو لاحقاً لتاريخ البداية.',
            'start_date.date_format' => 'صيغة تاريخ البداية غير صالحة (يجب أن تكون YYYY-MM-DD).',
            'end_date.date_format' => 'صيغة تاريخ النهاية غير صالحة (يجب أن تكون YYYY-MM-DD).',
            'end_date.after_or_equal' => 'تاريخ النهاية يجب أن يكون مساوياً أو لاحقاً لتاريخ البداية.',
        ];
    }

    /**
     * Resolve start and end timestamps in UTC and Cairo date strings.
     *
     * @return array{
     *     start_utc: Carbon,
     *     end_utc: Carbon,
     *     start_date: string,
     *     end_date: string,
     *     period: string
     * }
     */
    public function resolveDateRange(): array
    {
        $timezone = 'Africa/Cairo';
        $period = $this->input('period') ?: $this->input('range_preset');

        $fromInput = $this->input('from_date') ?: $this->input('start_date');
        $toInput = $this->input('to_date') ?: $this->input('end_date') ?: $fromInput;

        if (! $period && ($fromInput || $toInput)) {
            $period = 'custom';
        }

        $period = $period ?: 'this_month';

        switch ($period) {
            case 'today':
                $cairoStart = Carbon::now($timezone)->startOfDay();
                $cairoEnd = Carbon::now($timezone)->endOfDay();
                break;

            case 'this_week':
                $cairoStart = Carbon::now($timezone)->startOfWeek();
                $cairoEnd = Carbon::now($timezone)->endOfWeek();
                break;

            case 'custom':
                $cairoStart = Carbon::parse($fromInput ?: Carbon::now($timezone)->toDateString(), $timezone)->startOfDay();
                $cairoEnd = Carbon::parse($toInput ?: Carbon::now($timezone)->toDateString(), $timezone)->endOfDay();
                break;

            case 'this_month':
            default:
                $cairoStart = Carbon::now($timezone)->startOfMonth();
                $cairoEnd = Carbon::now($timezone)->endOfMonth();
                $period = 'this_month';
                break;
        }

        return [
            'start_utc' => $cairoStart->copy()->utc(),
            'end_utc' => $cairoEnd->copy()->utc(),
            'start_date' => $cairoStart->format('Y-m-d'),
            'end_date' => $cairoEnd->format('Y-m-d'),
            'period' => $period,
        ];
    }
}

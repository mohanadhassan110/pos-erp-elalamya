import React, { useMemo } from 'react';
import { CODE128_PATTERNS, encodeCode128B } from '../../utils/code128';

export interface Code128BarcodeProps {
  value: string;
  height?: number;
  moduleWidth?: number;
  showText?: boolean;
  fontSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface BarRect {
  x: number;
  width: number;
}

export const Code128Barcode: React.FC<Code128BarcodeProps> = ({
  value,
  height = 40,
  moduleWidth = 1.4,
  showText = true,
  fontSize = 11,
  className = '',
  style = {},
}) => {
  const encoding = useMemo(() => encodeCode128B(value), [value]);

  const { bars, totalWidth, totalHeight } = useMemo(() => {
    if (!encoding.valid) {
      return { bars: [], totalWidth: 0, totalHeight: 0 };
    }

    const quietZoneModules = 10;
    let currentModule = quietZoneModules;
    const computedBars: BarRect[] = [];

    for (const sym of encoding.symbols) {
      const pattern = CODE128_PATTERNS[sym] || '212222';
      for (let pIdx = 0; pIdx < pattern.length; pIdx++) {
        const w = parseInt(pattern[pIdx], 10);
        const isBar = pIdx % 2 === 0;

        if (isBar) {
          computedBars.push({
            x: currentModule * moduleWidth,
            width: w * moduleWidth,
          });
        }
        currentModule += w;
      }
    }

    const fullModules = currentModule + quietZoneModules;
    const computedTotalWidth = fullModules * moduleWidth;
    const textHeight = showText ? fontSize + 4 : 0;
    const computedTotalHeight = height + textHeight;

    return {
      bars: computedBars,
      totalWidth: computedTotalWidth,
      totalHeight: computedTotalHeight,
    };
  }, [encoding, moduleWidth, height, showText, fontSize]);

  const trimmed = (value || '').trim();
  if (!trimmed) {
    return null;
  }

  if (!encoding.valid) {
    return (
      <div
        className={className}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.375rem',
          border: '1px solid var(--color-danger-border)',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'var(--color-danger-bg)',
          color: 'var(--color-danger-600)',
          fontSize: '12px',
          fontFamily: 'monospace',
          userSelect: 'none',
          ...style,
        }}
        dir="ltr"
        title={encoding.error}
      >
        <span style={{ fontWeight: 700 }}>[رمز باركود غير صالح]</span>
        <span style={{ fontSize: '10px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </span>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', userSelect: 'none', maxWidth: '100%', ...style }}
      dir="ltr"
    >
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        style={{ display: 'block', maxWidth: '100%' }}
        shapeRendering="crispEdges"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="0" y="0" width={totalWidth} height={totalHeight} fill="#ffffff" />
        {bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y={0}
            width={bar.width}
            height={height}
            fill="#000000"
          />
        ))}
        {showText && (
          <text
            x={totalWidth / 2}
            y={height + fontSize}
            textAnchor="middle"
            fill="#000000"
            style={{
              fontFamily: 'monospace, "Courier New", Courier',
              fontSize: `${fontSize}px`,
              fontWeight: 700,
              letterSpacing: '2px',
            }}
          >
            {trimmed}
          </text>
        )}
      </svg>
    </div>
  );
};

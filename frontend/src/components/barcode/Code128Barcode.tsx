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
        className={`inline-flex flex-col items-center justify-center p-1.5 border border-red-300 rounded bg-red-50 text-red-600 text-xs font-mono select-none ${className}`}
        style={style}
        dir="ltr"
        title={encoding.error}
      >
        <span className="font-bold">[رمز باركود غير صالح]</span>
        <span className="text-[10px] text-red-500 truncate max-w-[180px]">{value}</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex flex-col items-center select-none ${className}`}
      style={{ ...style }}
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

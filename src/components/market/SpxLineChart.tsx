import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

export type PriceLine = { price: number; color: string; title: string; dashed?: boolean };
export type ChartPoint = { t: number; c: number; o?: number; h?: number; l?: number };

const etTimeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
});

export default function SpxLineChart({
  points,
  priceLines,
  height = 300,
  candles = false,
}: {
  points: ChartPoint[];
  priceLines: PriceLine[];
  height?: number;
  candles?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line" | "Candlestick"> | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // lightweight-charts cannot parse oklch()/lab() color values, so use a literal.
    const text = "#1a1a1a";
    const chart = createChart(el, {
      height,
      layout: {
        background: { color: "transparent" },
        textColor: text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(120,120,120,0.15)" },
        horzLines: { color: "rgba(120,120,120,0.15)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number) => etTimeFmt.format(new Date(time * 1000)),
      },
      localization: {
        timeFormatter: (time: number) => etTimeFmt.format(new Date(time * 1000)) + " ET",
      },
      crosshair: { mode: 0 },
      handleScale: { axisPressedMouseMove: false },
    });
    const series = candles
      ? chart.addSeries(CandlestickSeries, {
          upColor: "#16a34a",
          downColor: "#dc2626",
          borderUpColor: "#16a34a",
          borderDownColor: "#dc2626",
          wickUpColor: "#16a34a",
          wickDownColor: "#dc2626",
          priceLineVisible: false,
        })
      : chart.addSeries(LineSeries, {
          color: "#0ea5e9",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
        });
    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      ro.disconnect();
      chartRef.current = null;
      seriesRef.current = null;
      chart.remove();
    };
  }, [height, candles]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const rows = points
      .map((p) => ({
        time: Math.floor(p.t / 1000) as UTCTimestamp,
        value: p.c,
        open: p.o ?? p.c,
        high: p.h ?? p.c,
        low: p.l ?? p.c,
        close: p.c,
      }))
      .sort((a, b) => a.time - b.time)
      .filter((p, i, arr) => i === 0 || p.time !== arr[i - 1].time);
    try {
      series.setData(
        candles
          ? (rows.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })) as any)
          : (rows.map(({ time, value }) => ({ time, value })) as any),
      );
      chartRef.current?.timeScale().fitContent();
    } catch {
      /* chart disposed mid-update */
    }
  }, [points, candles]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    let created: ReturnType<ISeriesApi<"Line">["createPriceLine"]>[] = [];
    try {
      created = priceLines.map((l) =>
        series.createPriceLine({
          price: l.price,
          color: l.color,
          lineWidth: 1,
          lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
          axisLabelVisible: true,
          title: l.title,
        }),
      );
    } catch {
      /* chart disposed mid-update */
    }
    return () => {
      created.forEach((l) => {
        try {
          series.removePriceLine(l);
        } catch {
          /* series already disposed */
        }
      });
    };
  }, [priceLines, candles]);

  return <div ref={wrapRef} className="w-full" />;
}

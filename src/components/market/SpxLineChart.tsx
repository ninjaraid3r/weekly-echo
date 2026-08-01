import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

export type PriceLine = { price: number; color: string; title: string; dashed?: boolean };

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
}: {
  points: Array<{ t: number; c: number }>;
  priceLines: PriceLine[];
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const styles = getComputedStyle(document.documentElement);
    const text = styles.getPropertyValue("--foreground")?.trim() || "#111";
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
    const series = chart.addSeries(LineSeries, {
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
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const data = points
      .map((p) => ({ time: Math.floor(p.t / 1000) as UTCTimestamp, value: p.c }))
      .sort((a, b) => a.time - b.time)
      .filter((p, i, arr) => i === 0 || p.time !== arr[i - 1].time);
    series.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [points]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const created = priceLines.map((l) =>
      series.createPriceLine({
        price: l.price,
        color: l.color,
        lineWidth: 1,
        lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
        axisLabelVisible: true,
        title: l.title,
      }),
    );
    return () => {
      created.forEach((l) => {
        try {
          series.removePriceLine(l);
        } catch {
          /* series already disposed */
        }
      });
    };
  }, [priceLines]);

  return <div ref={wrapRef} className="w-full" />;
}

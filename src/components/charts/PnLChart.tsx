'use client';

/**
 * PnL Chart using Lightweight Charts (TradingView).
 * Dark theme colors matching our design tokens.
 */

import React, { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';
import { useCatEmotion } from '@/components/cat/CatEmotionProvider';
import Panel, { PanelHeader, PanelTitle } from '@/components/ui/Panel';
import TimeWindowToggle from './TimeWindowToggle';

export default function PnLChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<{ remove: () => void } | null>(null);
  const renderIdRef = useRef(0);
  const { pnlWindows, activeWindow } = useAppStore();
  const { trigger } = useCatEmotion();
  const currentPnl = pnlWindows[activeWindow];

  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (!currentPnl?.dailyReturns?.length) return;

    const renderId = ++renderIdRef.current;

    // Clean up previous chart synchronously
    if (chartInstanceRef.current) {
      try { chartInstanceRef.current.remove(); } catch { /* already removed */ }
      chartInstanceRef.current = null;
    }
    chartContainerRef.current.innerHTML = '';

    let resizeHandler: (() => void) | null = null;

    (async () => {
      const { createChart, ColorType } = await import('lightweight-charts');

      // Stale check — if another render happened while we awaited, bail
      if (renderId !== renderIdRef.current) return;
      if (!chartContainerRef.current) return;

      chartContainerRef.current.innerHTML = '';

      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 260,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#58586a',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 10,
        },
        grid: {
          vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
          horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
        },
        crosshair: {
          vertLine: { color: 'rgba(255, 255, 255, 0.08)', width: 1, style: 2 },
          horzLine: { color: 'rgba(255, 255, 255, 0.08)', width: 1, style: 2 },
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.04)',
          textColor: '#58586a',
        },
        timeScale: {
          borderColor: 'rgba(255, 255, 255, 0.04)',
          timeVisible: false,
        },
        handleScale: true,
        handleScroll: true,
      });

      // Second stale check after chart creation
      if (renderId !== renderIdRef.current) {
        chart.remove();
        return;
      }

      const pos = currentPnl.totalPnlUsd >= 0;

      const areaSeries = chart.addAreaSeries({
        lineColor: pos ? '#2eaa60' : '#e74c3c',
        topColor: pos ? 'rgba(46, 170, 96, 0.25)' : 'rgba(231, 76, 60, 0.25)',
        bottomColor: pos ? 'rgba(46, 170, 96, 0.02)' : 'rgba(231, 76, 60, 0.02)',
        lineWidth: 2,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: pos ? '#2eaa60' : '#e74c3c',
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const data = currentPnl.dailyReturns.map(d => ({
        time: d.date as string,
        value: d.cumulativePnl,
      }));

      areaSeries.setData(data);
      chart.timeScale().fitContent();
      chartInstanceRef.current = chart;

      if (currentPnl.totalPnlUsd > 500) {
        trigger({ type: 'profit_streak', count: currentPnl.winningTrades });
      } else if (currentPnl.maxDrawdownPercent > 15) {
        trigger({ type: 'drawdown', percent: currentPnl.maxDrawdownPercent });
      }

      resizeHandler = () => {
        if (chartContainerRef.current && renderId === renderIdRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };
      window.addEventListener('resize', resizeHandler);
    })();

    return () => {
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      if (chartInstanceRef.current && renderId === renderIdRef.current) {
        try { chartInstanceRef.current.remove(); } catch { /* already removed */ }
        chartInstanceRef.current = null;
      }
    };
  }, [currentPnl, trigger]);

  // Loading / no data state
  if (!currentPnl) {
    return (
      <Panel>
        <PanelHeader>
          <PanelTitle>P&L Performance</PanelTitle>
          <TimeWindowToggle />
        </PanelHeader>
        <div className="h-[260px] shimmer" style={{ borderRadius: 'var(--r-sm)' }} />
      </Panel>
    );
  }

  // No daily returns data
  if (!currentPnl.dailyReturns || currentPnl.dailyReturns.length === 0) {
    return (
      <Panel>
        <PanelHeader>
          <PanelTitle>P&L Performance</PanelTitle>
          <TimeWindowToggle />
        </PanelHeader>
        <div className="h-[260px] flex items-center justify-center">
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>No trade data for this window.</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel padding="sm">
      <PanelHeader className="px-3 pt-2">
        <div className="flex items-center gap-3">
          <PanelTitle>P&L Performance</PanelTitle>
          <span className="text-sm font-semibold tabular-nums"
            style={{ color: currentPnl.totalPnlUsd >= 0 ? 'var(--success)' : 'var(--accent)' }}>
            {currentPnl.totalPnlUsd >= 0 ? '+' : ''}${currentPnl.totalPnlUsd.toFixed(2)}
          </span>
        </div>
        <TimeWindowToggle />
      </PanelHeader>
      <div ref={chartContainerRef} className="w-full" style={{ minHeight: 260 }} />
    </Panel>
  );
}

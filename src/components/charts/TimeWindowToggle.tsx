'use client';

/**
 * TimeWindowToggle — Uses SegmentedControl.
 */

import SegmentedControl from '@/components/ui/SegmentedControl';
import { useAppStore } from '@/stores/app-store';
import type { TimeWindow } from '@/types';

const OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: 1, label: '1D' },
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
  { value: 180, label: '180D' },
  { value: 365, label: '1Y' },
];

export default function TimeWindowToggle() {
  const { activeWindow, setActiveWindow } = useAppStore();
  return <SegmentedControl options={OPTIONS} value={activeWindow} onChange={setActiveWindow} />;
}

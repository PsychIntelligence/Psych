'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppShell from '@/components/shell/AppShell';
import Panel, { PanelHeader, PanelTitle } from '@/components/ui/Panel';
import { Settings as SettingsIcon } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { useCatEmotion } from '@/components/cat/CatEmotionProvider';
import { useSettings } from '@/hooks/useSettings';
import { stagger, staggerItem, press } from '@/lib/motion';
import {
  Shield, Download, Trash2, Monitor, Moon, Sun,
  FileSpreadsheet, FileJson, Activity, RotateCcw, Check,
} from 'lucide-react';
import { exportTradesCSV, exportBehaviorJSON, downloadFile } from '@/lib/signals/export';
import { loadAchievements } from '@/lib/signals/achievements';

export default function SettingsPage() {
  const { reset } = useAppStore();
  const wallet = useAppStore(s => s.wallet);
  const lastSyncAt = useAppStore(s => s.lastSyncAt);
  const { trigger, setReducedMotion, setReactivity } = useCatEmotion();
  const { settings, update, resetToDefaults } = useSettings();
  const [showDel, setShowDel] = useState(false);
  const [saved, setSaved] = useState(false);

  const showSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  const Toggle = ({ on, onToggle }: { on: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} className="relative w-7 h-4 rounded-full"
      style={{ background: on ? 'var(--success)' : 'var(--stroke)', transition: 'background 0.15s' }}>
      <motion.div animate={{ x: on ? 12 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-[2px] w-3 h-3 rounded-full bg-white" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
    </button>
  );

  return (
    <AppShell>
      <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-xl mx-auto px-5 py-6 space-y-4">
        <motion.div variants={staggerItem} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-5 h-5" style={{ color: 'var(--muted)' }} />
            <div>
              <h1 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Settings</h1>
              <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                {wallet ? `Synced to ${wallet.solDomain ?? wallet.address.slice(0, 8)}...` : 'Local only'}
              </p>
            </div>
          </div>
          {/* Save indicator */}
          <AnimatePresence>
            {saved && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded"
                style={{ color: 'var(--success)', background: 'var(--success-soft)' }}
              >
                <Check className="w-3 h-3" /> Saved
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Appearance */}
        <motion.div variants={staggerItem}>
          <Panel>
            <PanelHeader><PanelTitle icon={<Monitor className="w-3.5 h-3.5" />}>Appearance</PanelTitle></PanelHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px]" style={{ color: 'var(--text)' }}>Theme</span>
                <div className="flex gap-[2px] rounded p-[3px]" style={{ background: 'var(--bg2)', border: '1px solid var(--stroke2)' }}>
                  {[
                    { v: 'light' as const, i: <Sun className="w-3 h-3" /> },
                    { v: 'system' as const, i: <Monitor className="w-3 h-3" /> },
                    { v: 'dark' as const, i: <Moon className="w-3 h-3" /> },
                  ].map(({ v, i }) => (
                    <button key={v} onClick={() => { update('theme', v); showSaved(); }}
                      className="px-2 py-1 rounded-md text-[10px]"
                      style={{
                        background: settings.theme === v ? 'var(--surface)' : 'transparent',
                        color: settings.theme === v ? 'var(--text)' : 'var(--muted)',
                        border: settings.theme === v ? '1px solid var(--stroke)' : '1px solid transparent',
                      }}>{i}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[12px]" style={{ color: 'var(--text)' }}>Reduced Motion</span>
                  <p className="text-[9px]" style={{ color: 'var(--ghost)' }}>Minimize animations</p>
                </div>
                <Toggle on={settings.reducedMotion} onToggle={() => {
                  update('reducedMotion', !settings.reducedMotion);
                  setReducedMotion(!settings.reducedMotion);
                  showSaved();
                }} />
              </div>
            </div>
          </Panel>
        </motion.div>

        {/* Behavior */}
        <motion.div variants={staggerItem}>
          <Panel>
            <PanelHeader><PanelTitle icon={<Activity className="w-3.5 h-3.5" />}>Behavior</PanelTitle></PanelHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[12px]" style={{ color: 'var(--text)' }}>Cat Reactivity</span>
                  <p className="text-[9px]" style={{ color: 'var(--ghost)' }}>How expressive the cat responds</p>
                </div>
                <div className="flex gap-[2px] rounded p-[2px]" style={{ background: 'var(--bg2)', border: '1px solid var(--stroke2)' }}>
                  {(['low', 'normal', 'high'] as const).map(v => (
                    <button key={v} onClick={() => { update('catReactivity', v); setReactivity(v); showSaved(); }}
                      className="px-2 py-0.5 rounded text-[9px] capitalize"
                      style={{
                        background: settings.catReactivity === v ? 'var(--surface)' : 'transparent',
                        color: settings.catReactivity === v ? 'var(--text)' : 'var(--muted)',
                        border: settings.catReactivity === v ? '1px solid var(--stroke)' : '1px solid transparent',
                      }}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[12px]" style={{ color: 'var(--text)' }}>Show Tooltips</span>
                  <p className="text-[9px]" style={{ color: 'var(--ghost)' }}>Hover hints on UI elements</p>
                </div>
                <Toggle on={settings.showTooltips} onToggle={() => {
                  update('showTooltips', !settings.showTooltips);
                  showSaved();
                }} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[12px]" style={{ color: 'var(--text)' }}>Notifications</span>
                  <p className="text-[9px]" style={{ color: 'var(--ghost)' }}>Alert sounds and popups</p>
                </div>
                <Toggle on={settings.notifications} onToggle={() => {
                  update('notifications', !settings.notifications);
                  showSaved();
                }} />
              </div>
            </div>
          </Panel>
        </motion.div>

        {/* Privacy & Data */}
        <motion.div variants={staggerItem}>
          <Panel>
            <PanelHeader><PanelTitle icon={<Shield className="w-3.5 h-3.5" />}>Privacy & Data</PanelTitle></PanelHeader>
            <p className="text-[11px] mb-3" style={{ color: 'var(--text2)' }}>
              Only public on-chain data. No private keys ever.
            </p>
            <div className="flex flex-wrap gap-2">
              <motion.button
                onClick={() => { const t = useAppStore.getState().trades; downloadFile(exportTradesCSV(t), 'psych-trades.csv', 'text/csv'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium"
                style={{ background: 'var(--surface2)', border: '1px solid var(--stroke)', color: 'var(--text2)' }} {...press}>
                <FileSpreadsheet className="w-3 h-3" /> Export CSV
              </motion.button>
              <motion.button
                onClick={() => { const t = useAppStore.getState().trades; downloadFile(exportBehaviorJSON(t), 'psych-behavior.json', 'application/json'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium"
                style={{ background: 'var(--surface2)', border: '1px solid var(--stroke)', color: 'var(--text2)' }} {...press}>
                <FileJson className="w-3 h-3" /> Export JSON
              </motion.button>
            </div>

            {/* Danger zone */}
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--stroke2)' }}>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  onClick={() => { resetToDefaults(); showSaved(); trigger({ type: 'custom', emotion: 'neutral', duration: 1000 }); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-medium"
                  style={{ background: 'var(--surface2)', border: '1px solid var(--stroke)', color: 'var(--muted)' }} {...press}>
                  <RotateCcw className="w-3 h-3" /> Reset Defaults
                </motion.button>

                {showDel ? (
                  <>
                    <motion.button onClick={() => { reset(); trigger({ type: 'custom', emotion: 'sad', duration: 3000 }); setShowDel(false); }}
                      className="px-3 py-1.5 rounded text-[10px] font-medium" style={{ background: 'var(--accent)', color: '#fff' }} {...press}>
                      Confirm Delete
                    </motion.button>
                    <motion.button onClick={() => setShowDel(false)} className="px-3 py-1.5 text-[10px]" style={{ color: 'var(--muted)' }} {...press}>
                      Cancel
                    </motion.button>
                  </>
                ) : (
                  <motion.button onClick={() => setShowDel(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px]"
                    style={{ color: 'var(--muted)' }} {...press}>
                    <Trash2 className="w-3 h-3" /> Delete All Data
                  </motion.button>
                )}
              </div>
            </div>
          </Panel>
        </motion.div>

        {/* Sync info */}
        {lastSyncAt && (
          <motion.div variants={staggerItem}>
            <Panel>
              <div className="text-[10px]" style={{ color: 'var(--ghost)' }}>
                Last synced: {new Date(lastSyncAt).toLocaleString()}
              </div>
            </Panel>
          </motion.div>
        )}

        <motion.div variants={staggerItem} className="text-center text-[8px] pb-8" style={{ color: 'var(--ghost)' }}>
          psych v0.1.0 — Not financial advice.
        </motion.div>
      </motion.div>
    </AppShell>
  );
}

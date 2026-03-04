'use client';

/**
 * CatEmotionProvider: React context providing the cat's emotional state,
 * trigger functions, and resolved asset references to the component tree.
 *
 * Loads assets on mount, preloads them, and exposes the full AssetMap
 * for the inspector dev panel.
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { CatStateMachine, type EmotionTrigger } from './CatStateMachine';
import {
  loadCatAssets, preloadAssets, getAssetForEmotion,
  type AssetMap, type CatAssetWithTalk,
} from './CatAssetLoader';
import type { CatState, CatEmotion } from '@/types';

interface CatEmotionContextValue {
  state: CatState;
  trigger: (event: EmotionTrigger) => void;
  getAsset: (emotion?: CatEmotion) => CatAssetWithTalk | null;
  hasRealAssets: boolean;
  isLoaded: boolean;
  assetMap: AssetMap | null;
  reloadAssets: () => void;
  setReducedMotion: (reduced: boolean) => void;
  setReactivity: (level: 'low' | 'normal' | 'high') => void;
}

const CatEmotionContext = createContext<CatEmotionContextValue | null>(null);

export function CatEmotionProvider({ children }: { children: React.ReactNode }) {
  const machineRef = useRef<CatStateMachine>(new CatStateMachine('idle'));
  const [state, setState] = useState<CatState>(machineRef.current.getState());
  const [assetMap, setAssetMap] = useState<AssetMap | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const doLoad = useCallback(async () => {
    setIsLoaded(false);
    const map = await loadCatAssets();
    setAssetMap(map);
    if (map.hasRealAssets) {
      await preloadAssets(map);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    const machine = machineRef.current;
    const unsubscribe = machine.subscribe(setState);
    doLoad();
    return () => {
      unsubscribe();
      machine.destroy();
    };
  }, [doLoad]);

  const trigger = useCallback((event: EmotionTrigger) => {
    machineRef.current.trigger(event);
  }, []);

  const getAsset = useCallback((emotion?: CatEmotion): CatAssetWithTalk | null => {
    if (!assetMap) return null;
    return getAssetForEmotion(assetMap, emotion ?? state.emotion);
  }, [assetMap, state.emotion]);

  const setReducedMotion = useCallback((reduced: boolean) => {
    machineRef.current.setReducedMotion(reduced);
  }, []);

  const setReactivity = useCallback((level: 'low' | 'normal' | 'high') => {
    machineRef.current.setReactivity(level);
  }, []);

  return (
    <CatEmotionContext.Provider
      value={{
        state,
        trigger,
        getAsset,
        hasRealAssets: assetMap?.hasRealAssets ?? false,
        isLoaded,
        assetMap,
        reloadAssets: doLoad,
        setReducedMotion,
        setReactivity,
      }}
    >
      {children}
    </CatEmotionContext.Provider>
  );
}

export function useCatEmotion(): CatEmotionContextValue {
  const context = useContext(CatEmotionContext);
  if (!context) {
    throw new Error('useCatEmotion must be used within a CatEmotionProvider');
  }
  return context;
}

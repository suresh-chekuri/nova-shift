// Small shared state for the custom Moon, so Settings can say whether it loaded.
import { create } from 'zustand';

export type MoonStatus = 'loading' | 'model' | 'fallback';
export const useScenery = create<{ moon: MoonStatus; note: string }>(() => ({ moon: 'loading', note: '' }));
export const setMoonStatus = (moon: MoonStatus, note = '') => useScenery.setState({ moon, note });

/** Where the custom Moon model must be placed. */
export const MOON_URL = import.meta.env.BASE_URL + 'models/moon.glb';

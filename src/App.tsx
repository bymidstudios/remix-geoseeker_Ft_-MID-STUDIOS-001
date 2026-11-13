/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import GameMap from './components/GameMap';
import GameSidebar from './components/GameSidebar';
import PanoramaStudio from './components/PanoramaStudio';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Compass, Globe, MapPin } from 'lucide-react';
import { HIDER_CHARACTER_AVATAR_URL, HIDER_PERSONA } from './constants';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function AppWorkspace() {
  const [activeTab, setActiveTab] = useState<'studio' | 'game'>('studio');
  const [studioSceneId, setStudioSceneId] = useState<string | null>(null);
  const { launchSceneRound } = useGame();

  const handleLaunchSceneInGame = async (sceneId: string) => {
    setStudioSceneId(sceneId);
    setActiveTab('game');
    await launchSceneRound(sceneId);
  };

  const handleOpenStudioWithScene = (sceneId?: string | null) => {
    if (sceneId) {
      setStudioSceneId(sceneId);
    }
    setActiveTab('studio');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
      {/* Top Navigation Bar (Light Slate & Blue Theme) */}
      <header className="h-14 bg-white border-b border-slate-200 px-5 flex items-center justify-between flex-shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <img
            src={HIDER_CHARACTER_AVATAR_URL}
            alt={HIDER_PERSONA.name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-600"
          />
          <div>
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">
              MID-STUDIOS
            </span>
            <span className="hidden sm:inline text-xs text-slate-400 mx-2">·</span>
            <span className="hidden sm:inline text-xs font-medium text-slate-500">
              360° Equirectangular Panorama Studio & GeoSeeker
            </span>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>360° Panorama Studio (All 10 Scenes)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('game')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'game'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>GeoSeeker Game</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Compass className="w-4 h-4 text-blue-600" />
          <span>2:1 Aspect Ratio · 360° × 180° FOV</span>
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === 'studio' ? (
        <PanoramaStudio
          initialSceneId={studioSceneId}
          onLaunchInGeoSeeker={handleLaunchSceneInGame}
        />
      ) : (
        <div className="flex flex-1 min-h-0 w-full overflow-hidden">
          {/* Sidebar */}
          <div className="w-[400px] h-full flex-shrink-0 z-20 shadow-2xl shadow-slate-300/50 bg-white">
            <GameSidebar onOpenStudio={handleOpenStudioWithScene} />
          </div>

          {/* Main Map Area */}
          <div className="flex-1 h-full relative p-4 bg-slate-100/50">
            <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-slate-200/60 bg-white relative">
              <GameMap />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 overflow-hidden">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <GameProvider>
        <APIProvider apiKey={API_KEY}>
          <AppWorkspace />
        </APIProvider>
      </GameProvider>
    </div>
  );
}

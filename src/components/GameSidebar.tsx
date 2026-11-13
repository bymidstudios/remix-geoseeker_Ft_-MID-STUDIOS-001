/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useGame } from '../context/GameContext';
import {
  Trophy,
  MapPin,
  RefreshCw,
  Eye,
  Target,
  Compass,
  Globe,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'motion/react';
import StreetView from './StreetView';
import {
  ZONES,
  MID_STUDIOS_LOGO_URL,
  HIDER_CHARACTER_AVATAR_URL,
  HIDER_PERSONA,
  REFERENCE_SCENES,
} from '../constants';

const ADJECTIVES = [
  'Sneaky',
  'Hidden',
  'Clever',
  'Swift',
  'Silent',
  'Shadowy',
  'Mystic',
  'Brave',
  'Wandering',
  'Curious',
];
const NOUNS = [
  'Fox',
  'Falcon',
  'Owl',
  'Seeker',
  'Hunter',
  'Panther',
  'Raven',
  'Leopard',
  'Voyager',
];

function generateName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

const EMOJIS = ['🙈', '🥶', '🔥', '🏃💨', '👀', '🤫'];

interface GameSidebarProps {
  onOpenStudio?: (sceneId?: string | null) => void;
}

export default function GameSidebar({ onOpenStudio }: GameSidebarProps) {
  const {
    gameState,
    playerId,
    hasJoined,
    joinGame,
    startGame,
    resetGame,
    setZone,
    sendReaction,
  } = useGame();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const generatedName = generateName();
    await joinGame(generatedName);
  };

  const currentPlayer = gameState?.players[playerId || ''];
  const guesses = currentPlayer?.guesses || [];
  const bestDistance =
    currentPlayer && Number.isFinite(currentPlayer.score) ? currentPlayer.score : null;

  const hiderName = gameState?.hiderId
    ? gameState.players[gameState.hiderId]?.name || HIDER_PERSONA.name
    : HIDER_PERSONA.name;

  const activeScene = gameState?.activeSceneId
    ? REFERENCE_SCENES.find((s) => s.id === gameState.activeSceneId) || null
    : null;

  const showStreetView =
    gameState?.hiderLocation &&
    (gameState.status === 'seeking' || gameState.status === 'finished');

  return (
    <div className="h-full flex flex-col bg-slate-50 border-r border-slate-200">
      {/* Header */}
      <div className="p-5 border-b border-slate-200/60 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center gap-2 font-display">
            <MapPin className="text-blue-600 w-7 h-7" />
            GeoSeeker
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Round {gameState?.round || 1} · vs {HIDER_PERSONA.shortName}
          </p>
        </div>
        {onOpenStudio && (
          <button
            type="button"
            onClick={() => onOpenStudio(gameState?.activeSceneId)}
            className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>360° Studio</span>
          </button>
        )}
      </div>

      {/* Game Status Banner */}
      {gameState && gameState.status !== 'waiting' && (
        <div
          className={`px-5 py-4 text-white shadow-inner transition-colors duration-500
          ${gameState?.status === 'hiding' ? 'bg-amber-500' : ''}
          ${gameState?.status === 'seeking' ? 'bg-blue-600' : ''}
          ${gameState?.status === 'finished' ? 'bg-emerald-600' : ''}
        `}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <img
                src={HIDER_CHARACTER_AVATAR_URL}
                alt={hiderName}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/90 shadow-md flex-shrink-0"
              />
              <div>
                {gameState?.status === 'hiding' && (
                  <div className="leading-tight text-sm font-bold flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-white" />
                    <span>{hiderName} is choosing a 360° spot...</span>
                  </div>
                )}
                {gameState?.status === 'seeking' && (
                  <div>
                    <div className="leading-tight text-sm font-bold">
                      Find {hiderName}! ({3 - guesses.length} guesses left)
                    </div>
                    <div className="text-[11px] text-blue-100">
                      Click the map to place up to 3 guesses
                    </div>
                  </div>
                )}
                {gameState?.status === 'finished' && (
                  <div className="leading-tight text-sm font-bold flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-white" />
                    <span>Round Complete! Location Revealed</span>
                  </div>
                )}
              </div>
            </div>
            {gameState?.zoneId && (
              <div className="flex items-center gap-1.5 text-xs bg-slate-900/25 px-3 py-1.5 rounded-2xl flex-shrink-0">
                <Globe className="w-3.5 h-3.5 text-white" />
                <span className="font-bold">
                  {ZONES[gameState.zoneId as keyof typeof ZONES]?.name.split(' (')[0] || 'Global'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
        {/* Join Card with MID-STUDIOS Intro Splash Header & Hider Character Persona */}
        {!hasJoined && (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleJoin}
            className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden"
          >
            {/* MID-STUDIOS Intro Splash Header */}
            <div className="relative h-32 w-full bg-slate-950">
              <img
                src={MID_STUDIOS_LOGO_URL}
                alt="MID-STUDIOS FOR VISUALIZATION IMAGINATION"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
              {/* Overlapping Hider Character Avatar */}
              <div className="absolute -bottom-7 left-5 flex items-end gap-3">
                <img
                  src={HIDER_CHARACTER_AVATAR_URL}
                  alt={HIDER_PERSONA.name}
                  className="w-16 h-16 rounded-full object-cover ring-4 ring-white shadow-lg bg-slate-900"
                />
              </div>
            </div>

            <div className="pt-9 px-6 pb-6">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md mb-2">
                <Sparkles className="w-3 h-3" />
                <span>Featured Hider Persona</span>
              </div>
              <h3 className="font-bold text-slate-900 font-display text-xl">
                Play vs {HIDER_PERSONA.name}
              </h3>
              <p className="text-sm text-slate-500 mt-1 mb-5 leading-relaxed">
                Explore seamless 360°×180° equirectangular coastal realms and global Street View
                locations to track down where {HIDER_PERSONA.shortName} is hiding!
              </p>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Target className="w-5 h-5" />
                <span>Join as Seeker</span>
              </button>
            </div>
          </motion.form>
        )}

        {/* Opponent & Player Role Card */}
        {hasJoined && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Hider Opponent
              </span>
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                MID-STUDIOS
              </span>
            </div>
            <div className="flex items-center gap-3.5">
              <img
                src={HIDER_CHARACTER_AVATAR_URL}
                alt={HIDER_PERSONA.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-600 shadow-sm"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 text-base truncate">
                  {HIDER_PERSONA.name}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  Hiding across {REFERENCE_SCENES.length} 360° Coastal Realms & Global Maps
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Zone Selector & Start Game Button */}
        {hasJoined &&
          gameState?.status === 'waiting' &&
          Object.keys(gameState?.players || {}).length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>Select Game Zone</span>
                </label>
                <select
                  value={gameState.zoneId || 'coastal_360'}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 font-medium text-sm text-slate-800"
                >
                  {Object.values(ZONES).map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => startGame()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-base cursor-pointer"
              >
                <Target className="w-5 h-5" />
                <span>Start Hiding Round</span>
              </button>
            </motion.div>
          )}

        {/* 360° Panorama / Street View Clue */}
        {showStreetView && gameState.hiderLocation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Compass className="w-4 h-4 text-blue-600" />
                <span>Hider&apos;s 360° View Clue</span>
              </h3>
              {activeScene && onOpenStudio && (
                <button
                  type="button"
                  onClick={() => onOpenStudio(activeScene.id)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  title="Inspect this 360° Panorama in the Studio"
                >
                  <span>Open in Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="h-72 w-full relative">
              <StreetView
                location={gameState.hiderLocation}
                sceneId={gameState.activeSceneId}
              />
            </div>
          </motion.div>
        )}

        {/* Seeker Guesses & Distance Tracker */}
        {hasJoined && gameState && gameState.status !== 'waiting' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-blue-600" />
                <span>Seeker Attempts ({guesses.length} / 3)</span>
              </span>
              {bestDistance !== null && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  Best:{' '}
                  {bestDistance < 1
                    ? `${Math.round(bestDistance * 1000)} m`
                    : `${bestDistance.toFixed(1)} km`}
                </span>
              )}
            </div>

            {guesses.length === 0 ? (
              <p className="text-xs text-slate-500">
                Click anywhere on the map to place your first guess and receive a directional
                compass clue!
              </p>
            ) : (
              <div className="space-y-1.5">
                {guesses.map((g, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70"
                  >
                    <span className="font-semibold text-slate-700">Guess #{idx + 1}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {g.distance < 1
                        ? `${Math.round(g.distance * 1000)} m away`
                        : `${g.distance.toFixed(1)} km away`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Round Finished Reveal Summary */}
            {gameState.status === 'finished' && activeScene && (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                  Revealed Hiding Spot
                </div>
                <div className="text-xs font-bold text-slate-900 mt-0.5">
                  {activeScene.title} — {activeScene.regionName}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Emoji Reactions */}
        {hasJoined && gameState && gameState.status !== 'waiting' && (
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Send Reaction
            </div>
            <div className="flex items-center justify-between gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => sendReaction(emoji)}
                  className="flex-1 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/60 hover:border-blue-200 text-lg transition active:scale-90 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-5 border-t border-slate-200 bg-white">
        {gameState?.status === 'finished' ? (
          <button
            type="button"
            onClick={resetGame}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Play Next Round</span>
          </button>
        ) : (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>MID-STUDIOS GeoSeeker</span>
            <span>360° Equirectangular Engine</span>
          </div>
        )}
      </div>
    </div>
  );
}

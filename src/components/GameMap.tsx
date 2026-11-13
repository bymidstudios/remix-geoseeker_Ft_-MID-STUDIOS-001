/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Map, MapMouseEvent, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';
import { useGame } from '../context/GameContext';
import { Navigation } from 'lucide-react';
import { ZONES, HIDER_CHARACTER_AVATAR_URL, HIDER_PERSONA } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import CompassFeedback from './CompassFeedback';
import { Player } from '../types';

function getPulseColor(distance: number) {
  if (distance < 50) return 'rgba(239, 68, 68, 0.6)'; // Red
  if (distance < 500) return 'rgba(249, 115, 22, 0.6)'; // Orange
  if (distance < 2000) return 'rgba(234, 179, 8, 0.6)'; // Yellow
  return 'rgba(59, 130, 246, 0.6)'; // Blue
}

export default function GameMap() {
  const { gameState, playerId, makeGuess, lastGuessResult, reactions, geminiMessages } = useGame();
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const map = useMap();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [geminiMessages]);

  // Reset selected location when game state changes significantly
  useEffect(() => {
    if (gameState?.status === 'waiting') {
      setSelectedLocation(null);
    }
  }, [gameState?.status]);

  const currentZone = gameState?.zoneId
    ? ZONES[gameState.zoneId as keyof typeof ZONES] || ZONES.coastal_360
    : ZONES.coastal_360;

  useEffect(() => {
    if (map && currentZone) {
      map.setCenter(currentZone.center);
      map.setZoom(currentZone.zoom);
    }
  }, [map, currentZone]);

  const handleMapClick = (e: MapMouseEvent) => {
    if (!e.detail.latLng) return;

    const latLng = e.detail.latLng as any;
    const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
    const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;

    const location = { lat, lng };
    setSelectedLocation(location);
  };

  const handleConfirmAction = () => {
    if (!selectedLocation) return;

    if (gameState?.status === 'seeking') {
      if (gameState.hiderId !== playerId) {
        makeGuess(selectedLocation);
        setSelectedLocation(null);
      }
    }
  };

  const currentPlayer = gameState?.players[playerId || ''];
  const canInteract =
    gameState?.status === 'seeking' &&
    (!currentPlayer?.guesses || currentPlayer.guesses.length < 3);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl border border-slate-200">
      <Map
        style={{ width: '100%', height: '100%' }}
        defaultCenter={currentZone.center}
        defaultZoom={currentZone.zoom}
        gestureHandling={'greedy'}
        disableDefaultUI={false}
        onClick={canInteract ? handleMapClick : undefined}
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        restriction={
          currentZone.bounds
            ? { latLngBounds: currentZone.bounds, strictBounds: false }
            : undefined
        }
      >
        {/* Show selected location pending confirmation */}
        {selectedLocation && (
          <AdvancedMarker position={selectedLocation}>
            <Pin background={'#2563EB'} borderColor={'#1E3A8A'} glyphColor={'white'} />
          </AdvancedMarker>
        )}

        {/* Show guesses for the current player (or all guesses if game is finished) */}
        {(Object.values(gameState?.players || {}) as Player[]).map((player) => {
          if (player.id !== playerId && gameState?.status !== 'finished') return null;

          return (player.guesses || []).map((guess, idx) => (
            <AdvancedMarker key={`${player.id}-guess-${idx}`} position={guess}>
              <div className="relative group flex items-center justify-center">
                {/* Pulse Effect */}
                <div
                  className="absolute w-12 h-12 rounded-full animate-ping"
                  style={{ backgroundColor: getPulseColor(guess.distance) }}
                />
                <Pin
                  background={'#EF4444'}
                  borderColor={'#7F1D1D'}
                  glyphColor={'white'}
                  scale={0.85}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900/90 text-white text-xs px-2.5 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow">
                  <div className="font-bold">{player.name}</div>
                  {guess.distance < 1
                    ? `${Math.round(guess.distance * 1000)} m`
                    : `${Math.round(guess.distance)} km`}
                </div>
              </div>
            </AdvancedMarker>
          ));
        })}

        {/* Show actual hider location with Character Avatar Marker when game is finished */}
        {gameState?.status === 'finished' && gameState.hiderLocation && (
          <AdvancedMarker position={gameState.hiderLocation}>
            <div className="flex flex-col items-center animate-bounce">
              <div className="bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-md shadow mb-1 whitespace-nowrap">
                {HIDER_PERSONA.name}
              </div>
              <div className="w-12 h-12 rounded-full p-0.5 bg-emerald-500 shadow-xl ring-4 ring-white overflow-hidden">
                <img
                  src={HIDER_CHARACTER_AVATAR_URL}
                  alt={HIDER_PERSONA.name}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>
          </AdvancedMarker>
        )}
      </Map>

      {/* Floating Emojis Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
        <AnimatePresence>
          {reactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ opacity: 1, y: '100vh', x: `${reaction.x}vw`, scale: 0.5 }}
              animate={{ opacity: 0, y: '-20vh', scale: 2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3, ease: 'easeOut' }}
              className="absolute text-6xl drop-shadow-lg"
            >
              {reaction.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirm Guess Overlay */}
      {selectedLocation && canInteract && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={handleConfirmAction}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl shadow-lg transform transition hover:scale-105 flex items-center gap-2 cursor-pointer"
          >
            <Navigation className="w-5 h-5" />
            <span>Confirm Guess Location</span>
          </button>
        </div>
      )}

      {/* Last Guess Feedback Overlay */}
      {lastGuessResult && gameState?.status === 'seeking' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-lg border border-slate-200 z-10 animate-in fade-in slide-in-from-top-4">
          <CompassFeedback
            distance={lastGuessResult.distance}
            bearing={lastGuessResult.bearing}
          />
        </div>
      )}

      {/* Hider Character Clues Chat Overlay */}
      {geminiMessages.length > 0 && (
        <div className="absolute bottom-6 left-6 w-84 max-h-68 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 z-10 flex flex-col overflow-hidden pointer-events-auto">
          <div className="bg-blue-600 px-4 py-2.5 flex items-center gap-2.5 text-white shadow-sm">
            <img
              src={HIDER_CHARACTER_AVATAR_URL}
              alt={HIDER_PERSONA.name}
              className="w-7 h-7 rounded-full object-cover ring-2 ring-white/80"
            />
            <div className="min-w-0">
              <div className="font-bold text-xs truncate">{HIDER_PERSONA.name}</div>
              <div className="text-[10px] text-blue-100 truncate">MID-STUDIOS Hider Clues</div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {geminiMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl text-xs leading-relaxed ${
                  msg.type === 'hint'
                    ? 'bg-amber-50 border border-amber-100 text-amber-950'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-amber-700">
                  {msg.type === 'hint' ? 'Hider Clue' : 'Reasoning'}
                </div>
                {msg.text}
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

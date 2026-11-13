/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { GameState, Reaction, Player } from '../types';
import { geminiHide, geminiProvideHint } from '../services/geminiService';
import { HIDER_PERSONA } from '../constants';

export interface GeminiMessage {
  id: string;
  text: string;
  type: 'hint' | 'reasoning';
}

interface GameContextType {
  gameState: GameState | null;
  isConnected: boolean;
  playerId: string | null;
  hasJoined: boolean;
  joinGame: (name: string) => Promise<boolean>;
  startGame: (preferredSceneId?: string) => Promise<void>;
  launchSceneRound: (sceneId: string) => Promise<void>;
  setZone: (zoneId: string) => void;
  sendReaction: (emoji: string) => void;
  makeGuess: (location: { lat: number; lng: number }) => void;
  resetGame: () => void;
  lastGuessResult: { distance: number; location: { lat: number; lng: number }; bearing: number } | null;
  reactions: Reaction[];
  geminiMessages: GeminiMessage[];
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// Helper: Calculate Distance (Haversine)
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// Helper: Calculate Bearing
function getBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLon = deg2rad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(deg2rad(lat2));
  const x =
    Math.cos(deg2rad(lat1)) * Math.sin(deg2rad(lat2)) -
    Math.sin(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  return ((brng * 180) / Math.PI + 360) % 360;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [lastGuessResult, setLastGuessResult] = useState<{
    distance: number;
    location: { lat: number; lng: number };
    bearing: number;
  } | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [geminiMessages, setGeminiMessages] = useState<GeminiMessage[]>([]);

  useEffect(() => {
    let storedId = sessionStorage.getItem('geoseeker_player_id');
    if (!storedId) {
      storedId = 'player_' + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('geoseeker_player_id', storedId);
    }
    setPlayerId(storedId);
    setIsConnected(true);
  }, []);

  const joinGame = async (name: string): Promise<boolean> => {
    const activePlayerId = playerId || 'player_local';
    const hiderId = HIDER_PERSONA.id;

    const newPlayer: Player = {
      id: activePlayerId,
      name: name || `Seeker ${activePlayerId.slice(0, 4)}`,
      role: 'seeker',
      guesses: [],
      score: Infinity,
    };

    const hiderPlayer: Player = {
      id: hiderId,
      name: HIDER_PERSONA.name,
      avatarUrl: HIDER_PERSONA.avatarUrl,
      role: 'hider',
      guesses: [],
      score: Infinity,
    };

    setGameState({
      roomId: 'local_game',
      status: 'waiting',
      hiderId,
      hiderLocation: null,
      activeSceneId: null,
      players: {
        [activePlayerId]: newPlayer,
        [hiderId]: hiderPlayer,
      },
      round: 1,
      zoneId: 'coastal_360',
    });

    setGeminiMessages([]);
    setHasJoined(true);
    return true;
  };

  const startGame = async (preferredSceneId?: string) => {
    if (!gameState) return;
    if (gameState.status !== 'waiting') return;

    setGameState((prev) => (prev ? { ...prev, status: 'hiding' } : null));

    const result = await geminiHide(gameState.zoneId, preferredSceneId);
    setGameState((prev) =>
      prev
        ? {
            ...prev,
            hiderLocation: { lat: result.lat, lng: result.lng },
            activeSceneId: result.sceneId || null,
            status: 'seeking',
          }
        : null
    );
    setGeminiMessages([{ id: Date.now().toString(), text: result.message, type: 'hint' }]);
  };

  const launchSceneRound = async (sceneId: string) => {
    const activePlayerId = playerId || 'player_local';
    const hiderId = HIDER_PERSONA.id;

    const seekerPlayer: Player = {
      id: activePlayerId,
      name: gameState?.players[activePlayerId]?.name || 'Curious Seeker',
      role: 'seeker',
      guesses: [],
      score: Infinity,
    };

    const hiderPlayer: Player = {
      id: hiderId,
      name: HIDER_PERSONA.name,
      avatarUrl: HIDER_PERSONA.avatarUrl,
      role: 'hider',
      guesses: [],
      score: Infinity,
    };

    setHasJoined(true);
    setLastGuessResult(null);
    setGameState({
      roomId: 'local_game',
      status: 'hiding',
      hiderId,
      hiderLocation: null,
      activeSceneId: sceneId,
      players: {
        [activePlayerId]: seekerPlayer,
        [hiderId]: hiderPlayer,
      },
      round: (gameState?.round || 0) + 1,
      zoneId: 'coastal_360',
    });

    const result = await geminiHide('coastal_360', sceneId);
    setGameState((prev) =>
      prev
        ? {
            ...prev,
            hiderLocation: { lat: result.lat, lng: result.lng },
            activeSceneId: result.sceneId || sceneId,
            status: 'seeking',
          }
        : null
    );
    setGeminiMessages([{ id: Date.now().toString(), text: result.message, type: 'hint' }]);
  };

  const setZone = async (zoneId: string) => {
    if (!gameState) return;
    if (gameState.status !== 'waiting') return;

    setGameState((prev) => (prev ? { ...prev, zoneId } : null));
  };

  const sendReaction = async (emoji: string) => {
    const reaction: Reaction = {
      id: Math.random().toString(36).substring(2, 11),
      emoji,
      timestamp: Date.now(),
      x: Math.random() * 80 + 10,
    };

    setReactions((prev) => [...prev, reaction]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
    }, 3000);
  };

  const makeGuess = async (location: { lat: number; lng: number }) => {
    if (!gameState || !playerId) return;
    if (gameState.status !== 'seeking') return;
    if (gameState.players[playerId]?.role === 'hider') return;
    if (!gameState.hiderLocation) return;

    const player = gameState.players[playerId];
    if (!player) return;

    if ((player.guesses || []).length >= 3) return;

    const distance = getDistanceFromLatLonInKm(
      location.lat,
      location.lng,
      gameState.hiderLocation.lat,
      gameState.hiderLocation.lng
    );

    const bearing = getBearing(
      location.lat,
      location.lng,
      gameState.hiderLocation.lat,
      gameState.hiderLocation.lng
    );

    const newGuess = { ...location, distance };
    const newScore = Math.min(player.score ?? Infinity, distance);
    const newGuesses = [...(player.guesses || []), newGuess];

    setGameState((prev) => {
      if (!prev) return null;

      let newStatus = prev.status;
      if (distance < 0.05 || newGuesses.length >= 3) {
        newStatus = 'finished';
      }

      return {
        ...prev,
        status: newStatus,
        players: {
          ...prev.players,
          [playerId]: {
            ...player,
            guesses: newGuesses,
            score: newScore,
          },
        },
      };
    });

    setLastGuessResult({ distance, location, bearing });

    // Provide hint if game is not finished
    if (distance >= 0.05 && newGuesses.length < 3) {
      const hint = await geminiProvideHint(
        gameState.zoneId,
        gameState.hiderLocation,
        newGuesses,
        gameState.activeSceneId
      );
      setGeminiMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), text: hint, type: 'hint' },
      ]);
    }
  };

  const resetGame = async () => {
    if (!gameState) return;

    const playerIds = Object.keys(gameState.players);
    const nextHiderId = HIDER_PERSONA.id;

    setGameState((prev) => {
      if (!prev) return null;

      const newPlayers = { ...prev.players };
      playerIds.forEach((id) => {
        newPlayers[id] = {
          ...newPlayers[id],
          role: id === nextHiderId ? 'hider' : 'seeker',
          guesses: [],
          score: Infinity,
        };
      });

      return {
        ...prev,
        status: 'waiting',
        hiderLocation: null,
        activeSceneId: null,
        round: prev.round + 1,
        hiderId: nextHiderId,
        players: newPlayers,
      };
    });

    setLastGuessResult(null);
  };

  return (
    <GameContext.Provider
      value={{
        gameState,
        isConnected,
        playerId,
        hasJoined,
        joinGame,
        startGame,
        launchSceneRound,
        setZone,
        sendReaction,
        makeGuess,
        resetGame,
        lastGuessResult,
        reactions,
        geminiMessages,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

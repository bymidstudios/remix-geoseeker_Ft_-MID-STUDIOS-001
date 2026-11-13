/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Player {
  id: string;
  name: string;
  avatarUrl?: string;
  role: 'hider' | 'seeker' | 'spectator';
  guesses: { lat: number; lng: number; distance: number }[];
  score: number;
}

export interface GameState {
  roomId: string;
  status: 'waiting' | 'hiding' | 'seeking' | 'finished';
  hiderId: string | null;
  hiderLocation: { lat: number; lng: number } | null;
  activeSceneId?: string | null;
  players: Record<string, Player>;
  round: number;
  zoneId: string;
}

export interface Reaction {
  id: string;
  emoji: string;
  timestamp: number;
  x: number;
}

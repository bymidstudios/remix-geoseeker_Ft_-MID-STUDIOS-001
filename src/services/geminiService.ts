/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ZONES, REFERENCE_SCENES } from '../constants';

export async function geminiHide(
  zoneId: string,
  preferredSceneId?: string
): Promise<{ lat: number; lng: number; message: string; sceneId?: string | null }> {
  const zone = ZONES[zoneId as keyof typeof ZONES] || ZONES.global;

  // If a specific coastal 360 scene was requested, or if we are in the coastal_360 zone,
  // pick from the 10 MID-STUDIOS reference scenes and ask the server for a persona hint.
  const matchedScene = preferredSceneId
    ? REFERENCE_SCENES.find((s) => s.id === preferredSceneId)
    : zoneId === 'coastal_360'
    ? REFERENCE_SCENES[Math.floor(Math.random() * REFERENCE_SCENES.length)]
    : null;

  try {
    const response = await fetch('/api/hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zoneId,
        sceneId: matchedScene?.id || null,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        return {
          lat: data.lat,
          lng: data.lng,
          message:
            data.message ||
            matchedScene?.hint ||
            "I'm hiding somewhere in this zone! Use the 360° view to find me!",
          sceneId: data.sceneId ?? matchedScene?.id ?? null,
        };
      }
    }
  } catch (error) {
    console.error('Error getting hiding spot from server:', error);
  }

  if (matchedScene) {
    return {
      lat: matchedScene.lat,
      lng: matchedScene.lng,
      message: matchedScene.hint,
      sceneId: matchedScene.id,
    };
  }

  // Fallback to center of zone if server call fails
  return {
    ...zone.center,
    message: "I'm hiding somewhere in this zone! Come find me!",
    sceneId: null,
  };
}

export async function geminiProvideHint(
  zoneId: string,
  hiderLocation: { lat: number; lng: number },
  previousGuesses: { lat: number; lng: number; distance: number; bearing?: number }[],
  sceneId?: string | null
): Promise<string> {
  try {
    const response = await fetch('/api/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zoneId, hiderLocation, previousGuesses, sceneId }),
    });
    if (response.ok) {
      const data = await response.json();
      if (data?.hint) {
        return data.hint;
      }
    }
  } catch (error) {
    console.error('Error getting hint from server:', error);
  }

  return "Look closely at the coastal mountains and the horizon line in the 360° panorama!";
}

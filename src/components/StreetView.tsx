/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { EyeOff, Globe, MapPin, X } from 'lucide-react';
import { REFERENCE_SCENES } from '../constants';
import PanoramaViewer360 from './PanoramaViewer360';

interface StreetViewProps {
  location: { lat: number; lng: number };
  sceneId?: string | null;
}

export default function StreetView({ location, sceneId }: StreetViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const streetViewLibrary = useMapsLibrary('streetView');
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const [hasStreetView, setHasStreetView] = useState<boolean | null>(null);
  const [sourceMode, setSourceMode] = useState<'custom360' | 'gmaps'>('custom360');
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState<boolean>(false);

  const matchedScene = sceneId
    ? REFERENCE_SCENES.find((s) => s.id === sceneId) || null
    : null;

  useEffect(() => {
    if (matchedScene) {
      setSourceMode('custom360');
    } else {
      setSourceMode('gmaps');
    }
  }, [matchedScene]);

  useEffect(() => {
    if (sourceMode !== 'gmaps') return;
    if (!containerRef.current || !streetViewLibrary) return;

    const svService = new streetViewLibrary.StreetViewService();
    setHasStreetView(null);

    const renderPanorama = (validLocation: google.maps.LatLng) => {
      setHasStreetView(true);
      if (!panoramaRef.current && containerRef.current) {
        panoramaRef.current = new streetViewLibrary.StreetViewPanorama(containerRef.current, {
          position: validLocation,
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          addressControl: false,
          showRoadLabels: false,
          linksControl: false,
          panControl: true,
          enableCloseButton: false,
          fullscreenControl: true,
          zoomControl: true,
        });
      } else if (panoramaRef.current) {
        panoramaRef.current.setPosition(validLocation);
      }
    };

    // Check for nearest panorama within 5000 meters first, fallback to 50000 meters
    svService.getPanorama({ location, radius: 5000 }, (data, status) => {
      if ((status as string) === 'OVER_QUERY_LIMIT') {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        setHasStreetView(false);
        return;
      }
      if (status === 'OK' && data?.location?.latLng) {
        renderPanorama(data.location.latLng);
      } else {
        svService.getPanorama({ location, radius: 50000 }, (fallbackData, fallbackStatus) => {
          if ((fallbackStatus as string) === 'OVER_QUERY_LIMIT') {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
            setHasStreetView(false);
            return;
          }
          if (fallbackStatus === 'OK' && fallbackData?.location?.latLng) {
            renderPanorama(fallbackData.location.latLng);
          } else {
            setHasStreetView(false);
          }
        });
      }
    });
  }, [location, streetViewLibrary, sourceMode]);

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {/* Toggle between MID-STUDIOS 360° Equirectangular Panorama & Nearby Google Street View */}
      {matchedScene && (
        <div className="flex items-center justify-between bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => setSourceMode('custom360')}
            className={`flex-1 py-1 px-2 rounded-md font-semibold flex items-center justify-center gap-1 transition ${
              sourceMode === 'custom360'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>360° Scene Clue</span>
          </button>
          <button
            type="button"
            onClick={() => {
              panoramaRef.current = null;
              setSourceMode('gmaps');
            }}
            className={`flex-1 py-1 px-2 rounded-md font-semibold flex items-center justify-center gap-1 transition ${
              sourceMode === 'gmaps'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Nearby Street View</span>
          </button>
        </div>
      )}

      {/* Active Panorama Area */}
      <div className="flex-1 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner relative min-h-[220px]">
        {matchedScene && sourceMode === 'custom360' ? (
          <PanoramaViewer360
            imageSrc={matchedScene.imageUrl}
            horizonRatio={matchedScene.horizonRatio}
            title={matchedScene.title}
            subtitle={matchedScene.timeOfDay}
            compact={true}
            onExpandRequest={() => setIsFullscreenModalOpen(true)}
          />
        ) : hasStreetView === false ? (
          <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-500 p-4 text-center">
            <EyeOff className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm font-medium">No Street View available near this location.</p>
          </div>
        ) : (
          <>
            <div ref={containerRef} className="w-full h-full" />
            {hasStreetView === null && (
              <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fullscreen 360° Modal for Deep Inspection during Gameplay */}
      {isFullscreenModalOpen && matchedScene && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex flex-col p-4 md:p-8">
          <div className="flex items-center justify-between mb-3 text-white">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <span>{matchedScene.title} — 360° × 180° Equirectangular Clue</span>
              </h3>
              <p className="text-xs text-slate-400">
                Drag to look 360° around the hiding spot or switch to 2:1 Flat Projection
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreenModalOpen(false)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
            >
              <X className="w-4 h-4" />
              <span>Close Fullscreen</span>
            </button>
          </div>
          <div className="flex-1 w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <PanoramaViewer360
              imageSrc={matchedScene.imageUrl}
              horizonRatio={matchedScene.horizonRatio}
              resolutionWidth={2048}
              title={matchedScene.title}
              subtitle={matchedScene.timeOfDay}
            />
          </div>
        </div>
      )}
    </div>
  );
}

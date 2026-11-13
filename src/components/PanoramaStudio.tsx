/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Map as GoogleMap, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import {
  CheckCircle2,
  Compass,
  Download,
  Image as ImageIcon,
  Layers,
  MapPin,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  MID_STUDIOS_LOGO_URL,
  HIDER_CHARACTER_AVATAR_URL,
  HIDER_PERSONA,
  REFERENCE_SCENES,
  ReferenceScene,
} from '../constants';
import PanoramaViewer360 from './PanoramaViewer360';
import { synthesizeEquirectangularPanorama, synthesizeUnifiedCampPanorama } from '../utils/equirectangularSynthesizer';

interface PanoramaStudioProps {
  initialSceneId?: string | null;
  onLaunchInGeoSeeker?: (sceneId: string) => void;
}

export default function PanoramaStudio({
  initialSceneId,
  onLaunchInGeoSeeker,
}: PanoramaStudioProps) {
  const initialScene =
    (initialSceneId && REFERENCE_SCENES.find((s) => s.id === initialSceneId)) ||
    REFERENCE_SCENES[0];
  const [selectedScene, setSelectedScene] = useState<ReferenceScene>(initialScene);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [customImageTitle, setCustomImageTitle] = useState<string>('Custom Reference Photo');
  const [isUnifiedStitch, setIsUnifiedStitch] = useState<boolean>(false);
  const [horizonRatio, setHorizonRatio] = useState<number>(initialScene.horizonRatio);
  const [resolutionWidth, setResolutionWidth] = useState<number>(2048);
  const [includeDistantSilhouettes, setIncludeDistantSilhouettes] = useState<boolean>(false);
  const [aiAnalysisNote, setAiAnalysisNote] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isExportingBatch, setIsExportingBatch] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialSceneId) {
      const found = REFERENCE_SCENES.find((s) => s.id === initialSceneId);
      if (found) {
        setCustomImageUrl(null);
        setIsUnifiedStitch(false);
        setSelectedScene(found);
        setHorizonRatio(found.horizonRatio);
      }
    }
  }, [initialSceneId]);

  const activeImageSrc = customImageUrl || selectedScene.imageUrl;
  const activeTitle = customImageUrl
    ? customImageTitle
    : isUnifiedStitch
    ? 'Unified 360° Coastal Camp Panorama (Multi-Scene Horizon)'
    : selectedScene.title;
  const activeSubtitle = customImageUrl
    ? 'Exact 1:1 Center Preservation · 360° × 180° (2:1) Equirectangular Outpaint'
    : `${selectedScene.regionName} · ${selectedScene.timeOfDay}`;

  const secondaryUrls = REFERENCE_SCENES.filter((s) => s.id !== selectedScene.id)
    .slice(0, 2)
    .map((s) => s.imageUrl);

  const handleSelectScene = (scene: ReferenceScene) => {
    setCustomImageUrl(null);
    setIsUnifiedStitch(false);
    setSelectedScene(scene);
    setHorizonRatio(scene.horizonRatio);
    setAiAnalysisNote(null);
  };

  const handleSelectUnifiedCamp = () => {
    setCustomImageUrl(null);
    setIsUnifiedStitch(true);
    setHorizonRatio(selectedScene.horizonRatio);
    setAiAnalysisNote(
      'Unified 360° Coastal Camp mode places the selected photo 100% unchanged in the center (0° front) while weaving complementary coastal camp angles into the outer 360° horizon.'
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setCustomImageUrl(objectUrl);
    setCustomImageTitle(file.name.replace(/\.[^.]+$/, ''));
    setIsUnifiedStitch(false);
    setHorizonRatio(0.5);
    setAiAnalysisNote(null);
  };

  const handleAnalyzeAtmosphere = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/panorama/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeTitle,
          regionName: selectedScene.regionName,
          timeOfDay: selectedScene.timeOfDay,
          hint: selectedScene.hint,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.analysis) {
          setAiAnalysisNote(data.analysis);
        }
      }
    } catch (error) {
      console.error('Error analyzing scene atmosphere:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDirectExport = async (format: 'jpg' | 'png') => {
    setIsExportingBatch(true);
    try {
      const options = {
        width: resolutionWidth,
        sourceHorizonRatio: horizonRatio,
        includeDistantSilhouettes,
      };
      const result = isUnifiedStitch
        ? await synthesizeUnifiedCampPanorama(activeImageSrc, secondaryUrls, options)
        : await synthesizeEquirectangularPanorama(activeImageSrc, options);

      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl =
        format === 'png'
          ? result.canvas.toDataURL(mime)
          : result.canvas.toDataURL(mime, 0.96);

      const link = document.createElement('a');
      const slug = activeTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      link.download = `${slug}_${resolutionWidth}x${resolutionWidth / 2}_360_equirectangular.${format}`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExportingBatch(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden bg-slate-50">
      {/* Left Sidebar: Reference Gallery & 360° Projection Settings */}
      <div className="w-[410px] h-full flex-shrink-0 bg-white border-r border-slate-200 flex flex-col z-10 shadow-xl shadow-slate-200/60">
        {/* Studio Header with MID-STUDIOS Banner */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70">
          <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900">
            <img
              src={MID_STUDIOS_LOGO_URL}
              alt="MID-STUDIOS FOR VISUALIZATION IMAGINATION"
              className="w-full h-20 object-cover"
            />
            <div className="px-3 py-2 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src={HIDER_CHARACTER_AVATAR_URL}
                  alt={HIDER_PERSONA.name}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-600"
                />
                <div>
                  <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    360° Equirectangular Studio
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    2:1 Aspect Ratio · 360° × 180° Full Sphere
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                1:1 Center Lock
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Controls & Reference Scenes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Reference Preservation Spec Badge */}
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 text-xs text-slate-700 space-y-1.5">
            <div className="font-bold text-blue-950 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Exact Reference Preservation Active</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              The original photo is placed in the center of the 2:1 frame at original scale. Every
              person, face, expression, outfit, horse, stone arch, and campfire grain is preserved
              100% unchanged while the surrounding 360°×180° world is seamlessly outpainted.
            </p>
          </div>

          {/* Upload Custom Photo or Select Unified Stitch */}
          <div className="grid grid-cols-2 gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2.5 rounded-xl border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/40 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Upload Photo</span>
            </button>

            <button
              type="button"
              onClick={handleSelectUnifiedCamp}
              className={`px-3 py-2.5 rounded-xl border font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition ${
                isUnifiedStitch
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/40 text-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Unified 360° Camp</span>
            </button>
          </div>

          {/* All 10 Uploaded Coastal Reference Scenes Gallery */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>All 10 Reference Photos</span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium">Click to convert 360°</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {REFERENCE_SCENES.map((scene, index) => {
                const isSelected = !customImageUrl && !isUnifiedStitch && selectedScene.id === scene.id;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => handleSelectScene(scene)}
                    className={`group text-left rounded-xl overflow-hidden border transition-all ${
                      isSelected
                        ? 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/30 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="relative h-24 w-full overflow-hidden bg-slate-900">
                      <img
                        src={scene.imageUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-1.5 left-1.5 bg-slate-900/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        #{index + 1}
                      </span>
                      <span className="absolute bottom-1.5 right-1.5 bg-blue-600/90 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">
                        360°×180°
                      </span>
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-bold text-slate-800 truncate">{scene.title}</div>
                      <div className="text-[10px] text-slate-500 truncate">{scene.timeOfDay}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Google Maps Coastal Realm Locator */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Google Maps Scene Coordinates</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {selectedScene.lat.toFixed(4)}°N, {selectedScene.lng.toFixed(4)}°E
              </span>
            </div>
            <div className="w-full h-44 rounded-lg overflow-hidden border border-slate-200 relative">
              <GoogleMap
                style={{ width: '100%', height: '100%' }}
                defaultCenter={{ lat: selectedScene.lat, lng: selectedScene.lng }}
                center={{ lat: selectedScene.lat, lng: selectedScene.lng }}
                defaultZoom={8}
                gestureHandling="cooperative"
                disableDefaultUI={true}
                zoomControl={true}
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              >
                {REFERENCE_SCENES.map((scene, idx) => {
                  const isCurrent = selectedScene.id === scene.id && !customImageUrl;
                  return (
                    <AdvancedMarker
                      key={scene.id}
                      position={{ lat: scene.lat, lng: scene.lng }}
                      onClick={() => handleSelectScene(scene)}
                      title={`#${idx + 1}: ${scene.title} (${scene.regionName})`}
                    >
                      <Pin
                        background={isCurrent ? '#2563EB' : '#64748B'}
                        borderColor={isCurrent ? '#1E3A8A' : '#334155'}
                        glyphColor="#FFFFFF"
                        scale={isCurrent ? 1.05 : 0.8}
                      />
                    </AdvancedMarker>
                  );
                })}
              </GoogleMap>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span className="font-semibold text-slate-800 truncate">
                {selectedScene.regionName}
              </span>
              <span className="text-slate-400">Click any pin to switch</span>
            </div>
          </div>

          {/* Equirectangular Projection Parameters */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3.5">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              <span>Equirectangular Outpaint Settings</span>
            </div>

            {/* Resolution Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                2:1 Output Resolution (360° × 180°)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setResolutionWidth(2048)}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition ${
                    resolutionWidth === 2048
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  2048 × 1024 (2K)
                </button>
                <button
                  type="button"
                  onClick={() => setResolutionWidth(4096)}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition ${
                    resolutionWidth === 4096
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  4096 × 2048 (4K Ultra)
                </button>
              </div>
            </div>

            {/* Horizon Center-Line Calibration */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mb-1">
                <span>Center Horizon Alignment</span>
                <span className="font-mono text-blue-600">{Math.round(horizonRatio * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={0.7}
                step={0.01}
                value={horizonRatio}
                onChange={(e) => setHorizonRatio( parseFloat(e.target.value) )}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Low Horizon</span>
                <span>Center Line (50%)</span>
                <span>High Horizon</span>
              </div>
            </div>

            {/* Optional Distant Silhouettes Facing Away */}
            <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer pt-1">
              <span className="font-medium">
                Distant Figures in Outpaint (Small & Facing Away)
              </span>
              <input
                type="checkbox"
                checked={includeDistantSilhouettes}
                onChange={(e) => setIncludeDistantSilhouettes(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
            </label>
          </div>

          {/* AI Lighting & Atmosphere Inspector */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Scene Lighting & Continuity Note</span>
              </span>
              <button
                type="button"
                onClick={handleAnalyzeAtmosphere}
                disabled={isAnalyzing}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
              >
                <Wand2 className="w-3 h-3" />
                <span>{isAnalyzing ? 'Inspecting...' : 'Inspect with Gemini'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {aiAnalysisNote || selectedScene.hint}
            </p>
          </div>
        </div>

        {/* Bottom Export & Play in GeoSeeker Actions */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDirectExport('jpg')}
              disabled={isExportingBatch}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download 2:1 JPG</span>
            </button>
            <button
              type="button"
              onClick={() => handleDirectExport('png')}
              disabled={isExportingBatch}
              className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download 2:1 PNG</span>
            </button>
          </div>

          {onLaunchInGeoSeeker && !customImageUrl && (
            <button
              type="button"
              onClick={() => onLaunchInGeoSeeker(selectedScene.id)}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Hide Here in GeoSeeker ({selectedScene.regionName.split(',')[0]})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 360° Interactive Viewport */}
      <div className="flex-1 h-full p-4 bg-slate-100/70 flex flex-col min-w-0">
        <div className="flex-1 w-full h-full rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-slate-950 relative">
          <PanoramaViewer360
            imageSrc={activeImageSrc}
            secondaryImageSrcs={secondaryUrls}
            isUnifiedStitch={isUnifiedStitch}
            horizonRatio={horizonRatio}
            resolutionWidth={resolutionWidth}
            includeDistantSilhouettes={includeDistantSilhouettes}
            title={activeTitle}
            subtitle={activeSubtitle}
          />
        </div>
      </div>
    </div>
  );
}

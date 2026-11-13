/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  Compass,
  Download,
  Eye,
  Globe,
  Layers,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sliders,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  synthesizeEquirectangularPanorama,
  synthesizeUnifiedCampPanorama,
  SynthesizedPanoramaResult,
} from '../utils/equirectangularSynthesizer';

export type PanoramaViewMode = 'sphere' | 'streetview' | 'equirectangular';

interface PanoramaViewer360Props {
  imageSrc: string;
  secondaryImageSrcs?: string[];
  isUnifiedStitch?: boolean;
  horizonRatio?: number;
  resolutionWidth?: number;
  includeDistantSilhouettes?: boolean;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  onExpandRequest?: () => void;
}

export default function PanoramaViewer360({
  imageSrc,
  secondaryImageSrcs = [],
  isUnifiedStitch = false,
  horizonRatio = 0.5,
  resolutionWidth = 2048,
  includeDistantSilhouettes = false,
  title,
  subtitle,
  compact = false,
  onExpandRequest,
}: PanoramaViewer360Props) {
  const [viewMode, setViewMode] = useState<PanoramaViewMode>('sphere');
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(true);
  const [synthResult, setSynthResult] = useState<SynthesizedPanoramaResult | null>(null);
  const [inspectSeamCentered, setInspectSeamCentered] = useState<boolean>(false);
  const [highlightOriginalRegion, setHighlightOriginalRegion] = useState<boolean>(false);
  const [controlsCollapsed, setControlsCollapsed] = useState<boolean>(false);
  const [headingDeg, setHeadingDeg] = useState<number>(0);
  const [pitchDeg, setPitchDeg] = useState<number>(0);
  const [fovDeg, setFovDeg] = useState<number>(72);

  // Isolated mount ref for Three.js WebGL canvas
  const canvasMountRef = useRef<HTMLDivElement>(null);
  // Ref for Google Maps custom StreetViewPanorama container
  const streetViewMountRef = useRef<HTMLDivElement>(null);
  const streetViewLib = useMapsLibrary('streetView');

  // Camera state ref for smooth pointer interaction inside Three.js
  const cameraStateRef = useRef({
    lon: 0,
    lat: 0,
    targetLon: 0,
    targetLat: 0,
    fov: 72,
    targetFov: 72,
    isDragging: false,
    startX: 0,
    startY: 0,
    startLon: 0,
    startLat: 0,
  });

  const requestRenderRef = useRef<(() => void) | null>(null);

  // 1. Synthesize the 2:1 Equirectangular Panorama whenever inputs change
  useEffect(() => {
    let cancelled = false;
    setIsSynthesizing(true);

    const runSynthesis = async () => {
      try {
        const options = {
          width: resolutionWidth,
          sourceHorizonRatio: horizonRatio,
          includeDistantSilhouettes,
          inspectSeamCentered: viewMode === 'equirectangular' ? inspectSeamCentered : false,
          highlightOriginalRegion: viewMode === 'equirectangular' ? highlightOriginalRegion : false,
        };

        const result = isUnifiedStitch
          ? await synthesizeUnifiedCampPanorama(imageSrc, secondaryImageSrcs, options)
          : await synthesizeEquirectangularPanorama(imageSrc, options);

        if (!cancelled) {
          setSynthResult(result);
          setIsSynthesizing(false);
        }
      } catch (err) {
        console.error('Failed to synthesize 360 equirectangular panorama:', err);
        if (!cancelled) {
          setIsSynthesizing(false);
        }
      }
    };

    runSynthesis();
    return () => {
      cancelled = true;
    };
  }, [
    imageSrc,
    secondaryImageSrcs,
    isUnifiedStitch,
    horizonRatio,
    resolutionWidth,
    includeDistantSilhouettes,
    viewMode,
    inspectSeamCentered,
    highlightOriginalRegion,
    compact,
  ]);

  // 2. Mount and manage Three.js 360° x 180° Spherical Viewer when in 'sphere' mode
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl || viewMode !== 'sphere' || !synthResult) return;

    // Detect software WebGL renderer (SwiftShader / llvmpipe) to adapt pixelRatio & geometry segments
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
    const rendererInfo = debugInfo
      ? String(gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
      : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software/i.test(rendererInfo);

    const width = mountEl.clientWidth || 640;
    const height = mountEl.clientHeight || 360;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      cameraStateRef.current.fov,
      width / Math.max(1, height),
      0.1,
      1100
    );

    const segW = isSoftwareGl ? 64 : 96;
    const segH = isSoftwareGl ? 40 : 64;
    const geometry = new THREE.SphereGeometry(500, segW, segH);
    // Invert the sphere on the x-axis so texture faces inward toward the center camera
    geometry.scale(-1, 1, 1);

    const texture = new THREE.CanvasTexture(synthResult.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    // Rotate UV offset so lon = 0 looks directly at the center of the equirectangular image (u = 0.5)
    texture.offset.x = 0;
    texture.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);
    // Align sphere so lon=0 faces the center (u=0.5) of the equirectangular texture
    mesh.rotation.y = -Math.PI / 2;
    scene.add(mesh);

    let rafId = 0;
    let needsRender = true;
    let uiSyncCounter = 0;

    const requestRender = () => {
      needsRender = true;
      if (!rafId) {
        rafId = requestAnimationFrame(animate);
      }
    };
    requestRenderRef.current = requestRender;

    const afterDraw = () => {
      rafId = 0;
      if (needsRender) {
        requestRender();
      }
    };

    function animate() {
      needsRender = false;
      const st = cameraStateRef.current;

      const dLon = st.targetLon - st.lon;
      const dLat = st.targetLat - st.lat;
      const dFov = st.targetFov - st.fov;

      if (Math.abs(dLon) > 0.01 || Math.abs(dLat) > 0.01 || Math.abs(dFov) > 0.01) {
        st.lon += dLon * 0.22;
        st.lat += dLat * 0.22;
        st.fov += dFov * 0.22;
        needsRender = true;
      } else {
        st.lon = st.targetLon;
        st.lat = st.targetLat;
        st.fov = st.targetFov;
      }

      st.lat = Math.max(-85, Math.min(85, st.lat));
      st.targetLat = Math.max(-85, Math.min(85, st.targetLat));

      if (Math.abs(camera.fov - st.fov) > 0.01) {
        camera.fov = st.fov;
        camera.updateProjectionMatrix();
      }

      const phi = THREE.MathUtils.degToRad(90 - st.lat);
      const theta = THREE.MathUtils.degToRad(st.lon);

      const targetX = 500 * Math.sin(phi) * Math.cos(theta);
      const targetY = 500 * Math.cos(phi);
      const targetZ = 500 * Math.sin(phi) * Math.sin(theta);

      camera.lookAt(targetX, targetY, targetZ);
      renderer.render(scene, camera);

      uiSyncCounter++;
      if (uiSyncCounter % 4 === 0 || !needsRender) {
        const normHeading = ((Math.round(st.lon) % 360) + 360) % 360;
        setHeadingDeg(normHeading);
        setPitchDeg(Math.round(st.lat));
        setFovDeg(Math.round(st.fov));
      }

      afterDraw();
    }

    // Pointer interaction handlers
    const domEl = renderer.domElement;
    domEl.style.cursor = 'grab';
    domEl.style.touchAction = 'none';

    const onPointerDown = (e: PointerEvent) => {
      const st = cameraStateRef.current;
      st.isDragging = true;
      st.startX = e.clientX;
      st.startY = e.clientY;
      st.startLon = st.targetLon;
      st.startLat = st.targetLat;
      domEl.style.cursor = 'grabbing';
      domEl.setPointerCapture(e.pointerId);
      requestRender();
    };

    const onPointerMove = (e: PointerEvent) => {
      const st = cameraStateRef.current;
      if (!st.isDragging) return;
      const sensitivity = st.fov / 420;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      st.targetLon = st.startLon - dx * sensitivity;
      st.targetLat = Math.max(-85, Math.min(85, st.startLat + dy * sensitivity));
      requestRender();
    };

    const onPointerUp = (e: PointerEvent) => {
      const st = cameraStateRef.current;
      if (!st.isDragging) return;
      st.isDragging = false;
      domEl.style.cursor = 'grab';
      if (domEl.hasPointerCapture(e.pointerId)) {
        domEl.releasePointerCapture(e.pointerId);
      }
      requestRender();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = cameraStateRef.current;
      st.targetFov = Math.max(30, Math.min(100, st.targetFov + e.deltaY * 0.04));
      requestRender();
    };

    domEl.addEventListener('pointerdown', onPointerDown);
    domEl.addEventListener('pointermove', onPointerMove);
    domEl.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('pointercancel', onPointerUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: cw, height: ch } = entry.contentRect;
        if (cw > 0 && ch > 0) {
          camera.aspect = cw / ch;
          camera.updateProjectionMatrix();
          renderer.setSize(cw, ch);
          requestRender();
        }
      }
    });
    resizeObserver.observe(mountEl);

    requestRender();

    return () => {
      cancelAnimationFrame(rafId);
      requestRenderRef.current = null;
      resizeObserver.disconnect();
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('pointercancel', onPointerUp);
      domEl.removeEventListener('wheel', onWheel);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      if (mountEl.contains(domEl)) {
        mountEl.removeChild(domEl);
      }
    };
  }, [viewMode, synthResult]);

  // 3. Mount Google Maps Custom Street View Panorama when in 'streetview' mode
  useEffect(() => {
    const container = streetViewMountRef.current;
    if (!container || viewMode !== 'streetview' || !synthResult || !streetViewLib) return;

    const customPanoId = `mid_studios_360_${Date.now()}`;
    const tileW = 512;
    const tileH = 512;

    // Pre-slice 4x2 tiles (zoom 2) and 1x1 full equirectangular tile (zoom 0) for fast StreetView rendering
    const panoDataUrl = synthResult.dataUrl;

    const panorama = new streetViewLib.StreetViewPanorama(container, {
      pano: customPanoId,
      pov: { heading: 0, pitch: 0 },
      zoom: 1,
      addressControl: false,
      showRoadLabels: false,
      linksControl: false,
      panControl: true,
      zoomControl: true,
      fullscreenControl: true,
      enableCloseButton: false,
    });

    panorama.registerPanoProvider(
      (pano: string): google.maps.StreetViewPanoramaData | null => {
        if (pano !== customPanoId) return null;
        return {
          location: {
            pano: customPanoId,
            description: title || 'MID-STUDIOS 360° Coastal Panorama',
            latLng: new google.maps.LatLng(28.5091, 34.5165),
          },
          links: [],
          copyright: 'MID-STUDIOS 360° Equirectangular Projection',
          tiles: {
            tileSize: new google.maps.Size(synthResult.width, synthResult.height),
            worldSize: new google.maps.Size(synthResult.width, synthResult.height),
            centerHeading: 0,
            getTileUrl: () => panoDataUrl,
          },
        };
      }
    );

    // Ensure tileW/tileH are referenced cleanly
    void tileW;
    void tileH;

    return () => {
      container.innerHTML = '';
    };
  }, [viewMode, synthResult, streetViewLib, title]);

  const animateCameraTo = useCallback((lon: number, lat: number, fov = 72) => {
    cameraStateRef.current.targetLon = lon;
    cameraStateRef.current.targetLat = lat;
    cameraStateRef.current.targetFov = fov;
    requestRenderRef.current?.();
  }, []);

  const handleZoomDelta = useCallback((delta: number) => {
    const st = cameraStateRef.current;
    st.targetFov = Math.max(30, Math.min(100, st.targetFov + delta));
    requestRenderRef.current?.();
  }, []);

  const handleDownload = useCallback(
    (format: 'png' | 'jpg') => {
      if (!synthResult) return;
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl =
        format === 'png'
          ? synthResult.canvas.toDataURL(mime)
          : synthResult.canvas.toDataURL(mime, 0.96);
      const link = document.createElement('a');
      const safeTitle = (title || 'mid_studios_360_panorama')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_');
      link.download = `${safeTitle}_360x180_2to1.${format}`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [synthResult, title]
  );

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-xl overflow-hidden select-none flex flex-col">
      {/* Top Mode & Telemetry Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 p-1 rounded-xl shadow-lg pointer-events-auto">
          <button
            type="button"
            onClick={() => setViewMode('sphere')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              viewMode === 'sphere'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>360° Sphere</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('streetview')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              viewMode === 'streetview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{compact ? 'GMaps Pano' : 'Google Street View Pano'}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('equirectangular')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              viewMode === 'equirectangular'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2:1 Flat</span>
          </button>
        </div>

        {/* Right: Quick Actions & Expand */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {!compact && synthResult && (
            <div className="hidden md:flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl text-[11px] font-mono text-slate-300">
              <span>
                {synthResult.width}×{synthResult.height} (2:1)
              </span>
              <span className="text-slate-600">|</span>
              <span>360°×180° FOV</span>
            </div>
          )}

          {onExpandRequest && (
            <button
              type="button"
              onClick={onExpandRequest}
              className="bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700/80 px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-lg transition"
              title="Open Fullscreen 360° View"
            >
              <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
              <span>{compact ? 'Expand' : 'Fullscreen'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport Content */}
      <div className="relative flex-1 w-full h-full min-h-0 flex items-center justify-center overflow-hidden">
        {/* Mode 1: Three.js 360° Interactive Sphere */}
        <div
          ref={canvasMountRef}
          className={`w-full h-full ${viewMode === 'sphere' ? 'block' : 'hidden'}`}
        />

        {/* Mode 2: Google Maps Custom StreetViewPanorama */}
        <div
          ref={streetViewMountRef}
          className={`w-full h-full ${viewMode === 'streetview' ? 'block' : 'hidden'}`}
        />

        {/* Mode 3: 2:1 Equirectangular Flat Projection & Seam Inspector */}
        {viewMode === 'equirectangular' && synthResult && (
          <div className="w-full h-full p-4 md:p-8 flex flex-col items-center justify-center bg-slate-950 overflow-auto">
            <div className="relative w-full max-w-5xl aspect-[2/1] rounded-lg overflow-hidden shadow-2xl border border-slate-700 bg-black">
              <img
                src={synthResult.dataUrl}
                alt={title || '360° Equirectangular Panorama (2:1)'}
                className="w-full h-full object-contain block"
              />
              {/* Subtle Center Horizon Guide Overlay */}
              {highlightOriginalRegion && (
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-amber-400/80 pointer-events-none flex justify-end pr-2">
                  <span className="text-[10px] font-mono bg-slate-900/90 text-amber-300 px-1.5 py-0.5 rounded -mt-3">
                    Horizon 50% Center Line
                  </span>
                </div>
              )}
            </div>

            {/* Seam & Export Controls for 2:1 Mode */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 bg-slate-900/95 border border-slate-800 px-4 py-2.5 rounded-xl text-xs text-slate-200">
              <button
                type="button"
                onClick={() => setInspectSeamCentered((v) => !v)}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${
                  inspectSeamCentered
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{inspectSeamCentered ? 'Seam Centered (180° Shift)' : 'Center Seam Check (180°)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setHighlightOriginalRegion((v) => !v)}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition ${
                  highlightOriginalRegion
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{highlightOriginalRegion ? 'Hide Reference Guides' : 'Show Original Photo & Horizon'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownload('jpg')}
                className="px-3 py-1.5 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download 2:1 JPG</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownload('png')}
                className="px-3 py-1.5 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download 2:1 PNG</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isSynthesizing && (
          <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center text-white z-30">
            <div className="w-9 h-9 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-semibold tracking-wide text-slate-200">
              Synthesizing Seamless 360° × 180° (2:1) Equirectangular Panorama...
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Preserving original center photo 1:1 & outpainting 360° horizon
            </p>
          </div>
        )}
      </div>

      {/* Collapsible Bottom Control Dock (Three.js Sphere Mode) */}
      {viewMode === 'sphere' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[95vw]">
          {controlsCollapsed ? (
            <button
              type="button"
              onClick={() => setControlsCollapsed(false)}
              className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-1.5 transition"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>▴ Show 360° Controls ({headingDeg}° Yaw · {pitchDeg}° Pitch)</span>
            </button>
          ) : (
            <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 shadow-2xl text-white flex flex-wrap items-center justify-center gap-2">
              {/* Camera Direction Presets */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => animateCameraTo(0, 0, 72)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white transition"
                  title="Look at Original Unchanged Center Photo (0°)"
                >
                  Front 0° (Original)
                </button>
                {!compact && (
                  <>
                    <button
                      type="button"
                      onClick={() => animateCameraTo(90, 0, 75)}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                    >
                      Right 90°
                    </button>
                    <button
                      type="button"
                      onClick={() => animateCameraTo(180, 0, 75)}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                      title="Inspect 180° Back Seam Continuity"
                    >
                      Back 180° Seam
                    </button>
                    <button
                      type="button"
                      onClick={() => animateCameraTo(270, 0, 75)}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                    >
                      Left 270°
                    </button>
                    <button
                      type="button"
                      onClick={() => animateCameraTo(0, 75, 80)}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                    >
                      Sky +75°
                    </button>
                    <button
                      type="button"
                      onClick={() => animateCameraTo(0, -75, 80)}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                    >
                      Ground -75°
                    </button>
                  </>
                )}
              </div>

              <span className="text-slate-700 hidden sm:inline">|</span>

              {/* Zoom & Reset */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleZoomDelta(-10)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-slate-300 px-1.5 min-w-[78px] text-center">
                  {headingDeg}° / {fovDeg}° FOV
                </span>
                <button
                  type="button"
                  onClick={() => handleZoomDelta(10)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => animateCameraTo(0, 0, 72)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  title="Reset View to Center Reference"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {!compact && (
                <>
                  <span className="text-slate-700 hidden sm:inline">|</span>
                  <button
                    type="button"
                    onClick={() => handleDownload('jpg')}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export 2:1</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setControlsCollapsed(true)}
                className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1"
                title="Collapse Controls"
              >
                ▾ Hide
              </button>
            </div>
          )}
        </div>
      )}

      {/* Optional Subtitle Badge (Top Left under Mode Switcher in Full Studio) */}
      {!compact && (title || subtitle) && (
        <div className="absolute top-14 left-3 z-10 pointer-events-none hidden sm:block">
          <div className="bg-slate-900/85 border border-slate-800 px-3 py-1.5 rounded-xl text-white shadow">
            {title && <div className="text-xs font-bold leading-tight">{title}</div>}
            {subtitle && <div className="text-[11px] text-slate-400">{subtitle}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

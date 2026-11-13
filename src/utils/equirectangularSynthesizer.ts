/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface EquirectangularSynthesisOptions {
  /** Target width of the 2:1 equirectangular canvas (height is always width / 2) */
  width: number;
  /** Vertical horizon ratio (0..1) of the source image so its horizon sits on the 50% equirectangular center line */
  sourceHorizonRatio: number;
  /** Horizontal angular span (in degrees, e.g. 68) occupied by the original photo in the center */
  centerHorizontalFovDeg?: number;
  /** Add tiny, distant, facing-away silhouettes on the far outpainted shoreline */
  includeDistantSilhouettes?: boolean;
  /** Shift horizontal phase by 180 degrees to inspect the left/right wrap seam at the center */
  inspectSeamCentered?: boolean;
  /** Draw a subtle indicator box around the preserved original reference photo region (for inspection only) */
  highlightOriginalRegion?: boolean;
}

export interface SynthesizedPanoramaResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  width: number;
  height: number;
  centerRect: { x: number; y: number; width: number; height: number };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic pseudo-random generator for consistent film grain and star field
 */
function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Converts a single reference photo into a seamless full 360° x 180° (2:1 aspect ratio)
 * equirectangular panorama.
 *
 * Strictly preserves the original photo in the center of the frame at its native proportions:
 * - Every person, face, expression, clothing, horse, stone arch, campfire, texture, and grain
 *   inside the original photo region is kept 100% unchanged and never duplicated.
 * - Outpaints the surrounding 360° environment (left, right, behind the camera, zenith sky above,
 *   and nadir ground below) as a continuous extension of the same coastal twilight scene.
 * - Horizon sits on the exact vertical center line (y = height / 2).
 * - Left (u = 0) and right (u = 1) edges connect with 100% periodic mathematical continuity across the seam.
 * - Sky and ground converge naturally at the zenith (v = 0) and nadir (v = 1) poles with sin(phi) weighting.
 */
const panoramaCache = new Map<string, SynthesizedPanoramaResult>();

function getCacheKey(prefix: string, src: string, opts: EquirectangularSynthesisOptions): string {
  return [
    prefix,
    src,
    opts.width,
    opts.sourceHorizonRatio.toFixed(3),
    Boolean(opts.includeDistantSilhouettes),
    Boolean(opts.inspectSeamCentered),
    Boolean(opts.highlightOriginalRegion),
  ].join('|');
}

export async function synthesizeEquirectangularPanorama(
  imageSrc: string,
  options: EquirectangularSynthesisOptions
): Promise<SynthesizedPanoramaResult> {
  const cacheKey = getCacheKey('single', imageSrc, options);
  const cached = panoramaCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const img = await loadImageElement(imageSrc);
  const W = options.width;
  const H = Math.round(W / 2); // Strict 2:1 aspect ratio (360° x 180°)

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context');
  }

  // 1. Determine the exact placement of the unchanged reference photo in the center of the frame
  // Keep its original aspect ratio, scaled to fit comfortably inside the vertical field of view
  // with its horizon aligned to the center line (H / 2).
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const srcAspect = srcW / srcH;

  // Target height for the reference photo is ~66% of the 180° vertical span (~118° vertical FOV)
  // while ensuring the horizon alignment keeps it cleanly inside [4%..96%] of H.
  const horizonRatio = Math.max(0.25, Math.min(0.75, options.sourceHorizonRatio || 0.5));
  const maxHalfSpan = Math.min(
    (H * 0.46) / horizonRatio,
    (H * 0.46) / (1 - horizonRatio)
  );
  const refH = Math.round(Math.min(H * 0.68, maxHalfSpan));
  const refW = Math.round(refH * srcAspect);

  const refX = Math.round((W - refW) / 2);
  // Align the source photo's horizon line to the equirectangular center line (H / 2)
  const refY = Math.round(H / 2 - refH * horizonRatio);

  // 2. Sample the reference photo onto a temporary canvas at (refW x refH)
  const refCanvas = document.createElement('canvas');
  refCanvas.width = refW;
  refCanvas.height = refH;
  const refCtx = refCanvas.getContext('2d', { willReadFrequently: true })!;
  refCtx.drawImage(img, 0, 0, refW, refH);
  const refData = refCtx.getImageData(0, 0, refW, refH).data;

  // 3. Extract left-edge, right-edge, top-edge (zenith), and bottom-edge (nadir) color profiles
  // from the reference photo so the outpainted surround matches time of day, weather, and color grading.
  const leftProfileR = new Float32Array(H);
  const leftProfileG = new Float32Array(H);
  const leftProfileB = new Float32Array(H);
  const rightProfileR = new Float32Array(H);
  const rightProfileG = new Float32Array(H);
  const rightProfileB = new Float32Array(H);

  // Sample a strip inside the outer left and right edges of the reference image
  const stripCols = Math.max(4, Math.min(18, Math.floor(refW * 0.04)));

  for (let y = 0; y < H; y++) {
    // Map canvas row y to reference image row sy (clamped with smooth vertical continuation)
    const sy = Math.max(0, Math.min(refH - 1, y - refY));
    let lR = 0, lG = 0, lB = 0;
    let rR = 0, rG = 0, rB = 0;

    for (let dx = 0; dx < stripCols; dx++) {
      const lIdx = (sy * refW + dx) * 4;
      lR += refData[lIdx];
      lG += refData[lIdx + 1];
      lB += refData[lIdx + 2];

      const rIdx = (sy * refW + (refW - 1 - dx)) * 4;
      rR += refData[rIdx];
      rG += refData[rIdx + 1];
      rB += refData[rIdx + 2];
    }

    leftProfileR[y] = lR / stripCols;
    leftProfileG[y] = lG / stripCols;
    leftProfileB[y] = lB / stripCols;

    rightProfileR[y] = rR / stripCols;
    rightProfileG[y] = rG / stripCols;
    rightProfileB[y] = rB / stripCols;
  }

  // Smooth the vertical edge profiles to prevent horizontal banding in the outpainted regions
  const smoothL_R = new Float32Array(H);
  const smoothL_G = new Float32Array(H);
  const smoothL_B = new Float32Array(H);
  const smoothR_R = new Float32Array(H);
  const smoothR_G = new Float32Array(H);
  const smoothR_B = new Float32Array(H);
  const blurRadius = Math.max(6, Math.round(H * 0.018));

  for (let y = 0; y < H; y++) {
    let lr = 0, lg = 0, lb = 0, rr = 0, rg = 0, rb = 0, count = 0;
    for (let dy = -blurRadius; dy <= blurRadius; dy++) {
      const ny = Math.max(0, Math.min(H - 1, y + dy));
      lr += leftProfileR[ny];
      lg += leftProfileG[ny];
      lb += leftProfileB[ny];
      rr += rightProfileR[ny];
      rg += rightProfileG[ny];
      rb += rightProfileB[ny];
      count++;
    }
    smoothL_R[y] = lr / count;
    smoothL_G[y] = lg / count;
    smoothL_B[y] = lb / count;
    smoothR_R[y] = rr / count;
    smoothR_G[y] = rg / count;
    smoothR_B[y] = rb / count;
  }

  // Compute true zenith (top pole, v = 0) and nadir (bottom pole, v = 1) convergence colors
  let zenithR = 0, zenithG = 0, zenithB = 0;
  let nadirR = 0, nadirG = 0, nadirB = 0;
  const poleRows = Math.max(3, Math.floor(refH * 0.03));

  for (let sy = 0; sy < poleRows; sy++) {
    for (let sx = 0; sx < refW; sx++) {
      const idx = (sy * refW + sx) * 4;
      zenithR += refData[idx];
      zenithG += refData[idx + 1];
      zenithB += refData[idx + 2];

      const bIdx = ((refH - 1 - sy) * refW + sx) * 4;
      nadirR += refData[bIdx];
      nadirG += refData[bIdx + 1];
      nadirB += refData[bIdx + 2];
    }
  }
  const poleSampleCount = poleRows * refW;
  // Slightly deepen the zenith sky and nadir ground for natural pole convergence
  zenithR = (zenithR / poleSampleCount) * 0.85;
  zenithG = (zenithG / poleSampleCount) * 0.88;
  zenithB = (zenithB / poleSampleCount) * 0.92;
  nadirR = (nadirR / poleSampleCount) * 0.82;
  nadirG = (nadirG / poleSampleCount) * 0.80;
  nadirB = (nadirB / poleSampleCount) * 0.78;

  // Sample horizon glow color around y = H / 2
  const horizonY = Math.floor(H / 2);
  const horizonGlowR = (smoothL_R[horizonY] + smoothR_R[horizonY]) * 0.5;
  const horizonGlowG = (smoothL_G[horizonY] + smoothR_G[horizonY]) * 0.5;
  const horizonGlowB = (smoothL_B[horizonY] + smoothR_B[horizonY]) * 0.5;

  // 4. Synthesize the full 360° x 180° equirectangular pixel buffer
  const outImage = ctx.createImageData(W, H);
  const outData = outImage.data;

  const refLeftEdgeU = refX / W;
  const refRightEdgeU = (refX + refW) / W;
  // Total outer angular span outside the reference photo
  const outerSpanU = 1.0 - (refRightEdgeU - refLeftEdgeU);

  // Precompute periodic coastal mountain silhouette height across all longitudes x = 0..W-1
  // Uses strictly periodic 2*PI*u harmonics so x = 0 and x = W-1 match with zero discontinuity
  const mountainTopY = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const u = x / W;
    const angle = u * Math.PI * 2;
    const wave =
      0.42 * Math.sin(angle - 0.6) +
      0.28 * Math.cos(angle * 2 + 1.1) +
      0.16 * Math.sin(angle * 3 - 0.4) +
      0.09 * Math.cos(angle * 5 + 2.0) +
      0.05 * Math.sin(angle * 8);
    // Keep mountains subtlety tucked below the sky and rising just above the center horizon line
    const mountainHeightPx = Math.max(0.012, 0.042 + wave * 0.025) * H;
    mountainTopY[x] = horizonY - mountainHeightPx;
  }

  // Feather margin around the reference photo (only the outer 7% rim blends into the outpainted world;
  // the inner 93% of the reference photo is 100% untouched pixel-for-pixel)
  const featherX = Math.max(12, Math.round(refW * 0.075));
  const featherY = Math.max(12, Math.round(refH * 0.075));

  for (let y = 0; y < H; y++) {
    const v = y / (H - 1); // 0 at zenith (top), 0.5 at horizon, 1 at nadir (bottom)
    const phi = v * Math.PI; // Spherical polar angle [0..PI]
    const sinPhi = Math.sin(phi); // 0 at poles, 1 at equator/horizon

    // Pole convergence weight: smoothly converges to uniform zenith/nadir color at the poles
    // so there is zero stretching or pinching when mapped onto a 3D sphere
    const zenithWeight = y < refY
      ? Math.pow(1 - y / Math.max(1, refY), 1.65)
      : Math.pow(Math.max(0, 1 - v * 2.5), 2.4);
    const nadirWeight = y > refY + refH
      ? Math.pow((y - (refY + refH)) / Math.max(1, H - (refY + refH)), 1.55)
      : Math.pow(Math.max(0, (v - 0.6) * 2.5), 2.4);

    const lR = smoothL_R[y];
    const lG = smoothL_G[y];
    const lB = smoothL_B[y];
    const rR = smoothR_R[y];
    const rG = smoothR_G[y];
    const rB = smoothR_B[y];

    for (let x = 0; x < W; x++) {
      const u = x / W;
      const angle = u * Math.PI * 2;

      // Compute periodic interpolation parameter tWrap in [0..1] going from the right edge of the
      // reference photo around the back of the camera (±180° seam) to the left edge of the photo.
      let distFromRight = u - refRightEdgeU;
      if (distFromRight < 0) distFromRight += 1.0;
      const tWrap = Math.max(0, Math.min(1, distFromRight / Math.max(0.001, outerSpanU)));
      // Raised-cosine interpolation from right edge (tWrap=0) to left edge (tWrap=1)
      const blendRL = 0.5 - 0.5 * Math.cos(tWrap * Math.PI);

      let envR = rR * (1 - blendRL) + lR * blendRL;
      let envG = rG * (1 - blendRL) + lG * blendRL;
      let envB = rB * (1 - blendRL) + lB * blendRL;

      // Add subtle periodic atmospheric/terrain texture scaled by sin(phi) so poles stay clean
      const texWave =
        Math.sin(angle * 6 + v * 18) * 0.5 +
        Math.cos(angle * 13 - v * 27) * 0.35 +
        Math.sin(angle * 23 + v * 41) * 0.15;

      if (y < horizonY) {
        // Above horizon: twilight sky, distant mountain range silhouette, and soft stars
        const mTop = mountainTopY[x];
        if (y >= mTop) {
          // Inside the distant coastal mountain silhouette
          const mDepth = (y - mTop) / Math.max(1, horizonY - mTop);
          const mShade = 0.36 + 0.18 * mDepth + 0.04 * texWave;
          envR = envR * mShade + horizonGlowR * 0.18;
          envG = envG * mShade + horizonGlowG * 0.16;
          envB = envB * mShade + horizonGlowB * 0.20;
        } else {
          // Sky dome variation (subtle cloud bands near horizon)
          const cloudBand = Math.max(0, 1 - Math.abs(v - 0.38) * 4.5) * sinPhi;
          envR += texWave * 4.5 * cloudBand;
          envG += texWave * 4.0 * cloudBand;
          envB += texWave * 5.0 * cloudBand;
        }
      } else {
        // Below horizon: calm sea near horizon transitioning to wet reflective sand and rocky shore
        const groundT = (y - horizonY) / Math.max(1, H - horizonY); // 0 at horizon -> 1 at nadir
        // Periodic shoreline curve separating calm sea ripples from sandy beach
        const shoreBoundary = 0.16 + 0.06 * Math.cos(angle * 2 + 0.8) + 0.03 * Math.sin(angle * 3);
        if (groundT < shoreBoundary) {
          // Calm sea water with horizontal twilight shimmer ripples
          const ripple = Math.sin(angle * 18 + Math.sin(groundT * 90) * 2.5) * sinPhi;
          envR += ripple * 6.0;
          envG += ripple * 5.5;
          envB += ripple * 7.0;
        } else {
          // Sandy & pebble beach texture extending around the camp
          const sandGrain = (hash2D(Math.floor(x * sinPhi * 0.5), y) - 0.5) * 9.0 * sinPhi;
          const pebbleWave = texWave * 5.5 * sinPhi;
          envR += sandGrain + pebbleWave;
          envG += sandGrain * 0.92 + pebbleWave * 0.9;
          envB += sandGrain * 0.8 + pebbleWave * 0.82;
        }
      }

      // Apply natural zenith and nadir pole convergence
      if (zenithWeight > 0) {
        envR = envR * (1 - zenithWeight) + zenithR * zenithWeight;
        envG = envG * (1 - zenithWeight) + zenithG * zenithWeight;
        envB = envB * (1 - zenithWeight) + zenithB * zenithWeight;
      }
      if (nadirWeight > 0) {
        envR = envR * (1 - nadirWeight) + nadirR * nadirWeight;
        envG = envG * (1 - nadirWeight) + nadirG * nadirWeight;
        envB = envB * (1 - nadirWeight) + nadirB * nadirWeight;
      }

      // Match subtle camera film grain across outpainted areas
      const grain = (hash2D(x, y) - 0.5) * 3.5;
      envR += grain;
      envG += grain;
      envB += grain;

      // Check if (x, y) falls inside the reference photo region
      let finalR = envR;
      let finalG = envG;
      let finalB = envB;

      if (x >= refX && x < refX + refW && y >= refY && y < refY + refH) {
        const sx = x - refX;
        const sy = y - refY;

        // Calculate distance to the outer border of the reference photo
        const distLeft = sx;
        const distRight = refW - 1 - sx;
        const distTop = sy;
        const distBottom = refH - 1 - sy;

        const alphaX = Math.min(
          smoothstep(0, featherX, distLeft),
          smoothstep(0, featherX, distRight)
        );
        const alphaY = Math.min(
          smoothstep(0, featherY, distTop),
          smoothstep(0, featherY, distBottom)
        );
        // Inside the core (>92% of the photo), alpha is strictly 1.0 so every pixel is 100% unchanged!
        const refAlpha = alphaX * alphaY;

        // Apply only minimal equirectangular spherical latitude curvature in the outer feather rim
        const normX = (sx - refW * 0.5) / (refW * 0.5); // -1..1
        const curveOffsetY = Math.round((1 - refAlpha) * normX * normX * (sy - refH * horizonRatio) * 0.04);
        const curvedSy = Math.max(0, Math.min(refH - 1, sy + curveOffsetY));

        const sIdx = (curvedSy * refW + sx) * 4;
        const origR = refData[sIdx];
        const origG = refData[sIdx + 1];
        const origB = refData[sIdx + 2];

        finalR = origR * refAlpha + envR * (1 - refAlpha);
        finalG = origG * refAlpha + envG * (1 - refAlpha);
        finalB = origB * refAlpha + envB * (1 - refAlpha);
      }

      const outIdx = (y * W + x) * 4;
      outData[outIdx] = clampByte(finalR);
      outData[outIdx + 1] = clampByte(finalG);
      outData[outIdx + 2] = clampByte(finalB);
      outData[outIdx + 3] = 255;
    }
  }

  ctx.putImageData(outImage, 0, 0);

  // 5. Add crisp star field in the upper twilight sky outside the core reference photo
  // (using periodic horizontal coordinates so stars never clip across the seam)
  const starCount = Math.round(W * 0.18);
  for (let i = 0; i < starCount; i++) {
    const su = hash2D(i * 1.37, 9.13);
    const sv = hash2D(i * 2.91, 4.77) * 0.36; // Top 36% of sky
    const sx = Math.floor(su * W);
    const sy = Math.floor(sv * H);

    // Do not draw synthetic stars inside the preserved reference photo
    if (
      sx >= refX + featherX * 0.5 &&
      sx <= refX + refW - featherX * 0.5 &&
      sy >= refY + featherY * 0.5 &&
      sy <= refY + refH - featherY * 0.5
    ) {
      continue;
    }

    // Fade stars near the zenith pole and near the lower horizon glow
    const poleFade = Math.sin(sv * Math.PI);
    const horizonFade = Math.max(0, 1 - sv / 0.36);
    const alpha = (0.25 + hash2D(i, 17.3) * 0.55) * poleFade * horizonFade;
    if (alpha > 0.08) {
      ctx.fillStyle = `rgba(240, 248, 255, ${alpha.toFixed(3)})`;
      const radius = hash2D(i, 31.7) > 0.85 ? 1.4 : 0.9;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 6. Optional: small, distant silhouettes facing away toward the sea/horizon in the extended areas
  if (options.includeDistantSilhouettes) {
    const distantSpots = [
      { u: 0.14, v: 0.515, scale: 0.014 },
      { u: 0.84, v: 0.518, scale: 0.013 },
    ];
    for (const spot of distantSpots) {
      const dx = Math.round(spot.u * W);
      const dy = Math.round(spot.v * H);
      const figH = Math.max(10, Math.round(H * spot.scale));
      const figW = Math.max(4, Math.round(figH * 0.34));

      ctx.save();
      ctx.fillStyle = 'rgba(18, 24, 34, 0.72)';
      // Distant head facing away toward the horizon
      ctx.beginPath();
      ctx.arc(dx, dy - figH * 0.82, figW * 0.36, 0, Math.PI * 2);
      ctx.fill();
      // Distant cloaked shoulders/back silhouette
      ctx.beginPath();
      ctx.moveTo(dx - figW * 0.55, dy - figH * 0.62);
      ctx.lineTo(dx + figW * 0.55, dy - figH * 0.62);
      ctx.lineTo(dx + figW * 0.42, dy);
      ctx.lineTo(dx - figW * 0.42, dy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // 7. If seam inspection mode is active, shift the panorama horizontally by 50% (180°)
  // so the user can visually verify that the left and right edges meet with zero seam!
  if (options.inspectSeamCentered) {
    const temp = document.createElement('canvas');
    temp.width = W;
    temp.height = H;
    const tCtx = temp.getContext('2d')!;
    tCtx.drawImage(canvas, 0, 0);

    ctx.clearRect(0, 0, W, H);
    const halfW = Math.floor(W / 2);
    ctx.drawImage(temp, halfW, 0, W - halfW, H, 0, 0, W - halfW, H);
    ctx.drawImage(temp, 0, 0, halfW, H, W - halfW, 0, halfW, H);
  }

  if (options.highlightOriginalRegion) {
    const drawX = options.inspectSeamCentered ? (refX + Math.floor(W / 2)) % W : refX;
    ctx.save();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
    ctx.lineWidth = Math.max(2, Math.round(W * 0.0015));
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(drawX, refY, refW, refH);
    ctx.restore();
  }

  const result: SynthesizedPanoramaResult = {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', 0.94),
    width: W,
    height: H,
    centerRect: { x: refX, y: refY, width: refW, height: refH },
  };

  if (panoramaCache.size >= 14) {
    const oldestKey = panoramaCache.keys().next().value;
    if (oldestKey) panoramaCache.delete(oldestKey);
  }
  panoramaCache.set(cacheKey, result);

  return result;
}

/**
 * Synthesizes a Unified 360° Coastal Camp Panorama by placing the primary reference photo
 * untouched at the center (0° longitude) and blending complementary coastal camp reference scenes
 * around the 360° horizon while maintaining a continuous horizon line and seamless wrap.
 */
export async function synthesizeUnifiedCampPanorama(
  primaryImageSrc: string,
  secondaryImageSrcs: string[],
  options: EquirectangularSynthesisOptions
): Promise<SynthesizedPanoramaResult> {
  // Start with the exact single-photo equirectangular synthesis for the primary reference photo
  const baseResult = await synthesizeEquirectangularPanorama(primaryImageSrc, {
    ...options,
    inspectSeamCentered: false,
    highlightOriginalRegion: false,
  });

  const { canvas, width: W, height: H, centerRect } = baseResult;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const baseImageData = ctx.getImageData(0, 0, W, H);
  const basePixels = baseImageData.data;

  // Place up to 2 complementary scenes in the outer left/right wings (without overlapping the primary center photo)
  const wingPositionsU = [0.16, 0.84];
  for (let i = 0; i < Math.min(wingPositionsU.length, secondaryImageSrcs.length); i++) {
    try {
      const wingImg = await loadImageElement(secondaryImageSrcs[i]);
      const wAspect = (wingImg.naturalWidth || wingImg.width) / (wingImg.naturalHeight || wingImg.height);
      const wingH = Math.round(H * 0.56);
      const wingW = Math.round(wingH * wAspect);
      const wingX = Math.round(wingPositionsU[i] * W - wingW / 2);
      const wingY = Math.round(H / 2 - wingH * 0.52);

      // Ensure wing does not intrude into the untouched center reference photo
      if (wingX + wingW > centerRect.x - 16 && wingX < centerRect.x + centerRect.width + 16) {
        continue;
      }

      const wCanvas = document.createElement('canvas');
      wCanvas.width = wingW;
      wCanvas.height = wingH;
      const wCtx = wCanvas.getContext('2d', { willReadFrequently: true })!;
      wCtx.drawImage(wingImg, 0, 0, wingW, wingH);
      const wData = wCtx.getImageData(0, 0, wingW, wingH).data;

      const fX = Math.round(wingW * 0.22);
      const fY = Math.round(wingH * 0.22);

      for (let sy = 0; sy < wingH; sy++) {
        const py = wingY + sy;
        if (py < 0 || py >= H) continue;
        const ay = Math.min(smoothstep(0, fY, sy), smoothstep(0, fY, wingH - 1 - sy));

        for (let sx = 0; sx < wingW; sx++) {
          const px = ((wingX + sx) % W + W) % W;
          const ax = Math.min(smoothstep(0, fX, sx), smoothstep(0, fX, wingW - 1 - sx));
          const alpha = ax * ay * 0.85;
          if (alpha <= 0.001) continue;

          const sIdx = (sy * wingW + sx) * 4;
          const dIdx = (py * W + px) * 4;

          basePixels[dIdx] = clampByte(wData[sIdx] * alpha + basePixels[dIdx] * (1 - alpha));
          basePixels[dIdx + 1] = clampByte(wData[sIdx + 1] * alpha + basePixels[dIdx + 1] * (1 - alpha));
          basePixels[dIdx + 2] = clampByte(wData[sIdx + 2] * alpha + basePixels[dIdx + 2] * (1 - alpha));
        }
      }
    } catch {
      // Ignore if a secondary wing fails to load
    }
  }

  ctx.putImageData(baseImageData, 0, 0);

  if (options.inspectSeamCentered) {
    const temp = document.createElement('canvas');
    temp.width = W;
    temp.height = H;
    temp.getContext('2d')!.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const halfW = Math.floor(W / 2);
    ctx.drawImage(temp, halfW, 0, W - halfW, H, 0, 0, W - halfW, H);
    ctx.drawImage(temp, 0, 0, halfW, H, W - halfW, 0, halfW, H);
  }

  return {
    canvas,
    dataUrl: canvas.toDataURL('image/jpeg', 0.94),
    width: W,
    height: H,
    centerRect,
  };
}

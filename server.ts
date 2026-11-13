/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createServer } from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { ZONES, REFERENCE_SCENES, HIDER_PERSONA } from "./src/constants";

function stripHttpOptions(val: any): any {
  if (!val || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripHttpOptions);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (
      k === "httpOptions" ||
      k === "http_options" ||
      k === "__proto__" ||
      k === "constructor" ||
      k === "prototype" ||
      k === "cachedContent" ||
      k === "cached_content" ||
      k === "fileSearch" ||
      k === "file_search" ||
      k === "corpora" ||
      k === "semanticRetriever" ||
      k === "semantic_retriever"
    )
      continue;
    if ((k === "fileData" || k === "file_data") && v && typeof v === "object") {
      const rawU = (v as any).fileUri ?? (v as any).file_uri;
      const u = typeof rawU === "string" ? rawU.trim() : "";
      if (!/^https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(u)) continue;
    }
    out[k] = stripHttpOptions(v);
  }
  return out;
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 2);
  const httpServer = createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      req.body = stripHttpOptions(req.body);
    }
    next();
  });

  // API routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/streetview", async (req, res) => {
    try {
      const { lat, lng, key } = req.query;
      const sLat = String(lat ?? "").trim();
      const sLng = String(lng ?? "").trim();
      const sKey = String(key ?? "").trim();
      const nLat = Number(sLat);
      const nLng = Number(sLng);
      if (
        !sLat ||
        !sLng ||
        !sKey ||
        !/^-?\d+(?:\.\d+)?$/.test(sLat) ||
        !/^-?\d+(?:\.\d+)?$/.test(sLng) ||
        !Number.isFinite(nLat) ||
        !Number.isFinite(nLng) ||
        nLat < -90 ||
        nLat > 90 ||
        nLng < -180 ||
        nLng > 180 ||
        !/^[A-Za-z0-9_-]{20,128}$/.test(sKey)
      ) {
        return res.status(400).json({ error: "Invalid lat, lng, or key" });
      }
      const urlObj = new URL("https://maps.googleapis.com/maps/api/streetview");
      urlObj.searchParams.set("size", "600x400");
      urlObj.searchParams.set("location", `${nLat},${nLng}`);
      urlObj.searchParams.set("key", sKey);
      const response = await fetch(urlObj.toString(), { redirect: "error" });
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      res.json({ base64 });
    } catch (error) {
      console.error("Error fetching streetview:", error);
      res.status(500).json({ error: "Failed to fetch streetview image" });
    }
  });

  app.post("/api/hide", async (req, res): Promise<any> => {
    const { zoneId, sceneId } = req.body || {};
    const zone = ZONES[(zoneId as keyof typeof ZONES) || "global"] || ZONES.global;
    const bounds = zone.bounds;

    // Check if we are hiding in one of the 10 MID-STUDIOS 360° Coastal Reference Scenes
    const selectedScene = sceneId
      ? REFERENCE_SCENES.find((s) => s.id === sceneId)
      : zoneId === "coastal_360"
      ? REFERENCE_SCENES[Math.floor(Math.random() * REFERENCE_SCENES.length)]
      : null;

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      if (selectedScene) {
        return res.json({
          lat: selectedScene.lat,
          lng: selectedScene.lng,
          sceneId: selectedScene.id,
          message: selectedScene.hint,
        });
      }
      return res.json({
        ...zone.center,
        sceneId: null,
        message: "I'm hiding somewhere in this zone! Come find me!",
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });

      if (selectedScene) {
        const scenePrompt = `You are ${HIDER_PERSONA.name} (${HIDER_PERSONA.shortName}) from ${HIDER_PERSONA.studio}. You are hiding in a 360° coastal panorama scene titled "${selectedScene.title}" near ${selectedScene.regionName} during ${selectedScene.timeOfDay}. Visual details: ${selectedScene.hint}. Write a short, atmospheric, playful 1-2 sentence clue inviting the Seeker to inspect your 360° equirectangular panorama and guess where along the coast you are hiding without naming the exact town. Return ONLY a JSON object with a 'message' property.`;
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: scenePrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                message: { type: Type.STRING },
              },
              required: ["message"],
            },
          },
        });
        const text = response.text;
        const parsed = text ? JSON.parse(text) : null;
        return res.json({
          lat: selectedScene.lat,
          lng: selectedScene.lng,
          sceneId: selectedScene.id,
          message: parsed?.message || selectedScene.hint,
        });
      }

      let prompt = `You are ${HIDER_PERSONA.name} (${HIDER_PERSONA.shortName}) playing a game of GeoSeeker / Hide and Seek. You need to pick a hiding spot within the following zone: ${zone.name}.`;
      if (bounds) {
        prompt += ` The bounds are roughly: North ${bounds.north}, South ${bounds.south}, East ${bounds.east}, West ${bounds.west}.`;
      }
      prompt += ` Pick a random, interesting location (like a coastal landmark, park, or scenic street) within this area. Return ONLY a JSON object with 'lat', 'lng', and 'message' properties. The 'message' should be a cryptic, playful clue in character.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              message: { type: Type.STRING },
            },
            required: ["lat", "lng", "message"],
          },
        },
      });

      const text = response.text;
      if (text) {
        const data = JSON.parse(text);
        return res.json({
          lat: data.lat,
          lng: data.lng,
          sceneId: null,
          message: data.message || "I'm hiding somewhere in this zone! Come find me!",
        });
      }
    } catch (error) {
      console.error("Error getting hiding spot from Gemini:", error);
    }

    if (selectedScene) {
      return res.json({
        lat: selectedScene.lat,
        lng: selectedScene.lng,
        sceneId: selectedScene.id,
        message: selectedScene.hint,
      });
    }

    return res.json({
      ...zone.center,
      sceneId: null,
      message: "I'm hiding somewhere in this zone! Come find me!",
    });
  });

  app.post("/api/hint", async (req, res): Promise<any> => {
    const { zoneId, hiderLocation, previousGuesses, sceneId } = req.body || {};
    if (
      !hiderLocation ||
      typeof hiderLocation.lat !== "number" ||
      typeof hiderLocation.lng !== "number"
    ) {
      return res.status(400).json({ error: "Invalid hiderLocation." });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.json({
        hint: "Rotate the 360° panorama to inspect the coastline mountains and horizon glow!",
      });
    }

    const zone = ZONES[(zoneId as keyof typeof ZONES) || "global"] || ZONES.global;
    const matchedScene = sceneId ? REFERENCE_SCENES.find((s) => s.id === sceneId) : null;
    const guesses = Array.isArray(previousGuesses) ? previousGuesses : [];

    let prompt = `You are ${HIDER_PERSONA.name} (${HIDER_PERSONA.shortName}) hiding at latitude ${hiderLocation.lat}, longitude ${hiderLocation.lng} in ${zone.name}.`;
    if (matchedScene) {
      prompt += ` Your hiding scene is "${matchedScene.title}" (${matchedScene.regionName}) at ${matchedScene.timeOfDay}: ${matchedScene.hint}.`;
    }
    prompt += ` The seeker has made ${guesses.length} guesses so far.\n`;
    guesses.forEach((g: any, i: number) => {
      prompt += `Guess ${i + 1} was ${Number(g.distance || 0).toFixed(2)} km away.\n`;
    });
    prompt += `Provide a short, playful, atmospheric hint in character to help them narrow down the location without giving away the exact coordinates. Return ONLY a JSON object with a 'hint' property.`;

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hint: { type: Type.STRING },
            },
            required: ["hint"],
          },
        },
      });

      const text = response.text;
      if (text) {
        const data = JSON.parse(text);
        return res.json({ hint: data.hint || "Keep looking along the coast!" });
      }
    } catch (error) {
      console.error("Error getting hint from Gemini:", error);
    }

    return res.json({
      hint: "Look closely at the mountain ridge and the sea horizon in the 360° view!",
    });
  });

  app.post("/api/panorama/analyze", async (req, res): Promise<any> => {
    const { title, regionName, timeOfDay, hint } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.json({
        analysis: `${title || "Coastal Scene"} (${timeOfDay || "Twilight"}): Center reference preserved 1:1 with continuous 360°×180° horizon outpainting, matching warm campfire light and twilight sky gradients across the seam.`,
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      const prompt = `Describe in 2 concise sentences how the 360°x180° (2:1) equirectangular panorama extends the reference scene "${title}" (${regionName}, ${timeOfDay}: ${hint}) around the viewer—highlighting the unchanged center subject, the continuous center horizon line, the twilight sky zenith, and the seamless shoreline wrap.`;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return res.json({
        analysis:
          response.text ||
          "Center reference preserved 1:1 with seamless 360°×180° equirectangular coastal horizon continuation.",
      });
    } catch (error) {
      console.error("Error analyzing panorama:", error);
      return res.json({
        analysis:
          "Center reference preserved 1:1 with seamless 360°×180° equirectangular coastal horizon continuation.",
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(["/server.cjs", "/server.cjs.map"], (_req: any, res: any) =>
      res.status(404).end()
    );
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface CompassFeedbackProps {
  distance: number;
  bearing: number;
}

export default function CompassFeedback({ distance, bearing }: CompassFeedbackProps) {
  const [rotation, setRotation] = useState(bearing);

  useEffect(() => {
    // Calculate jitter amplitude based on distance (max 90 degrees, min 1 degree)
    const jitterAmplitude = Math.max(1, Math.min(90, distance / 20));
    
    const interval = setInterval(() => {
      const randomJitter = (Math.random() - 0.5) * 2 * jitterAmplitude;
      setRotation(bearing + randomJitter);
    }, 50); // Fast jitter

    return () => clearInterval(interval);
  }, [bearing, distance]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-16 h-16 rounded-full border-4 border-slate-200 bg-slate-50 shadow-inner flex items-center justify-center">
        <div 
          className="absolute text-red-500 transition-transform duration-75 ease-linear z-10"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <ArrowUp className="w-8 h-8" strokeWidth={3} />
        </div>
        {/* Compass markings */}
        <div className="absolute top-1 text-[8px] font-bold text-slate-400">N</div>
        <div className="absolute bottom-1 text-[8px] font-bold text-slate-400">S</div>
        <div className="absolute right-1 text-[8px] font-bold text-slate-400">E</div>
        <div className="absolute left-1 text-[8px] font-bold text-slate-400">W</div>
      </div>
      <div className="text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Signal Strength</p>
        <p className="font-mono font-bold text-slate-800 text-lg">
          <span className="text-blue-600">{Math.round(distance).toLocaleString()}</span> km
        </p>
      </div>
    </div>
  );
}

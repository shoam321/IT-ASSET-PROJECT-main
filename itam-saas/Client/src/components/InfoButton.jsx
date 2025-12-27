import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

export default function InfoButton({ title, description, examples = [] }) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      {/* Info Button */}
      <button
        onClick={() => setShowInfo(true)}
        className="p-1.5 rounded-lg bg-blue-600 bg-opacity-20 hover:bg-opacity-30 text-blue-400 transition"
        title="Learn more"
      >
        <Info className="w-4 h-4" />
      </button>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-lg w-full p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Info className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">{title}</h3>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <div className="text-slate-300 space-y-3 mb-4">
              <p>{description}</p>
            </div>

            {/* Examples (if provided) */}
            {examples.length > 0 && (
              <div className="bg-slate-900 bg-opacity-50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-slate-400 mb-2">What you can do:</h4>
                <ul className="space-y-2">
                  {examples.map((example, index) => (
                    <li key={index} className="text-sm text-slate-300 flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      <span>{example}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setShowInfo(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition font-medium"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

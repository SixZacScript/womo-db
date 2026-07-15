import { useState } from "react";
import { Settings, X } from "lucide-react";

export function SettingsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem("gemini-api-key") || "");

  function handleSave() {
    if (apiKey.trim()) {
      localStorage.setItem("gemini-api-key", apiKey.trim());
    } else {
      localStorage.removeItem("gemini-api-key");
    }
    setIsOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 rounded-full bg-gray-800 border border-gray-700 hover:bg-gray-700 shadow-lg z-40"
        title="Settings"
      >
        <Settings size={20} className="text-gray-100" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsOpen(false)}>
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Settings</h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-100">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-2">
                Google Gemini API Key (for AI Query)
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-3 py-2 rounded border border-gray-700 bg-gray-900 text-gray-100 outline-none text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Get free API key at{" "}
                <a href="https://aistudio.google.com" target="_blank" className="text-blue-400 hover:underline">
                  aistudio.google.com
                </a>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Save
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

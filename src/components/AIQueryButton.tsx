import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { generateMongoQuery } from "../services/ai";

interface AIQueryButtonProps {
  collectionName: string;
  sampleFields: string[];
  onQueryGenerated: (query: string) => void;
}

export function AIQueryButton({ collectionName, sampleFields, onQueryGenerated }: AIQueryButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!prompt.trim()) {
      setError("กรุณาใส่คำอธิบายที่ต้องการค้นหา");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await generateMongoQuery(
        {
          prompt: prompt.trim(),
          collectionName,
          sampleFields,
        },
        "" // No API key needed for LM Studio
      );

      onQueryGenerated(result.query);
      setIsOpen(false);
      setPrompt("");
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-medium shadow-sm"
      >
        <Sparkles size={16} />
        AI Query
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsOpen(false)}>
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg border border-gray-700 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-purple-400" size={20} />
              <h3 className="text-lg font-semibold text-gray-100">AI Query Generator</h3>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-2">
                อธิบายว่าต้องการค้นหาอะไร (ภาษาไทยหรืออังกฤษก็ได้)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder='ตัวอย่าง: "หา user ที่มีอายุมากกว่า 25" หรือ "find users created this month"'
                className="w-full px-3 py-2 rounded border border-gray-700 bg-gray-900 text-gray-100 outline-none text-sm resize-none"
                rows={3}
                disabled={isLoading}
              />
            </div>

            {!localStorage.getItem("chrome-ai-checked") && (
              <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded">
                <p className="text-xs text-blue-300 mb-2">
                  ต้องการ Chrome Built-in AI (Gemini Nano):
                </p>
                <ol className="text-xs text-blue-200 space-y-1 ml-4 list-decimal">
                  <li>ใช้ Chrome 127+ หรือใหม่กว่า</li>
                  <li>เปิด chrome://flags/#optimization-guide-on-device-model</li>
                  <li>เปิด chrome://flags/#prompt-api-for-gemini-nano</li>
                  <li>ตั้งค่าเป็น "Enabled" ทั้งสอง</li>
                  <li>Restart Chrome</li>
                </ol>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    กำลังสร้าง...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    สร้าง Query
                  </>
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

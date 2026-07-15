import { useState, useRef, useMemo, useCallback, useEffect } from "react";

interface CustomQueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  fieldNames?: string[];
}

interface Suggestion {
  label: string;
  type: string;
  kind: "field" | "operator" | "function";
}

const OPERATORS = [
  { label: "$eq", type: "Comparison", kind: "operator" as const },
  { label: "$ne", type: "Comparison", kind: "operator" as const },
  { label: "$gt", type: "Comparison", kind: "operator" as const },
  { label: "$gte", type: "Comparison", kind: "operator" as const },
  { label: "$lt", type: "Comparison", kind: "operator" as const },
  { label: "$lte", type: "Comparison", kind: "operator" as const },
  { label: "$in", type: "Comparison", kind: "operator" as const },
  { label: "$nin", type: "Comparison", kind: "operator" as const },
  { label: "$and", type: "Logical", kind: "operator" as const },
  { label: "$or", type: "Logical", kind: "operator" as const },
  { label: "$not", type: "Logical", kind: "operator" as const },
  { label: "$exists", type: "Element", kind: "operator" as const },
  { label: "$regex", type: "Evaluation", kind: "operator" as const },
];

export function CustomQueryEditor({ value, onChange, onExecute, fieldNames = [] }: CustomQueryEditorProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hide suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSuggestions([]);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const buildSuggestions = useCallback((filter: string) => {
    const allSuggestions: Suggestion[] = [];
    const lowerFilter = filter.toLowerCase();

    // Field suggestions
    for (const field of fieldNames) {
      if (!filter || field.toLowerCase().includes(lowerFilter)) {
        // Try to infer type from field name
        let type = "Unknown";
        if (field.includes("_id") || field === "_id") type = "ObjectId";
        else if (field.includes("date") || field.includes("time")) type = "Date";
        else if (field.includes("count") || field.includes("num")) type = "Number";
        else if (field.includes("name") || field.includes("code")) type = "String";

        allSuggestions.push({ label: field, type, kind: "field" });
      }
    }

    // Operator suggestions
    for (const op of OPERATORS) {
      if (!filter || op.label.toLowerCase().includes(lowerFilter)) {
        allSuggestions.push({ label: op.label, type: op.type, kind: op.kind });
      }
    }

    // ObjectId function
    if (!filter || "objectid".includes(lowerFilter)) {
      allSuggestions.push({ label: "ObjectId", type: "BSON Type", kind: "function" });
    }

    return allSuggestions;
  }, [fieldNames]);

  const handleInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const newValue = target.value;
    const cursorPos = target.selectionStart;

    onChange(newValue);

    // Extract word being typed
    let start = cursorPos - 1;
    while (start >= 0 && /[a-zA-Z0-9_$]/.test(newValue[start])) {
      start--;
    }
    start++;

    const currentWord = newValue.slice(start, cursorPos);

    // Show suggestions if typing or after trigger
    const shouldShow = currentWord.length > 0 || /[{:,\s]/.test(newValue[cursorPos - 1] || '');

    if (shouldShow) {
      const sugg = buildSuggestions(currentWord);
      setSuggestions(sugg);
      setSelectedIndex(0);
    } else {
      setSuggestions([]);
    }
  }, [onChange, buildSuggestions]);

  const insertSuggestion = useCallback((suggestion: Suggestion) => {
    if (!textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart;
    const text = value;

    // Find word start
    let start = cursorPos - 1;
    while (start >= 0 && /[a-zA-Z0-9_$]/.test(text[start])) {
      start--;
    }
    start++;

    let insertText = suggestion.label;
    let cursorOffset = insertText.length;

    if (suggestion.kind === "function") {
      insertText = 'ObjectId("")';
      cursorOffset = insertText.length - 2;
    }

    const newValue = text.slice(0, start) + insertText + text.slice(cursorPos);
    onChange(newValue);

    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = start + cursorOffset;
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        textareaRef.current.focus();
      }
    }, 0);

    setSuggestions([]);
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        insertSuggestion(suggestions[selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestions([]);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onExecute();
    }
  }, [suggestions, selectedIndex, insertSuggestion, onExecute]);

  function renderHighlighted(text: string): React.ReactElement[] {
    const elements: React.ReactElement[] = [];
    let i = 0;

    while (i < text.length) {
      const char = text[i];

      // String
      if (char === '"') {
        let str = '"';
        i++;
        while (i < text.length && text[i] !== '"') {
          if (text[i] === '\\') {
            str += text[i] + (text[i + 1] || '');
            i += 2;
          } else {
            str += text[i];
            i++;
          }
        }
        if (i < text.length) str += text[i++];
        elements.push(<span key={elements.length} className="text-green-400">{str}</span>);
        continue;
      }

      // Number
      if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(text[i + 1] || ''))) {
        let num = char;
        i++;
        while (i < text.length && /[0-9.]/.test(text[i])) {
          num += text[i++];
        }
        elements.push(<span key={elements.length} className="text-blue-400">{num}</span>);
        continue;
      }

      // Boolean/null
      const word = text.slice(i).match(/^(true|false|null)\b/);
      if (word) {
        elements.push(<span key={elements.length} className="text-purple-400">{word[0]}</span>);
        i += word[0].length;
        continue;
      }

      // ObjectId
      const oidMatch = text.slice(i).match(/^ObjectId/);
      if (oidMatch) {
        elements.push(<span key={elements.length} className="text-yellow-400">{oidMatch[0]}</span>);
        i += oidMatch[0].length;
        continue;
      }

      // Operators
      if (char === '$') {
        let op = '$';
        i++;
        while (i < text.length && /[a-zA-Z]/.test(text[i])) {
          op += text[i++];
        }
        elements.push(<span key={elements.length} className="text-cyan-400">{op}</span>);
        continue;
      }

      // Keys
      const keyMatch = text.slice(i).match(/^([a-zA-Z_][a-zA-Z0-9_\.]*)\s*:/);
      if (keyMatch) {
        elements.push(<span key={elements.length} className="text-red-300">{keyMatch[1]}</span>);
        i += keyMatch[1].length;
        continue;
      }

      elements.push(<span key={elements.length} className="text-gray-400">{char}</span>);
      i++;
    }

    return elements;
  }

  const highlightedContent = useMemo(() => renderHighlighted(value), [value]);

  return (
    <div className="flex gap-2 items-start">
      <div ref={containerRef} className="flex-1 relative border border-gray-700 rounded bg-gray-800">
        <div className="absolute inset-0 p-3 font-mono text-sm pointer-events-none whitespace-pre-wrap break-words overflow-hidden leading-relaxed">
          {highlightedContent}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="{}"
          className="relative w-full min-h-[80px] p-3 font-mono text-sm bg-transparent text-transparent caret-white outline-none resize-y leading-relaxed"
          style={{ caretColor: "#fff" }}
          spellCheck={false}
        />
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-y-auto z-[9999]">
            {suggestions.map((suggestion, idx) => (
              <div
                key={`${suggestion.label}-${idx}`}
                className={`px-3 py-2 cursor-pointer flex items-start justify-between gap-3 text-sm transition-colors ${
                  idx === selectedIndex ? "bg-gray-700" : "hover:bg-gray-700/50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertSuggestion(suggestion);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-mono font-medium">{suggestion.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    suggestion.kind === "field" ? "bg-green-600/30 text-green-300" :
                    suggestion.kind === "operator" ? "bg-cyan-600/30 text-cyan-300" :
                    "bg-yellow-600/30 text-yellow-300"
                  }`}>
                    {suggestion.kind}
                  </span>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{suggestion.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onExecute}
        className="px-4 py-2 h-[80px] rounded bg-green-600 hover:bg-green-700 text-sm font-medium"
      >
        Find
      </button>
    </div>
  );
}

import Editor from "@monaco-editor/react";
import { editor } from "monaco-editor";

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  fieldNames?: string[];
}

export function QueryEditor({ value, onChange, onExecute, fieldNames = [] }: QueryEditorProps) {
  function normalizeQuery(input: string): string {
    // Convert MongoDB shell syntax to JSON
    // {_id:ObjectId('...')} -> {"_id": {"$oid": "..."}}
    // {code:"ENL65050001"} -> {"code": "ENL65050001"}

    let normalized = input.trim();

    // Replace ObjectId('...') with {"$oid": "..."}
    normalized = normalized.replace(/ObjectId\(['"]([^'"]+)['"]\)/g, '{"$oid": "$1"}');

    // Add quotes to unquoted keys
    normalized = normalized.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // Add quotes to unquoted string values (but not numbers/booleans)
    // Match: key: value (where value is not already quoted, not a number, not true/false/null, not ObjectId result, not {)
    normalized = normalized.replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*([,}])/g, (match, value, trailing) => {
      if (value === 'true' || value === 'false' || value === 'null') {
        return `: ${value}${trailing}`;
      }
      return `: "${value}"${trailing}`;
    });

    return normalized;
  }

  function handleExecute() {
    const normalized = normalizeQuery(value);
    onChange(normalized);
    onExecute();
  }

  function handleEditorMount(editor: editor.IStandaloneCodeEditor, monaco: any) {
    // Add Enter key binding to execute query
    editor.addCommand(monaco.KeyCode.Enter, () => {
      handleExecute();
    });

    // Register autocomplete provider
    monaco.languages.registerCompletionItemProvider("json", {
      provideCompletionItems: (model: any, position: any) => {
        const suggestions = [];
        const textBeforeCursor = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Add field name suggestions
        for (const field of fieldNames) {
          suggestions.push({
            label: field,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: field,
            documentation: `Field from collection`,
            sortText: `0_${field}`, // Sort fields first
          });
        }

        // Add MongoDB query operators
        const operators = [
          { label: "$eq", doc: "Matches values equal to specified value" },
          { label: "$ne", doc: "Matches values not equal to specified value" },
          { label: "$gt", doc: "Matches values greater than specified value" },
          { label: "$gte", doc: "Matches values greater than or equal" },
          { label: "$lt", doc: "Matches values less than specified value" },
          { label: "$lte", doc: "Matches values less than or equal" },
          { label: "$in", doc: "Matches any value in array" },
          { label: "$nin", doc: "Matches none of values in array" },
          { label: "$and", doc: "Joins query clauses with AND" },
          { label: "$or", doc: "Joins query clauses with OR" },
          { label: "$not", doc: "Inverts effect of query expression" },
          { label: "$exists", doc: "Matches documents with field" },
          { label: "$regex", doc: "Matches documents with regex pattern" },
        ];

        for (const op of operators) {
          suggestions.push({
            label: op.label,
            kind: monaco.languages.CompletionItemKind.Operator,
            insertText: op.label,
            documentation: op.doc,
            sortText: `1_${op.label}`, // Sort operators after fields
          });
        }

        // Add ObjectId helper
        suggestions.push({
          label: "ObjectId",
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'ObjectId("$0")',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "MongoDB ObjectId",
          sortText: "2_ObjectId",
        });

        return { suggestions };
      },
      triggerCharacters: ["{", ":", ",", " ", '"'],
    });
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="flex-1 border border-gray-700 rounded overflow-hidden">
        <Editor
          height="80px"
          defaultLanguage="json"
          theme="vs-dark"
          value={value}
          onChange={(val) => onChange(val || "{}")}
          onMount={(editor, monaco) => {
            handleEditorMount(editor, monaco);

            // Bind Enter key to execute
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, handleExecute);
            editor.addCommand(monaco.KeyCode.Enter, handleExecute);
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "off",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: "on",
            folding: false,
            glyphMargin: false,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 0,
            suggest: {
              snippetsPreventQuickSuggestions: false,
            },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
          }}
        />
      </div>
      <button
        onClick={handleExecute}
        className="px-4 py-2 h-[80px] rounded bg-green-600 hover:bg-green-700 text-sm font-medium"
      >
        Find
      </button>
    </div>
  );
}

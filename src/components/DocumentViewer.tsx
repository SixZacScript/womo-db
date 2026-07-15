import { useState, useEffect } from "react";

interface Document {
  _id?: any;
  [key: string]: any;
}

interface DocumentViewerProps {
  documents: Document[];
  onUpdate: (docId: string, newContent: string) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
}

export function DocumentViewer({ documents, onUpdate, onDelete }: DocumentViewerProps) {
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [localDocuments, setLocalDocuments] = useState<Document[]>(documents);

  // Sync local documents with prop changes
  useEffect(() => {
    setLocalDocuments(documents);
  }, [documents]);

  function startEdit(docId: string, path: string, value: any) {
    const key = `${docId}:${path}`;
    setEditingPath(key);

    // Extract actual value from BSON types
    if (value && typeof value === 'object') {
      if (value.$oid) {
        setEditValue(JSON.stringify(value.$oid));
        return;
      }
      if (value.$date) {
        const dateVal = value.$date.$numberLong ? parseInt(value.$date.$numberLong) : value.$date;
        setEditValue(JSON.stringify(new Date(dateVal).toISOString()));
        return;
      }
    }

    setEditValue(JSON.stringify(value));
  }

  async function saveEdit(doc: Document, path: string) {
    try {
      const newValue = JSON.parse(editValue);
      const updatedDoc = { ...doc };

      // Update nested path
      const keys = path.split('.');
      let current: any = updatedDoc;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = newValue;

      const docId = doc._id?.$oid || doc._id;

      // Update local state immediately
      setLocalDocuments(prev => prev.map(d =>
        (d._id?.$oid || d._id) === docId ? updatedDoc : d
      ));
      setEditingPath(null);

      // Then sync to server
      await onUpdate(docId, JSON.stringify(updatedDoc));
    } catch (e) {
      alert(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function deleteField(doc: Document, path: string) {
    if (!confirm(`Delete field "${path}"?`)) return;

    try {
      const updatedDoc = { ...doc };
      const keys = path.split('.');

      if (keys.length === 1) {
        delete updatedDoc[keys[0]];
      } else {
        let current: any = updatedDoc;
        for (let i = 0; i < keys.length - 1; i++) {
          current = current[keys[i]];
        }
        delete current[keys[keys.length - 1]];
      }

      const docId = doc._id?.$oid || doc._id;

      // Update local state immediately
      setLocalDocuments(prev => prev.map(d =>
        (d._id?.$oid || d._id) === docId ? updatedDoc : d
      ));

      // Then sync to server
      await onUpdate(docId, JSON.stringify(updatedDoc));
    } catch (e) {
      alert(`Error deleting field: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function addField(doc: Document, parentPath: string) {
    const fieldName = prompt("Field name:");
    if (!fieldName) return;

    const fieldValue = prompt("Field value (JSON):");
    if (fieldValue === null) return;

    try {
      const newValue = JSON.parse(fieldValue);
      const updatedDoc = { ...doc };

      if (parentPath === "") {
        updatedDoc[fieldName] = newValue;
      } else {
        const keys = parentPath.split('.');
        let current: any = updatedDoc;
        for (const key of keys) {
          current = current[key];
        }
        current[fieldName] = newValue;
      }

      const docId = doc._id?.$oid || doc._id;

      // Update local state immediately
      setLocalDocuments(prev => prev.map(d =>
        (d._id?.$oid || d._id) === docId ? updatedDoc : d
      ));

      // Then sync to server
      await onUpdate(docId, JSON.stringify(updatedDoc));
    } catch (e) {
      alert(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function renderValue(value: any, docId: string, path: string = "", depth: number = 0): JSX.Element {
    const editKey = `${docId}:${path}`;
    const isEditing = editingPath === editKey;

    if (isEditing) {
      return (
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => {
            const doc = localDocuments.find(d => (d._id?.$oid || d._id) === docId);
            if (doc) saveEdit(doc, path);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const doc = localDocuments.find(d => (d._id?.$oid || d._id) === docId);
              if (doc) saveEdit(doc, path);
            } else if (e.key === 'Escape') {
              setEditingPath(null);
            }
          }}
          autoFocus
          className="bg-gray-700 px-2 py-0.5 rounded border border-blue-500 outline-none text-sm min-w-[200px] resize-none overflow-hidden"
          rows={1}
          style={{
            width: `${Math.max(200, editValue.length * 8 + 20)}px`,
            height: 'auto'
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
        />
      );
    }

    if (value === null) {
      return (
        <span
          className="text-purple-400 cursor-pointer hover:bg-gray-700 px-1 rounded"
          onDoubleClick={() => startEdit(docId, path, value)}
        >
          null
        </span>
      );
    }
    if (value === undefined) {
      return (
        <span
          className="text-gray-500 cursor-pointer hover:bg-gray-700 px-1 rounded"
          onDoubleClick={() => startEdit(docId, path, value)}
        >
          undefined
        </span>
      );
    }

    const type = typeof value;

    if (type === "string") {
      return (
        <span
          className="text-green-400 cursor-pointer hover:bg-gray-700 px-1 rounded"
          onDoubleClick={() => startEdit(docId, path, value)}
        >
          "{value}"
        </span>
      );
    }
    if (type === "number") {
      return (
        <span
          className="text-blue-400 cursor-pointer hover:bg-gray-700 px-1 rounded"
          onDoubleClick={() => startEdit(docId, path, value)}
        >
          {value}
        </span>
      );
    }
    if (type === "boolean") {
      return (
        <span
          className="text-purple-400 cursor-pointer hover:bg-gray-700 px-1 rounded"
          onDoubleClick={() => startEdit(docId, path, value)}
        >
          {String(value)}
        </span>
      );
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return (
          <span
            className="text-gray-400 cursor-pointer hover:bg-gray-700 px-1 rounded"
            onDoubleClick={() => startEdit(docId, path, value)}
          >
            []
          </span>
        );
      }
      return (
        <div className="ml-4">
          <span className="text-gray-400">[</span>
          {value.map((item, idx) => (
            <div key={idx} className="ml-4">
              {renderValue(item, docId, `${path}[${idx}]`, depth + 1)}
              {idx < value.length - 1 && <span className="text-gray-400">,</span>}
            </div>
          ))}
          <span className="text-gray-400">]</span>
        </div>
      );
    }
    if (type === "object") {
      // Handle special BSON types
      if (value.$oid) {
        return (
          <span
            className="text-yellow-400 cursor-pointer hover:bg-gray-700 px-1 rounded"
            onDoubleClick={() => startEdit(docId, path, value)}
          >
            ObjectId("{value.$oid}")
          </span>
        );
      }
      if (value.$date) {
        try {
          const date = new Date(value.$date.$numberLong ? parseInt(value.$date.$numberLong) : value.$date);
          if (!isNaN(date.getTime())) {
            return (
              <span
                className="text-cyan-400 cursor-pointer hover:bg-gray-700 px-1 rounded"
                onDoubleClick={() => startEdit(docId, path, value)}
              >
                ISODate("{date.toISOString()}")
              </span>
            );
          }
        } catch (e) {
          // Fall through
        }
      }

      const keys = Object.keys(value);
      if (keys.length === 0) {
        return (
          <span
            className="text-gray-400 cursor-pointer hover:bg-gray-700 px-1 rounded"
            onDoubleClick={() => startEdit(docId, path, value)}
          >
            {"{}"}
          </span>
        );
      }

      return (
        <div className="ml-4">
          <span className="text-gray-400">{"{"}</span>
          {keys.map((key, idx) => (
            <div key={key} className="ml-4 group relative">
              <span className="text-red-300">{key}</span>
              <span className="text-gray-400">: </span>
              {renderValue(value[key], docId, path ? `${path}.${key}` : key, depth + 1)}
              {idx < keys.length - 1 && <span className="text-gray-400">,</span>}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const doc = localDocuments.find(d => (d._id?.$oid || d._id) === docId);
                  if (doc) deleteField(doc, path ? `${path}.${key}` : key);
                }}
                className="ml-2 px-1.5 py-0.5 text-xs rounded bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
          <div className="ml-4">
            <button
              onClick={() => {
                const doc = localDocuments.find(d => (d._id?.$oid || d._id) === docId);
                if (doc) addField(doc, path);
              }}
              className="text-xs text-green-400 hover:text-green-300 border border-green-600/50 px-2 py-0.5 rounded bg-green-600/10 hover:bg-green-600/20"
            >
              + Add field
            </button>
          </div>
          <span className="text-gray-400">{"}"}</span>
        </div>
      );
    }

    return (
      <span
        className="text-gray-400 cursor-pointer hover:bg-gray-700 px-1 rounded"
        onDoubleClick={() => startEdit(docId, path, value)}
      >
        {String(value)}
      </span>
    );
  }

  if (documents.length === 0) {
    return <p className="text-gray-500 text-center py-8">No documents found</p>;
  }

  return (
    <div className="border border-gray-700 rounded overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-800 border-b border-gray-700">
          <tr>
            <th className="text-left py-2 px-3 font-semibold text-sm w-16">#</th>
            <th className="text-left py-2 px-3 font-semibold text-sm">Document</th>
            <th className="text-right py-2 px-3 font-semibold text-sm w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, idx) => {
            const docId = doc._id?.$oid || doc._id;

            return (
              <tr key={docId || idx} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-3 px-3 text-gray-500 text-sm align-top">{idx + 1}</td>
                <td className="py-3 px-3 font-mono text-sm">
                  <div className="leading-relaxed">{renderValue(doc, docId, "", 0)}</div>
                </td>
                <td className="py-3 px-3 align-top">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => onDelete(docId)}
                      className="px-3 py-1 text-xs rounded bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

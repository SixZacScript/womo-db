import { X, Database, Table } from "lucide-react";
import { useTabContext } from "../contexts/TabContext";

export function TabBar() {
  const { tabs, activeTabId, switchTab, closeTab } = useTabContext();

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-1 bg-gray-800 border-b border-gray-700 px-2 py-1 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;

        return (
          <div
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-t cursor-pointer
              min-w-[120px] max-w-[200px] group
              ${isActive
                ? 'bg-gray-900 border-b-2 border-blue-500 text-gray-100'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
              }
            `}
          >
            {tab.type === 'collection' ? (
              <Database size={14} className="flex-shrink-0" />
            ) : (
              <Table size={14} className="flex-shrink-0" />
            )}

            <span className="flex-1 truncate text-sm">
              {tab.label}
            </span>

            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
              >
                <X size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

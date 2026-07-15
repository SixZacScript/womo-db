import { useTabContext } from "../contexts/TabContext";
import { Collections } from "../pages/Collections";
import { Documents } from "../pages/Documents";

interface TabContentProps {
  selectedDb: string;
  favoriteCollections: Set<string>;
  onToggleFavoriteCollection: (colName: string) => void;
}

export function TabContent({ favoriteCollections, onToggleFavoriteCollection }: TabContentProps) {
  const { tabs, activeTabId } = useTabContext();

  const activeTab = tabs.find(t => t.id === activeTabId);

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <p>Select a database to start</p>
      </div>
    );
  }

  if (activeTab.type === 'collection') {
    return (
      <Collections
        selectedDb={activeTab.db}
        favoriteCollections={favoriteCollections}
        onToggleFavoriteCollection={onToggleFavoriteCollection}
      />
    );
  }

  if (activeTab.type === 'documents' && activeTab.collection) {
    return (
      <Documents
        selectedDb={activeTab.db}
        selectedCollection={activeTab.collection}
        tabId={activeTab.id}
      />
    );
  }

  return null;
}

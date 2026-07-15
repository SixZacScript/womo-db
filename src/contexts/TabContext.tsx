import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Tab {
  id: string;
  type: 'collection' | 'documents';
  db: string;
  collection?: string;
  label: string;
  state?: {
    query?: string;
    page?: number;
    pageSize?: number;
  };
}

interface TabContextType {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Omit<Tab, 'id'>) => string;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  updateTabState: (id: string, state: Partial<Tab['state']>) => void;
  clearTabs: () => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function TabProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Load tabs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('womo-db-tabs');
    if (stored) {
      try {
        const { tabs: storedTabs, activeTabId: storedActiveId } = JSON.parse(stored);
        if (storedTabs && storedTabs.length > 0) {
          setTabs(storedTabs);
          setActiveTabId(storedActiveId || storedTabs[0].id);
        }
      } catch (e) {
        console.error('Failed to load tabs from localStorage:', e);
      }
    }
  }, []);

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    if (tabs.length > 0) {
      localStorage.setItem('womo-db-tabs', JSON.stringify({ tabs, activeTabId }));
    } else {
      localStorage.removeItem('womo-db-tabs');
    }
  }, [tabs, activeTabId]);

  function addTab(tab: Omit<Tab, 'id'>): string {
    // Check if tab already exists
    const existingTab = tabs.find(
      t => t.type === tab.type &&
           t.db === tab.db &&
           t.collection === tab.collection
    );

    if (existingTab) {
      setActiveTabId(existingTab.id);
      return existingTab.id;
    }

    // Create new tab
    const newTab: Tab = {
      ...tab,
      id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    return newTab.id;
  }

  function closeTab(id: string) {
    // Don't close if it's the only tab
    if (tabs.length === 1) return;

    const tabIndex = tabs.findIndex(t => t.id === id);
    if (tabIndex === -1) return;

    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);

    // If closing active tab, switch to adjacent tab
    if (activeTabId === id) {
      const nextIndex = tabIndex < newTabs.length ? tabIndex : tabIndex - 1;
      setActiveTabId(newTabs[nextIndex]?.id || null);
    }
  }

  function switchTab(id: string) {
    if (tabs.find(t => t.id === id)) {
      setActiveTabId(id);
    }
  }

  function updateTabState(id: string, state: Partial<Tab['state']>) {
    setTabs(prev => prev.map(tab =>
      tab.id === id
        ? { ...tab, state: { ...tab.state, ...state } }
        : tab
    ));
  }

  function clearTabs() {
    setTabs([]);
    setActiveTabId(null);
    localStorage.removeItem('womo-db-tabs');
  }

  return (
    <TabContext.Provider value={{
      tabs,
      activeTabId,
      addTab,
      closeTab,
      switchTab,
      updateTabState,
      clearTabs,
    }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabContext() {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabContext must be used within TabProvider');
  }
  return context;
}

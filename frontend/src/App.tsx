import { useState } from "react";
import CanvasPanel from "./components/CanvasPanel";
import ChatWindow from "./components/ChatWindow";
import MemoryPanel from "./components/MemoryPanel";
import PromptLibrary from "./components/PromptLibrary";
import SettingsModal from "./components/SettingsModal";
import Sidebar from "./components/Sidebar";
import { useChat } from "./lib/store";

export default function App() {
  const { canvasOpen, setCanvasOpen, notice, setNotice, settings } = useChat();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showMemory, setShowMemory] = useState(false);

  const openArtifact = (id: string) => {
    setSelectedArtifact(id);
    setCanvasOpen(true);
  };

  return (
    <div className="app">
      <Sidebar
        collapsed={sidebarCollapsed}
        onOpenSettings={() => setShowSettings(true)}
        onOpenPrompts={() => setShowPrompts(true)}
        onOpenMemory={() => setShowMemory(true)}
      />
      <div className="main">
        <ChatWindow
          onOpenArtifact={openArtifact}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        {canvasOpen && (
          <CanvasPanel
            selectedId={selectedArtifact}
            onSelect={setSelectedArtifact}
            onClose={() => setCanvasOpen(false)}
          />
        )}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showPrompts && <PromptLibrary onClose={() => setShowPrompts(false)} />}
      {showMemory && <MemoryPanel onClose={() => setShowMemory(false)} />}

      {!settings?.has_api_key && !showSettings && (
        <div className="toast" style={{ borderColor: "var(--accent)" }}>
          No OpenRouter API key set.{" "}
          <button className="btn ghost" onClick={() => setShowSettings(true)} style={{ color: "var(--accent)" }}>
            Open Settings
          </button>
        </div>
      )}

      {notice && (
        <div className="toast" onClick={() => setNotice(null)} title="Click to dismiss">
          {notice}
        </div>
      )}
    </div>
  );
}

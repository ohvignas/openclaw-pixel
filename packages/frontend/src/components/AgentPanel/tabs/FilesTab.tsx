import { useState, useEffect } from "react";

const AGENT_FILES = ["AGENTS.md", "SOUL.md", "IDENTITY.md", "USER.md", "TOOLS.md", "MEMORY.md", "BOOTSTRAP.md", "HEARTBEAT.md"] as const;
type AgentFile = typeof AGENT_FILES[number];

export function FilesTab({ agentId }: { agentId: string }) {
  const [selected, setSelected] = useState<AgentFile>("AGENTS.md");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/files/${encodeURIComponent(agentId)}/${selected}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { content?: string }) => setContent(d.content ?? ""))
      .catch((err: Error) => { if (err.name !== "AbortError") setContent(""); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [agentId, selected]);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(agentId)}/${selected}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError("Échec de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      {/* Sélecteur de fichier */}
      <div className="flex gap-1 shrink-0 flex-wrap">
        {AGENT_FILES.map((f) => (
          <button
            key={f}
            onClick={() => setSelected(f)}
            className={`font-pixel text-xs px-2 py-1 border transition-colors ${
              selected === f
                ? "border-pixel-accent text-pixel-accent"
                : "border-pixel-border text-gray-500 hover:text-gray-300"
            }`}
          >
            {f.replace(".md", "")}
          </button>
        ))}
      </div>

      {/* Editeur */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="font-pixel text-xs text-gray-600">Chargement...</span>
        </div>
      ) : (
        <textarea
          className="flex-1 bg-pixel-bg border border-pixel-border text-gray-300 font-mono text-xs p-2 resize-none focus:outline-none focus:border-pixel-accent"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
        />
      )}

      {/* Erreur sauvegarde */}
      {saveError && (
        <div className="shrink-0 font-pixel text-xs text-pixel-red py-1">{saveError}</div>
      )}

      {/* Bouton save */}
      <button
        onClick={save}
        disabled={saving}
        className={`shrink-0 font-pixel text-xs py-1 transition-colors ${
          saved
            ? "bg-pixel-green text-black"
            : "bg-pixel-accent text-white hover:opacity-80 disabled:opacity-50"
        }`}
      >
        {saved ? "✓ Sauvegarde" : saving ? "Sauvegarde..." : "Sauvegarder"}
      </button>
    </div>
  );
}

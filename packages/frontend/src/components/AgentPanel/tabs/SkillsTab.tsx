import { useState } from "react";

interface ClawHubSkill {
  slug: string;
  name: string;
  description: string;
  stars?: number;
}

export function SkillsTab({ agentId }: { agentId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClawHubSkill[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clawhub/search?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as ClawHubSkill[];
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setError("Impossible de contacter ClawHub");
    } finally {
      setLoading(false);
    }
  };

  const install = async (skill: ClawHubSkill) => {
    setInstalling(skill.slug);
    try {
      const res = await fetch("/api/clawhub/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: skill.slug, agentId }),
      });
      if (res.ok) {
        setInstalled((s) => new Set([...s, skill.slug]));
      }
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex gap-2">
        <input
          className="flex-1 bg-pixel-bg border border-pixel-border text-white font-pixel text-xs px-2 py-1 focus:outline-none focus:border-pixel-accent"
          placeholder="Chercher sur ClawHub..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button
          onClick={search}
          disabled={loading}
          className="bg-pixel-accent text-white font-pixel text-xs px-3 py-1 hover:opacity-80 disabled:opacity-50"
        >
          {loading ? "..." : "🔍"}
        </button>
      </div>

      {error && <p className="font-pixel text-xs text-pixel-red">{error}</p>}

      <div className="space-y-2">
        {results.map((skill) => (
          <div key={skill.slug} className="bg-pixel-bg border border-pixel-border p-2 flex justify-between items-start gap-2">
            <div className="min-w-0">
              <div className="font-pixel text-xs text-white">{skill.name}</div>
              <div className="font-pixel text-xs text-gray-500 mt-1 line-clamp-2">{skill.description}</div>
              {skill.stars !== undefined && (
                <div className="font-pixel text-xs text-gray-600 mt-1">★ {skill.stars}</div>
              )}
            </div>
            <button
              onClick={() => install(skill)}
              disabled={installing === skill.slug || installed.has(skill.slug)}
              className="bg-pixel-green text-black font-pixel text-xs px-2 py-1 shrink-0 hover:opacity-80 disabled:opacity-50"
            >
              {installed.has(skill.slug) ? "✓" : installing === skill.slug ? "..." : "+ Install"}
            </button>
          </div>
        ))}
        {results.length === 0 && query && !loading && (
          <p className="font-pixel text-xs text-gray-600">Aucun résultat</p>
        )}
      </div>
    </div>
  );
}

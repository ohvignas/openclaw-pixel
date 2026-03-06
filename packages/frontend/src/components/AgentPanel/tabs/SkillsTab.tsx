import { FormEvent, useEffect, useMemo, useState } from "react";
import { getGatewayConfig, isSkillEnabled, patchGatewayConfig } from "../../../openclaw/agentConfig.ts";

interface ClawHubSearchDebug {
  query?: string;
  command?: string;
  stdout?: string;
  stderr?: string;
}

interface ClawHubSkill {
  slug: string;
  name: string;
  description: string;
  summary?: string;
  stars?: number;
  downloads?: number;
  installsCurrent?: number;
  installsAllTime?: number;
  version?: string | null;
  updatedAt?: number | null;
  ownerHandle?: string | null;
  pageUrl?: string | null;
}

interface ClawHubSkillVersion {
  version: string;
  createdAt: number;
  changelog: string;
  changelogSource?: string;
}

interface ClawHubSkillDetail {
  slug: string;
  displayName: string;
  summary: string;
  ownerHandle?: string | null;
  ownerDisplayName?: string | null;
  ownerImage?: string | null;
  latestVersion?: ClawHubSkillVersion | null;
  stats?: {
    comments?: number;
    downloads?: number;
    installsAllTime?: number;
    installsCurrent?: number;
    stars?: number;
    versions?: number;
  };
  createdAt?: number;
  updatedAt?: number;
  pageUrl?: string;
}

interface InstalledSkill {
  name: string;
  title: string;
  description?: string;
  hasSkillFile: boolean;
  updatedAt: number;
}

interface SkillFileEntry {
  path: string;
  size?: number | null;
}

interface ClawHubDiscoverResponse {
  items?: Array<{
    slug: string;
    displayName: string;
    summary?: string;
    latestVersion?: { version: string } | null;
    stats?: {
      downloads?: number;
      installsAllTime?: number;
      installsCurrent?: number;
      stars?: number;
      versions?: number;
    };
    pageUrl?: string;
    updatedAt?: number;
  }>;
}

interface CreateSkillFormState {
  slug: string;
  title: string;
  description: string;
  whenToUse: string;
  instructions: string;
  emoji: string;
  homepage: string;
  requiresBins: string;
  requiresEnv: string;
  requiresConfig: string;
}

const EMPTY_CREATE_FORM: CreateSkillFormState = {
  slug: "",
  title: "",
  description: "",
  whenToUse: "",
  instructions: "",
  emoji: "",
  homepage: "",
  requiresBins: "",
  requiresEnv: "",
  requiresConfig: "",
};

export function SkillsTab({ agentId }: { agentId: string }) {
  const [activeSection, setActiveSection] = useState<"agent" | "create">("agent");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClawHubSkill[]>([]);
  const [selectedSearchSkillSlug, setSelectedSearchSkillSlug] = useState<string | null>(null);
  const [selectedSearchSkillDetail, setSelectedSearchSkillDetail] = useState<ClawHubSkillDetail | null>(null);
  const [selectedSearchSkillVersions, setSelectedSearchSkillVersions] = useState<ClawHubSkillVersion[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingSkill, setCreatingSkill] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchDebug, setSearchDebug] = useState<ClawHubSearchDebug | null>(null);
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [installedLoading, setInstalledLoading] = useState(true);
  const [skillEnabledState, setSkillEnabledState] = useState<Record<string, boolean>>({});
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [selectedSkillContent, setSelectedSkillContent] = useState("");
  const [installedSkillFiles, setInstalledSkillFiles] = useState<SkillFileEntry[]>([]);
  const [selectedInstalledFilePath, setSelectedInstalledFilePath] = useState<string | null>(null);
  const [skillFileLoading, setSkillFileLoading] = useState(false);
  const [savingSkill, setSavingSkill] = useState(false);
  const [deletingSkill, setDeletingSkill] = useState(false);
  const [saved, setSaved] = useState(false);
  const [createSkillForm, setCreateSkillForm] = useState<CreateSkillFormState>(EMPTY_CREATE_FORM);
  const [searchSkillFiles, setSearchSkillFiles] = useState<SkillFileEntry[]>([]);
  const [selectedSearchFilePath, setSelectedSearchFilePath] = useState<string | null>(null);
  const [selectedSearchFileContent, setSelectedSearchFileContent] = useState("");
  const [searchFileLoading, setSearchFileLoading] = useState(false);

  const refreshInstalledSkills = async () => {
    setInstalledLoading(true);
    try {
      const res = await fetch(`/api/agent-skills/${encodeURIComponent(agentId)}`);
      const data = (await res.json()) as { items?: InstalledSkill[]; error?: string; detail?: string };
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Impossible de lister les skills.");
      }
      setInstalledSkills(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lister les skills.");
      setInstalledSkills([]);
    } finally {
      setInstalledLoading(false);
    }
  };

  const refreshSkillEnabledState = async () => {
    try {
      const config = await getGatewayConfig();
      setSkillEnabledState(
        Object.fromEntries(
          installedSkills.map((skill) => [skill.name, isSkillEnabled(config, skill.name)]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de lire la configuration des skills.");
    }
  };

  const loadDiscover = async () => {
    setLoading(true);
    setError(null);
    setSearchDebug(null);
    try {
      const res = await fetch("/api/clawhub/discover?sort=downloads");
      const data = (await res.json()) as ClawHubDiscoverResponse & { error?: string; detail?: string };
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Impossible de charger le catalogue ClawHub.");
      }
      const nextResults = Array.isArray(data.items)
        ? data.items.map((item) => ({
            slug: item.slug,
            name: item.displayName,
            description: item.summary ?? "",
            summary: item.summary ?? "",
            stars: item.stats?.stars,
            downloads: item.stats?.downloads,
            installsCurrent: item.stats?.installsCurrent,
            installsAllTime: item.stats?.installsAllTime,
            version: item.latestVersion?.version ?? null,
            updatedAt: item.updatedAt ?? null,
            pageUrl: item.pageUrl ?? `https://clawhub.ai/skills/${encodeURIComponent(item.slug)}`,
          }))
        : [];

      setResults(nextResults);
      setSelectedSearchSkillSlug((current) => current ?? nextResults[0]?.slug ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le catalogue ClawHub.");
      setResults([]);
      setSelectedSearchSkillSlug(null);
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    if (!query.trim()) {
      await loadDiscover();
      return;
    }

    setLoading(true);
    setError(null);
    setSearchDebug(null);
    try {
      const res = await fetch(`/api/clawhub/search?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as {
        items?: ClawHubSkill[];
        debug?: ClawHubSearchDebug;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Impossible de contacter ClawHub.");
      }
      const nextResults = Array.isArray(data.items) ? data.items : [];
      setResults(nextResults);
      setSelectedSearchSkillSlug(nextResults[0]?.slug ?? null);
      setSearchDebug(data.debug ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de contacter ClawHub.");
      setResults([]);
      setSelectedSearchSkillSlug(null);
      setSearchDebug(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshInstalledSkills();
    void loadDiscover();
  }, [agentId]);

  useEffect(() => {
    if (installedSkills.length === 0) {
      setSkillEnabledState({});
      return;
    }
    void refreshSkillEnabledState();
  }, [installedSkills]);

  useEffect(() => {
    if (!selectedSkillName) return;
    setSkillFileLoading(true);
    setError(null);
    fetch(`/api/agent-skills/${encodeURIComponent(agentId)}/${encodeURIComponent(selectedSkillName)}/files/list`)
      .then(async (res) => {
        const data = (await res.json()) as { items?: SkillFileEntry[]; error?: string; detail?: string };
        if (!res.ok) {
          throw new Error(data.detail || data.error || "Impossible de charger le skill.");
        }
        const items = Array.isArray(data.items) ? data.items : [];
        setInstalledSkillFiles(items);
        setSelectedInstalledFilePath(items.find((item) => item.path === "SKILL.md")?.path ?? items[0]?.path ?? null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Impossible de charger le skill.");
        setSelectedSkillContent("");
        setInstalledSkillFiles([]);
        setSelectedInstalledFilePath(null);
      })
      .finally(() => setSkillFileLoading(false));
  }, [agentId, selectedSkillName]);

  useEffect(() => {
    if (!selectedSkillName || !selectedInstalledFilePath) {
      return;
    }

    setSkillFileLoading(true);
    fetch(
      `/api/agent-skills/${encodeURIComponent(agentId)}/${encodeURIComponent(selectedSkillName)}/files/content?path=${encodeURIComponent(selectedInstalledFilePath)}`,
    )
      .then(async (res) => {
        const data = (await res.json()) as { content?: string; error?: string; detail?: string };
        if (!res.ok) {
          throw new Error(data.detail || data.error || "Impossible de lire le fichier du skill.");
        }
        setSelectedSkillContent(data.content ?? "");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Impossible de lire le fichier du skill.");
        setSelectedSkillContent("");
      })
      .finally(() => setSkillFileLoading(false));
  }, [agentId, selectedSkillName, selectedInstalledFilePath]);

  useEffect(() => {
    if (!selectedSearchSkillSlug) {
      setSelectedSearchSkillDetail(null);
      setSelectedSearchSkillVersions([]);
      setSearchSkillFiles([]);
      setSelectedSearchFilePath(null);
      setSelectedSearchFileContent("");
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/clawhub/skill/${encodeURIComponent(selectedSearchSkillSlug)}`)
      .then(async (res) => {
        const data = (await res.json()) as {
          detail?: ClawHubSkillDetail;
          versions?: ClawHubSkillVersion[];
          error?: string;
          detailMessage?: string;
        };
        if (!res.ok) {
          throw new Error(data.detailMessage || data.error || "Impossible de charger le detail du skill.");
        }
        if (!cancelled) {
          setSelectedSearchSkillDetail(data.detail ?? null);
          setSelectedSearchSkillVersions(Array.isArray(data.versions) ? data.versions : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de charger le detail du skill.");
          setSelectedSearchSkillDetail(null);
          setSelectedSearchSkillVersions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSearchSkillSlug]);

  useEffect(() => {
    if (!selectedSearchSkillSlug) {
      return;
    }

    let cancelled = false;
    fetch(`/api/clawhub/skill/${encodeURIComponent(selectedSearchSkillSlug)}/files`)
      .then(async (res) => {
        const data = (await res.json()) as { items?: SkillFileEntry[]; error?: string; detail?: string };
        if (!res.ok) {
          throw new Error(data.detail || data.error || "Impossible de lister les fichiers ClawHub.");
        }
        if (!cancelled) {
          const items = Array.isArray(data.items) ? data.items : [];
          setSearchSkillFiles(items);
          setSelectedSearchFilePath(items.find((item) => item.path === "SKILL.md")?.path ?? items[0]?.path ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de lister les fichiers ClawHub.");
          setSearchSkillFiles([]);
          setSelectedSearchFilePath(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSearchSkillSlug]);

  useEffect(() => {
    if (!selectedSearchSkillSlug || !selectedSearchFilePath) {
      setSelectedSearchFileContent("");
      return;
    }

    let cancelled = false;
    setSearchFileLoading(true);
    fetch(
      `/api/clawhub/skill/${encodeURIComponent(selectedSearchSkillSlug)}/file?path=${encodeURIComponent(selectedSearchFilePath)}`,
    )
      .then(async (res) => {
        const data = (await res.json()) as { content?: string; error?: string; detail?: string };
        if (!res.ok) {
          throw new Error(data.detail || data.error || "Impossible de lire le fichier ClawHub.");
        }
        if (!cancelled) {
          setSelectedSearchFileContent(data.content ?? "");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de lire le fichier ClawHub.");
          setSelectedSearchFileContent("");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearchFileLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSearchSkillSlug, selectedSearchFilePath]);

  const install = async (skill: ClawHubSkill) => {
    setInstalling(skill.slug);
    setError(null);
    try {
      const res = await fetch("/api/clawhub/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: skill.slug, agentId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.detail || data.error || "Impossible d'installer le skill.");
      }
      await refreshInstalledSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'installer le skill.");
    } finally {
      setInstalling(null);
    }
  };

  const saveSkill = async () => {
    if (!selectedSkillName) return;
    setSavingSkill(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/agent-skills/${encodeURIComponent(agentId)}/${encodeURIComponent(selectedSkillName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: selectedSkillContent }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.detail || data.error || "Impossible de sauvegarder le skill.");
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
      await refreshInstalledSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de sauvegarder le skill.");
    } finally {
      setSavingSkill(false);
    }
  };

  const deleteSkill = async () => {
    if (!selectedSkillName) return;
    setDeletingSkill(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-skills/${encodeURIComponent(agentId)}/${encodeURIComponent(selectedSkillName)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.detail || data.error || "Impossible de supprimer le skill.");
      }
      setSelectedSkillName(null);
      setSelectedSkillContent("");
      await refreshInstalledSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer le skill.");
    } finally {
      setDeletingSkill(false);
    }
  };

  const createSkill = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatingSkill(true);
    setError(null);
    try {
      const res = await fetch(`/api/agent-skills/${encodeURIComponent(agentId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createSkillForm),
      });
      const data = (await res.json()) as { ok?: boolean; slug?: string; content?: string; error?: string; detail?: string };
      if (!res.ok || !data.ok || !data.slug) {
        throw new Error(data.detail || data.error || "Impossible de creer le skill.");
      }
      await refreshInstalledSkills();
      setSelectedSkillName(data.slug);
      setSelectedSkillContent(data.content ?? "");
      setSelectedInstalledFilePath("SKILL.md");
      setCreateSkillForm(EMPTY_CREATE_FORM);
      setActiveSection("agent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de creer le skill.");
    } finally {
      setCreatingSkill(false);
    }
  };

  const toggleSkillEnabled = async (skillName: string, enabled: boolean) => {
    setTogglingSkill(skillName);
    setError(null);
    try {
      const config = await getGatewayConfig();
      const nextEntries = {
        ...(config.resolved?.skills?.entries ?? {}),
        [skillName]: {
          ...(config.resolved?.skills?.entries?.[skillName] ?? {}),
          enabled,
        },
      };
      await patchGatewayConfig({ skills: { entries: nextEntries } }, config.hash);
      setSkillEnabledState((current) => ({ ...current, [skillName]: enabled }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre a jour l'etat du skill.");
    } finally {
      setTogglingSkill(null);
    }
  };

  const installedNames = useMemo(
    () => new Set(installedSkills.map((skill) => skill.name.toLowerCase())),
    [installedSkills],
  );
  const selectedSearchSkill = results.find((skill) => skill.slug === selectedSearchSkillSlug) ?? null;
  const selectedPageUrl =
    selectedSearchSkillDetail?.pageUrl ||
    selectedSearchSkill?.pageUrl ||
    (selectedSearchSkill ? `https://clawhub.ai/skills/${encodeURIComponent(selectedSearchSkill.slug)}` : "");

  return (
    <div className="p-3 space-y-4">
      <div className="flex border border-pixel-border bg-pixel-bg">
        <button
          type="button"
          onClick={() => setActiveSection("agent")}
          className={`flex-1 px-3 py-2 font-pixel text-xs ${
            activeSection === "agent" ? "bg-pixel-border text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Skills de l&apos;agent
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("create")}
          className={`flex-1 px-3 py-2 font-pixel text-xs ${
            activeSection === "create" ? "bg-pixel-border text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          Creer un skill
        </button>
      </div>

      {activeSection === "create" ? (
        <div className="border border-pixel-border bg-pixel-bg p-3">
          <div className="mb-2 font-pixel text-xs text-gray-500 uppercase tracking-wider">Creer un skill pour cet agent</div>
          <p className="mb-3 font-pixel text-[10px] text-gray-500">
            Ce skill sera cree dans le workspace de cet agent uniquement. Open Claw le detectera comme skill per-agent.
          </p>
          <form className="space-y-2" onSubmit={(event) => void createSkill(event)}>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="font-pixel text-[10px] text-gray-500">Slug</span>
                <input
                  className="w-full border border-pixel-border bg-black/10 px-2 py-1 font-pixel text-xs text-white focus:border-pixel-accent focus:outline-none"
                  value={createSkillForm.slug}
                  onChange={(event) => setCreateSkillForm((current) => ({ ...current, slug: event.target.value }))}
                  placeholder="agent-memory-helper"
                />
              </label>
              <label className="space-y-1">
                <span className="font-pixel text-[10px] text-gray-500">Titre</span>
                <input
                  className="w-full border border-pixel-border bg-black/10 px-2 py-1 font-pixel text-xs text-white focus:border-pixel-accent focus:outline-none"
                  value={createSkillForm.title}
                  onChange={(event) => setCreateSkillForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Agent Memory Helper"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="font-pixel text-[10px] text-gray-500">Description</span>
              <input
                className="w-full border border-pixel-border bg-black/10 px-2 py-1 font-pixel text-xs text-white focus:border-pixel-accent focus:outline-none"
                value={createSkillForm.description}
                onChange={(event) => setCreateSkillForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Aide l'agent a structurer et memoriser des informations."
              />
            </label>

            <label className="block space-y-1">
              <span className="font-pixel text-[10px] text-gray-500">Quand l'utiliser</span>
              <textarea
                className="min-h-20 w-full resize-none border border-pixel-border bg-black/10 px-2 py-1 font-pixel text-xs text-white focus:border-pixel-accent focus:outline-none"
                value={createSkillForm.whenToUse}
                onChange={(event) => setCreateSkillForm((current) => ({ ...current, whenToUse: event.target.value }))}
                placeholder={"Quand l'utilisateur demande de memoriser une information.\nQuand l'agent doit structurer un rappel durable."}
              />
            </label>

            <label className="block space-y-1">
              <span className="font-pixel text-[10px] text-gray-500">Instructions du skill</span>
              <textarea
                className="min-h-28 w-full resize-none border border-pixel-border bg-black/10 px-2 py-1 font-mono text-xs text-white focus:border-pixel-accent focus:outline-none"
                value={createSkillForm.instructions}
                onChange={(event) => setCreateSkillForm((current) => ({ ...current, instructions: event.target.value }))}
                placeholder={"1. Reformule la demande clairement.\n2. Ecris le rappel dans MEMORY.md si c'est durable.\n3. Confirme ce qui a ete memorise."}
                spellCheck={false}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="font-pixel text-[10px] text-gray-500">Emoji</span>
                <input
                  className="w-full border border-pixel-border bg-black/10 px-2 py-1 font-pixel text-xs text-white focus:border-pixel-accent focus:outline-none"
                  value={createSkillForm.emoji}
                  onChange={(event) => setCreateSkillForm((current) => ({ ...current, emoji: event.target.value }))}
                  placeholder="🧠"
                />
              </label>
              <label className="space-y-1">
                <span className="font-pixel text-[10px] text-gray-500">Homepage</span>
                <input
                  className="w-full border border-pixel-border bg-black/10 px-2 py-1 font-pixel text-xs text-white focus:border-pixel-accent focus:outline-none"
                  value={createSkillForm.homepage}
                  onChange={(event) => setCreateSkillForm((current) => ({ ...current, homepage: event.target.value }))}
                  placeholder="https://..."
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1">
                <span className="font-pixel text-[10px] text-gray-500">Bins requis</span>
                <input
                  className="w-full border border-pixel-border bg-black/10 px-2 py-1 font-pixel text-xs text-white focus:border-pixel-accent focus:outline-none"
                  value={createSkillForm.requiresBins}
                  onChange={(event) => setCreateSkillForm((current) => ({ ...current, requiresBins: event.target.value }))}
                  placeholder="uv,ffmpeg"
                />
              </label>
              <label className="space-y-1">
                <span className="font-pixel text-[10px] text-gray-500">Env requises</span>
                <input
                  className="w-full border border-pixel-border bg-black/10 px-2 py-1 font-pixel text-xs text-white focus:border-pixel-accent focus:outline-none"
                  value={createSkillForm.requiresEnv}
                  onChange={(event) => setCreateSkillForm((current) => ({ ...current, requiresEnv: event.target.value }))}
                  placeholder="OPENAI_API_KEY"
                />
              </label>
              <label className="space-y-1">
                <span className="font-pixel text-[10px] text-gray-500">Config requise</span>
                <input
                  className="w-full border border-pixel-border bg-black/10 px-2 py-1 font-pixel text-xs text-white focus:border-pixel-accent focus:outline-none"
                  value={createSkillForm.requiresConfig}
                  onChange={(event) => setCreateSkillForm((current) => ({ ...current, requiresConfig: event.target.value }))}
                  placeholder="browser.enabled"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-pixel text-[10px] text-gray-600">
                Conforme a la doc Open Claw: dossier skill + `SKILL.md` + frontmatter.
              </span>
              <button
                type="submit"
                disabled={creatingSkill}
                className="bg-pixel-accent px-3 py-1 font-pixel text-xs text-white disabled:opacity-50"
              >
                {creatingSkill ? "Creation..." : "Creer le skill"}
              </button>
            </div>
          </form>
        </div>
      ) : (
      <>
      <div className="border border-pixel-border bg-pixel-bg p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="font-pixel text-xs text-gray-500 uppercase tracking-wider">Skills de cet agent</div>
          <button
            type="button"
            onClick={() => void refreshInstalledSkills()}
            disabled={installedLoading}
            className="border border-pixel-border px-2 py-1 font-pixel text-xs text-gray-400 hover:text-white disabled:opacity-50"
          >
            {installedLoading ? "..." : "Refresh"}
          </button>
        </div>
        <div className="grid grid-cols-[14rem_1fr] gap-3">
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {installedSkills.map((skill) => (
              <div
                key={skill.name}
                className={`w-full border p-2 ${
                  selectedSkillName === skill.name
                    ? "border-pixel-accent bg-black/10"
                    : "border-pixel-border bg-black/10 hover:border-pixel-accent"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSkillName(skill.name)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="font-pixel text-xs text-white">{skill.title}</div>
                    <div className="mt-1 font-pixel text-[10px] text-pixel-accent">{skill.name}</div>
                  </button>
                  <label className="flex shrink-0 items-center gap-1 font-pixel text-[10px] text-gray-400">
                    <input
                      type="checkbox"
                      checked={skillEnabledState[skill.name] ?? true}
                      disabled={togglingSkill === skill.name}
                      onChange={(event) => void toggleSkillEnabled(skill.name, event.target.checked)}
                    />
                    actif
                  </label>
                </div>
                {skill.description && (
                  <div className="mt-1 font-pixel text-[10px] text-gray-500 line-clamp-2">{skill.description}</div>
                )}
              </div>
            ))}
            {!installedLoading && installedSkills.length === 0 && (
              <p className="font-pixel text-xs text-gray-600">Aucun skill workspace pour cet agent.</p>
            )}
          </div>

	          <div className="space-y-2">
	            {selectedSkillName ? (
	              <>
	                <div className="font-pixel text-xs text-gray-500">{selectedSkillName}</div>
	                <div className="font-pixel text-[10px] text-gray-600">
	                  La coche `actif` met a jour `skills.entries.&lt;skill&gt;.enabled`. Le changement est pris au prochain tour agent.
	                </div>
	                <div className="grid grid-cols-[12rem_1fr] gap-3">
	                  <div className="space-y-2 max-h-72 overflow-y-auto border border-pixel-border bg-black/10 p-2">
	                    {installedSkillFiles.map((file) => (
	                      <button
	                        key={file.path}
	                        type="button"
	                        onClick={() => setSelectedInstalledFilePath(file.path)}
	                        className={`w-full border px-2 py-1 text-left font-mono text-[10px] ${
	                          selectedInstalledFilePath === file.path
	                            ? "border-pixel-accent text-pixel-accent"
	                            : "border-pixel-border text-gray-400 hover:text-white"
	                        }`}
	                      >
	                        {file.path}
	                      </button>
	                    ))}
	                  </div>
	                  {skillFileLoading ? (
	                    <div className="flex min-h-72 items-center justify-center border border-pixel-border bg-black/10">
	                      <span className="font-pixel text-xs text-gray-600">Chargement...</span>
	                    </div>
	                  ) : (
	                    <textarea
	                      className="min-h-72 w-full resize-none border border-pixel-border bg-black/10 p-2 font-mono text-xs text-gray-300 focus:border-pixel-accent focus:outline-none"
	                      value={selectedSkillContent}
	                      onChange={(event) => setSelectedSkillContent(event.target.value)}
	                      spellCheck={false}
	                    />
	                  )}
	                </div>
	                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveSkill()}
                    disabled={savingSkill || skillFileLoading}
                    className="bg-pixel-accent px-3 py-1 font-pixel text-xs text-white disabled:opacity-50"
                  >
                    {savingSkill ? "Sauvegarde..." : "Sauvegarder"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSkill()}
                    disabled={deletingSkill}
                    className="border border-pixel-red px-3 py-1 font-pixel text-xs text-pixel-red disabled:opacity-50"
                  >
                    {deletingSkill ? "Suppression..." : "Supprimer"}
                  </button>
                  {saved && <span className="font-pixel text-xs text-pixel-green">Sauvegarde OK</span>}
                </div>
              </>
            ) : (
              <div className="flex min-h-72 items-center justify-center border border-pixel-border bg-black/10">
                <span className="font-pixel text-xs text-gray-600">Selectionne un skill installe pour l&apos;ouvrir.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border border-pixel-border bg-pixel-bg p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="font-pixel text-xs text-gray-500 uppercase tracking-wider">Explorer ClawHub</div>
          <button
            type="button"
            onClick={() => void loadDiscover()}
            disabled={loading}
            className="border border-pixel-border px-2 py-1 font-pixel text-xs text-gray-400 hover:text-white disabled:opacity-50"
          >
            {loading && !query.trim() ? "..." : "Top downloads"}
          </button>
        </div>
        <div className="mb-3 flex gap-2">
          <input
            className="flex-1 border border-pixel-border bg-black/10 px-2 py-1 font-pixel text-xs text-white focus:border-pixel-accent focus:outline-none"
            placeholder="Chercher sur ClawHub..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void search()}
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={loading}
            className="bg-pixel-accent px-3 py-1 font-pixel text-xs text-white disabled:opacity-50"
          >
            {loading ? "..." : "Chercher"}
          </button>
        </div>

        {error && <p className="mb-2 font-pixel text-xs text-pixel-red">{error}</p>}
        {!error && searchDebug && results.length === 0 && (
          <div className="mb-3 border border-pixel-border bg-black/10 p-2 space-y-2">
            <div className="font-pixel text-xs text-yellow-300">Diagnostic recherche ClawHub</div>
            {searchDebug.command && (
              <div className="font-mono text-[10px] text-gray-400 break-all">{searchDebug.command}</div>
            )}
            {searchDebug.stderr && (
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-pixel-red">
                {searchDebug.stderr}
              </pre>
            )}
            {searchDebug.stdout && (
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-gray-500">
                {searchDebug.stdout}
              </pre>
            )}
          </div>
        )}

        <div className="grid grid-cols-[15rem_1fr] gap-3">
          <div className="space-y-2 max-h-[30rem] overflow-y-auto">
            {results.map((skill) => {
              const selected = selectedSearchSkillSlug === skill.slug;
              return (
                <button
                  key={skill.slug}
                  type="button"
                  onClick={() => setSelectedSearchSkillSlug(skill.slug)}
                  className={`w-full border p-2 text-left ${
                    selected
                      ? "border-pixel-accent bg-black/10"
                      : "border-pixel-border bg-black/10 hover:border-pixel-accent"
                  }`}
                >
                  <div className="font-pixel text-xs text-white">{skill.name}</div>
                  <div className="mt-1 font-pixel text-[10px] text-pixel-accent">{skill.slug}</div>
                  <div className="mt-1 font-pixel text-[10px] text-gray-500 line-clamp-3">{skill.description}</div>
                  <div className="mt-1 font-pixel text-[10px] text-gray-600">
                    {typeof skill.downloads === "number" ? `${formatCompact(skill.downloads)} dl` : "?"} ·{" "}
                    {typeof skill.stars === "number" ? `${formatCompact(skill.stars)} ★` : "?"}
                    {skill.version ? ` · v${skill.version}` : ""}
                  </div>
                </button>
              );
            })}
            {results.length === 0 && !loading && (
              <p className="font-pixel text-xs text-gray-600">
                {query.trim() ? "Aucun resultat." : "Aucun skill charge."}
              </p>
            )}
          </div>

          <div className="space-y-2">
            {selectedSearchSkill ? (
              <div className="min-h-[30rem] border border-pixel-border bg-black/10 p-3">
                {detailLoading ? (
                  <div className="flex min-h-[28rem] items-center justify-center">
                    <span className="font-pixel text-xs text-gray-600">Chargement du detail...</span>
                  </div>
                ) : (
                  <>
                    <div className="font-pixel text-sm text-white">
                      {selectedSearchSkillDetail?.displayName ?? selectedSearchSkill.name}
                    </div>
                    <div className="mt-1 font-pixel text-[10px] text-pixel-accent">{selectedSearchSkill.slug}</div>
                    <div className="mt-1 font-pixel text-[10px] text-gray-400">
                      {selectedSearchSkillDetail?.ownerHandle
                        ? `par @${selectedSearchSkillDetail.ownerHandle}`
                        : selectedSearchSkill.ownerHandle
                          ? `par @${selectedSearchSkill.ownerHandle}`
                          : "proprietaire non remonte"}
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      <StatBox label="Downloads" value={formatMaybe(selectedSearchSkillDetail?.stats?.downloads ?? selectedSearchSkill.downloads)} />
                      <StatBox label="Stars" value={formatMaybe(selectedSearchSkillDetail?.stats?.stars ?? selectedSearchSkill.stars)} />
                      <StatBox label="Installs" value={formatMaybe(selectedSearchSkillDetail?.stats?.installsCurrent ?? selectedSearchSkill.installsCurrent)} />
                      <StatBox
                        label="Version"
                        value={selectedSearchSkillDetail?.latestVersion?.version ?? selectedSearchSkill.version ?? "?"}
                      />
                    </div>

                    <div className="mt-3 border border-pixel-border bg-black/10 p-2">
                      <div className="mb-1 font-pixel text-[10px] text-gray-500 uppercase tracking-wider">Description</div>
                      <div className="whitespace-pre-wrap font-pixel text-xs text-gray-300">
                        {selectedSearchSkillDetail?.summary || selectedSearchSkill.summary || selectedSearchSkill.description || "Aucune description."}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void install(selectedSearchSkill)}
                        disabled={
                          installing === selectedSearchSkill.slug || isInstalledSkill(installedNames, selectedSearchSkill.slug)
                        }
                        className="bg-pixel-green px-3 py-1 font-pixel text-xs text-black disabled:opacity-50"
                      >
                        {isInstalledSkill(installedNames, selectedSearchSkill.slug)
                          ? "Installe dans cet agent"
                          : installing === selectedSearchSkill.slug
                            ? "Installation..."
                            : "Installer sur l'agent"}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(selectedPageUrl, "_blank", "noopener,noreferrer")}
                        className="border border-pixel-border px-3 py-1 font-pixel text-xs text-gray-300 hover:text-white"
                      >
                        Ouvrir la page ClawHub
                      </button>
                    </div>

                    <div className="mt-3 border border-pixel-border bg-black/10 p-2">
                      <div className="mb-1 font-pixel text-[10px] text-gray-500 uppercase tracking-wider">Versions</div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedSearchSkillVersions.map((version) => (
                          <div key={`${selectedSearchSkill.slug}-${version.version}`} className="border border-pixel-border bg-black/10 p-2">
                            <div className="font-pixel text-xs text-white">
                              v{version.version} · {formatDate(version.createdAt)}
                            </div>
                            {version.changelogSource && (
                              <div className="mt-1 font-pixel text-[10px] text-gray-500">{version.changelogSource}</div>
                            )}
                            {version.changelog && (
                              <div className="mt-1 whitespace-pre-wrap font-pixel text-[10px] text-gray-400">
                                {version.changelog}
                              </div>
                            )}
                          </div>
                        ))}
                        {selectedSearchSkillVersions.length === 0 && (
                          <div className="font-pixel text-xs text-gray-600">Aucune version detaillee exposee par l&apos;API publique.</div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 border border-pixel-border bg-black/10 p-2">
                      <div className="mb-2 font-pixel text-[10px] text-gray-500 uppercase tracking-wider">Fichiers du skill</div>
                      <div className="grid grid-cols-[12rem_1fr] gap-3">
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {searchSkillFiles.map((file) => (
                            <button
                              key={file.path}
                              type="button"
                              onClick={() => setSelectedSearchFilePath(file.path)}
                              className={`w-full border px-2 py-1 text-left font-mono text-[10px] ${
                                selectedSearchFilePath === file.path
                                  ? "border-pixel-accent text-pixel-accent"
                                  : "border-pixel-border text-gray-400 hover:text-white"
                              }`}
                            >
                              {file.path}
                            </button>
                          ))}
                        </div>
                        <div className="border border-pixel-border bg-black/10 p-2">
                          {searchFileLoading ? (
                            <div className="font-pixel text-xs text-gray-600">Chargement du fichier...</div>
                          ) : (
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-gray-300">
                              {selectedSearchFileContent || "Selectionne un fichier pour le lire."}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 border border-pixel-border bg-black/10 p-2">
                      <div className="font-pixel text-[10px] text-gray-500 uppercase tracking-wider">Securite / compare</div>
                      <div className="mt-1 font-pixel text-[10px] text-gray-400">
                        Les fichiers sont maintenant lisibles directement. En revanche la note de securite detaillee et le compare riche ne sont pas exposes proprement par l&apos;API publique simple qu&apos;on peut consommer ici.
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex min-h-[30rem] items-center justify-center border border-pixel-border bg-black/10">
                <span className="font-pixel text-xs text-gray-600">Selectionne un skill ClawHub pour voir son detail.</span>
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-pixel-border bg-black/10 p-2">
      <div className="font-pixel text-[10px] text-gray-500">{label}</div>
      <div className="mt-1 font-pixel text-xs text-white">{value}</div>
    </div>
  );
}

function formatCompact(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "?";
  }
  if (value < 1000) {
    return String(Math.round(value));
  }
  if (value < 1_000_000) {
    return `${Math.round((value / 100)) / 10}k`.replace(".0k", "k");
  }
  return `${Math.round((value / 100_000)) / 10}M`.replace(".0M", "M");
}

function formatMaybe(value?: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "?";
  }
  return formatCompact(value);
}

function formatDate(value: number): string {
  try {
    return new Date(value).toLocaleDateString("fr-FR");
  } catch {
    return "?";
  }
}

function isInstalledSkill(installedNames: Set<string>, slug: string): boolean {
  const normalized = slug.toLowerCase();
  const tail = normalized.split("/").pop() ?? normalized;
  return installedNames.has(normalized) || installedNames.has(tail);
}

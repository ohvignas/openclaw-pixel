import { useEffect, useState } from "react";
import { gatewayClient } from "../../../openclaw/openclawClient.ts";

interface CronPayload {
  jobs?: unknown;
  total?: number;
}

interface CronJob {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  agentId?: string;
  schedule?: unknown;
}

export function CronTab({ agentId }: { agentId: string }) {
  const [payload, setPayload] = useState<CronPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    gatewayClient.request<CronPayload>("cron.list", {})
      .then((value) => {
        if (!cancelled) setPayload(value);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Impossible de charger les cron jobs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const jobs = normalizeJobs(payload?.jobs).filter((job) => !job.agentId || job.agentId === agentId);

  return (
    <div className="p-3 space-y-2">
      <div className="font-pixel text-xs text-gray-500">Agent: {agentId}</div>
      {loading && <p className="font-pixel text-xs text-gray-600">Chargement...</p>}
      {error && <p className="font-pixel text-xs text-pixel-red">{error}</p>}
      {!loading && !error && jobs.length === 0 && (
        <p className="font-pixel text-xs text-gray-600">Aucun cron job configure dans Open Claw.</p>
      )}
      <div className="space-y-2">
        {jobs.map((job) => (
          <div key={job.id} className="border border-pixel-border bg-pixel-bg p-2">
            <div className="font-pixel text-xs text-white">{job.title ?? job.name ?? job.id}</div>
            <div className="mt-1 font-pixel text-[10px] text-gray-500">
              {formatSchedule(job.schedule)} · {job.enabled === false ? "desactive" : "active"}
            </div>
            {job.description && (
              <div className="mt-1 font-pixel text-[10px] text-gray-600">{job.description}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function normalizeJobs(value: unknown): CronJob[] {
  if (Array.isArray(value)) return value.filter(isCronJob);
  if (!value || typeof value !== "object") return [];
  return Object.values(value).filter(isCronJob);
}

function isCronJob(value: unknown): value is CronJob {
  return Boolean(value && typeof value === "object");
}

function formatSchedule(schedule: unknown): string {
  if (typeof schedule === "string") return schedule;
  if (!schedule || typeof schedule !== "object") return "schedule inconnu";

  const record = schedule as Record<string, unknown>;
  const kind = typeof record.kind === "string" ? record.kind : null;

  if (kind === "at") {
    return typeof record.at === "string" ? `at ${record.at}` : "at";
  }
  if (kind === "every") {
    return typeof record.everyMs === "number" ? `every ${formatDuration(record.everyMs)}` : "every";
  }
  if (kind === "cron") {
    const expr = typeof record.expr === "string" ? record.expr : "cron";
    const tz = typeof record.tz === "string" ? ` (${record.tz})` : "";
    return `${expr}${tz}`;
  }

  try {
    return JSON.stringify(schedule);
  } catch {
    return "schedule inconnu";
  }
}

function formatDuration(ms: number): string {
  if (ms % 3600000 === 0) return `${ms / 3600000}h`;
  if (ms % 60000 === 0) return `${ms / 60000}m`;
  if (ms % 1000 === 0) return `${ms / 1000}s`;
  return `${ms}ms`;
}

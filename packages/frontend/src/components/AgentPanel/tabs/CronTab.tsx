import { useState, useEffect } from "react";

interface CronJob {
  id: string;
  schedule: string;
  description?: string;
  enabled: boolean;
  nextRun?: string;
}

export function CronTab({ agentId: _agentId }: { agentId: string }) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: filtrer par agent quand l'API supporte l'agentId
    fetch("/api/cli/run/hooks:list")
      .then((r) => r.json())
      .then((d: { items?: CronJob[] }) => setJobs(Array.isArray(d) ? d : (d.items ?? [])))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [_agentId]);

  if (loading) {
    return (
      <div className="p-3 flex items-center justify-center">
        <span className="font-pixel text-xs text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {jobs.length === 0 ? (
        <p className="font-pixel text-xs text-gray-600">Aucun cron job configuré</p>
      ) : (
        jobs.map((job) => (
          <div key={job.id} className="bg-pixel-bg border border-pixel-border p-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-pixel text-xs text-white">{job.id}</div>
                <div className="font-pixel text-xs text-gray-500 mt-1">{job.schedule}</div>
                {job.description && (
                  <div className="font-pixel text-xs text-gray-600 mt-1">{job.description}</div>
                )}
              </div>
              <div
                className={`w-3 h-3 rounded-full shrink-0 mt-1 ${
                  job.enabled ? "bg-pixel-green" : "bg-gray-600"
                }`}
                title={job.enabled ? "Actif" : "Inactif"}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

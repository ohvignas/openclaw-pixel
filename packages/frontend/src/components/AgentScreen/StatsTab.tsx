import { useEconomyStore } from '../../store/economyStore.ts'
import { useAgentStore } from '../../store/agentStore.ts'

interface StatsTabProps {
  agentId: string
}

export function StatsTab({ agentId }: StatsTabProps) {
  const agent = useAgentStore((s) => s.agents[agentId])
  const coins = useEconomyStore((s) => s.coins)
  const eventCount = useAgentStore((s) =>
    s.eventLog.filter((e) => e.agentId === agentId).length
  )
  const workingCount = useAgentStore((s) =>
    s.eventLog.filter((e) => e.agentId === agentId && e.type === 'working').length
  )

  const statusColor =
    agent?.status === 'working' ? 'text-pixel-green' :
    agent?.status === 'waiting_approval' ? 'text-yellow-400' :
    agent?.status === 'error' ? 'text-pixel-red' : 'text-gray-400'

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Statut" value={agent?.status ?? 'idle'} valueClass={statusColor} />
        <StatCard label="Modèle" value={agent?.model ?? '\u2014'} />
        <StatCard label="Coins workspace" value={`${coins.toLocaleString()} c`} valueClass="text-yellow-400" />
        <StatCard label="Outil actif" value={agent?.currentTool ?? '\u2014'} />
        <StatCard label="Events totaux" value={String(eventCount)} />
        <StatCard label="Actions travail" value={String(workingCount)} />
      </div>
      <p className="font-pixel text-xs text-gray-600 mt-4">
        Graphe tokens/temps &mdash; prochaine itération
      </p>
    </div>
  )
}

function StatCard({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="border border-pixel-border p-3 bg-pixel-bg">
      <p className="font-pixel text-xs text-gray-500 mb-1">{label}</p>
      <p className={`font-pixel text-xs ${valueClass}`}>{value}</p>
    </div>
  )
}

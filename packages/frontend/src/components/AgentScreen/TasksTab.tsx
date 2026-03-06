import { useAgentStore } from '../../store/agentStore.ts'

interface TasksTabProps {
  agentId: string
}

export function TasksTab({ agentId }: TasksTabProps) {
  const events = useAgentStore((s) =>
    s.eventLog.filter((e) => e.agentId === agentId)
  )

  const inProgress = events.filter((e) => e.type === 'working').slice(0, 3)
  const done = events.filter((e) => e.type === 'idle').slice(0, 30)

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {inProgress.length > 0 && (
        <section>
          <h3 className="font-pixel text-xs text-yellow-400 mb-2 tracking-widest">EN COURS</h3>
          {inProgress.map((e, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 border-b border-pixel-border">
              <span className="text-yellow-400 mt-0.5">&#9889;</span>
              <div>
                <p className="font-pixel text-xs text-white">{e.detail}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h3 className="font-pixel text-xs text-pixel-green mb-2 tracking-widest">TERMINEES</h3>
          {done.map((e, i) => (
            <div key={i} className="flex items-center gap-2 py-1 border-b border-pixel-border">
              <span className="text-pixel-green text-xs">&#10003;</span>
              <span className="font-pixel text-xs text-gray-300">{e.detail}</span>
            </div>
          ))}
        </section>
      )}

      {events.length === 0 && (
        <p className="font-pixel text-xs text-gray-600">Aucune activité enregistrée pour cet agent.</p>
      )}
    </div>
  )
}

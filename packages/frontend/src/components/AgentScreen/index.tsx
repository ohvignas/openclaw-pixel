import { useState } from 'react'
import { useAgentStore } from '../../store/agentStore.ts'
import { TasksTab } from './TasksTab.tsx'
import { FilesTab } from './FilesTab.tsx'
import { StatsTab } from './StatsTab.tsx'
import { ChatTab } from '../AgentPanel/tabs/ChatTab.tsx'

type Tab = 'tasks' | 'files' | 'stats' | 'chat'

interface AgentScreenProps {
  agentId: string
  deskName: string
  onDeskNameChange: (name: string) => void
  onClose: () => void
  availableAgents: Array<{ id: string; name: string; emoji: string }>
  onChangeAgent: (id: string) => void
}

export function AgentScreen({
  agentId,
  deskName,
  onDeskNameChange,
  onClose,
  availableAgents,
  onChangeAgent,
}: AgentScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('tasks')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(deskName)
  const [showAgentPicker, setShowAgentPicker] = useState(false)

  const agent = useAgentStore((s) => s.agents[agentId])

  const statusColor =
    agent?.status === 'working' ? 'text-pixel-green' :
    agent?.status === 'waiting_approval' ? 'text-yellow-400' :
    agent?.status === 'error' ? 'text-pixel-red' : 'text-gray-400'

  const tabs: Array<{ id: Tab; icon: string; label: string }> = [
    { id: 'tasks',  icon: '&#128203;', label: 'Tâches' },
    { id: 'files',  icon: '&#128193;', label: 'Fichiers' },
    { id: 'stats',  icon: '&#128202;', label: 'Stats' },
    { id: 'chat',   icon: '&#128172;', label: 'Chat' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div
        className="w-[900px] h-[600px] bg-pixel-panel border-2 border-pixel-border flex flex-col"
        style={{ boxShadow: '4px 4px 0 #000, 8px 8px 0 rgba(0,0,0,0.3)' }}
      >
        {/* Barre de titre style WinXP */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b-2 border-pixel-border shrink-0"
          style={{ background: 'linear-gradient(to right, #1e3a8a, #1d4ed8, #1e3a8a)' }}
        >
          <div className="flex items-center gap-2">
            <span>&#128187;</span>
            {editingName ? (
              <input
                autoFocus
                className="bg-transparent text-white font-pixel text-xs border-b border-white/50 outline-none w-40"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={() => { onDeskNameChange(nameInput); setEditingName(false) }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              />
            ) : (
              <button
                className="font-pixel text-xs text-white hover:text-yellow-300 transition-colors"
                onClick={() => setEditingName(true)}
                title="Cliquez pour renommer"
              >
                {deskName} &#9998;
              </button>
            )}
            {agent && (
              <>
                <span className="text-blue-300 font-pixel text-xs">&mdash;</span>
                <span className="font-pixel text-xs text-white/80">{agent.emoji} {agent.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button className="w-5 h-5 bg-gray-600/80 hover:bg-gray-500 font-pixel text-xs text-white flex items-center justify-center border border-gray-400/30">_</button>
            <button className="w-5 h-5 bg-gray-600/80 hover:bg-gray-500 font-pixel text-xs text-white flex items-center justify-center border border-gray-400/30">&#9633;</button>
            <button onClick={onClose} className="w-5 h-5 bg-red-700 hover:bg-red-500 font-pixel text-xs text-white flex items-center justify-center border border-red-400/30">X</button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 px-3 py-1 bg-pixel-bg border-b border-pixel-border shrink-0">
          <span className={`font-pixel text-xs ${statusColor}`}>
            &#9679; {agent?.status ?? 'idle'}
          </span>
          {agent?.currentTool && (
            <span className="font-pixel text-xs text-gray-500">
              Tool: {agent.currentTool}
            </span>
          )}
          <div className="flex-1" />
          <div className="relative">
            <button
              className="font-pixel text-xs text-gray-400 hover:text-white border border-pixel-border px-2 py-0.5 transition-colors"
              onClick={() => setShowAgentPicker((v) => !v)}
            >
              Changer agent &#9660;
            </button>
            {showAgentPicker && (
              <div className="absolute right-0 top-full mt-1 bg-pixel-panel border border-pixel-border z-10 min-w-40">
                {availableAgents.map((a) => (
                  <button
                    key={a.id}
                    className={`block w-full text-left px-3 py-1.5 font-pixel text-xs transition-colors ${
                      a.id === agentId ? 'text-pixel-accent' : 'text-white hover:bg-pixel-border'
                    }`}
                    onClick={() => { onChangeAgent(a.id); setShowAgentPicker(false) }}
                  >
                    {a.emoji} {a.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar onglets */}
          <div className="w-28 border-r border-pixel-border flex flex-col py-2 bg-pixel-bg shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-left px-3 py-2.5 font-pixel text-xs transition-colors ${
                  activeTab === tab.id
                    ? 'text-pixel-accent bg-pixel-border'
                    : 'text-gray-400 hover:text-white'
                }`}
                dangerouslySetInnerHTML={{ __html: `${tab.icon} ${tab.label}` }}
              />
            ))}
          </div>

          {/* Contenu */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'tasks'  && <TasksTab agentId={agentId} />}
            {activeTab === 'files'  && <FilesTab agentId={agentId} />}
            {activeTab === 'stats'  && <StatsTab agentId={agentId} />}
            {activeTab === 'chat'   && <ChatTab agentId={agentId} />}
          </div>
        </div>
      </div>
    </div>
  )
}

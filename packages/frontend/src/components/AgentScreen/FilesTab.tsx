import { useState, useEffect } from 'react'

interface FilesTabProps {
  agentId: string
}

interface AgentFile {
  name: string
  path: string
}

export function FilesTab({ agentId }: FilesTabProps) {
  const [files, setFiles] = useState<AgentFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AgentFile | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)

  useEffect(() => {
    fetch(`/api/agents/${encodeURIComponent(agentId)}/files`)
      .then((r) => r.json())
      .then((data: AgentFile[]) => { setFiles(data); setLoading(false) })
      .catch(() => { setFiles([]); setLoading(false) })
  }, [agentId])

  const openFile = async (file: AgentFile) => {
    setSelected(file)
    setLoadingContent(true)
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(file.path)}`)
      const text = await res.text()
      setContent(text)
    } catch {
      setContent('Impossible de lire le fichier.')
    } finally {
      setLoadingContent(false)
    }
  }

  if (loading) {
    return <div className="p-4 font-pixel text-xs text-gray-500">Chargement...</div>
  }

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-48 border-r border-pixel-border overflow-y-auto shrink-0">
        {files.length === 0 ? (
          <p className="p-4 font-pixel text-xs text-gray-600">Aucun fichier généré</p>
        ) : (
          files.map((f) => (
            <button
              key={f.path}
              onClick={() => openFile(f)}
              className={`w-full text-left px-3 py-2 font-pixel text-xs border-b border-pixel-border transition-colors ${
                selected?.path === f.path
                  ? 'bg-pixel-border text-pixel-accent'
                  : 'text-gray-300 hover:bg-pixel-bg'
              }`}
            >
              &#128196; {f.name}
            </button>
          ))
        )}
      </div>
      <div className="flex-1 overflow-auto p-3 bg-pixel-bg">
        {loadingContent ? (
          <p className="font-pixel text-xs text-gray-500">Chargement...</p>
        ) : content ? (
          <pre className="font-pixel text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{content}</pre>
        ) : (
          <p className="font-pixel text-xs text-gray-600">Sélectionnez un fichier</p>
        )}
      </div>
    </div>
  )
}

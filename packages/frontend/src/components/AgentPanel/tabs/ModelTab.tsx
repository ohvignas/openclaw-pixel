import { useState } from "react";

const PROVIDERS = [
  {
    label: "Anthropic",
    models: [
      "anthropic/claude-opus-4-6",
      "anthropic/claude-sonnet-4-6",
      "anthropic/claude-haiku-4-5",
    ],
  },
  {
    label: "OpenAI",
    models: ["openai/gpt-4o", "openai/gpt-4o-mini", "openai/o1"],
  },
  {
    label: "Mistral",
    models: ["mistral/mistral-large", "mistral/mistral-small"],
  },
  {
    label: "Ollama (local)",
    models: ["ollama/llama3", "ollama/mistral", "ollama/gemma"],
  },
  {
    label: "OpenRouter",
    models: ["openrouter/auto"],
  },
];

export function ModelTab({ agentId: _agentId }: { agentId: string }) {
  const [selected, setSelected] = useState("anthropic/claude-opus-4-6");

  return (
    <div className="p-3 space-y-4">
      <div>
        <div className="font-pixel text-xs text-gray-500 mb-2">Modèle actif</div>
        <div className="bg-pixel-bg border border-pixel-green p-2 font-pixel text-xs text-pixel-green">
          {selected}
        </div>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((p) => (
          <div key={p.label}>
            <div className="font-pixel text-xs text-gray-600 mb-1 uppercase tracking-wider">
              {p.label}
            </div>
            <div className="space-y-1">
              {p.models.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelected(m)}
                  className={`w-full text-left font-pixel text-xs px-2 py-1 border transition-colors ${
                    selected === m
                      ? "border-pixel-green text-pixel-green bg-pixel-bg"
                      : "border-pixel-border text-gray-500 hover:text-white hover:border-gray-500"
                  }`}
                >
                  {selected === m ? "▶ " : "  "}{m}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

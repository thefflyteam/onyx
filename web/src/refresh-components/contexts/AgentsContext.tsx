"use client";

import React, {
  createContext,
  useState,
  useContext,
  useMemo,
  useEffect,
  useRef,
  Dispatch,
  SetStateAction,
} from "react";
import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import { useSearchParams } from "next/navigation";
import { SEARCH_PARAM_NAMES } from "@/app/chat/services/searchParams";
import {
  UserSpecificAssistantPreference,
  UserSpecificAssistantPreferences,
} from "@/lib/types";
import { useAssistantPreferences } from "@/app/chat/hooks/useAssistantPreferences";
import useSWR from "swr";
import { errorHandlingFetcher } from "@/lib/fetcher";

async function pinAgents(pinnedAgentIds: number[]) {
  console.log(pinnedAgentIds);
  const response = await fetch(`/api/user/pinned-assistants`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ordered_assistant_ids: pinnedAgentIds,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to update pinned assistants");
  }
}

function getPinnedAgents(
  agents: MinimalPersonaSnapshot[],
  pinnedAgentIds?: number[]
): MinimalPersonaSnapshot[] {
  return pinnedAgentIds
    ? (pinnedAgentIds
        .map((pinnedAgentId) =>
          agents.find((agent) => agent.id === pinnedAgentId)
        )
        .filter((agent) => !!agent) as MinimalPersonaSnapshot[])
    : agents.filter((agent) => agent.is_default_persona && agent.id !== 0);
}

interface AgentsProviderProps {
  agents: MinimalPersonaSnapshot[];
  pinnedAgentIds: number[];
  children: React.ReactNode;
}

export function AgentsProvider({
  agents: initialAgents,
  pinnedAgentIds: initialPinnedAgentIds,
  children,
}: AgentsProviderProps) {
  // Use SWR for agents list - this enables global cache invalidation via mutate()
  const { data: agents, mutate: refreshAgents } = useSWR<
    MinimalPersonaSnapshot[]
  >("/api/persona", errorHandlingFetcher, {
    fallbackData: initialAgents, // Use SSR data on initial render
    revalidateOnFocus: false, // Don't refetch on window focus (too aggressive)
    revalidateOnReconnect: true, // Refetch when reconnecting to internet
  });

  const [pinnedAgents, setPinnedAgents] = useState<MinimalPersonaSnapshot[]>(
    () => getPinnedAgents(agents || initialAgents, initialPinnedAgentIds)
  );

  const { assistantPreferences, setSpecificAssistantPreferences } =
    useAssistantPreferences();
  const [forcedToolIds, setForcedToolIds] = useState<number[]>([]);

  const isInitialMount = useRef(true);
  const searchParams = useSearchParams();
  const currentAgentIdRaw = searchParams?.get(SEARCH_PARAM_NAMES.PERSONA_ID);
  const currentAgentId = currentAgentIdRaw ? parseInt(currentAgentIdRaw) : null;
  const currentAgent = useMemo(
    () =>
      currentAgentId && agents
        ? agents.find((agent) => agent.id === currentAgentId) || null
        : null,
    [agents, currentAgentId]
  );

  function togglePinnedAgent(
    agent: MinimalPersonaSnapshot,
    shouldPin: boolean
  ) {
    setPinnedAgents((prev) =>
      shouldPin
        ? [...prev, agent]
        : prev.filter((prevAgent) => prevAgent.id !== agent.id)
    );
  }

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    pinAgents(pinnedAgents.map((agent) => agent.id));
  }, [pinnedAgents]);

  return (
    <AgentsContext.Provider
      value={{
        agents: agents || initialAgents, // Fallback to initial agents if SWR hasn't loaded yet
        refreshAgents: async () => {
          await refreshAgents(); // Wrap SWR mutate to match expected Promise<void> signature
        },
        pinnedAgents,
        setPinnedAgents,
        togglePinnedAgent,
        currentAgent,
        agentPreferences: assistantPreferences,
        setSpecificAgentPreferences: setSpecificAssistantPreferences,
        forcedToolIds,
        setForcedToolIds,
      }}
    >
      {children}
    </AgentsContext.Provider>
  );
}

interface AgentsContextType {
  // All available agents
  agents: MinimalPersonaSnapshot[];
  refreshAgents: () => Promise<void>;

  // Pinned agents (from user preferences)
  pinnedAgents: MinimalPersonaSnapshot[];
  setPinnedAgents: Dispatch<SetStateAction<MinimalPersonaSnapshot[]>>;
  togglePinnedAgent: (agent: MinimalPersonaSnapshot, request: boolean) => void;

  // Currently live/active agent (from searchParams)
  currentAgent: MinimalPersonaSnapshot | null;

  agentPreferences: UserSpecificAssistantPreferences | null;
  setSpecificAgentPreferences: (
    assistantId: number,
    assistantPreferences: UserSpecificAssistantPreference
  ) => void;

  forcedToolIds: number[];
  setForcedToolIds: Dispatch<SetStateAction<number[]>>;
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

export function useAgentsContext(): AgentsContextType {
  const context = useContext(AgentsContext);
  if (!context)
    throw new Error("useAgentsContext must be used within an AgentsProvider");
  return context;
}

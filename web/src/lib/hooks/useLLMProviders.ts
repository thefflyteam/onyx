import useSWR from "swr";
import { LLMProviderDescriptor } from "@/app/admin/configuration/llm/interfaces";
import { errorHandlingFetcher } from "@/lib/fetcher";

export function useLLMProviders(personaId?: number) {
  const url = personaId
    ? `/api/llm/provider?persona_id=${personaId}`
    : "/api/llm/provider";

  const { data, error, mutate } = useSWR<LLMProviderDescriptor[]>(
    url,
    errorHandlingFetcher
  );

  return {
    llmProviders: data || [],
    isLoading: !error && !data,
    error,
    refetch: mutate,
  };
}

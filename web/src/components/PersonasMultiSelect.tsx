import { FormikProps } from "formik";
import { Label } from "@/components/Field";
import Text from "@/refresh-components/texts/Text";
import { SearchMultiSelectDropdown } from "@/components/Dropdown";
import useSWR from "swr";
import { errorHandlingFetcher } from "@/lib/fetcher";

export type PersonasMultiSelectFormType = {
  personas: number[];
};

interface Persona {
  id: number;
  name: string;
  description: string;
}

interface PersonasMultiSelectProps<T extends PersonasMultiSelectFormType> {
  formikProps: FormikProps<T>;
  label?: string;
  subtext?: string;
}

export function PersonasMultiSelect<T extends PersonasMultiSelectFormType>({
  formikProps,
  label = "Assistant Whitelist",
  subtext = "Select which assistants can use this LLM provider. If none selected, all assistants can use it.",
}: PersonasMultiSelectProps<T>) {
  const { data: personas, isLoading } = useSWR<Persona[]>(
    "/api/persona",
    errorHandlingFetcher
  );

  if (isLoading) {
    return (
      <div className="mb-4">
        <Label>{label}</Label>
        <div className="animate-pulse bg-background-200 h-10 w-full rounded-lg mt-2"></div>
      </div>
    );
  }

  if (!personas || personas.length === 0) {
    return (
      <div className="mb-4">
        <Label>{label}</Label>
        <Text className="text-sm text-text-subtle mt-2">
          No assistants available. Please create an assistant first from the
          Assistants page.
        </Text>
      </div>
    );
  }

  const selectedPersonaIds = formikProps.values.personas || [];
  const selectedPersonas = personas.filter((p) =>
    selectedPersonaIds.includes(p.id)
  );

  const handleSelect = (option: { name: string; value: number }) => {
    const currentPersonas = formikProps.values.personas || [];
    if (!currentPersonas.includes(option.value)) {
      formikProps.setFieldValue("personas", [...currentPersonas, option.value]);
    }
  };

  const handleRemove = (personaId: number) => {
    const currentPersonas = formikProps.values.personas || [];
    formikProps.setFieldValue(
      "personas",
      currentPersonas.filter((id) => id !== personaId)
    );
  };

  return (
    <div className="mb-4">
      <Label className="mb-2">{label}</Label>
      {subtext && (
        <Text className="text-sm text-text-subtle mb-3">{subtext}</Text>
      )}

      <SearchMultiSelectDropdown
        options={personas
          .filter((p) => !selectedPersonaIds.includes(p.id))
          .map((p) => ({
            name: p.name,
            value: p.id,
          }))}
        onSelect={handleSelect}
      />

      {selectedPersonas.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedPersonas.map((persona) => (
            <div
              key={persona.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-background-125 border border-border rounded-md"
            >
              <span className="text-sm">{persona.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(persona.id)}
                className="text-text-500 hover:text-error transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

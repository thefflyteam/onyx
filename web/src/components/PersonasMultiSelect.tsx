import { FormikProps } from "formik";
import useSWR from "swr";
import { errorHandlingFetcher } from "@/lib/fetcher";
import { GenericMultiSelect } from "@/components/GenericMultiSelect";

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
  label = "Assistants",
  subtext = "Select which assistants can use this LLM provider. If none selected, all assistants can use it.",
}: PersonasMultiSelectProps<T>) {
  const {
    data: personas,
    isLoading,
    error,
  } = useSWR<Persona[]>("/api/persona", errorHandlingFetcher);

  return (
    <GenericMultiSelect
      formikProps={formikProps}
      fieldName="personas"
      label={label}
      subtext={subtext}
      items={personas}
      isLoading={isLoading}
      error={error}
      emptyMessage="No assistants available. Please create an assistant first from the Assistants page."
    />
  );
}

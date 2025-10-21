import { FormikProps } from "formik";
import { Label } from "@/components/Field";
import Text from "@/refresh-components/texts/Text";
import { SearchMultiSelectDropdown } from "@/components/Dropdown";
import { useUserGroups } from "@/lib/hooks";
import { usePaidEnterpriseFeaturesEnabled } from "@/components/settings/usePaidEnterpriseFeaturesEnabled";

export type GroupsMultiSelectFormType = {
  groups: number[];
};

interface GroupsMultiSelectProps<T extends GroupsMultiSelectFormType> {
  formikProps: FormikProps<T>;
  label?: string;
  subtext?: string;
}

export function GroupsMultiSelect<T extends GroupsMultiSelectFormType>({
  formikProps,
  label = "User Groups",
  subtext = "Select which user groups can access this resource",
}: GroupsMultiSelectProps<T>) {
  const { data: userGroups, isLoading: userGroupsIsLoading } = useUserGroups();
  const isPaidEnterpriseFeaturesEnabled = usePaidEnterpriseFeaturesEnabled();

  // Show loading state while checking enterprise features or loading groups
  if (userGroupsIsLoading || isPaidEnterpriseFeaturesEnabled === undefined) {
    return (
      <div className="mb-4">
        <Label>{label}</Label>
        <div className="animate-pulse bg-background-200 h-10 w-full rounded-lg mt-2"></div>
      </div>
    );
  }

  if (!isPaidEnterpriseFeaturesEnabled) {
    return null;
  }

  if (!userGroups || userGroups.length === 0) {
    return (
      <div className="mb-4">
        <Label>{label}</Label>
        <Text className="text-sm text-text-subtle mt-2">
          No user groups available. Please create a user group first.
        </Text>
      </div>
    );
  }

  const selectedGroupIds = formikProps.values.groups || [];
  const selectedGroups = userGroups.filter((g) =>
    selectedGroupIds.includes(g.id)
  );

  const handleSelect = (option: { name: string; value: number }) => {
    const currentGroups = formikProps.values.groups || [];
    if (!currentGroups.includes(option.value)) {
      formikProps.setFieldValue("groups", [...currentGroups, option.value]);
    }
  };

  const handleRemove = (groupId: number) => {
    const currentGroups = formikProps.values.groups || [];
    formikProps.setFieldValue(
      "groups",
      currentGroups.filter((id) => id !== groupId)
    );
  };

  return (
    <div className="mb-4">
      <Label className="mb-2">{label}</Label>
      {subtext && (
        <Text className="text-sm text-text-subtle mb-3">{subtext}</Text>
      )}

      <SearchMultiSelectDropdown
        options={userGroups
          .filter((g) => !selectedGroupIds.includes(g.id))
          .map((g) => ({
            name: g.name,
            value: g.id,
          }))}
        onSelect={handleSelect}
      />

      {selectedGroups.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedGroups.map((group) => (
            <div
              key={group.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-background-125 border border-border rounded-md"
            >
              <span className="text-sm">{group.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(group.id)}
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

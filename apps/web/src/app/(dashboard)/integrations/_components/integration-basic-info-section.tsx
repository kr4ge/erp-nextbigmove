'use client';

import { SectionCard } from '@/components/ui/section-card';
import { FormInput } from '@/components/ui/form-input';
import { FormTextarea } from '@/components/ui/form-textarea';

interface IntegrationBasicInfoSectionProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function IntegrationBasicInfoSection({
  name,
  description,
  onNameChange,
  onDescriptionChange,
}: IntegrationBasicInfoSectionProps) {
  return (
    <SectionCard title="Basic Information">
      <div className="space-y-4">
        <FormInput
          label="Integration Name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          required
        />

        <FormTextarea
          label="Description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
      </div>
    </SectionCard>
  );
}

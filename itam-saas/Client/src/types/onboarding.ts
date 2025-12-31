export type UserType = 'PRIVATE' | 'B2B';

export interface OnboardingState {
  step: 'USER_SELECTION' | 'ORG_DETAILS' | 'TEAM_INVITES' | 'FIRST_ASSET' | 'COMPLETED';
  userType: UserType | null;
  tempData: {
    companyName?: string;
    primaryLocation?: string; // e.g., 'HQ'
    teamMembers: string[]; // List of emails for "Ghost Users"
    selectedCategory?: string;
  };
  isSubmitting: boolean;
}

// Payload for the final Server Action
export interface OnboardingPayload {
  userType: UserType;
  organization?: {
    name: string;
    primaryLocation: string;
  };
  initialEmployees?: { fullName: string; email?: string }[];
  firstAsset?: {
    categorySlug: string;
    modelName: string;
    serialNumber: string;
    assignedToEmail?: string; // Links to a ghost user above
  };
}

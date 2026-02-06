import { useState } from 'react';

export const HOME_AGE_OPTIONS = [
  { value: "0-5", label: "0-5 years" },
  { value: "6-10", label: "6-10 years" },
  { value: "11-20", label: "11-20 years" },
  { value: "21-30", label: "21-30 years" },
  { value: "30+", label: "Over 30 years" },
];

export const HOUSEHOLD_SIZE_OPTIONS = [
  { value: "1-2", label: "1-2 people" },
  { value: "3-4", label: "3-4 people" },
  { value: "5-6", label: "5-6 people" },
  { value: "7+", label: "7+ people" },
];

export const WATER_SOURCE_OPTIONS = [
  { value: "city", label: "City/Municipal Water" },
  { value: "well", label: "Well Water" },
  { value: "unknown", label: "Not Sure" },
];

export interface WizardState {
  currentStep: number;
  proposalId: string | null;
  // Customer info
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  // Location
  street: string;
  city: string;
  state: string;
  zipCode: string;
  // Household
  homeAge: string;
  householdSize: string;
  numShowers: string;
  numBathrooms: string;
  bottledWaterCases: string;
  waterSource: string;
  hasDishwasher: boolean;
  hasDryer: boolean;
  hasWaterHeater: boolean;
  hasIceMaker: boolean;
  waterConcerns: string;
  // Water test
  hardness: string;
  iron: string;
  tds: string;
  ph: number[];
  chlorine: string;
  // Presentation
  presentationUrl: string | null;
  isGenerating: boolean;
  // Products & Invoice
  selectedProductIds: string[];
  customerEmailForInvoice: string;
  allowPromoCodes: boolean;
  paymentLink: string | null;
  // Install
  installDate: string;
}

export function useProposalWizard() {
  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    proposalId: null,
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    homeAge: '',
    householdSize: '',
    numShowers: '',
    numBathrooms: '',
    bottledWaterCases: '',
    waterSource: '',
    hasDishwasher: false,
    hasDryer: false,
    hasWaterHeater: false,
    hasIceMaker: false,
    waterConcerns: '',
    hardness: '',
    iron: '',
    tds: '',
    ph: [7],
    chlorine: '',
    presentationUrl: null,
    isGenerating: false,
    selectedProductIds: [],
    customerEmailForInvoice: '',
    allowPromoCodes: true,
    paymentLink: null,
    installDate: '',
  });

  const update = (partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };

  const setStep = (step: number) => update({ currentStep: step });

  const canProceed = (): boolean => {
    switch (state.currentStep) {
      case 1:
        return state.customerName.trim().length > 0;
      case 2:
        return state.street.trim().length > 0 && state.city.trim().length > 0 && state.state.trim().length > 0 && state.zipCode.trim().length > 0;
      case 3:
        return state.homeAge.length > 0 && state.householdSize.length > 0 && state.waterSource.length > 0;
      case 4:
        return true;
      case 5:
        return !!state.proposalId;
      case 6:
        return state.selectedProductIds.length > 0;
      case 7:
        return true;
      case 8:
        return true;
      case 9:
        return true;
      default:
        return false;
    }
  };

  return { state, update, setStep, canProceed };
}

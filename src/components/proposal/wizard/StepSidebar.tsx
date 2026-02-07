import { User, MapPin, Home, Droplets, Sparkles, ShoppingCart, Receipt, FileText, Camera, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const STEPS = [
  { id: 1, title: 'Customer Info', icon: User },
  { id: 2, title: 'Location', icon: MapPin },
  { id: 3, title: 'Household', icon: Home },
  { id: 4, title: 'Water Test', icon: Droplets },
  { id: 5, title: 'Presentation', icon: Sparkles },
  { id: 6, title: 'System Buildout', icon: ShoppingCart },
  { id: 7, title: 'Generate Invoice', icon: Receipt },
  { id: 8, title: 'Contract', icon: FileText },
  { id: 9, title: 'Install Details', icon: Camera },
];

interface StepSidebarProps {
  currentStep: number;
  proposalId: string | null;
  onStepClick: (step: number) => void;
}

export function StepSidebar({ currentStep, proposalId, onStepClick }: StepSidebarProps) {
  const canNavigateTo = (stepId: number) => {
    // Steps 1-4 are always navigable once reached
    // Steps 5+ require a saved proposal
    if (stepId <= 4) return stepId <= currentStep;
    return !!proposalId;
  };

  return (
    <nav className="w-64 flex-shrink-0 hidden lg:block">
      <div className="sticky top-24 space-y-1">
        {STEPS.map((step, index) => {
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;
          const isClickable = canNavigateTo(step.id);

          return (
            <div key={step.id} className="relative">
              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    'absolute left-5 top-10 w-0.5 h-6 transition-colors duration-300',
                    isCompleted ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}

              <button
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200',
                  isActive && 'bg-primary/10 text-primary',
                  isCompleted && !isActive && 'text-foreground hover:bg-muted/50',
                  !isActive && !isCompleted && !isClickable && 'text-muted-foreground/50 cursor-not-allowed',
                  !isActive && !isCompleted && isClickable && 'text-muted-foreground hover:bg-muted/50 cursor-pointer'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300',
                    isActive && 'gradient-water shadow-water',
                    isCompleted && !isActive && 'bg-primary/15',
                    !isActive && !isCompleted && 'bg-muted'
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : (
                    <step.icon
                      className={cn(
                        'w-4 h-4',
                        isActive && 'text-primary-foreground',
                        !isActive && !isCompleted && 'text-muted-foreground',
                        isCompleted && !isActive && 'text-primary'
                      )}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    'text-sm font-medium truncate',
                    isActive && 'text-primary',
                    isCompleted && !isActive && 'text-foreground'
                  )}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Step {step.id}
                  </p>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

// Mobile step indicator
export function MobileStepIndicator({ currentStep }: { currentStep: number }) {
  const step = STEPS.find((s) => s.id === currentStep);
  if (!step) return null;

  return (
    <div className="lg:hidden flex items-center gap-3 mb-6 px-1">
      <div className="w-10 h-10 gradient-water rounded-xl flex items-center justify-center shadow-sm">
        <step.icon className="w-4 h-4 text-primary-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-primary">{step.title}</p>
        <p className="text-xs text-muted-foreground">Step {step.id} of {STEPS.length}</p>
      </div>
      <div className="ml-auto flex gap-0.5">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              s.id === currentStep ? 'bg-primary' : s.id < currentStep ? 'bg-primary/40' : 'bg-muted'
            )}
          />
        ))}
      </div>
    </div>
  );
}

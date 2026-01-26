import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, User, MapPin, Droplet, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WaterBackground } from "@/components/WaterBackground";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SYSTEMS = [
  { value: "standard-softener", label: "Standard Softener" },
  { value: "iron-filter", label: "Iron Filter" },
  { value: "reverse-osmosis", label: "Reverse Osmosis" },
  { value: "uv-purification", label: "UV Purification" },
  { value: "whole-house", label: "Whole House System" },
];

const STEPS = [
  { id: 1, title: "Customer Info", icon: User },
  { id: 2, title: "Location", icon: MapPin },
  { id: 3, title: "System", icon: Droplet },
];

export default function NewProposal() {
  const [currentStep, setCurrentStep] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [recommendedSystem, setRecommendedSystem] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return customerName.trim().length > 0;
      case 2:
        return address.trim().length > 0;
      case 3:
        return recommendedSystem.length > 0;
      default:
        return false;
    }
  };

  const handleGenerate = async () => {
    if (!user || !profile?.dealership_id) {
      toast({
        title: "Unable to create proposal",
        description: "Please complete onboarding before creating proposals.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Create proposal in database first
      const { data: proposal, error: insertError } = await supabase
        .from("proposals")
        .insert({
          customer_name: customerName,
          address: address,
          recommended_system: SYSTEMS.find((s) => s.value === recommendedSystem)?.label || recommendedSystem,
          dealership_id: profile.dealership_id!,
          created_by: user!.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call n8n webhook (fire and forget - n8n will callback when PDF is ready)
      fetch(
        "https://n8n.srv1297035.hstgr.cloud/webhook/e36c484d-ce4c-4f8e-bb75-9ad945c9ef7b",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerName,
            address,
            recommendedSystem: SYSTEMS.find((s) => s.value === recommendedSystem)?.label || recommendedSystem,
            repName: profile.full_name,
            proposalId: proposal.id,
          }),
        },
      ).catch((err) => console.error("Failed to trigger n8n webhook:", err));

      setIsComplete(true);
    } catch (error) {
      console.error("Error generating proposal:", error);
      toast({
        title: "Proposal saved",
        description: "Your proposal has been saved. The presentation will be generated shortly.",
      });
      setIsComplete(true);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <WaterBackground />
        <Card className="w-full max-w-md text-center shadow-water border-0">
          <CardContent className="pt-12 pb-12">
            <div className="mb-8">
              <LoadingSpinner size="lg" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Creating Your Presentation</h2>
            <p className="text-muted-foreground">Our AI is building your customized water treatment presentation...</p>
            <div className="mt-8 flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary animate-pulse"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <WaterBackground />
        <Card className="w-full max-w-md text-center shadow-water border-0 animate-scale-in">
          <CardContent className="pt-12 pb-12">
            <div className="w-20 h-20 gradient-water rounded-full flex items-center justify-center mx-auto mb-6 shadow-water">
              <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Proposal Created!</h2>
            <p className="text-muted-foreground mb-8">Your presentation for {customerName} is ready.</p>
            <div className="flex flex-col gap-3">
              <Button variant="water" size="lg" onClick={() => navigate("/")}>
                Back to Dashboard
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCurrentStep(1);
                  setCustomerName("");
                  setAddress("");
                  setRecommendedSystem("");
                  setIsComplete(false);
                }}
              >
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <WaterBackground />

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-foreground">New Proposal</h1>
          <p className="text-muted-foreground mt-1">Create a customized water treatment presentation</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                      currentStep >= step.id ? "gradient-water shadow-water" : "bg-muted"
                    }`}
                  >
                    <step.icon
                      className={`w-5 h-5 ${
                        currentStep >= step.id ? "text-primary-foreground" : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-xs mt-2 font-medium ${
                      currentStep >= step.id ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-full h-1 mx-2 rounded-full transition-all duration-300 ${
                      currentStep > step.id ? "gradient-water" : "bg-muted"
                    }`}
                    style={{ width: "60px" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <Card className="shadow-water border-0 animate-fade-in">
          <CardHeader>
            <CardTitle>
              {currentStep === 1 && "Customer Information"}
              {currentStep === 2 && "Service Location"}
              {currentStep === 3 && "Recommended System"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Enter the customer's name"}
              {currentStep === 2 && "Where will the system be installed?"}
              {currentStep === 3 && "Select the best system for this customer"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStep === 1 && (
              <div className="space-y-2">
                <Label htmlFor="customerName" className="font-medium">
                  Customer Name
                </Label>
                <Input
                  id="customerName"
                  type="text"
                  placeholder="e.g., John Smith"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-12 text-lg"
                  autoFocus
                />
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-2">
                <Label htmlFor="address" className="font-medium">
                  Address
                </Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="e.g., 123 Main St, City, State"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="h-12 text-lg"
                  autoFocus
                />
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-2">
                <Label className="font-medium">Recommended System</Label>
                <Select value={recommendedSystem} onValueChange={setRecommendedSystem}>
                  <SelectTrigger className="h-12 text-lg">
                    <SelectValue placeholder="Select a system..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SYSTEMS.map((system) => (
                      <SelectItem key={system.value} value={system.value}>
                        {system.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} disabled={currentStep === 1}>
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>

              {currentStep < 3 ? (
                <Button variant="water" onClick={() => setCurrentStep(currentStep + 1)} disabled={!canProceed()}>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button variant="water" onClick={handleGenerate} disabled={!canProceed()}>
                  <Sparkles className="w-4 h-4" />
                  Generate Presentation
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

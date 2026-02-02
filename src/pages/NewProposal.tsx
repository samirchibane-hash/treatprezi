import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, User, MapPin, Home, Droplets, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { WaterBackground } from "@/components/WaterBackground";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const HOME_AGE_OPTIONS = [
  { value: "0-5", label: "0-5 years" },
  { value: "6-10", label: "6-10 years" },
  { value: "11-20", label: "11-20 years" },
  { value: "21-30", label: "21-30 years" },
  { value: "30+", label: "Over 30 years" },
];

const HOUSEHOLD_SIZE_OPTIONS = [
  { value: "1-2", label: "1-2 people" },
  { value: "3-4", label: "3-4 people" },
  { value: "5-6", label: "5-6 people" },
  { value: "7+", label: "7+ people" },
];

const WATER_SOURCE_OPTIONS = [
  { value: "city", label: "City/Municipal Water" },
  { value: "well", label: "Well Water" },
  { value: "unknown", label: "Not Sure" },
];

const STEPS = [
  { id: 1, title: "Customer Info", icon: User },
  { id: 2, title: "Location", icon: MapPin },
  { id: 3, title: "Household", icon: Home },
  { id: 4, title: "Water Test", icon: Droplets },
];

export default function NewProposal() {
  const [currentStep, setCurrentStep] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [homeAge, setHomeAge] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [numShowers, setNumShowers] = useState("");
  const [numBathrooms, setNumBathrooms] = useState("");
  const [bottledWaterCases, setBottledWaterCases] = useState("");
  const [waterSource, setWaterSource] = useState("");
  const [hasDishwasher, setHasDishwasher] = useState(false);
  const [hasDryer, setHasDryer] = useState(false);
  const [hasWaterHeater, setHasWaterHeater] = useState(false);
  const [hasIceMaker, setHasIceMaker] = useState(false);
  const [waterConcerns, setWaterConcerns] = useState("");
  // Water Test fields
  const [hardness, setHardness] = useState("");
  const [iron, setIron] = useState("");
  const [tds, setTds] = useState("");
  const [ph, setPh] = useState<number[]>([7]);
  const [chlorine, setChlorine] = useState("");
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
        return street.trim().length > 0 && city.trim().length > 0 && state.trim().length > 0 && zipCode.trim().length > 0;
      case 3:
        return homeAge.length > 0 && householdSize.length > 0 && waterSource.length > 0;
      case 4:
        return true; // All water test fields are optional
      default:
        return false;
    }
  };

  const isValidEmail = (email: string) => {
    if (!email.trim()) return true; // Optional field
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
      // Fetch full rep profile with phone/email
      const { data: repProfile } = await supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", user.id)
        .single();

      // Fetch dealership details
      const { data: dealership } = await supabase
        .from("dealerships")
        .select("name, address, phone")
        .eq("id", profile.dealership_id)
        .single();

      // Create proposal in database first
      const { data: proposal, error: insertError } = await supabase
        .from("proposals")
        .insert({
          customer_name: customerName,
          customer_email: customerEmail.trim() || null,
          customer_phone: customerPhone.trim() || null,
          address: `${street}, ${city}, ${state} ${zipCode}`,
          recommended_system: `Home: ${HOME_AGE_OPTIONS.find(o => o.value === homeAge)?.label}, ${HOUSEHOLD_SIZE_OPTIONS.find(o => o.value === householdSize)?.label}, ${WATER_SOURCE_OPTIONS.find(o => o.value === waterSource)?.label}`,
          dealership_id: profile.dealership_id!,
          created_by: user!.id,
          // Household details
          home_age: HOME_AGE_OPTIONS.find(o => o.value === homeAge)?.label || homeAge,
          household_size: HOUSEHOLD_SIZE_OPTIONS.find(o => o.value === householdSize)?.label || householdSize,
          num_showers: numShowers || null,
          num_bathrooms: numBathrooms || null,
          bottled_water_cases: bottledWaterCases || null,
          water_source: WATER_SOURCE_OPTIONS.find(o => o.value === waterSource)?.label || waterSource,
          has_dishwasher: hasDishwasher,
          has_dryer: hasDryer,
          has_water_heater: hasWaterHeater,
          has_ice_maker: hasIceMaker,
          water_concerns: waterConcerns.trim() || null,
          // Water test data
          hardness: hardness ? parseFloat(hardness) : null,
          iron: iron ? parseFloat(iron) : null,
          tds: tds ? parseFloat(tds) : null,
          ph: ph[0],
          chlorine: chlorine ? parseFloat(chlorine) : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call n8n webhook with full rep and company data
      fetch(
        "https://n8n.srv1297035.hstgr.cloud/webhook/e36c484d-ce4c-4f8e-bb75-9ad945c9ef7b",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerName,
            customerEmail: customerEmail.trim() || null,
            customerPhone: customerPhone.trim() || null,
            street,
            city,
            state,
            zipCode,
            address: `${street}, ${city}, ${state} ${zipCode}`,
            // Household details
            homeAge: HOME_AGE_OPTIONS.find(o => o.value === homeAge)?.label || homeAge,
            householdSize: HOUSEHOLD_SIZE_OPTIONS.find(o => o.value === householdSize)?.label || householdSize,
            numShowers: numShowers || null,
            numBathrooms: numBathrooms || null,
            bottledWaterCases: bottledWaterCases || null,
            waterSource: WATER_SOURCE_OPTIONS.find(o => o.value === waterSource)?.label || waterSource,
            hasDishwasher,
            hasDryer,
            hasWaterHeater,
            hasIceMaker,
            waterConcerns: waterConcerns.trim() || null,
            // Water test results
            hardness: hardness ? parseFloat(hardness) : null,
            iron: iron ? parseFloat(iron) : null,
            tds: tds ? parseFloat(tds) : null,
            ph: ph[0],
            chlorine: chlorine ? parseFloat(chlorine) : null,
            proposalId: proposal.id,
            // Rep details
            repName: repProfile?.full_name || profile.full_name,
            repEmail: repProfile?.email || user.email,
            repPhone: repProfile?.phone || null,
            // Company details
            companyName: dealership?.name || null,
            companyAddress: dealership?.address || null,
            companyPhone: dealership?.phone || null,
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
                  setCustomerEmail("");
                  setCustomerPhone("");
                  setStreet("");
                  setCity("");
                  setState("");
                  setZipCode("");
                  setHomeAge("");
                  setHouseholdSize("");
                  setNumShowers("");
                  setNumBathrooms("");
                  setBottledWaterCases("");
                  setWaterSource("");
                  setHasDishwasher(false);
                  setHasDryer(false);
                  setHasWaterHeater(false);
                  setHasIceMaker(false);
                  setWaterConcerns("");
                  setHardness("");
                  setIron("");
                  setTds("");
                  setPh([7]);
                  setChlorine("");
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
              {currentStep === 3 && "Household Details"}
              {currentStep === 4 && "Water Test Results"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Enter the customer's contact information"}
              {currentStep === 2 && "Where will the system be installed?"}
              {currentStep === 3 && "Tell us about the home and water usage"}
              {currentStep === 4 && "Enter the water quality test measurements"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentStep === 1 && (
              <div className="space-y-4">
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
                <div className="space-y-2">
                  <Label htmlFor="customerEmail" className="font-medium">
                    Email <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    placeholder="e.g., john@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className={`h-12 text-lg ${!isValidEmail(customerEmail) ? 'border-destructive' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPhone" className="font-medium">
                    Phone <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    placeholder="e.g., (555) 123-4567"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-12 text-lg"
                  />
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="street" className="font-medium">
                    Street Address
                  </Label>
                  <Input
                    id="street"
                    type="text"
                    placeholder="e.g., 123 Main St"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="h-12 text-lg"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="font-medium">
                      City
                    </Label>
                    <Input
                      id="city"
                      type="text"
                      placeholder="e.g., Austin"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="h-12 text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state" className="font-medium">
                      State
                    </Label>
                    <Input
                      id="state"
                      type="text"
                      placeholder="e.g., TX"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="h-12 text-lg"
                    />
                  </div>
                </div>
                <div className="w-1/2">
                  <div className="space-y-2">
                    <Label htmlFor="zipCode" className="font-medium">
                      ZIP Code
                    </Label>
                    <Input
                      id="zipCode"
                      type="text"
                      placeholder="e.g., 78701"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      className="h-12 text-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Home Age & Household Size */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium">Home Age</Label>
                    <Select value={homeAge} onValueChange={setHomeAge}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {HOME_AGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-medium">Household Size</Label>
                    <Select value={householdSize} onValueChange={setHouseholdSize}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {HOUSEHOLD_SIZE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Showers & Bathrooms */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="numShowers" className="font-medium">
                      Number of Showers
                    </Label>
                    <Input
                      id="numShowers"
                      type="number"
                      min="0"
                      placeholder="e.g., 2"
                      value={numShowers}
                      onChange={(e) => setNumShowers(e.target.value)}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numBathrooms" className="font-medium">
                      Number of Bathrooms
                    </Label>
                    <Input
                      id="numBathrooms"
                      type="number"
                      min="0"
                      placeholder="e.g., 2"
                      value={numBathrooms}
                      onChange={(e) => setNumBathrooms(e.target.value)}
                      className="h-12"
                    />
                  </div>
                </div>

                {/* Water Source & Bottled Water */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-medium">Water Source</Label>
                    <Select value={waterSource} onValueChange={setWaterSource}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {WATER_SOURCE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bottledWater" className="font-medium">
                      Bottled Water/Month
                    </Label>
                    <Input
                      id="bottledWater"
                      type="number"
                      min="0"
                      placeholder="Cases per month"
                      value={bottledWaterCases}
                      onChange={(e) => setBottledWaterCases(e.target.value)}
                      className="h-12"
                    />
                  </div>
                </div>

                {/* Appliances */}
                <div className="space-y-3">
                  <Label className="font-medium">Appliances in Home</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
                      <Checkbox
                        checked={hasDishwasher}
                        onCheckedChange={(checked) => setHasDishwasher(checked === true)}
                      />
                      <span>Dishwasher</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
                      <Checkbox
                        checked={hasDryer}
                        onCheckedChange={(checked) => setHasDryer(checked === true)}
                      />
                      <span>Dryer</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
                      <Checkbox
                        checked={hasWaterHeater}
                        onCheckedChange={(checked) => setHasWaterHeater(checked === true)}
                      />
                      <span>Water Heater</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
                      <Checkbox
                        checked={hasIceMaker}
                        onCheckedChange={(checked) => setHasIceMaker(checked === true)}
                      />
                      <span>Ice Maker</span>
                    </label>
                  </div>
                </div>

                {/* Water Concerns */}
                <div className="space-y-2">
                  <Label htmlFor="waterConcerns" className="font-medium">
                    Water Concerns <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="waterConcerns"
                    type="text"
                    placeholder="e.g., hard water, bad taste, staining..."
                    value={waterConcerns}
                    onChange={(e) => setWaterConcerns(e.target.value)}
                    className="h-12"
                  />
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                {/* Hardness & Iron */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hardness" className="font-medium">
                      Hardness <span className="text-muted-foreground font-normal">(Grains)</span>
                    </Label>
                    <Input
                      id="hardness"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="e.g., 15"
                      value={hardness}
                      onChange={(e) => setHardness(e.target.value)}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iron" className="font-medium">
                      Iron <span className="text-muted-foreground font-normal">(ppm)</span>
                    </Label>
                    <Input
                      id="iron"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g., 0.3"
                      value={iron}
                      onChange={(e) => setIron(e.target.value)}
                      className="h-12"
                    />
                  </div>
                </div>

                {/* TDS & Chlorine */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tds" className="font-medium">
                      TDS <span className="text-muted-foreground font-normal">(ppm)</span>
                    </Label>
                    <Input
                      id="tds"
                      type="number"
                      min="0"
                      placeholder="e.g., 350"
                      value={tds}
                      onChange={(e) => setTds(e.target.value)}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chlorine" className="font-medium">
                      Chlorine <span className="text-muted-foreground font-normal">(ppm)</span>
                    </Label>
                    <Input
                      id="chlorine"
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="e.g., 1.5"
                      value={chlorine}
                      onChange={(e) => setChlorine(e.target.value)}
                      className="h-12"
                    />
                  </div>
                </div>

                {/* pH Slider */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="font-medium">pH Level</Label>
                    <span className="text-lg font-semibold text-primary">{ph[0].toFixed(1)}</span>
                  </div>
                  <Slider
                    value={ph}
                    onValueChange={setPh}
                    min={0}
                    max={14}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0 (Acidic)</span>
                    <span>7 (Neutral)</span>
                    <span>14 (Alkaline)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-6">
              <Button variant="ghost" onClick={() => setCurrentStep(currentStep - 1)} disabled={currentStep === 1}>
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>

              {currentStep < 4 ? (
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

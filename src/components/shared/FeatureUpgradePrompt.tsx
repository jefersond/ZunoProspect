import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Feature {
  icon: LucideIcon;
  label: string;
}

interface FeatureUpgradePromptProps {
  title: string;
  description: string;
  features: Feature[];
  requiredPlan?: string;
}

export const FeatureUpgradePrompt = ({
  title,
  description,
  features,
  requiredPlan = 'Agência'
}: FeatureUpgradePromptProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-border">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          
          <h1 className="text-2xl font-bold mb-2">{title}</h1>
          <p className="text-muted-foreground mb-6">
            {description}
          </p>

          <div className="space-y-3 mb-8 text-left">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <feature.icon className="h-5 w-5 text-primary" />
                <span className="text-sm">{feature.label}</span>
              </div>
            ))}
          </div>

          <Button 
            onClick={() => navigate('/profile')} 
            className="w-full bg-emerald-600 text-white shadow-sm shadow-emerald-950/20 hover:bg-emerald-500"
            size="lg"
          >
            Fazer Upgrade para {requiredPlan}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => navigate('/prospeccao')} 
            className="w-full mt-2"
          >
            Voltar para Prospecção
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

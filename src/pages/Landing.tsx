import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Workflow,
  BarChart3,
  FileText,
  Globe,
  CheckCircle,
  ArrowRight,
  Zap,
  Shield,
  Users,
} from "lucide-react";

export default function Landing() {
  const { t } = useLanguage();

  const features = [
    {
      icon: BarChart3,
      titleKey: "landing.feature1Title",
      descKey: "landing.feature1Desc",
    },
    {
      icon: FileText,
      titleKey: "landing.feature2Title",
      descKey: "landing.feature2Desc",
    },
    {
      icon: Globe,
      titleKey: "landing.feature3Title",
      descKey: "landing.feature3Desc",
    },
  ];

  const pricingPlans = [
    {
      name: t("landing.pricingFree"),
      price: "€0",
      period: t("landing.perMonth"),
      features: [
        t("landing.freeFeature1"),
        t("landing.freeFeature2"),
        t("landing.freeFeature3"),
      ],
      cta: t("landing.getStarted"),
      highlighted: false,
    },
    {
      name: t("landing.pricingPro"),
      price: "€19",
      period: t("landing.perMonth"),
      features: [
        t("landing.proFeature1"),
        t("landing.proFeature2"),
        t("landing.proFeature3"),
        t("landing.proFeature4"),
      ],
      cta: t("landing.startTrial"),
      highlighted: true,
    },
    {
      name: t("landing.pricingEnterprise"),
      price: t("landing.customPricing"),
      period: "",
      features: [
        t("landing.enterpriseFeature1"),
        t("landing.enterpriseFeature2"),
        t("landing.enterpriseFeature3"),
        t("landing.enterpriseFeature4"),
      ],
      cta: t("landing.contactSales"),
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="w-7 h-7 text-accent" />
            <span className="text-xl font-semibold">BPMN Modeler</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
            <Link to="/auth">
              <Button variant="ghost">{t("auth.signIn")}</Button>
            </Link>
            <Link to="/auth">
              <Button>{t("landing.getStarted")}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            {t("landing.heroTitle")}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t("landing.heroSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="gap-2">
                {t("landing.getStarted")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline">
              {t("landing.learnMore")}
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            {t("landing.featuresTitle")}
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            {t("landing.featuresSubtitle")}
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((feature, idx) => (
              <Card key={idx} className="border-0 shadow-lg bg-card">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-accent" />
                  </div>
                  <CardTitle className="text-xl">{t(feature.titleKey)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t(feature.descKey)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                {t("landing.benefitsTitle")}
              </h2>
              <div className="space-y-4">
                {[
                  { icon: Zap, text: t("landing.benefit1") },
                  { icon: Shield, text: t("landing.benefit2") },
                  { icon: Users, text: t("landing.benefit3") },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <item.icon className="w-4 h-4 text-accent" />
                    </div>
                    <p className="text-lg">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary/5 to-accent/10 rounded-2xl p-8 border">
              <div className="aspect-video bg-card rounded-lg shadow-lg flex items-center justify-center">
                <Workflow className="w-16 h-16 text-accent/50" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            {t("landing.pricingTitle")}
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            {t("landing.pricingSubtitle")}
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, idx) => (
              <Card
                key={idx}
                className={`relative ${
                  plan.highlighted
                    ? "border-accent shadow-lg scale-105"
                    : "border-border"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-full">
                      {t("landing.mostPopular")}
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl mb-2">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-muted-foreground">/{plan.period}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth" className="block">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-12 text-primary-foreground">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t("landing.ctaTitle")}
            </h2>
            <p className="text-lg opacity-90 mb-8">
              {t("landing.ctaSubtitle")}
            </p>
            <Link to="/auth">
              <Button
                size="lg"
                variant="secondary"
                className="gap-2"
              >
                {t("landing.getStarted")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Workflow className="w-5 h-5 text-accent" />
              <span className="font-medium">BPMN Modeler</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 BPMN Modeler. {t("landing.allRightsReserved")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

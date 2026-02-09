import { createContext, useContext, useState, ReactNode, useCallback } from "react";

type Language = "en" | "fi";

interface Translations {
  [key: string]: {
    en: string;
    fi: string;
  };
}

const translations: Translations = {
  // Navigation & Common
  "nav.dashboard": { en: "Dashboard", fi: "Työpöytä" },
  "nav.signOut": { en: "Sign Out", fi: "Kirjaudu ulos" },
  "nav.profile": { en: "Profile", fi: "Profiili" },
  "common.save": { en: "Save", fi: "Tallenna" },
  "common.cancel": { en: "Cancel", fi: "Peruuta" },
  "common.delete": { en: "Delete", fi: "Poista" },
  "common.edit": { en: "Edit", fi: "Muokkaa" },
  "common.create": { en: "Create", fi: "Luo" },
  "common.search": { en: "Search", fi: "Hae" },
  "common.loading": { en: "Loading...", fi: "Ladataan..." },
  "common.saved": { en: "Saved", fi: "Tallennettu" },
  "common.unsaved": { en: "Unsaved", fi: "Tallentamatta" },
  "common.saving": { en: "Saving...", fi: "Tallennetaan..." },
  
  // Auth
  "auth.signIn": { en: "Sign In", fi: "Kirjaudu sisään" },
  "auth.signUp": { en: "Sign Up", fi: "Rekisteröidy" },
  "auth.email": { en: "Email", fi: "Sähköposti" },
  "auth.password": { en: "Password", fi: "Salasana" },
  "auth.displayName": { en: "Display Name", fi: "Näyttönimi" },
  "auth.noAccount": { en: "Don't have an account?", fi: "Eikö sinulla ole tiliä?" },
  "auth.haveAccount": { en: "Already have an account?", fi: "Onko sinulla jo tili?" },
  "auth.subtitle": { en: "Professional BPMN process modeling", fi: "Ammattimainen BPMN-prosessimallinnus" },
  "auth.checkEmail": { en: "Check your email for confirmation", fi: "Tarkista sähköpostisi vahvistusviesti" },
  
  // Dashboard
  "dashboard.newProject": { en: "New Project", fi: "Uusi projekti" },
  "dashboard.newFromTemplate": { en: "New from Template", fi: "Uusi mallista" },
  "dashboard.folders": { en: "Folders", fi: "Kansiot" },
  "dashboard.allProjects": { en: "All Projects", fi: "Kaikki projektit" },
  "dashboard.searchProjects": { en: "Search projects...", fi: "Hae projekteja..." },
  "dashboard.noProjects": { en: "No projects yet", fi: "Ei projekteja vielä" },
  "dashboard.noMatch": { en: "No projects match your search", fi: "Hakuun ei löytynyt projekteja" },
  "dashboard.createFirst": { en: "Create your first project", fi: "Luo ensimmäinen projektisi" },
  "dashboard.createFolder": { en: "Create Folder", fi: "Luo kansio" },
  "dashboard.folderName": { en: "Folder name...", fi: "Kansion nimi..." },
  "dashboard.chooseTemplate": { en: "Choose a Template", fi: "Valitse malli" },
  "dashboard.moveToFolder": { en: "Move to Folder", fi: "Siirrä kansioon" },
  "dashboard.noFolder": { en: "No Folder (Root)", fi: "Ei kansiota (juuri)" },
  "dashboard.creatingIn": { en: "Creating in", fi: "Luodaan kansioon" },
  "dashboard.totalProjects": { en: "Total Projects", fi: "Projekteja yhteensä" },
  "dashboard.systemsMapped": { en: "Systems Mapped", fi: "Järjestelmiä kartoitettu" },
  "dashboard.currentFolder": { en: "Current Folder", fi: "Nykyinen kansio" },
  "dashboard.projectMoved": { en: "Project moved", fi: "Projekti siirretty" },
  
  // Editor
  "editor.processSteps": { en: "Process Steps", fi: "Prosessin vaiheet" },
  "editor.addStep": { en: "Add Step", fi: "Lisää vaihe" },
  "editor.noSteps": { en: "No process steps yet.", fi: "Ei prosessin vaiheita vielä." },
  "editor.clickAdd": { en: "Click \"Add Step\" to begin mapping.", fi: "Klikkaa \"Lisää vaihe\" aloittaaksesi." },
  "editor.taskName": { en: "Task name...", fi: "Tehtävän nimi..." },
  "editor.performer": { en: "Performer", fi: "Suorittaja" },
  "editor.decision": { en: "Decision", fi: "Päätös" },
  "editor.backToDashboard": { en: "Back to Dashboard", fi: "Takaisin työpöydälle" },
  "editor.export": { en: "Export", fi: "Vie" },
  "editor.exportAs": { en: "Export as", fi: "Vie muodossa" },
  
  // Strategic Tools
  "strategic.analysis": { en: "Analysis", fi: "Analyysi" },
  "strategic.swot": { en: "SWOT Analysis", fi: "SWOT-analyysi" },
  "strategic.strengths": { en: "Strengths", fi: "Vahvuudet" },
  "strategic.weaknesses": { en: "Weaknesses", fi: "Heikkoudet" },
  "strategic.opportunities": { en: "Opportunities", fi: "Mahdollisuudet" },
  "strategic.threats": { en: "Threats", fi: "Uhat" },
  "strategic.sipoc": { en: "SIPOC", fi: "SIPOC" },
  "strategic.suppliers": { en: "Suppliers", fi: "Toimittajat" },
  "strategic.inputs": { en: "Inputs", fi: "Syötteet" },
  "strategic.process": { en: "Process", fi: "Prosessi" },
  "strategic.outputs": { en: "Outputs", fi: "Tulosteet" },
  "strategic.customers": { en: "Customers", fi: "Asiakkaat" },
  "strategic.systemHeatmap": { en: "System Heatmap", fi: "Järjestelmäkartta" },
  "strategic.highToolSwitching": { en: "High tool-switching detected", fi: "Paljon työkalujen vaihtoa havaittu" },
  "strategic.generateSOP": { en: "Generate SOP", fi: "Luo SOP" },
  "strategic.sopGenerated": { en: "SOP Generated", fi: "SOP luotu" },
  
  // Profile
  "profile.title": { en: "Profile Settings", fi: "Profiiliasetukset" },
  "profile.phoneNumber": { en: "Phone Number", fi: "Puhelinnumero" },
  "profile.address": { en: "Address", fi: "Osoite" },
  "profile.updated": { en: "Profile updated", fi: "Profiili päivitetty" },
  
  // Templates
  "template.basicStarter": { en: "Basic BPMN Starter", fi: "BPMN-perusmalli" },
  "template.sipocStarter": { en: "Strategic SIPOC Starter", fi: "Strateginen SIPOC-malli" },
  "template.systemOptimization": { en: "System Optimization Flow", fi: "Järjestelmien optimointi" },
  "template.complianceDoc": { en: "Compliance & Documentation", fi: "Dokumentointi ja vaatimustenmukaisuus" },

  // Folder Tags
  "folder.manageTags": { en: "Manage Tags", fi: "Hallitse tageja" },
  "folder.systemTags": { en: "System Tags", fi: "Järjestelmätagit" },
  "folder.addTagPlaceholder": { en: "Add new tag...", fi: "Lisää uusi tagi..." },
  "folder.inheritedTags": { en: "Inherited from parent folders", fi: "Peritty yläkansioista" },
  "folder.folderTags": { en: "This folder's tags", fi: "Tämän kansion tagit" },
  "folder.noTags": { en: "No tags defined", fi: "Ei tageja määritetty" },
  "folder.tagsHelp": { en: "Tags defined here will be available in all projects within this folder and its subfolders.", fi: "Täällä määritetyt tagit ovat käytettävissä kaikissa tämän kansion ja sen alikansioiden projekteissa." },

  // Sharing
  "share.share": { en: "Share", fi: "Jaa" },
  "share.shareTitle": { en: "Share", fi: "Jaa" },
  "share.inviteUser": { en: "Invite user by email", fi: "Kutsu käyttäjä sähköpostilla" },
  "share.emailPlaceholder": { en: "user@example.com", fi: "kayttaja@esimerkki.fi" },
  "share.view": { en: "View", fi: "Näytä" },
  "share.edit": { en: "Edit", fi: "Muokkaa" },
  "share.sendInvite": { en: "Send Invite", fi: "Lähetä kutsu" },
  "share.currentAccess": { en: "Current access", fi: "Nykyinen pääsy" },
  "share.noShares": { en: "Not shared with anyone yet", fi: "Ei vielä jaettu kenellekään" },
  "share.folderShareHelp": { en: "Users with access to this folder can also access all projects within it.", fi: "Käyttäjät, joilla on pääsy tähän kansioon, voivat myös käyttää kaikkia sen projekteja." },
  "share.projectShareHelp": { en: "Share this project with specific users.", fi: "Jaa tämä projekti tietyille käyttäjille." },
  "share.shareCreated": { en: "Invitation sent", fi: "Kutsu lähetetty" },
  "share.shareRemoved": { en: "Access removed", fi: "Pääsy poistettu" },

  // Landing Page
  "landing.heroTitle": { en: "Optimize Your Business Processes", fi: "Optimoi liiketoimintaprosessisi" },
  "landing.heroSubtitle": { en: "Professional BPMN modeling with automated SOP generation, system mapping, and strategic analysis tools.", fi: "Ammattimainen BPMN-mallinnus automaattisella SOP-generoinnilla, järjestelmäkartoituksella ja strategisilla analyysityökaluilla." },
  "landing.getStarted": { en: "Get Started", fi: "Aloita nyt" },
  "landing.learnMore": { en: "Learn More", fi: "Lue lisää" },
  "landing.featuresTitle": { en: "Powerful Features", fi: "Tehokkaat ominaisuudet" },
  "landing.featuresSubtitle": { en: "Everything you need to model, analyze, and document your business processes.", fi: "Kaikki mitä tarvitset liiketoimintaprosessien mallintamiseen, analysointiin ja dokumentointiin." },
  "landing.feature1Title": { en: "System Heatmap", fi: "Järjestelmäkartta" },
  "landing.feature1Desc": { en: "Visualize tool-switching hotspots and identify areas for system integration optimization.", fi: "Visualisoi työkalujen vaihdon kuumat pisteet ja tunnista järjestelmäintegraation optimointikohteet." },
  "landing.feature2Title": { en: "Auto-Documentation", fi: "Automaattinen dokumentointi" },
  "landing.feature2Desc": { en: "Generate professional SOPs automatically from your BPMN diagrams with one click.", fi: "Luo ammattimaisia SOP-dokumentteja automaattisesti BPMN-kaavioistasi yhdellä klikkauksella." },
  "landing.feature3Title": { en: "Multilingual Support", fi: "Monikielinen tuki" },
  "landing.feature3Desc": { en: "Full interface localization in English and Finnish with more languages coming soon.", fi: "Täysi käyttöliittymän lokalisointi englanniksi ja suomeksi, lisää kieliä tulossa." },
  "landing.benefitsTitle": { en: "Why Choose Us?", fi: "Miksi valita meidät?" },
  "landing.benefit1": { en: "Streamline process documentation and reduce manual effort by 80%", fi: "Tehosta prosessidokumentaatiota ja vähennä manuaalista työtä 80%" },
  "landing.benefit2": { en: "Enterprise-grade security with role-based access control", fi: "Yritystason tietoturva roolipohjaisella pääsynhallinnalla" },
  "landing.benefit3": { en: "Collaborate seamlessly with team members in real-time", fi: "Tee yhteistyötä saumattomasti tiimin jäsenten kanssa reaaliajassa" },
  "landing.pricingTitle": { en: "Simple, Transparent Pricing", fi: "Yksinkertainen, läpinäkyvä hinnoittelu" },
  "landing.pricingSubtitle": { en: "Choose the plan that fits your needs. No hidden fees.", fi: "Valitse tarpeisiisi sopiva suunnitelma. Ei piilokustannuksia." },
  "landing.pricingFree": { en: "Free", fi: "Ilmainen" },
  "landing.pricingPro": { en: "Pro", fi: "Pro" },
  "landing.pricingEnterprise": { en: "Enterprise", fi: "Yritys" },
  "landing.perMonth": { en: "month", fi: "kk" },
  "landing.customPricing": { en: "Custom", fi: "Räätälöity" },
  "landing.freeFeature1": { en: "Up to 3 projects", fi: "Korkeintaan 3 projektia" },
  "landing.freeFeature2": { en: "Basic BPMN modeling", fi: "Perus BPMN-mallinnus" },
  "landing.freeFeature3": { en: "PNG/SVG export", fi: "PNG/SVG-vienti" },
  "landing.proFeature1": { en: "Unlimited projects", fi: "Rajattomat projektit" },
  "landing.proFeature2": { en: "SOP auto-generation", fi: "SOP-automaattigenerointi" },
  "landing.proFeature3": { en: "System Heatmap", fi: "Järjestelmäkartta" },
  "landing.proFeature4": { en: "Priority support", fi: "Ensisijainen tuki" },
  "landing.enterpriseFeature1": { en: "Everything in Pro", fi: "Kaikki Pro-ominaisuudet" },
  "landing.enterpriseFeature2": { en: "SSO & SAML", fi: "SSO & SAML" },
  "landing.enterpriseFeature3": { en: "Custom integrations", fi: "Mukautetut integraatiot" },
  "landing.enterpriseFeature4": { en: "Dedicated support", fi: "Omistautunut tuki" },
  "landing.startTrial": { en: "Start Free Trial", fi: "Aloita ilmainen kokeilu" },
  "landing.contactSales": { en: "Contact Sales", fi: "Ota yhteyttä myyntiin" },
  "landing.mostPopular": { en: "Most Popular", fi: "Suosituin" },
  "landing.ctaTitle": { en: "Ready to Transform Your Processes?", fi: "Valmis muuttamaan prosessisi?" },
  "landing.ctaSubtitle": { en: "Join thousands of professionals who trust us for their process documentation.", fi: "Liity tuhansien ammattilaisten joukkoon, jotka luottavat meihin prosessidokumentaatiossaan." },
  "landing.allRightsReserved": { en: "All rights reserved.", fi: "Kaikki oikeudet pidätetään." },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("language");
    return (saved === "fi" || saved === "en") ? saved : "en";
  });

  const handleSetLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
  }, []);

  const t = useCallback((key: string): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Missing translation: ${key}`);
      return key;
    }
    return translation[language];
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

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

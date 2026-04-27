// Ported from OpenPostings/server/normalize-job-industry.js
// Rules run in priority order — first match wins.

interface IndustryRule {
  id: string
  targetKey: string
  targetLabel: string
  test: (title: string, normalized: string) => boolean
}

const RULES: IndustryRule[] = [
  {
    id: "salesforce_platform_role",
    targetKey: "information_technology_software",
    targetLabel: "IT/Software",
    test: (title) => /\bsalesforce\b/i.test(title),
  },
  {
    id: "sales_exclusive",
    targetKey: "sales_business_development",
    targetLabel: "Sales/Business Development",
    test: (title, normalized) => {
      if (
        /\b(account executive|account manager|business development|brand ambassador|inside sales|outside sales|sales representative|sales manager|sales director|sales consultant|sales specialist|sales associate|sales advisor|presales?|telesales|territory manager|channel sales|partner sales|go[\s-]?to[\s-]?market|gtm|revenue operations)\b/i.test(
          title
        )
      ) return true
      return (
        /\bsales(?!force\b)\b/i.test(title) ||
        /\bsalesperson\b|\bsalesman\b|\bsalesworker\b/i.test(normalized)
      )
    },
  },
  {
    id: "hr_recruiting",
    targetKey: "human_resources_recruiting",
    targetLabel: "HR/Recruiting",
    test: (title) =>
      /\b(recruiter|recruiting|talent acquisition|human resources|hr generalist|hr manager|people operations|people partner|staffing specialist|sourcer)\b/i.test(
        title
      ),
  },
  {
    id: "legal_compliance",
    targetKey: "legal_compliance",
    targetLabel: "Legal/Compliance",
    test: (title) =>
      /\b(attorney|counsel|paralegal|legal assistant|litigation|compliance officer|privacy counsel|contracts counsel|general counsel)\b/i.test(
        title
      ),
  },
  {
    id: "finance_accounting",
    targetKey: "finance_accounting_banking_insurance",
    targetLabel: "Finance/Accounting/Banking/Insurance",
    test: (title) =>
      /\b(accountant|accounting|accounts payable|accounts receivable|bookkeeper|controller|cpa\b|tax specialist|tax analyst|tax manager|payroll specialist|payroll analyst|fp&a|financial analyst|financial controller|treasury analyst|underwriter)\b/i.test(
        title
      ),
  },
  {
    id: "marketing_media_design",
    targetKey: "marketing_advertising_media_design",
    targetLabel: "Marketing/Media/Design",
    test: (title) =>
      /\b(marketing manager|marketing specialist|digital marketing|content strategist|content marketing|social media|seo specialist|sem specialist|brand marketing|demand generation|public relations|copywriter)\b/i.test(
        title
      ),
  },
  {
    id: "customer_service_call_center",
    targetKey: "customer_service_call_center",
    targetLabel: "Customer Service",
    test: (title) =>
      /\b(call center|customer service representative|customer support representative|contact center|client service representative)\b/i.test(
        title
      ),
  },
  {
    id: "behavioral_health_social_care",
    targetKey: "behavioral_health_social_care",
    targetLabel: "Behavioral Health/Social Care",
    test: (title) =>
      /\b(mental health|behavioral health|social worker|substance abuse counselor|counselor|case worker)\b/i.test(
        title
      ),
  },
  {
    id: "healthcare_medical",
    targetKey: "healthcare_medical",
    targetLabel: "Healthcare/Medical",
    test: (title) =>
      /\b(registered nurse|nurse practitioner|licensed practical nurse|lpn\b|rn\b|cna\b|medical assistant|physician|doctor|pharmacist|radiologic technologist|medical technologist|sonographer)\b/i.test(
        title
      ),
  },
  {
    id: "education_training_library",
    targetKey: "education_training_library",
    targetLabel: "Education/Training",
    test: (title) =>
      /\b(teacher|instructor|professor|tutor|librarian|adjunct faculty|teaching assistant)\b/i.test(title),
  },
  {
    id: "transportation_logistics",
    targetKey: "transportation_logistics_warehouse",
    targetLabel: "Transportation/Logistics",
    test: (title) =>
      /\b(cdl\b|truck driver|delivery driver|forklift operator|warehouse associate|warehouse worker|logistics coordinator|supply chain analyst|dispatcher|route driver)\b/i.test(
        title
      ),
  },
  {
    id: "cybersecurity_network_telecom",
    targetKey: "cybersecurity_network_telecom",
    targetLabel: "Cybersecurity/Network",
    test: (title) =>
      /\b(cybersecurity|information security|security analyst|soc analyst|network engineer|telecom engineer|network administrator)\b/i.test(
        title
      ),
  },
  {
    id: "data_ai_analytics",
    targetKey: "data_ai_analytics",
    targetLabel: "Data/AI/Analytics",
    test: (title) =>
      /\b(data scientist|machine learning engineer|ml engineer|ai engineer|ai scientist|business intelligence|bi analyst|data engineer|data analyst|analytics engineer)\b/i.test(
        title
      ),
  },
  {
    id: "information_technology_software",
    targetKey: "information_technology_software",
    targetLabel: "IT/Software",
    test: (title) =>
      /\b(software engineer|software developer|full stack developer|frontend developer|backend developer|devops engineer|site reliability engineer|systems administrator|software architect|qa engineer|test automation engineer)\b/i.test(
        title
      ),
  },
]

export interface IndustryClassification {
  industryKey: string
  industryLabel: string
  ruleId: string
}

export function classifyJobIndustry(title: string): IndustryClassification | null {
  const normalized = title.toLowerCase().replace(/\s+/g, " ").trim()
  for (const rule of RULES) {
    if (rule.test(title, normalized)) {
      return { industryKey: rule.targetKey, industryLabel: rule.targetLabel, ruleId: rule.id }
    }
  }
  return null
}

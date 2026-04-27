// Pre-configured company list ported from Career-Ops portals.yml.
// Each entry has enough info to auto-detect ATS and seed tracked_companies.

export interface PresetCompany {
  name: string
  careersUrl: string
  notes: string
  category: string
}

export const PRESET_COMPANIES: PresetCompany[] = [
  // AI Labs & LLM providers
  { name: "Anthropic", careersUrl: "https://job-boards.greenhouse.io/anthropic", notes: "Claude, Constitutional AI. SF + London.", category: "AI Labs" },
  { name: "OpenAI", careersUrl: "https://openai.com/careers", notes: "GPT, ChatGPT. SF.", category: "AI Labs" },
  { name: "Mistral AI", careersUrl: "https://jobs.lever.co/mistral", notes: "Paris. European frontier model provider.", category: "AI Labs" },
  { name: "Cohere", careersUrl: "https://jobs.ashbyhq.com/cohere", notes: "AI/LLM provider. Toronto + remote.", category: "AI Labs" },
  { name: "Aleph Alpha", careersUrl: "https://jobs.ashbyhq.com/AlephAlpha", notes: "Heidelberg. Sovereign European LLM provider.", category: "AI Labs" },
  { name: "Black Forest Labs", careersUrl: "https://job-boards.greenhouse.io/blackforestlabs", notes: "Freiburg / SF. FLUX image models.", category: "AI Labs" },

  // Voice AI & Conversational AI
  { name: "PolyAI", careersUrl: "https://job-boards.eu.greenhouse.io/polyai", notes: "UK. Voice AI for enterprise contact centres.", category: "Voice AI" },
  { name: "Parloa", careersUrl: "https://job-boards.eu.greenhouse.io/parloa", notes: "Berlin. Voice AI enterprise.", category: "Voice AI" },
  { name: "ElevenLabs", careersUrl: "https://jobs.ashbyhq.com/elevenlabs", notes: "Voice AI TTS leader.", category: "Voice AI" },
  { name: "Deepgram", careersUrl: "https://jobs.ashbyhq.com/deepgram", notes: "STT/TTS APIs.", category: "Voice AI" },
  { name: "Vapi", careersUrl: "https://jobs.ashbyhq.com/vapi", notes: "Voice AI infrastructure.", category: "Voice AI" },
  { name: "Bland AI", careersUrl: "https://jobs.ashbyhq.com/bland", notes: "Voice phone agents. $65M Series B.", category: "Voice AI" },
  { name: "Hume AI", careersUrl: "https://job-boards.greenhouse.io/humeai", notes: "NYC. Empathic voice AI.", category: "Voice AI" },

  // AI-native platforms
  { name: "Retool", careersUrl: "https://retool.com/careers", notes: "London. Pioneered Deployed Engineer role.", category: "Dev Tools / AI Infra" },
  { name: "Airtable", careersUrl: "https://job-boards.greenhouse.io/airtable", notes: "No-code + AI platform.", category: "Dev Tools / AI Infra" },
  { name: "Vercel", careersUrl: "https://job-boards.greenhouse.io/vercel", notes: "AI SDK, v0.dev. Frontend AI tooling.", category: "Dev Tools / AI Infra" },
  { name: "Temporal", careersUrl: "https://job-boards.greenhouse.io/temporal", notes: "Workflow orchestration.", category: "Dev Tools / AI Infra" },
  { name: "Arize AI", careersUrl: "https://job-boards.greenhouse.io/arizeai", notes: "LLMOps / AI observability.", category: "Dev Tools / AI Infra" },
  { name: "Glean", careersUrl: "https://job-boards.greenhouse.io/gleanwork", notes: "Enterprise AI search.", category: "Dev Tools / AI Infra" },
  { name: "LangChain", careersUrl: "https://jobs.ashbyhq.com/langchain", notes: "LangChain / LangSmith framework.", category: "Dev Tools / AI Infra" },
  { name: "Pinecone", careersUrl: "https://jobs.ashbyhq.com/pinecone", notes: "Vector database.", category: "Dev Tools / AI Infra" },
  { name: "Perplexity", careersUrl: "https://jobs.ashbyhq.com/perplexity", notes: "AI-native search and enterprise AI.", category: "Dev Tools / AI Infra" },
  { name: "Hightouch", careersUrl: "https://job-boards.greenhouse.io/hightouch", notes: "Data activation platform with AI agents.", category: "Dev Tools / AI Infra" },
  { name: "Supabase", careersUrl: "https://jobs.ashbyhq.com/supabase", notes: "Open-source Firebase alternative. Remote-first.", category: "Dev Tools / AI Infra" },
  { name: "Resend", careersUrl: "https://jobs.ashbyhq.com/resend", notes: "Email API for developers. Remote-first.", category: "Dev Tools / AI Infra" },
  { name: "WorkOS", careersUrl: "https://jobs.ashbyhq.com/workos", notes: "Enterprise-ready auth/platform APIs.", category: "Dev Tools / AI Infra" },
  { name: "Langfuse", careersUrl: "https://langfuse.com/careers", notes: "Berlin. LLMOps / observability.", category: "Dev Tools / AI Infra" },

  // Automation / No-code
  { name: "n8n", careersUrl: "https://jobs.ashbyhq.com/n8n", notes: "Berlin + remote EU. Workflow automation.", category: "Automation" },
  { name: "Zapier", careersUrl: "https://jobs.ashbyhq.com/zapier", notes: "Remote-first. Automation platform leader.", category: "Automation" },
  { name: "Lindy", careersUrl: "https://jobs.ashbyhq.com/lindy", notes: "AI agent management platform.", category: "Automation" },
  { name: "Clay Labs", careersUrl: "https://jobs.ashbyhq.com/claylabs", notes: "AI-native GTM and workflow automation.", category: "Automation" },

  // Contact Centre AI & CX
  { name: "Intercom", careersUrl: "https://job-boards.greenhouse.io/intercom", notes: "Dublin. Fin AI agent.", category: "CX / Contact Centre" },
  { name: "Sierra", careersUrl: "https://jobs.ashbyhq.com/sierra", notes: "Bret Taylor. AI customer agents.", category: "CX / Contact Centre" },
  { name: "Decagon", careersUrl: "https://jobs.ashbyhq.com/decagon", notes: "AI customer support agents.", category: "CX / Contact Centre" },
  { name: "Gong", careersUrl: "https://www.gong.io/careers", notes: "Revenue intelligence with voice AI.", category: "CX / Contact Centre" },
  { name: "Talkdesk", careersUrl: "https://www.talkdesk.com/careers", notes: "Lisbon. Contact centre AI.", category: "CX / Contact Centre" },

  // UK & Ireland AI
  { name: "Wayve", careersUrl: "https://job-boards.greenhouse.io/wayve", notes: "London. Embodied AI for self-driving.", category: "UK AI" },
  { name: "Isomorphic Labs", careersUrl: "https://job-boards.greenhouse.io/isomorphiclabs", notes: "London / Lausanne. DeepMind spin-out.", category: "UK AI" },
  { name: "PhysicsX", careersUrl: "https://job-boards.greenhouse.io/physicsx", notes: "London. Physics-informed ML.", category: "UK AI" },
  { name: "Synthesia", careersUrl: "https://jobs.ashbyhq.com/synthesia", notes: "London. AI video generation. $4B.", category: "UK AI" },
  { name: "Faculty", careersUrl: "https://jobs.ashbyhq.com/faculty", notes: "London. Applied AI consultancy.", category: "UK AI" },
  { name: "Speechmatics", careersUrl: "https://job-boards.greenhouse.io/speechmatics", notes: "Cambridge UK. Speech recognition.", category: "UK AI" },
  { name: "Stability AI", careersUrl: "https://job-boards.greenhouse.io/stabilityai", notes: "London / SF. Generative AI research.", category: "UK AI" },

  // DACH & European AI
  { name: "DeepL", careersUrl: "https://jobs.ashbyhq.com/DeepL", notes: "Cologne. Translation & language AI.", category: "European AI" },
  { name: "Helsing", careersUrl: "https://job-boards.greenhouse.io/helsing", notes: "Munich / Berlin / London. Defence AI.", category: "European AI" },
  { name: "Celonis", careersUrl: "https://job-boards.greenhouse.io/celonis", notes: "Munich / NYC. Process intelligence.", category: "European AI" },
  { name: "Qonto", careersUrl: "https://jobs.lever.co/qonto", notes: "Paris / Berlin / Barcelona. SMB neobank.", category: "European AI" },
  { name: "Pigment", careersUrl: "https://jobs.lever.co/pigment", notes: "Paris. AI-powered FP&A platform.", category: "European AI" },
  { name: "Lovable", careersUrl: "https://jobs.ashbyhq.com/lovable", notes: "Stockholm. AI app builder.", category: "European AI" },
  { name: "Attio", careersUrl: "https://jobs.ashbyhq.com/attio", notes: "Remote EU. AI-native CRM. Series B.", category: "European AI" },
  { name: "Hugging Face", careersUrl: "https://apply.workable.com/huggingface/", notes: "Paris / NYC / Remote. ML hub.", category: "European AI" },
  { name: "Lakera", careersUrl: "https://jobs.ashbyhq.com/lakera.ai", notes: "Zurich. AI security & guardrails.", category: "European AI" },

  // Fintech
  { name: "N26", careersUrl: "https://job-boards.greenhouse.io/n26", notes: "Berlin / Barcelona. Mobile bank.", category: "Fintech" },
  { name: "Trade Republic", careersUrl: "https://job-boards.greenhouse.io/traderepublicbank", notes: "Berlin / London / Paris. Neobroker.", category: "Fintech" },
  { name: "SumUp", careersUrl: "https://job-boards.greenhouse.io/sumup", notes: "Berlin / London. Payments fintech.", category: "Fintech" },

  // Enterprise / Broader
  { name: "Palantir", careersUrl: "https://jobs.lever.co/palantir", notes: "FDE roles. Mostly US/London.", category: "Enterprise" },
  { name: "Spotify", careersUrl: "https://jobs.lever.co/spotify", notes: "Stockholm / NYC / London. Audio platform.", category: "Enterprise" },
  { name: "Salesforce", careersUrl: "https://careers.salesforce.com", notes: "Agentforce AI agents platform.", category: "Enterprise" },
  { name: "Twilio", careersUrl: "https://www.twilio.com/en-us/company/jobs", notes: "Voice/messaging infrastructure.", category: "Enterprise" },

  // UK Fintech & Neobanks
  { name: "Monzo", careersUrl: "https://job-boards.greenhouse.io/monzo", notes: "London. UK's leading neobank.", category: "UK Fintech" },
  { name: "Starling Bank", careersUrl: "https://www.starlingbank.com/careers", notes: "London. Award-winning digital bank.", category: "UK Fintech" },
  { name: "GoCardless", careersUrl: "https://job-boards.greenhouse.io/gocardless", notes: "London. Bank debit payments platform.", category: "UK Fintech" },
  { name: "Checkout.com", careersUrl: "https://jobs.ashbyhq.com/checkout.com", notes: "London. Global payments processing.", category: "UK Fintech" },
  { name: "Capital on Tap", careersUrl: "https://job-boards.greenhouse.io/capitalontap", notes: "London. SME credit card and financial platform.", category: "UK Fintech" },
  { name: "Clear Street", careersUrl: "https://job-boards.greenhouse.io/clearstreet", notes: "London / NYC. Modern clearing and prime brokerage.", category: "UK Fintech" },
  { name: "Plaid", careersUrl: "https://jobs.lever.co/plaid", notes: "London. Open-banking connectivity API.", category: "UK Fintech" },
  { name: "NewDay", careersUrl: "https://newday.wd3.myworkdayjobs.com/NewDay", notes: "London. Consumer credit cards and fintech.", category: "UK Fintech" },

  // AI Labs & Research — extended
  { name: "xAI", careersUrl: "https://job-boards.greenhouse.io/xai", notes: "SF / remote. Elon Musk's AI lab — Grok.", category: "AI Labs" },
  { name: "Scale AI", careersUrl: "https://job-boards.greenhouse.io/scaleai", notes: "SF. AI data infrastructure and RLHF.", category: "AI Labs" },
  { name: "i.AI", careersUrl: "https://job-boards.eu.greenhouse.io/iai", notes: "London. UK government AI incubator.", category: "AI Labs" },
  { name: "QuantCo", careersUrl: "https://jobs.lever.co/quantco-", notes: "Europe / remote. Applied AI for enterprises.", category: "AI Labs" },
  { name: "H Company", careersUrl: "https://jobs.ashbyhq.com/hcompany", notes: "London / Paris. AGI-focused research lab.", category: "AI Labs" },

  // Dev Tools / AI Infra — extended
  { name: "Metabase", careersUrl: "https://jobs.lever.co/metabase", notes: "Remote. Open-source BI and analytics.", category: "Dev Tools / AI Infra" },
  { name: "Remote", careersUrl: "https://job-boards.greenhouse.io/remotecom", notes: "Fully remote. Global HR and payroll platform.", category: "Dev Tools / AI Infra" },
  { name: "Heron Data", careersUrl: "https://jobs.ashbyhq.com/herondata", notes: "London. AI workflow automation for fintechs.", category: "Dev Tools / AI Infra" },
  { name: "Ashby (company)", careersUrl: "https://jobs.ashbyhq.com/ashby", notes: "Remote / UK. All-in-one recruiting platform.", category: "Dev Tools / AI Infra" },

  // CX / Contact Centre — extended
  { name: "Hook", careersUrl: "https://jobs.ashbyhq.com/hook", notes: "London. Revenue retention and CS platform.", category: "CX / Contact Centre" },

  // Consulting & Enterprise — extended
  { name: "Theodo UK", careersUrl: "https://jobs.lever.co/theodo", notes: "London. Lean software consultancy.", category: "Enterprise" },
  { name: "Financial Technology Partners", careersUrl: "https://job-boards.greenhouse.io/financialtechnologypartners", notes: "SF / NYC. Fintech-focused investment bank.", category: "Enterprise" },

  // UK Social / Care Tech
  { name: "Lottie", careersUrl: "https://jobs.ashbyhq.com/lottie", notes: "London. Care-home marketplace and fintech.", category: "UK Other" },

  // UK Fintech — extended
  { name: "ClearScore", careersUrl: "https://job-boards.eu.greenhouse.io/clearscoretechnologylimited", notes: "London. Credit score and financial health app.", category: "UK Fintech" },

  // UK Deep Tech
  { name: "Graphcore", careersUrl: "https://job-boards.greenhouse.io/graphcore", notes: "Bristol. AI/ML chip (IPU) maker.", category: "UK Deep Tech" },
]

export const PRESET_CATEGORIES = [...new Set(PRESET_COMPANIES.map((c) => c.category))]

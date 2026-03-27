import type { Job } from "./types";

const ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api";

interface AdzunaSearchParams {
	app_id: string;
	app_key: string;
	what?: string;
	where?: string;
	location_id?: number;
	location?: string;
	salary_min?: number;
	salary_max?: number;
	salary_include_unknown?: number;
	distance?: number;
	full_time?: number;
	part_time?: number;
	contract?: number;
	permanent?: number;
	results_per_page?: number;
	page?: number;
	sort?: "relevance" | "date" | "salary";
	order?: "asc" | "desc";
}

interface AdzunaJob {
	id: string;
	title: string;
	company: { display_name: string };
	location: { display_name: string; area?: string[] };
	description: string;
	created: string;
	salary_min?: number;
	salary_max?: number;
	salary_is_predicted?: number;
	redirect_url: string;
	category: { label: string };
}

interface AdzunaResponse {
	results: AdzunaJob[];
	count: number;
	total: number;
	mean_salary?: number;
	page: number;
	items_per_page: number;
}

/**
 * Search jobs using the Adzuna API.
 * Falls back to mock data when API credentials are not configured.
 */
export async function searchAdzunaJobs(params: {
	query?: string;
	location?: string;
	salaryMin?: number;
	salaryMax?: number;
	distance?: number;
	page?: number;
	resultsPerPage?: number;
	sort?: "relevance" | "date" | "salary";
}): Promise<{ jobs: Job[]; total: number; page: number }> {
	const appId = process.env.ADZUNA_APP_ID;
	const appKey = process.env.ADZUNA_APP_KEY;

	// Fall back to mock data if credentials are not set
	if (!appId || !appKey || appId === "your-adzuna-app-id") {
		return getMockJobs(params);
	}

	const searchParams: AdzunaSearchParams = {
		app_id: appId,
		app_key: appKey,
		results_per_page: params.resultsPerPage ?? 20,
		page: params.page ?? 1,
		salary_include_unknown: 1,
	};

	if (params.query) searchParams.what = params.query;
	if (params.location) searchParams.where = params.location;
	if (params.salaryMin) searchParams.salary_min = params.salaryMin;
	if (params.salaryMax) searchParams.salary_max = params.salaryMax;
	if (params.distance) searchParams.distance = params.distance;
	if (params.sort) searchParams.sort = params.sort;

	// UK country id for Adzuna
	searchParams.location_id = 1; // United Kingdom

	const url = new URL(`${ADZUNA_BASE_URL}/jobs/gb/search/1`);
	Object.entries(searchParams).forEach(([key, value]) => {
		if (value !== undefined) url.searchParams.append(key, String(value));
	});

	const response = await fetch(url.toString(), {
		headers: { "Content-Type": "application/json" },
		next: { revalidate: 300 }, // Cache for 5 minutes
	});

	if (!response.ok) {
		console.error("Adzuna API error:", response.status, await response.text());
		return getMockJobs(params);
	}

	const data: AdzunaResponse = await response.json();

	const jobs: Job[] = data.results.map((job) => ({
		id: job.id,
		title: job.title,
		company: job.company.display_name,
		location: job.location.display_name,
		description: stripHtml(job.description),
		salaryMin: job.salary_min ?? null,
		salaryMax: job.salary_max ?? null,
		salaryCurrency: "GBP",
		postedAt: job.created,
		url: job.redirect_url,
		source: "adzuna",
		isEasyApply: false,
	}));

	return {
		jobs,
		total: data.total,
		page: data.page,
	};
}

/**
 * Strip HTML tags from a string
 */
function stripHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

// ============================================================
// MOCK DATA FOR DEVELOPMENT
// ============================================================

const MOCK_JOBS: Job[] = [
	{
		id: "mock-1",
		title: "Junior Software Engineer",
		company: "TechCorp UK",
		location: "London, UK",
		description: `We are looking for a Junior Software Engineer to join our growing team. You'll work on building scalable web applications using modern technologies like React, Node.js, and PostgreSQL.

Requirements:
- Bachelor's degree in Computer Science or related field
- Knowledge of JavaScript/TypeScript
- Familiarity with SQL databases
- Good communication skills

We offer:
- Competitive salary (£28,000 - £35,000)
- Flexible working
- 25 days holiday
- Career development opportunities`,
		salaryMin: 28000,
		salaryMax: 35000,
		salaryCurrency: "GBP",
		postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
		url: "https://example.com/job/mock-1",
		source: "mock",
		isEasyApply: false,
	},
	{
		id: "mock-2",
		title: "Graduate Software Developer",
		company: "FinTech Solutions",
		location: "Manchester, UK",
		description: `Join our fintech startup as a Graduate Software Developer. You'll be working on payment systems and financial applications.

Requirements:
- Degree in STEM subject
- Interest in financial technology
- Strong problem-solving skills
- Team player`,
		salaryMin: 30000,
		salaryMax: 40000,
		salaryCurrency: "GBP",
		postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
		url: "https://example.com/job/mock-2",
		source: "mock",
		isEasyApply: true,
	},
	{
		id: "mock-3",
		title: "Junior Full Stack Developer",
		company: "Digital Agency Ltd",
		location: "Birmingham, UK",
		description: `We're seeking a Junior Full Stack Developer to help build web applications for our clients. You'll work with React, Next.js, and Node.js.

Requirements:
- Some experience with React or similar framework
- Understanding of REST APIs
- Good attention to detail
- EU right to work required`,
		salaryMin: 25000,
		salaryMax: 32000,
		salaryCurrency: "GBP",
		postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
		url: "https://example.com/job/mock-3",
		source: "mock",
		isEasyApply: false,
	},
	{
		id: "mock-4",
		title: "Associate Software Engineer",
		company: "Global Systems",
		location: "Remote (UK)",
		description: `Global Systems is hiring an Associate Software Engineer to support our enterprise software products.

Requirements:
- Degree in Computer Science or Engineering
- Knowledge of Java or Python
- Willingness to learn
- Good analytical skills`,
		salaryMin: 32000,
		salaryMax: 40000,
		salaryCurrency: "GBP",
		postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
		url: "https://example.com/job/mock-4",
		source: "mock",
		isEasyApply: false,
	},
	{
		id: "mock-5",
		title: "Junior Backend Engineer",
		company: "DataFlow Ltd",
		location: "Edinburgh, UK",
		description: `DataFlow is looking for a Junior Backend Engineer to help build and maintain our data processing pipelines.

Requirements:
- Understanding of Python or Go
- Basic knowledge of databases
- Interest in data engineering
- Strong attention to detail`,
		salaryMin: 27000,
		salaryMax: 34000,
		salaryCurrency: "GBP",
		postedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
		url: "https://example.com/job/mock-5",
		source: "mock",
		isEasyApply: true,
	},
	{
		id: "mock-6",
		title: "Graduate QA Engineer",
		company: "TestTech",
		location: "Bristol, UK",
		description: `TestTech is seeking a Graduate QA Engineer to join our quality assurance team.

Requirements:
- Attention to detail
- Basic understanding of testing principles
- Good documentation skills
- ISTQB certification a plus`,
		salaryMin: 24000,
		salaryMax: 30000,
		salaryCurrency: "GBP",
		postedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
		url: "https://example.com/job/mock-6",
		source: "mock",
		isEasyApply: false,
	},
	{
		id: "mock-7",
		title: "Junior DevOps Engineer",
		company: "CloudScale",
		location: "London, UK",
		description: `CloudScale is looking for a Junior DevOps Engineer to help manage our cloud infrastructure on AWS.

Requirements:
- Basic AWS knowledge
- Familiarity with Docker
- Understanding of CI/CD pipelines
- Linux administration skills`,
		salaryMin: 35000,
		salaryMax: 45000,
		salaryCurrency: "GBP",
		postedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
		url: "https://example.com/job/mock-7",
		source: "mock",
		isEasyApply: false,
	},
	{
		id: "mock-8",
		title: "Junior Frontend Developer",
		company: "Creative Digital",
		location: "Leeds, UK",
		description: `Join Creative Digital as a Junior Frontend Developer working with React and Tailwind CSS.

Requirements:
- Knowledge of HTML, CSS, JavaScript
- Some experience with React
- Eye for design
- Good communication skills`,
		salaryMin: 23000,
		salaryMax: 30000,
		salaryCurrency: "GBP",
		postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
		url: "https://example.com/job/mock-8",
		source: "mock",
		isEasyApply: true,
	},
];

function getMockJobs(params: {
	query?: string;
	location?: string;
	salaryMin?: number;
	page?: number;
	resultsPerPage?: number;
}): { jobs: Job[]; total: number; page: number } {
	let filtered = [...MOCK_JOBS];

	if (params.query) {
		const q = params.query.toLowerCase();
		filtered = filtered.filter(
			(job) =>
				job.title.toLowerCase().includes(q) ||
				job.company.toLowerCase().includes(q) ||
				job.description?.toLowerCase().includes(q),
		);
	}

	if (params.location) {
		const loc = params.location.toLowerCase();
		filtered = filtered.filter((job) =>
			job.location?.toLowerCase().includes(loc),
		);
	}

	if (params.salaryMin) {
		filtered = filtered.filter(
			(job) => (job.salaryMax ?? 0) >= params.salaryMin!,
		);
	}

	const page = params.page ?? 1;
	const perPage = params.resultsPerPage ?? 20;
	const start = (page - 1) * perPage;
	const paginated = filtered.slice(start, start + perPage);

	return {
		jobs: paginated,
		total: filtered.length,
		page,
	};
}

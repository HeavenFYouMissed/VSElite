export type McpTransport = "stdio" | "http";

export interface McpInstall {
	command?: string;
	args?: string[];
	url?: string;
	env?: string[];
}

export interface McpServer {
	id: string;
	name: string;
	description: string;
	domain: string;
	category: "Dev" | "Search" | "Productivity" | "Cloud" | "Data" | "Comms" | "Core";
	transport: McpTransport;
	install: McpInstall;
}

export const MCP_CATALOG: McpServer[] = [
	// Core (official)
	{ id: "filesystem", name: "Filesystem", description: "Read/write local files", domain: "modelcontextprotocol.io", category: "Core", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."] } },
	{ id: "git", name: "Git", description: "Git repo operations", domain: "git-scm.com", category: "Core", transport: "stdio",
		install: { command: "uvx", args: ["mcp-server-git"] } },
	{ id: "fetch", name: "Fetch", description: "Fetch & convert web pages", domain: "modelcontextprotocol.io", category: "Core", transport: "stdio",
		install: { command: "uvx", args: ["mcp-server-fetch"] } },
	{ id: "memory", name: "Memory", description: "Persistent knowledge graph", domain: "modelcontextprotocol.io", category: "Core", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-memory"] } },
	{ id: "sequential-thinking", name: "Sequential Thinking", description: "Step-by-step reasoning", domain: "modelcontextprotocol.io", category: "Core", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-sequential-thinking"] } },
	{ id: "time", name: "Time", description: "Time & timezone tools", domain: "modelcontextprotocol.io", category: "Core", transport: "stdio",
		install: { command: "uvx", args: ["mcp-server-time"] } },
	// Dev
	{ id: "github", name: "GitHub", description: "Repos, issues, PRs", domain: "github.com", category: "Dev", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"], env: ["GITHUB_PERSONAL_ACCESS_TOKEN"] } },
	{ id: "gitlab", name: "GitLab", description: "GitLab repos & MRs", domain: "gitlab.com", category: "Dev", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-gitlab"], env: ["GITLAB_PERSONAL_ACCESS_TOKEN"] } },
	{ id: "docker", name: "Docker", description: "Manage containers", domain: "docker.com", category: "Dev", transport: "stdio",
		install: { command: "uvx", args: ["docker-mcp"] } },
	{ id: "sentry", name: "Sentry", description: "Error tracking & issues", domain: "sentry.io", category: "Dev", transport: "stdio",
		install: { command: "npx", args: ["-y", "@sentry/mcp-server"], env: ["SENTRY_AUTH_TOKEN"] } },
	{ id: "puppeteer", name: "Puppeteer", description: "Headless browser control", domain: "pptr.dev", category: "Dev", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-puppeteer"] } },
	{ id: "playwright", name: "Playwright", description: "Browser automation", domain: "playwright.dev", category: "Dev", transport: "stdio",
		install: { command: "npx", args: ["-y", "@playwright/mcp"] } },
	// Search
	{ id: "brave-search", name: "Brave Search", description: "Web & local search", domain: "brave.com", category: "Search", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-brave-search"], env: ["BRAVE_API_KEY"] } },
	{ id: "exa", name: "Exa", description: "Neural web search", domain: "exa.ai", category: "Search", transport: "stdio",
		install: { command: "npx", args: ["-y", "exa-mcp-server"], env: ["EXA_API_KEY"] } },
	{ id: "tavily", name: "Tavily", description: "AI search & extract", domain: "tavily.com", category: "Search", transport: "stdio",
		install: { command: "npx", args: ["-y", "tavily-mcp"], env: ["TAVILY_API_KEY"] } },
	{ id: "perplexity", name: "Perplexity", description: "Perplexity answers", domain: "perplexity.ai", category: "Search", transport: "stdio",
		install: { command: "npx", args: ["-y", "server-perplexity-ask"], env: ["PERPLEXITY_API_KEY"] } },
	{ id: "firecrawl", name: "Firecrawl", description: "Scrape & crawl sites", domain: "firecrawl.dev", category: "Search", transport: "stdio",
		install: { command: "npx", args: ["-y", "firecrawl-mcp"], env: ["FIRECRAWL_API_KEY"] } },
	// Productivity
	{ id: "notion", name: "Notion", description: "Notion pages & DBs", domain: "notion.so", category: "Productivity", transport: "stdio",
		install: { command: "npx", args: ["-y", "@notionhq/notion-mcp-server"], env: ["NOTION_TOKEN"] } },
	{ id: "slack", name: "Slack", description: "Slack channels & DMs", domain: "slack.com", category: "Productivity", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-slack"], env: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"] } },
	{ id: "linear", name: "Linear", description: "Issues & projects", domain: "linear.app", category: "Productivity", transport: "http",
		install: { url: "https://mcp.linear.app/sse" } },
	{ id: "jira", name: "Jira", description: "Jira issues & boards", domain: "atlassian.com", category: "Productivity", transport: "stdio",
		install: { command: "npx", args: ["-y", "mcp-atlassian"], env: ["JIRA_URL", "JIRA_API_TOKEN", "JIRA_USERNAME"] } },
	{ id: "confluence", name: "Confluence", description: "Wiki pages & docs", domain: "atlassian.com", category: "Productivity", transport: "stdio",
		install: { command: "npx", args: ["-y", "mcp-atlassian"], env: ["CONFLUENCE_URL", "CONFLUENCE_API_TOKEN", "CONFLUENCE_USERNAME"] } },
	{ id: "google-drive", name: "Google Drive", description: "Files & folders", domain: "google.com", category: "Productivity", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-gdrive"], env: ["GDRIVE_CREDENTIALS_PATH"] } },
	{ id: "gmail", name: "Gmail", description: "Read & send email", domain: "google.com", category: "Productivity", transport: "stdio",
		install: { command: "npx", args: ["-y", "@gongrzhe/server-gmail-autoauth-mcp"] } },
	{ id: "google-calendar", name: "Google Calendar", description: "Events & scheduling", domain: "google.com", category: "Productivity", transport: "stdio",
		install: { command: "npx", args: ["-y", "@cocal/google-calendar-mcp"] } },
	{ id: "google-sheets", name: "Google Sheets", description: "Spreadsheets", domain: "google.com", category: "Productivity", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-google-sheets"], env: ["GOOGLE_CREDENTIALS"] } },
	{ id: "asana", name: "Asana", description: "Tasks & projects", domain: "asana.com", category: "Productivity", transport: "http",
		install: { url: "https://mcp.asana.com/sse" } },
	{ id: "trello", name: "Trello", description: "Boards & cards", domain: "trello.com", category: "Productivity", transport: "stdio",
		install: { command: "npx", args: ["-y", "@delorenj/mcp-server-trello"], env: ["TRELLO_API_KEY", "TRELLO_TOKEN"] } },
	{ id: "clickup", name: "ClickUp", description: "Tasks & docs", domain: "clickup.com", category: "Productivity", transport: "stdio",
		install: { command: "npx", args: ["-y", "@taazkareem/clickup-mcp-server"], env: ["CLICKUP_API_KEY", "CLICKUP_TEAM_ID"] } },
	{ id: "obsidian", name: "Obsidian", description: "Vault notes", domain: "obsidian.md", category: "Productivity", transport: "stdio",
		install: { command: "npx", args: ["-y", "obsidian-mcp"], env: ["OBSIDIAN_VAULT_PATH"] } },
	// Cloud
	{ id: "aws", name: "AWS", description: "AWS resources & docs", domain: "aws.amazon.com", category: "Cloud", transport: "stdio",
		install: { command: "uvx", args: ["awslabs.core-mcp-server"], env: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"] } },
	{ id: "cloudflare", name: "Cloudflare", description: "Workers, KV, DNS", domain: "cloudflare.com", category: "Cloud", transport: "stdio",
		install: { command: "npx", args: ["-y", "@cloudflare/mcp-server-cloudflare"], env: ["CLOUDFLARE_API_TOKEN"] } },
	{ id: "vercel", name: "Vercel", description: "Deployments & projects", domain: "vercel.com", category: "Cloud", transport: "http",
		install: { url: "https://mcp.vercel.com" } },
	{ id: "kubernetes", name: "Kubernetes", description: "Manage k8s clusters", domain: "kubernetes.io", category: "Cloud", transport: "stdio",
		install: { command: "npx", args: ["-y", "mcp-server-kubernetes"] } },
	{ id: "supabase", name: "Supabase", description: "DB, auth, storage", domain: "supabase.com", category: "Cloud", transport: "stdio",
		install: { command: "npx", args: ["-y", "@supabase/mcp-server-supabase"], env: ["SUPABASE_ACCESS_TOKEN"] } },
	{ id: "railway", name: "Railway", description: "Deploy & manage apps", domain: "railway.app", category: "Cloud", transport: "stdio",
		install: { command: "npx", args: ["-y", "@railway/mcp-server"], env: ["RAILWAY_API_TOKEN"] } },
	// Data
	{ id: "postgres", name: "Postgres", description: "Query Postgres DBs", domain: "postgresql.org", category: "Data", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-postgres"], env: ["POSTGRES_CONNECTION_STRING"] } },
	{ id: "sqlite", name: "SQLite", description: "Query SQLite files", domain: "sqlite.org", category: "Data", transport: "stdio",
		install: { command: "uvx", args: ["mcp-server-sqlite", "--db-path", "./data.db"] } },
	{ id: "mongodb", name: "MongoDB", description: "Query MongoDB", domain: "mongodb.com", category: "Data", transport: "stdio",
		install: { command: "npx", args: ["-y", "mongodb-mcp-server"], env: ["MDB_MCP_CONNECTION_STRING"] } },
	{ id: "redis", name: "Redis", description: "Redis key-value ops", domain: "redis.io", category: "Data", transport: "stdio",
		install: { command: "npx", args: ["-y", "@modelcontextprotocol/server-redis"], env: ["REDIS_URL"] } },
	{ id: "stripe", name: "Stripe", description: "Payments & customers", domain: "stripe.com", category: "Data", transport: "stdio",
		install: { command: "npx", args: ["-y", "@stripe/mcp"], env: ["STRIPE_SECRET_KEY"] } },
	{ id: "airtable", name: "Airtable", description: "Bases & records", domain: "airtable.com", category: "Data", transport: "stdio",
		install: { command: "npx", args: ["-y", "airtable-mcp-server"], env: ["AIRTABLE_API_KEY"] } },
	{ id: "snowflake", name: "Snowflake", description: "Query Snowflake", domain: "snowflake.com", category: "Data", transport: "stdio",
		install: { command: "uvx", args: ["mcp-snowflake-server"], env: ["SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD"] } },
	{ id: "bigquery", name: "BigQuery", description: "Query BigQuery", domain: "cloud.google.com", category: "Data", transport: "stdio",
		install: { command: "npx", args: ["-y", "@google-cloud/mcp-server-bigquery"], env: ["GOOGLE_APPLICATION_CREDENTIALS"] } },
	{ id: "huggingface", name: "Hugging Face", description: "Models & datasets", domain: "huggingface.co", category: "Data", transport: "http",
		install: { url: "https://huggingface.co/mcp" } },
	// Comms
	{ id: "discord", name: "Discord", description: "Servers & messages", domain: "discord.com", category: "Comms", transport: "stdio",
		install: { command: "npx", args: ["-y", "mcp-discord"], env: ["DISCORD_TOKEN"] } },
	{ id: "telegram", name: "Telegram", description: "Send & read messages", domain: "telegram.org", category: "Comms", transport: "stdio",
		install: { command: "npx", args: ["-y", "@chigwell/telegram-mcp"], env: ["TELEGRAM_API_ID", "TELEGRAM_API_HASH"] } },
	{ id: "twilio", name: "Twilio", description: "SMS & voice", domain: "twilio.com", category: "Comms", transport: "stdio",
		install: { command: "npx", args: ["-y", "@twilio-alpha/mcp"], env: ["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY", "TWILIO_API_SECRET"] } },
	{ id: "figma", name: "Figma", description: "Designs & components", domain: "figma.com", category: "Comms", transport: "stdio",
		install: { command: "npx", args: ["-y", "figma-developer-mcp"], env: ["FIGMA_API_KEY"] } },
	{ id: "youtube", name: "YouTube", description: "Video data & captions", domain: "youtube.com", category: "Comms", transport: "stdio",
		install: { command: "npx", args: ["-y", "@anaisbetts/mcp-youtube"] } },
	{ id: "elevenlabs", name: "ElevenLabs", description: "Text-to-speech", domain: "elevenlabs.io", category: "Comms", transport: "stdio",
		install: { command: "uvx", args: ["elevenlabs-mcp"], env: ["ELEVENLABS_API_KEY"] } },
];

export function iconUrl(server: McpServer): string {
	return `https://www.google.com/s2/favicons?sz=64&domain=${server.domain}`;
}

export const MCP_CATEGORIES = ["All", "Core", "Dev", "Search", "Productivity", "Cloud", "Data", "Comms"] as const;

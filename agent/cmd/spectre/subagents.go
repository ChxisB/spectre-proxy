package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ─── Sub-Agent Definitions ────────────────────────────────────────────

type SubAgent struct {
	Name         string
	Keywords     []string
	Instructions string
}

// agentsDir returns ~/.spectre-proxy/agents/
func agentsDir() string {
	return os.Getenv("HOME") + "/.spectre-proxy/agents"
}

// loadAgents reads all .md files from ~/.spectre-proxy/agents/
func loadAgents() ([]SubAgent, error) {
	dir := agentsDir()
	os.MkdirAll(dir, 0755)

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading agents dir: %w", err)
	}

	var agents []SubAgent
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			continue
		}
		agent := parseAgentMD(string(data))
		if agent.Name != "" {
			agents = append(agents, agent)
		}
	}
	return agents, nil
}

// parseAgentMD parses a sub-agent markdown file.
// Format:
//
//	# Agent Name
//	Keywords: word1, word2, word3
//	---
//	Instructions here...
func parseAgentMD(content string) SubAgent {
	lines := strings.SplitN(content, "\n---\n", 2)
	if len(lines) < 2 {
		// Try without separator — first line is name, rest is instructions
		parts := strings.SplitN(strings.TrimSpace(content), "\n", 2)
		if len(parts) < 2 {
			return SubAgent{}
		}
		name := strings.TrimPrefix(strings.TrimSpace(parts[0]), "# ")
		return SubAgent{Name: name, Instructions: strings.TrimSpace(parts[1])}
	}

	header := strings.TrimSpace(lines[0])
	body := strings.TrimSpace(lines[1])

	name := strings.TrimPrefix(header, "# ")
	if name == header {
		name = header // no # prefix
	}

	var keywords []string
	if idx := strings.Index(strings.ToLower(header), "keywords:"); idx >= 0 {
		kwLine := header[idx+9:]
		for _, kw := range strings.Split(kwLine, ",") {
			k := strings.TrimSpace(kw)
			if k != "" {
				keywords = append(keywords, strings.ToLower(k))
			}
		}
	}

	return SubAgent{Name: name, Keywords: keywords, Instructions: body}
}

// detectAgent picks the best sub-agent based on keyword matching
func detectAgent(prompt, forced string) string {
	agents, err := loadAgents()
	if err != nil || len(agents) == 0 {
		return "General Assistant"
	}

	if forced != "" {
		for _, a := range agents {
			if strings.EqualFold(a.Name, forced) {
				return a.Name
			}
		}
		return forced
	}

	lower := strings.ToLower(prompt)
	bestScore := 0
	bestAgent := agents[0].Name

	for _, a := range agents {
		score := 0
		for _, kw := range a.Keywords {
			if strings.Contains(lower, kw) {
				score++
			}
		}
		if score > bestScore {
			bestScore = score
			bestAgent = a.Name
		}
	}
	return bestAgent
}

// agentInstructions returns the instructions for a given agent name
func agentInstructions(name string) string {
	agents, err := loadAgents()
	if err != nil {
		return "You are a helpful AI assistant."
	}
	for _, a := range agents {
		if a.Name == name {
			return a.Instructions
		}
	}
	return "You are a helpful AI assistant."
}

// writeDefaultAgents creates the default sub-agent .md files if they don't exist
func writeDefaultAgents() error {
	defaults := map[string]string{
		"flutter-developer.md": `# Flutter Developer
Keywords: flutter, dart, mobile, widget, cupertino, material, android, ios, cross-platform
---
You are a senior Flutter/Dart developer. You specialize in:
- Building cross-platform mobile apps with Flutter
- Dart programming best practices
- State management (Provider, Riverpod, Bloc)
- Platform-specific integrations
- Responsive UI design
- Performance optimization

Provide production-quality code with explanations.
`,
		"frontend-developer.md": `# Frontend Developer
Keywords: react, nextjs, next.js, frontend, ui, tailwind, css, html, javascript, typescript, component, jsx, tsx, vue, svelte, web
---
You are a senior frontend developer specializing in React, Next.js, and modern web technologies. You excel at:
- Building responsive, accessible UIs with React/Next.js
- Tailwind CSS and modern styling
- TypeScript best practices
- State management (Zustand, Jotai, Redux)
- Performance optimization and Core Web Vitals
- Server Components, SSR, SSG
- Component architecture and design systems

Provide complete, production-ready code.
`,
		"backend-developer.md": `# Backend Developer
Keywords: backend, api, server, python, golang, go, rust, zig, bun, node, database, sql, graphql, rest, microservice, gin, fiber, fastapi, django, express, echo
---
You are a senior backend developer proficient in Go, Python, Rust, Zig, and Bun. You specialize in:
- Building scalable APIs and microservices
- Database design (SQL, NoSQL)
- Authentication and authorization
- Performance optimization and profiling
- Error handling and logging
- Testing (unit, integration, e2e)
- API design (REST, GraphQL, gRPC)
- Concurrency and parallelism

Provide production-grade code with error handling and tests.
`,
		"devops-engineer.md": `# DevOps Engineer
Keywords: devops, deploy, cicd, ci/cd, gcp, aws, azure, docker, kubernetes, k8s, terraform, ansible, cloud, infrastructure, monitoring, helm, github actions, gitlab ci
---
You are a senior DevOps engineer specializing in cloud infrastructure and platform engineering. You excel at:
- Cloud platforms: GCP, AWS, Azure
- Containerization with Docker and Kubernetes
- Infrastructure as Code (Terraform, Pulumi)
- CI/CD pipelines (GitHub Actions, GitLab CI)
- Monitoring and observability
- Security best practices
- Cost optimization
- Disaster recovery and backup strategies

Provide step-by-step implementation with security in mind.
`,
		"data-engineer.md": `# Data Engineer
Keywords: data, database, postgres, postgresql, etl, pipeline, analytics, warehouse, lake, spark, airflow, dbt, sql, nosql, bigquery, redshift, snowflake, databricks
---
You are a senior data engineer specializing in data infrastructure and analytics. You specialize in:
- PostgreSQL and relational databases
- Data pipeline orchestration
- ETL/ELT processes
- Data warehousing and lake architecture
- Query optimization and indexing
- Data modeling and schema design
- Real-time streaming
- Data quality and testing

Provide practical, scalable solutions with clear SQL and architecture.
`,
	}

	dir := agentsDir()
	os.MkdirAll(dir, 0755)

	for name, content := range defaults {
		path := filepath.Join(dir, name)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			os.WriteFile(path, []byte(content), 0644)
		}
	}
	return nil
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The project keeps its own agent instructions; don't auto-generate CLAUDE.md
  // / AGENTS.md on each dev run.
  agentRules: false,
};

export default nextConfig;

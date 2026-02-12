#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import Table from 'cli-table3';

interface AgentConfig {
  name: string;
  emoji: string;
  workspacePath: string;
}

const AGENTS: AgentConfig[] = [
  { name: 'Clawd', emoji: '🦞', workspacePath: '/home/clawd/.openclaw/workspace' },
  { name: 'Spark', emoji: '⚡', workspacePath: '/home/clawd/.openclaw/workspace-spark' },
  { name: 'Echo', emoji: '🌊', workspacePath: '/home/clawd/.openclaw/workspace-echo' },
  { name: 'Codex', emoji: '🐦‍⬛', workspacePath: '/home/clawd/.openclaw/workspace-codex' },
  { name: 'Lumen', emoji: '💡', workspacePath: '/home/clawd/.openclaw/workspace-lumen' },
];

function getLastModifiedTime(dirPath: string): string {
  try {
    if (!fs.existsSync(dirPath)) {
      return chalk.gray('N/A');
    }

    let latestMtime = 0;
    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip node_modules and .git
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          scanDir(fullPath);
        } else {
          const stats = fs.statSync(fullPath);
          if (stats.mtimeMs > latestMtime) {
            latestMtime = stats.mtimeMs;
          }
        }
      }
    };

    scanDir(dirPath);

    if (latestMtime === 0) {
      return chalk.gray('No files');
    }

    const mtime = new Date(latestMtime);
    const now = new Date();
    const diffMs = now.getTime() - mtime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return chalk.green(`${diffMins}m ago`);
    } else if (diffHours < 24) {
      return chalk.yellow(`${diffHours}h ago`);
    } else {
      return chalk.red(`${diffDays}d ago`);
    }
  } catch (error) {
    return chalk.gray('Error');
  }
}

function getGitStatus(dirPath: string): string {
  try {
    if (!fs.existsSync(dirPath) || !fs.existsSync(path.join(dirPath, '.git'))) {
      return chalk.gray('No repo');
    }

    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dirPath,
      encoding: 'utf8',
    }).trim();

    const status = execSync('git status --porcelain', {
      cwd: dirPath,
      encoding: 'utf8',
    });

    const lines = status.trim().split('\n').filter(l => l);
    const changeCount = lines.length;

    if (changeCount === 0) {
      return chalk.green(`✓ ${branch} (clean)`);
    } else {
      return chalk.yellow(`⚠ ${branch} (${changeCount} changes)`);
    }
  } catch (error) {
    return chalk.gray('No repo');
  }
}

function getRecentMemoryNotes(dirPath: string): string {
  try {
    const memoryDir = path.join(dirPath, 'memory');
    if (!fs.existsSync(memoryDir)) {
      return chalk.gray('No memory dir');
    }

    // Find the most recent YYYY-MM-DD.md file
    const files = fs.readdirSync(memoryDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort()
      .reverse();

    if (files.length === 0) {
      return chalk.gray('No memory files');
    }

    const recentFile = path.join(memoryDir, files[0]);
    const content = fs.readFileSync(recentFile, 'utf8');
    const lines = content.trim().split('\n').filter(l => l.trim());

    if (lines.length === 0) {
      return chalk.gray('No notes');
    }

    // Get last 3 non-empty lines
    const lastLines = lines.slice(-3);
    return lastLines.map(l => chalk.dim(l.substring(0, 60))).join('\n');
  } catch (error) {
    return chalk.gray('No recent notes');
  }
}

function main() {
  console.log(chalk.bold.cyan('\n🤖 OpenClaw Agent Status\n'));

  const table = new Table({
    head: [
      chalk.bold('Agent'),
      chalk.bold('Last Modified'),
      chalk.bold('Git Status'),
      chalk.bold('Recent Memory Notes'),
    ],
    colWidths: [15, 20, 35, 65],
    wordWrap: true,
  });

  for (const agent of AGENTS) {
    const agentName = `${agent.emoji} ${agent.name}`;
    const lastMod = getLastModifiedTime(agent.workspacePath);
    const gitStatus = getGitStatus(agent.workspacePath);
    const memoryNotes = getRecentMemoryNotes(agent.workspacePath);

    table.push([agentName, lastMod, gitStatus, memoryNotes]);
  }

  console.log(table.toString());
  console.log();
}

main();

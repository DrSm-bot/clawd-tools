#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import Table from "cli-table3";

type Workspace = {
  name: string;
  rootPath: string;
};

type FileInfo = {
  fullPath: string;
  relativePath: string;
  mtimeMs: number;
  size: number;
};

type AnalysisResult = {
  workspace: Workspace;
  memoryPath: string;
  exists: boolean;
  dailyLogCount: number;
  olderThan30DaysCount: number;
  totalSizeBytes: number;
  oldestDate: number | null;
  newestDate: number | null;
  archivedCount: number;
};

const WORKSPACES: Workspace[] = [
  { name: "Clawd", rootPath: "/home/clawd/.openclaw/workspace" },
  { name: "Spark", rootPath: "/home/clawd/.openclaw/workspace-spark" },
  { name: "Echo", rootPath: "/home/clawd/.openclaw/workspace-echo" },
  { name: "Codex", rootPath: "/home/clawd/.openclaw/workspace-codex" },
  { name: "Lumen", rootPath: "/home/clawd/.openclaw/workspace-lumen" }
];

const DAILY_LOG_REGEX = /^\d{4}-\d{2}-\d{2}\.md$/;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ARCHIVE_ARG = "--archive";

async function existsDir(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function collectFilesRecursively(baseDir: string, currentDir = baseDir): Promise<FileInfo[]> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files: FileInfo[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFilesRecursively(baseDir, fullPath);
      files.push(...nested);
    } else if (entry.isFile()) {
      const stat = await fs.stat(fullPath);
      files.push({
        fullPath,
        relativePath: path.relative(baseDir, fullPath),
        mtimeMs: stat.mtimeMs,
        size: stat.size
      });
    }
  }

  return files;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** exp;
  return `${size.toFixed(size >= 10 || exp === 0 ? 0 : 1)} ${units[exp]}`;
}

function formatDate(ms: number | null): string {
  if (ms === null) return "-";
  return new Date(ms).toISOString().slice(0, 10);
}

async function archiveOldFiles(memoryPath: string, oldFiles: FileInfo[]): Promise<number> {
  const archiveDir = path.join(memoryPath, "archive");
  await fs.mkdir(archiveDir, { recursive: true });
  let moved = 0;

  for (const file of oldFiles) {
    if (file.relativePath.startsWith(`archive${path.sep}`) || file.relativePath === "archive") {
      continue;
    }

    const destination = path.join(archiveDir, file.relativePath);
    await fs.mkdir(path.dirname(destination), { recursive: true });

    try {
      await fs.rename(file.fullPath, destination);
      moved += 1;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return moved;
}

async function analyzeWorkspace(workspace: Workspace, shouldArchive: boolean): Promise<AnalysisResult> {
  const memoryPath = path.join(workspace.rootPath, "memory");
  const exists = await existsDir(memoryPath);

  if (!exists) {
    return {
      workspace,
      memoryPath,
      exists: false,
      dailyLogCount: 0,
      olderThan30DaysCount: 0,
      totalSizeBytes: 0,
      oldestDate: null,
      newestDate: null,
      archivedCount: 0
    };
  }

  const files = await collectFilesRecursively(memoryPath);
  const now = Date.now();
  const cutoff = now - 30 * DAY_IN_MS;

  const dailyLogCount = files.filter((file) => DAILY_LOG_REGEX.test(path.basename(file.relativePath))).length;
  const oldFiles = files.filter((file) => file.mtimeMs < cutoff);
  const totalSizeBytes = files.reduce((sum, file) => sum + file.size, 0);
  const mtimeValues = files.map((file) => file.mtimeMs);
  const oldestDate = mtimeValues.length > 0 ? Math.min(...mtimeValues) : null;
  const newestDate = mtimeValues.length > 0 ? Math.max(...mtimeValues) : null;
  const archivedCount = shouldArchive ? await archiveOldFiles(memoryPath, oldFiles) : 0;

  return {
    workspace,
    memoryPath,
    exists: true,
    dailyLogCount,
    olderThan30DaysCount: oldFiles.length,
    totalSizeBytes,
    oldestDate,
    newestDate,
    archivedCount
  };
}

function renderTable(results: AnalysisResult[], shouldArchive: boolean): void {
  const head = [
    chalk.bold.cyan("Workspace"),
    chalk.bold.cyan("Memory Path"),
    chalk.bold.cyan("Daily Logs"),
    chalk.bold.cyan(">30 Days"),
    chalk.bold.cyan("Total Size"),
    chalk.bold.cyan("Date Range"),
    chalk.bold.cyan("Status")
  ];
  if (shouldArchive) {
    head.push(chalk.bold.cyan("Archived"));
  }

  const table = new Table({
    head,
    style: { head: [], border: [] },
    wordWrap: true
  });

  for (const result of results) {
    const status = result.exists ? chalk.green("OK") : chalk.yellow("Missing");
    const range = `${formatDate(result.oldestDate)} -> ${formatDate(result.newestDate)}`;
    const row = [
      chalk.white(result.workspace.name),
      chalk.gray(result.memoryPath),
      chalk.blue(String(result.dailyLogCount)),
      result.olderThan30DaysCount > 0
        ? chalk.yellow(String(result.olderThan30DaysCount))
        : chalk.green("0"),
      chalk.magenta(formatBytes(result.totalSizeBytes)),
      chalk.white(range),
      status
    ];

    if (shouldArchive) {
      row.push(result.archivedCount > 0 ? chalk.green(String(result.archivedCount)) : chalk.gray("0"));
    }

    table.push(row);
  }

  console.log(table.toString());
}

async function main(): Promise<void> {
  const shouldArchive = process.argv.includes(ARCHIVE_ARG);
  const results = await Promise.all(WORKSPACES.map((workspace) => analyzeWorkspace(workspace, shouldArchive)));

  console.log(chalk.bold(`memory-cleanup ${shouldArchive ? "(archive enabled)" : "(report mode)"}`));
  renderTable(results, shouldArchive);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`Error: ${message}`));
  process.exit(1);
});

/**
 * RobinPath CLI Entry Point (for standalone binary)
 * Bundled by esbuild, packaged as Node.js SEA.
 */
import { createInterface } from 'node:readline';
import { readFileSync, existsSync, mkdirSync, copyFileSync, rmSync, writeFileSync, readdirSync, statSync, watch, appendFileSync, chmodSync } from 'node:fs';
import { resolve, extname, join, basename, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { RobinPath, ROBINPATH_VERSION, Parser, Printer, LineIndexImpl, formatErrorWithContext } from '@robinpath/robinpath';

// ============================================================================
// Global flags
// ============================================================================
let FLAG_QUIET = false;
let FLAG_VERBOSE = false;

function log(...args) {
    if (!FLAG_QUIET) console.log(...args);
}

function logVerbose(...args) {
    if (FLAG_VERBOSE) console.error('[verbose]', ...args);
}

// ============================================================================
// ANSI colors (only when stderr is a TTY)
// ============================================================================
const isTTY = process.stderr.isTTY;
const color = {
    red: (s) => isTTY ? `\x1b[31m${s}\x1b[0m` : s,
    green: (s) => isTTY ? `\x1b[32m${s}\x1b[0m` : s,
    yellow: (s) => isTTY ? `\x1b[33m${s}\x1b[0m` : s,
    dim: (s) => isTTY ? `\x1b[2m${s}\x1b[0m` : s,
    bold: (s) => isTTY ? `\x1b[1m${s}\x1b[0m` : s,
    cyan: (s) => isTTY ? `\x1b[36m${s}\x1b[0m` : s,
};

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Get the install directory for robinpath
 */
function getInstallDir() {
    return join(homedir(), '.robinpath', 'bin');
}

/**
 * Get the robinpath home directory
 */
function getRobinPathHome() {
    return join(homedir(), '.robinpath');
}

/**
 * Install: copy this exe to ~/.robinpath/bin and add to PATH
 */
function handleInstall() {
    const installDir = getInstallDir();
    const isWindows = platform() === 'win32';
    const exeName = isWindows ? 'robinpath.exe' : 'robinpath';
    const dest = join(installDir, exeName);
    const src = process.execPath;

    // Already installed in the right place?
    if (resolve(src) === resolve(dest)) {
        log(`robinpath v${ROBINPATH_VERSION} is already installed.`);
        return;
    }

    // Create directory
    mkdirSync(installDir, { recursive: true });

    // Copy binary
    copyFileSync(src, dest);

    // Make executable on Unix
    if (!isWindows) {
        try {
            chmodSync(dest, 0o755);
        } catch {
            // ignore chmod failures
        }
    }

    // Add to PATH
    if (isWindows) {
        try {
            const checkPath = execSync(
                `powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','User')"`,
                { encoding: 'utf-8' }
            ).trim();

            if (!checkPath.includes(installDir)) {
                execSync(
                    `powershell -NoProfile -Command "[Environment]::SetEnvironmentVariable('Path','${installDir};' + [Environment]::GetEnvironmentVariable('Path','User'),'User')"`,
                    { encoding: 'utf-8' }
                );
            }
        } catch {
            log(`Could not update PATH automatically.`);
            log(`Add this to your PATH manually: ${installDir}`);
        }
    } else {
        // Unix: suggest adding to shell profile
        const shellProfile = process.env.SHELL?.includes('zsh') ? '~/.zshrc' : '~/.bashrc';
        const exportLine = `export PATH="${installDir}:$PATH"`;
        log(`Add to ${shellProfile}:`);
        log(`  ${exportLine}`);
    }

    log('');
    log(`Installed robinpath v${ROBINPATH_VERSION}`);
    log(`Location: ${dest}`);
    log('');
    log('Restart your terminal, then run:');
    log('  robinpath --version');
}

/**
 * Uninstall: remove ~/.robinpath and clean PATH
 */
function handleUninstall() {
    const installDir = getInstallDir();
    const robinpathHome = getRobinPathHome();
    const isWindows = platform() === 'win32';

    // Remove the directory
    if (existsSync(robinpathHome)) {
        rmSync(robinpathHome, { recursive: true, force: true });
        log(`Removed ${robinpathHome}`);
    } else {
        log('Nothing to remove.');
    }

    // Clean PATH
    if (isWindows) {
        try {
            execSync(
                `powershell -NoProfile -Command "$p = [Environment]::GetEnvironmentVariable('Path','User'); $clean = ($p -split ';' | Where-Object { $_ -notlike '*\\.robinpath\\bin*' }) -join ';'; [Environment]::SetEnvironmentVariable('Path',$clean,'User')"`,
                { encoding: 'utf-8' }
            );
            log('Removed from PATH');
        } catch {
            log(`Could not update PATH automatically.`);
            log(`Remove "${installDir}" from your PATH manually.`);
        }
    } else {
        log(`Remove the robinpath PATH line from your shell profile.`);
    }

    log('');
    log('RobinPath uninstalled. Restart your terminal.');
}

/**
 * Resolve a script file path, auto-adding .rp or .robin extension if needed
 */
function resolveScriptPath(fileArg) {
    const filePath = resolve(fileArg);
    if (existsSync(filePath)) return filePath;

    if (!extname(filePath)) {
        const rpPath = filePath + '.rp';
        if (existsSync(rpPath)) return rpPath;

        const robinPath = filePath + '.robin';
        if (existsSync(robinPath)) return robinPath;
    }

    return null;
}

/**
 * Display a rich error with context
 */
function displayError(error, script) {
    // Check for pre-formatted error message
    if (error.__formattedMessage) {
        console.error(color.red('Error:') + ' ' + error.__formattedMessage);
        return;
    }

    // Try to use formatErrorWithContext for rich error display
    if (script) {
        try {
            const formatted = formatErrorWithContext({ message: error.message, code: script });
            if (formatted && formatted !== error.message) {
                console.error(color.red('Error:') + ' ' + formatted);
                return;
            }
        } catch {
            // Fall through to simple error
        }
    }

    console.error(color.red('Error:') + ' ' + error.message);
}

/**
 * Execute a script and exit with proper code
 */
async function runScript(script, filePath) {
    const rp = new RobinPath();
    const startTime = FLAG_VERBOSE ? performance.now() : 0;

    try {
        await rp.executeScript(script);
        if (FLAG_VERBOSE) {
            const elapsed = (performance.now() - startTime).toFixed(1);
            const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
            logVerbose(`Executed in ${elapsed}ms, heap: ${mem}MB`);
        }
    } catch (error) {
        displayError(error, script);
        process.exit(1);
    }
}

/**
 * Read all of stdin as a string (for piped input)
 */
function readStdin() {
    return new Promise((resolve) => {
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => { data += chunk; });
        process.stdin.on('end', () => { resolve(data); });
    });
}

// ============================================================================
// Commands
// ============================================================================

/**
 * robinpath check <file> — Syntax checker
 */
async function handleCheck(args) {
    const fileArg = args.find(a => !a.startsWith('-'));
    if (!fileArg) {
        console.error(color.red('Error:') + ' check requires a file argument');
        console.error('Usage: robinpath check <file>');
        process.exit(2);
    }

    const filePath = resolveScriptPath(fileArg);
    if (!filePath) {
        console.error(color.red('Error:') + ` File not found: ${fileArg}`);
        process.exit(2);
    }

    const script = readFileSync(filePath, 'utf-8');
    const startTime = FLAG_VERBOSE ? performance.now() : 0;

    try {
        const parser = new Parser(script);
        await parser.parse();
        if (FLAG_VERBOSE) {
            const elapsed = (performance.now() - startTime).toFixed(1);
            logVerbose(`Parsed in ${elapsed}ms`);
        }
        log(color.green('OK') + ` ${fileArg} — no syntax errors`);
        process.exit(0);
    } catch (error) {
        // Try rich error formatting
        try {
            const formatted = formatErrorWithContext({ message: error.message, code: script });
            console.error(color.red('Syntax error') + ` in ${fileArg}:\n${formatted}`);
        } catch {
            console.error(color.red('Syntax error') + ` in ${fileArg}: ${error.message}`);
        }
        process.exit(2);
    }
}

/**
 * robinpath ast <file> — AST dump
 */
async function handleAST(args) {
    const compact = args.includes('--compact');
    const fileArg = args.find(a => !a.startsWith('-'));
    if (!fileArg) {
        console.error(color.red('Error:') + ' ast requires a file argument');
        console.error('Usage: robinpath ast <file> [--compact]');
        process.exit(2);
    }

    const filePath = resolveScriptPath(fileArg);
    if (!filePath) {
        console.error(color.red('Error:') + ` File not found: ${fileArg}`);
        process.exit(2);
    }

    const script = readFileSync(filePath, 'utf-8');
    const rp = new RobinPath();
    const startTime = FLAG_VERBOSE ? performance.now() : 0;

    try {
        const ast = await rp.getAST(script);
        if (FLAG_VERBOSE) {
            const elapsed = (performance.now() - startTime).toFixed(1);
            logVerbose(`Parsed in ${elapsed}ms, ${ast.length} top-level nodes`);
        }
        console.log(compact ? JSON.stringify(ast) : JSON.stringify(ast, null, 2));
    } catch (error) {
        displayError(error, script);
        process.exit(2);
    }
}

/**
 * robinpath fmt <file|dir> — Code formatter
 */
async function handleFmt(args) {
    const writeInPlace = args.includes('--write') || args.includes('-w');
    const checkOnly = args.includes('--check');
    const fileArg = args.find(a => !a.startsWith('-'));

    if (!fileArg) {
        console.error(color.red('Error:') + ' fmt requires a file or directory argument');
        console.error('Usage: robinpath fmt <file|dir> [--write] [--check]');
        process.exit(2);
    }

    // Collect files to format
    const files = collectRPFiles(fileArg);
    if (files.length === 0) {
        console.error(color.red('Error:') + ` No .rp or .robin files found: ${fileArg}`);
        process.exit(2);
    }

    let hasUnformatted = false;

    for (const filePath of files) {
        const script = readFileSync(filePath, 'utf-8');
        const startTime = FLAG_VERBOSE ? performance.now() : 0;

        try {
            const formatted = await formatScript(script);
            if (FLAG_VERBOSE) {
                const elapsed = (performance.now() - startTime).toFixed(1);
                logVerbose(`Formatted ${relative(process.cwd(), filePath)} in ${elapsed}ms`);
            }

            if (checkOnly) {
                if (formatted !== script) {
                    console.error(relative(process.cwd(), filePath) + ' — ' + color.red('not formatted'));
                    hasUnformatted = true;
                } else {
                    log(relative(process.cwd(), filePath) + ' — ' + color.green('OK'));
                }
            } else if (writeInPlace) {
                if (formatted !== script) {
                    writeFileSync(filePath, formatted, 'utf-8');
                    log(color.green('formatted') + ' ' + relative(process.cwd(), filePath));
                } else {
                    log(color.dim('unchanged') + ' ' + relative(process.cwd(), filePath));
                }
            } else {
                // Print to stdout
                process.stdout.write(formatted);
            }
        } catch (error) {
            console.error(color.red('Error') + ` formatting ${relative(process.cwd(), filePath)}: ${error.message}`);
            hasUnformatted = true;
        }
    }

    if (checkOnly && hasUnformatted) {
        process.exit(1);
    }
}

/**
 * Format a RobinPath script to canonical style (normalized, no flavor preservation)
 */
async function formatScript(script) {
    const parser = new Parser(script);
    const statements = await parser.parse();

    // Create a dummy LineIndex (no original script = forces normalization)
    const dummyLineIndex = new LineIndexImpl('');

    const ctx = {
        indentLevel: 0,
        lineIndex: dummyLineIndex,
        // No originalScript = forces normalized output
    };

    // Strip flavor/preservation flags so Printer uses canonical forms
    const normalized = statements.map(s => stripFlavorFlags(s));

    const parts = [];
    for (let i = 0; i < normalized.length; i++) {
        const code = Printer.printNode(normalized[i], ctx);
        if (i > 0 && code.trim()) {
            // For normalized output, add blank line between blocks and other statements
            const prevType = normalized[i - 1].type;
            const currType = normalized[i].type;
            const blockTypes = ['ifBlock', 'define', 'do', 'together', 'forLoop', 'onBlock', 'cell'];
            if (blockTypes.includes(prevType) || blockTypes.includes(currType)) {
                parts.push('\n');
            }
        }
        parts.push(code);
    }

    let result = parts.join('');
    // Ensure single trailing newline
    result = result.replace(/\n*$/, '\n');
    return result;
}

/**
 * Recursively strip flavor-preservation flags from AST nodes
 * so the Printer outputs canonical/normalized form.
 */
function stripFlavorFlags(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(n => stripFlavorFlags(n));

    const clone = { ...node };

    // Assignment: force canonical $x = value form
    if (clone.type === 'assignment') {
        delete clone.isSet;
        delete clone.hasAs;
        delete clone.isImplicit;
    }

    // If block: remove hasThen (for elseif branches)
    if (clone.type === 'ifBlock') {
        delete clone.hasThen;
        if (clone.thenBranch) clone.thenBranch = clone.thenBranch.map(s => stripFlavorFlags(s));
        if (clone.elseBranch) clone.elseBranch = clone.elseBranch.map(s => stripFlavorFlags(s));
        if (clone.elseifBranches) {
            clone.elseifBranches = clone.elseifBranches.map(b => ({
                ...b,
                hasThen: undefined,
                body: b.body ? b.body.map(s => stripFlavorFlags(s)) : b.body,
            }));
        }
    }

    // Command: remove module prefix tracking (force full qualified names)
    if (clone.type === 'command') {
        delete clone.modulePrefix;
    }

    // Strip codePos so Printer doesn't try to extract original code
    delete clone.codePos;
    delete clone.bodyPos;
    delete clone.openPos;
    delete clone.closePos;
    delete clone.headerPos;
    delete clone.keywordPos;
    delete clone.elseKeywordPos;

    // Recurse into body arrays
    if (clone.body && Array.isArray(clone.body)) {
        clone.body = clone.body.map(s => stripFlavorFlags(s));
    }
    if (clone.command && typeof clone.command === 'object') {
        clone.command = stripFlavorFlags(clone.command);
    }

    return clone;
}

/**
 * Collect .rp and .robin files from a path (file or directory)
 */
function collectRPFiles(pathArg) {
    const fullPath = resolve(pathArg);

    if (!existsSync(fullPath)) {
        // Try resolving with extensions
        const resolved = resolveScriptPath(pathArg);
        if (resolved) return [resolved];
        return [];
    }

    const stat = statSync(fullPath);
    if (stat.isFile()) {
        return [fullPath];
    }

    if (stat.isDirectory()) {
        return collectRPFilesRecursive(fullPath);
    }

    return [];
}

function collectRPFilesRecursive(dir) {
    const results = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            results.push(...collectRPFilesRecursive(fullPath));
        } else if (entry.endsWith('.rp') || entry.endsWith('.robin')) {
            results.push(fullPath);
        }
    }
    return results;
}

/**
 * robinpath test [dir|file] — Test runner
 */
async function handleTest(args) {
    const targetArg = args.find(a => !a.startsWith('-'));
    const searchPath = targetArg || '.';

    // Collect test files
    let testFiles;
    const fullPath = resolve(searchPath);
    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        testFiles = [fullPath];
    } else {
        testFiles = collectTestFiles(searchPath);
    }

    if (testFiles.length === 0) {
        log(color.yellow('No *.test.rp files found') + (targetArg ? ` in ${targetArg}` : ''));
        process.exit(0);
    }

    let passed = 0;
    let failed = 0;
    const failures = [];
    const startTime = performance.now();

    for (const filePath of testFiles) {
        const relPath = relative(process.cwd(), filePath);
        const script = readFileSync(filePath, 'utf-8');
        const rp = new RobinPath();

        try {
            await rp.executeScript(script);
            passed++;
            log(color.green('PASS') + '  ' + relPath);
        } catch (error) {
            failed++;
            log(color.red('FAIL') + '  ' + relPath);

            // Extract position info if available
            let detail = '  ' + error.message;
            if (error.__formattedMessage) {
                detail = '  ' + error.__formattedMessage.split('\n').join('\n  ');
            }
            log(color.dim(detail));
            failures.push({ file: relPath, error: error.message });
        }
    }

    const total = passed + failed;
    const elapsed = (performance.now() - startTime).toFixed(0);

    log('');
    const summary = `${total} test${total !== 1 ? 's' : ''}: ${passed} passed, ${failed} failed`;
    if (failed > 0) {
        log(color.red(summary) + color.dim(` (${elapsed}ms)`));
    } else {
        log(color.green(summary) + color.dim(` (${elapsed}ms)`));
    }

    process.exit(failed > 0 ? 1 : 0);
}

/**
 * Collect *.test.rp files recursively
 */
function collectTestFiles(searchPath) {
    const fullPath = resolve(searchPath);
    if (!existsSync(fullPath)) {
        return [];
    }

    const stat = statSync(fullPath);
    if (!stat.isDirectory()) {
        if (fullPath.endsWith('.test.rp')) return [fullPath];
        return [];
    }

    return collectTestFilesRecursive(fullPath);
}

function collectTestFilesRecursive(dir) {
    const results = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            results.push(...collectTestFilesRecursive(fullPath));
        } else if (entry.endsWith('.test.rp')) {
            results.push(fullPath);
        }
    }
    return results.sort();
}

/**
 * --watch flag: Re-run script on file changes
 */
async function handleWatch(filePath, script) {
    log(color.dim(`Watching ${relative(process.cwd(), filePath)} for changes...`));
    log('');

    // Initial run
    await runWatchIteration(filePath);

    let debounceTimer = null;
    watch(filePath, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            // Clear screen
            process.stdout.write('\x1b[2J\x1b[H');
            await runWatchIteration(filePath);
        }, 200);
    });
}

async function runWatchIteration(filePath) {
    const timestamp = new Date().toLocaleTimeString();
    log(color.dim(`[${timestamp}]`) + ` Running ${relative(process.cwd(), filePath)}`);
    log(color.dim('─'.repeat(50)));

    const script = readFileSync(filePath, 'utf-8');
    const rp = new RobinPath();
    try {
        await rp.executeScript(script);
    } catch (error) {
        displayError(error, script);
    }
    log('');
    log(color.dim('Waiting for changes...'));
}

// ============================================================================
// Help system
// ============================================================================

function showMainHelp() {
    console.log(`RobinPath v${ROBINPATH_VERSION} — Scripting language for automation and data processing

USAGE:
  robinpath [command] [flags] [file]

COMMANDS:
  <file.rp>          Run a RobinPath script
  fmt <file|dir>     Format a script (--write to overwrite, --check for CI)
  check <file>       Check syntax without executing
  ast <file>         Dump AST as JSON (--compact for minified)
  test [dir|file]    Run *.test.rp test files
  install            Install robinpath to system PATH
  uninstall          Remove robinpath from system

FLAGS:
  -e, --eval <code>  Execute inline script
  -w, --watch        Re-run script on file changes
  -q, --quiet        Suppress non-error output
  --verbose          Show timing and debug info
  -v, --version      Show version
  -h, --help         Show this help

REPL:
  robinpath          Start interactive REPL (no arguments)

  REPL Commands:
    help             Show help
    exit / quit      Exit REPL
    clear            Clear screen
    ..               List all available commands/modules
    .load <file>     Load and execute a script file
    .save <file>     Save session to file
    \\                Line continuation (at end of line)

EXAMPLES:
  robinpath app.rp                Run a script
  robinpath hello                 Auto-resolves hello.rp or hello.robin
  robinpath -e 'log "hi"'        Execute inline code
  robinpath fmt app.rp            Print formatted code
  robinpath fmt -w src/           Format all .rp files in dir
  robinpath check app.rp          Syntax check
  robinpath ast app.rp            Dump AST as JSON
  robinpath test                  Run all *.test.rp in current dir
  robinpath test tests/           Run tests in specific dir
  robinpath --watch app.rp        Re-run on file changes
  echo 'log "hi"' | robinpath    Pipe script via stdin

FILE EXTENSIONS:
  .rp, .robin        Both recognized (auto-resolved without extension)

MODULES (built-in):
  math      Mathematical operations (add, subtract, multiply, ...)
  string    String manipulation (length, slice, split, ...)
  array     Array operations (push, pop, map, filter, ...)
  object    Object operations (keys, values, merge, ...)
  json      JSON parse/stringify
  time      Time operations (sleep, now, format)
  random    Random number generation (int, float, pick, shuffle)
  fetch     HTTP requests (get, post, put, delete)
  test      Test assertions (assert, assertEqual, assertTrue, ...)
  dom       DOM manipulation (browser only)

TEST WRITING:
  Use the test module for assertions:
    test.assert ($value)
    test.assertEqual ($actual) ($expected)
    test.assertTrue ($value)
    test.assertContains ($array) ($item)

  Name test files with .test.rp extension.
  Run with: robinpath test

CONFIGURATION:
  Install dir:  ~/.robinpath/bin/
  History file: ~/.robinpath/history

For more: https://github.com/user/robinpath-cli`);
}

function showCommandHelp(command) {
    const helpPages = {
        fmt: `robinpath fmt — Code formatter

USAGE:
  robinpath fmt <file|dir> [flags]

DESCRIPTION:
  Format RobinPath source code to a canonical style (like gofmt).
  Normalizes syntax: 'set $x as 1' becomes '$x = 1', indentation
  is standardized, etc.

FLAGS:
  -w, --write    Overwrite file(s) in place
  --check        Exit code 1 if any file is not formatted (for CI)

  Without flags, formatted code is printed to stdout.

EXAMPLES:
  robinpath fmt app.rp            Print formatted code to stdout
  robinpath fmt -w app.rp         Format and overwrite file
  robinpath fmt --check app.rp    Check if formatted (CI mode)
  robinpath fmt -w src/           Format all .rp/.robin files in directory
  robinpath fmt --check .         Check all files in current directory`,

        check: `robinpath check — Syntax checker

USAGE:
  robinpath check <file>

DESCRIPTION:
  Parse a RobinPath script and report syntax errors without executing.
  Shows rich error context with line numbers and caret pointers.

EXIT CODES:
  0    No syntax errors
  2    Syntax error found

EXAMPLES:
  robinpath check app.rp          Check single file
  robinpath check hello           Auto-resolves hello.rp or hello.robin`,

        ast: `robinpath ast — AST dump

USAGE:
  robinpath ast <file> [flags]

DESCRIPTION:
  Parse a RobinPath script and output its Abstract Syntax Tree as JSON.
  Useful for tooling, editor integrations, and debugging.

FLAGS:
  --compact      Output minified JSON (no indentation)

EXAMPLES:
  robinpath ast app.rp            Pretty-printed AST
  robinpath ast app.rp --compact  Minified AST`,

        test: `robinpath test — Test runner

USAGE:
  robinpath test [dir|file]

DESCRIPTION:
  Discover and run *.test.rp test files. Uses the built-in 'test'
  module for assertions. Each test file runs in an isolated RobinPath
  instance. If any assertion fails, the file is marked FAIL.

  Without arguments, searches the current directory recursively.

EXIT CODES:
  0    All tests passed
  1    One or more tests failed

OUTPUT FORMAT:
  PASS  tests/math.test.rp
  FAIL  tests/string.test.rp
    Error: assertEqual failed (Expected "hello", got "world")

  2 tests: 1 passed, 1 failed

ASSERTIONS (test module):
  test.assert ($value)            Assert value is truthy
  test.assertEqual ($a) ($b)      Assert a equals b
  test.assertTrue ($value)        Assert value is true
  test.assertFalse ($value)       Assert value is false
  test.assertContains ($arr) ($v) Assert array contains value

EXAMPLES:
  robinpath test                  Run all tests in current dir
  robinpath test tests/           Run tests in specific dir
  robinpath test my.test.rp       Run a single test file`,

        install: `robinpath install — System installation

USAGE:
  robinpath install

DESCRIPTION:
  Copy the robinpath binary to ~/.robinpath/bin/ and add it to
  your system PATH. After installation, restart your terminal
  and run 'robinpath --version' to verify.`,

        uninstall: `robinpath uninstall — System removal

USAGE:
  robinpath uninstall

DESCRIPTION:
  Remove ~/.robinpath/ and clean the PATH entry. After uninstalling,
  restart your terminal.`,
    };

    const page = helpPages[command];
    if (page) {
        console.log(page);
    } else {
        console.error(color.red('Error:') + ` Unknown command: ${command}`);
        console.error('Available commands: fmt, check, ast, test, install, uninstall');
        process.exit(2);
    }
}

// ============================================================================
// REPL
// ============================================================================

/**
 * Get REPL history file path
 */
function getHistoryPath() {
    return join(getRobinPathHome(), 'history');
}

/**
 * Load REPL history from file
 */
function loadHistory() {
    const historyPath = getHistoryPath();
    try {
        if (existsSync(historyPath)) {
            const content = readFileSync(historyPath, 'utf-8');
            return content.split('\n').filter(line => line.trim()).reverse();
        }
    } catch {
        // Ignore errors reading history
    }
    return [];
}

/**
 * Append a line to REPL history file
 */
function appendHistory(line) {
    const historyPath = getHistoryPath();
    try {
        const dir = getRobinPathHome();
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
        appendFileSync(historyPath, line + '\n', 'utf-8');

        // Trim history file if it exceeds 1000 lines
        try {
            const content = readFileSync(historyPath, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim());
            if (lines.length > 1000) {
                const trimmed = lines.slice(lines.length - 1000);
                writeFileSync(historyPath, trimmed.join('\n') + '\n', 'utf-8');
            }
        } catch {
            // Ignore trim errors
        }
    } catch {
        // Ignore errors writing history
    }
}

async function startREPL() {
    const rp = new RobinPath({ threadControl: true });
    rp.createThread('default');

    const sessionLines = []; // Track session lines for .save

    function getPrompt() {
        const thread = rp.getCurrentThread();
        if (!thread) return '> ';
        const currentModule = thread.getCurrentModule();
        if (currentModule) {
            return `${thread.id}@${currentModule}> `;
        }
        return `${thread.id}> `;
    }

    function endsWithBackslash(line) {
        return line.trimEnd().endsWith('\\');
    }

    let accumulatedLines = [];

    // Load history
    const history = loadHistory();

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: getPrompt(),
        history: history,
        historySize: 1000,
    });

    log(`RobinPath v${ROBINPATH_VERSION}`);
    log('Type "help" for commands, "exit" to quit');
    log('');

    rl.prompt();

    rl.on('line', async (line) => {
        const trimmed = line.trim();

        if (!trimmed && accumulatedLines.length === 0) {
            rl.prompt();
            return;
        }

        if (trimmed === 'exit' || trimmed === 'quit' || trimmed === '.exit') {
            log('Goodbye!');
            process.exit(0);
        }

        if (accumulatedLines.length === 0 && (trimmed === 'help' || trimmed === '.help')) {
            log('');
            log('RobinPath REPL Commands:');
            log('  exit, quit     Exit the REPL');
            log('  help           Show this help');
            log('  clear          Clear the screen');
            log('  ..             Show all available commands');
            log('  .load <file>   Load and execute a script file');
            log('  .save <file>   Save session to file');
            log('');
            log('Write RobinPath code and press Enter to execute.');
            log('Multi-line blocks (if/def/for/do) are supported.');
            log('Use \\ at end of line for line continuation.');
            log('');
            rl.prompt();
            return;
        }

        if (accumulatedLines.length === 0 && (trimmed === 'clear' || trimmed === '.clear')) {
            console.clear();
            rl.prompt();
            return;
        }

        // ".." command — show available commands
        if (accumulatedLines.length === 0 && trimmed === '..') {
            const thread = rp.getCurrentThread();
            const commands = thread ? thread.getAvailableCommands() : rp.getAvailableCommands();
            log(JSON.stringify(commands, null, 2));
            rl.prompt();
            return;
        }

        // .load <file> — load and execute a script file
        if (accumulatedLines.length === 0 && trimmed.startsWith('.load ')) {
            const fileArg = trimmed.slice(6).trim();
            if (!fileArg) {
                console.error(color.red('Error:') + ' .load requires a file argument');
                rl.prompt();
                return;
            }
            const loadPath = resolveScriptPath(fileArg);
            if (!loadPath) {
                console.error(color.red('Error:') + ` File not found: ${fileArg}`);
                rl.prompt();
                return;
            }
            try {
                const script = readFileSync(loadPath, 'utf-8');
                log(color.dim(`Loading ${fileArg}...`));
                const thread = rp.getCurrentThread();
                if (thread) {
                    await thread.executeScript(script);
                } else {
                    await rp.executeScript(script);
                }
                log(color.green('Loaded') + ` ${fileArg}`);
            } catch (error) {
                displayError(error, null);
            }
            rl.setPrompt(getPrompt());
            rl.prompt();
            return;
        }

        // .save <file> — save session lines to a file
        if (accumulatedLines.length === 0 && trimmed.startsWith('.save ')) {
            const fileArg = trimmed.slice(6).trim();
            if (!fileArg) {
                console.error(color.red('Error:') + ' .save requires a file argument');
                rl.prompt();
                return;
            }
            try {
                const content = sessionLines.join('\n') + '\n';
                writeFileSync(resolve(fileArg), content, 'utf-8');
                log(color.green('Saved') + ` ${sessionLines.length} lines to ${fileArg}`);
            } catch (error) {
                console.error(color.red('Error:') + ` Could not save: ${error.message}`);
            }
            rl.prompt();
            return;
        }

        // Backslash continuation
        if (endsWithBackslash(line)) {
            accumulatedLines.push(line);
            rl.setPrompt('... ');
            rl.prompt();
            return;
        }

        // If we have accumulated lines, add this one
        if (accumulatedLines.length > 0) {
            accumulatedLines.push(line);
        }

        // Determine the full script to check/execute
        const scriptToCheck = accumulatedLines.length > 0
            ? accumulatedLines.join('\n')
            : line;

        try {
            const thread = rp.getCurrentThread();
            let needsMore;
            if (thread) {
                needsMore = await thread.needsMoreInput(scriptToCheck);
            } else {
                needsMore = await rp.needsMoreInput(scriptToCheck);
            }

            if (needsMore.needsMore) {
                if (accumulatedLines.length === 0) {
                    accumulatedLines.push(line);
                }
                rl.setPrompt('... ');
                rl.prompt();
                return;
            }

            // Block is complete — execute
            const finalScript = accumulatedLines.length > 0
                ? accumulatedLines.join('\n')
                : line;
            accumulatedLines = [];

            // Save to history and session
            appendHistory(finalScript);
            sessionLines.push(finalScript);

            if (thread) {
                await thread.executeScript(finalScript);
            } else {
                await rp.executeScript(finalScript);
            }

            rl.setPrompt(getPrompt());
        } catch (error) {
            displayError(error, null);
            accumulatedLines = [];
            rl.setPrompt(getPrompt());
        }

        rl.prompt();
    });

    rl.on('close', () => {
        log('\nGoodbye!');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        if (accumulatedLines.length > 0) {
            log('\nBlock cancelled.');
            accumulatedLines = [];
            rl.setPrompt(getPrompt());
            rl.prompt();
        } else {
            log('\nGoodbye!');
            process.exit(0);
        }
    });
}

// ============================================================================
// Main entry point
// ============================================================================

async function main() {
    const args = process.argv.slice(2);

    // Parse global flags first
    FLAG_QUIET = args.includes('--quiet') || args.includes('-q');
    FLAG_VERBOSE = args.includes('--verbose');

    // Handle flags (can appear anywhere)
    if (args.includes('--version') || args.includes('-v')) {
        console.log(`robinpath v${ROBINPATH_VERSION}`);
        return;
    }

    if (args.includes('--help') || args.includes('-h')) {
        showMainHelp();
        return;
    }

    // Handle commands
    const command = args[0];

    // help <command>
    if (command === 'help') {
        const subCommand = args[1];
        if (subCommand) {
            showCommandHelp(subCommand);
        } else {
            showMainHelp();
        }
        return;
    }

    // install / uninstall
    if (command === 'install') {
        handleInstall();
        return;
    }
    if (command === 'uninstall') {
        handleUninstall();
        return;
    }

    // check <file>
    if (command === 'check') {
        await handleCheck(args.slice(1));
        return;
    }

    // ast <file>
    if (command === 'ast') {
        await handleAST(args.slice(1));
        return;
    }

    // fmt <file|dir>
    if (command === 'fmt') {
        await handleFmt(args.slice(1));
        return;
    }

    // test [dir|file]
    if (command === 'test') {
        await handleTest(args.slice(1));
        return;
    }

    // Handle -e / --eval
    const evalIdx = args.indexOf('-e') !== -1 ? args.indexOf('-e') : args.indexOf('--eval');
    if (evalIdx !== -1) {
        const script = args[evalIdx + 1];
        if (!script) {
            console.error(color.red('Error:') + ' -e requires a script argument');
            process.exit(2);
        }
        await runScript(script);
        return;
    }

    // Handle -- (everything after is treated as file arg)
    const dashDashIdx = args.indexOf('--');
    let fileArg;
    if (dashDashIdx !== -1) {
        fileArg = args[dashDashIdx + 1];
    } else {
        // Filter out known flags before finding file arg
        const flagsToSkip = new Set(['-q', '--quiet', '--verbose']);
        fileArg = args.find(a => !a.startsWith('-') && !flagsToSkip.has(a));
    }

    // Handle file argument
    if (fileArg) {
        const filePath = resolveScriptPath(fileArg);
        if (!filePath) {
            console.error(color.red('Error:') + ` File not found: ${fileArg}`);
            if (!extname(fileArg)) {
                console.error(`  (also tried ${fileArg}.rp and ${fileArg}.robin)`);
            }
            process.exit(2);
        }

        const script = readFileSync(filePath, 'utf-8');

        // --watch / -w flag (only when file is present)
        const hasWatch = args.includes('--watch');
        // -w only means watch when a file arg is present and -w is NOT after 'fmt'
        const hasShortWatch = args.includes('-w') && command !== 'fmt';
        if (hasWatch || hasShortWatch) {
            await handleWatch(filePath, script);
            return;
        }

        await runScript(script, filePath);
        return;
    }

    // No file, no -e — check if stdin is piped (not a terminal)
    if (!process.stdin.isTTY) {
        // Piped input: read all stdin and execute as a script
        const script = await readStdin();
        if (script.trim()) {
            await runScript(script);
        }
        return;
    }

    // Interactive REPL (stdin is a terminal)
    await startREPL();
}

main().catch(err => {
    console.error(color.red('Fatal:') + ` ${err.message}`);
    process.exit(1);
});

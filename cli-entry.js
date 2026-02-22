/**
 * RobinPath CLI Entry Point (for standalone binary)
 * Bundled by esbuild, packaged as Node.js SEA.
 */
import { createInterface } from 'node:readline';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, copyFileSync, rmSync, writeFileSync, readdirSync, statSync, watch, appendFileSync, chmodSync, unlinkSync } from 'node:fs';
import { resolve, extname, join, relative, dirname, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir, platform, tmpdir } from 'node:os';
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
const isTTY = process.stdout.isTTY || process.stderr.isTTY;
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
// Cloud / Auth utilities
// ============================================================================

const CLOUD_URL = process.env.ROBINPATH_CLOUD_URL || 'https://robinpath.com';
const PLATFORM_URL = process.env.ROBINPATH_PLATFORM_URL || 'https://robinpath-platform.nabivogedu.workers.dev';

function getAuthPath() {
    return join(homedir(), '.robinpath', 'auth.json');
}

function readAuth() {
    try {
        const authPath = getAuthPath();
        if (!existsSync(authPath)) return null;
        const data = JSON.parse(readFileSync(authPath, 'utf-8'));
        if (!data.token) return null;
        return data;
    } catch {
        return null;
    }
}

function writeAuth(data) {
    const authPath = getAuthPath();
    const dir = dirname(authPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(authPath, JSON.stringify(data, null, 2), 'utf-8');
    // Restrict permissions on Unix
    if (platform() !== 'win32') {
        try { chmodSync(authPath, 0o600); } catch { /* ignore */ }
    }
}

function removeAuth() {
    const authPath = getAuthPath();
    if (existsSync(authPath)) {
        unlinkSync(authPath);
    }
}

function getAuthToken() {
    const auth = readAuth();
    if (!auth) return null;
    // Check expiry
    if (auth.expiresAt && Date.now() >= auth.expiresAt * 1000) {
        return null;
    }
    return auth.token;
}

function requireAuth() {
    const token = getAuthToken();
    if (!token) {
        console.error(color.red('Error:') + ' Not logged in. Run ' + color.cyan('robinpath login') + ' to sign in.');
        process.exit(1);
    }
    return token;
}

async function platformFetch(path, opts = {}) {
    const token = requireAuth();
    const headers = { Authorization: `Bearer ${token}`, ...opts.headers };
    const url = `${PLATFORM_URL}${path}`;
    const res = await fetch(url, { ...opts, headers });
    return res;
}

function openBrowser(url) {
    const plat = platform();
    try {
        if (plat === 'win32') {
            execSync(`start "" "${url}"`, { stdio: 'ignore' });
        } else if (plat === 'darwin') {
            execSync(`open "${url}"`, { stdio: 'ignore' });
        } else {
            execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
        }
    } catch {
        log(color.yellow('Could not open browser automatically.'));
        log(`Open this URL manually: ${url}`);
    }
}

/**
 * Decode a JWT payload (no verification — just base64url decode the claims).
 */
function decodeJWTPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
        return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
    } catch {
        return null;
    }
}

// ============================================================================
// Cloud commands
// ============================================================================

/**
 * robinpath login — Sign in via browser OAuth
 */
async function handleLogin() {
    // Check if already logged in
    const existing = readAuth();
    if (existing && existing.expiresAt && Date.now() < existing.expiresAt * 1000) {
        log(`Already logged in as ${color.cyan(existing.email)}`);
        log(`Token expires ${new Date(existing.expiresAt * 1000).toLocaleDateString()}`);
        log(`Run ${color.cyan('robinpath logout')} to sign out first.`);
        return;
    }

    return new Promise((resolveLogin) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url, `http://localhost`);
            if (url.pathname !== '/callback') {
                res.writeHead(404);
                res.end('Not found');
                return;
            }

            const token = url.searchParams.get('token');
            const email = url.searchParams.get('email');
            const name = url.searchParams.get('name');

            if (!token) {
                res.writeHead(400);
                res.end('Missing token');
                return;
            }

            // Decode JWT to get expiry
            const claims = decodeJWTPayload(token);
            const expiresAt = claims?.exp || (Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);

            // Save auth
            writeAuth({ token, email: email || '', name: name || '', expiresAt });

            // Respond with success page
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`<!DOCTYPE html>
<html>
<head><title>RobinPath CLI</title></head>
<body style="font-family:system-ui;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<div style="text-align:center">
<h1 style="font-size:24px;color:#22c55e">Signed in!</h1>
<p style="color:#888">You can close this tab and return to your terminal.</p>
</div>
</body>
</html>`);

            // Close server and resolve
            server.close();
            clearTimeout(timeout);
            log(color.green('Logged in') + ` as ${color.cyan(email || 'unknown')}`);
            resolveLogin();
        });

        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            const callbackUrl = `http://localhost:${port}/callback`;
            const loginUrl = `${CLOUD_URL}/api/auth/cli?callback=${encodeURIComponent(callbackUrl)}`;

            log('Opening browser to sign in...');
            log(color.dim('Waiting for authentication...'));
            log('');
            log(color.dim(`If the browser doesn't open, visit:`));
            log(color.cyan(loginUrl));
            log('');

            openBrowser(loginUrl);
        });

        // Timeout after 5 minutes
        const timeout = setTimeout(() => {
            server.close();
            console.error(color.red('Error:') + ' Login timed out (5 minutes). Please try again.');
            process.exit(1);
        }, 5 * 60 * 1000);
    });
}

/**
 * robinpath logout — Remove stored credentials
 */
function handleLogout() {
    const auth = readAuth();
    if (auth) {
        removeAuth();
        log('Logged out.');
    } else {
        log('Not logged in.');
    }
}

/**
 * robinpath whoami — Show current user and account info
 */
async function handleWhoami() {
    const auth = readAuth();
    if (!auth) {
        log('Not logged in. Run ' + color.cyan('robinpath login') + ' to sign in.');
        return;
    }

    // Check if token is expired
    if (auth.expiresAt && Date.now() >= auth.expiresAt * 1000) {
        log(color.yellow('Token expired.') + ' Run ' + color.cyan('robinpath login') + ' to refresh.');
        return;
    }

    log(color.bold('Local credentials:'));
    log(`  Email:   ${auth.email || color.dim('(none)')}`);
    log(`  Name:    ${auth.name || color.dim('(none)')}`);
    log(`  Expires: ${auth.expiresAt ? new Date(auth.expiresAt * 1000).toLocaleDateString() : color.dim('(unknown)')}`);

    // Try fetching server profile
    try {
        const res = await platformFetch('/v1/me');
        if (res.ok) {
            const body = await res.json();
            const user = body.data || body;
            log('');
            log(color.bold('Server profile:'));
            if (user.username) log(`  Username: ${user.username}`);
            if (user.tier) log(`  Tier:     ${user.tier}`);
            if (user.role) log(`  Role:     ${user.role}`);
        } else if (res.status === 401) {
            log('');
            log(color.yellow('Token rejected by server.') + ' Run ' + color.cyan('robinpath login') + ' to refresh.');
        }
    } catch (err) {
        log('');
        log(color.dim(`Could not reach server: ${err.message}`));
    }
}

/**
 * robinpath publish [dir] — Publish a module to the registry
 */
async function handlePublish(args) {
    const token = requireAuth();
    const targetArg = args.find(a => !a.startsWith('-')) || '.';
    const targetDir = resolve(targetArg);

    // Read package.json
    const pkgPath = join(targetDir, 'package.json');
    if (!existsSync(pkgPath)) {
        console.error(color.red('Error:') + ` No package.json found in ${targetDir}`);
        process.exit(2);
    }

    let pkg;
    try {
        pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    } catch (err) {
        console.error(color.red('Error:') + ` Invalid package.json: ${err.message}`);
        process.exit(2);
    }

    if (!pkg.name) {
        console.error(color.red('Error:') + ' package.json is missing "name" field');
        process.exit(2);
    }
    if (!pkg.version) {
        console.error(color.red('Error:') + ' package.json is missing "version" field');
        process.exit(2);
    }

    // Parse scope and name
    let scope, name;
    if (pkg.name.startsWith('@') && pkg.name.includes('/')) {
        const parts = pkg.name.slice(1).split('/');
        scope = parts[0];
        name = parts.slice(1).join('/');
    } else {
        // Use user's email prefix as scope fallback
        const auth = readAuth();
        const emailPrefix = auth?.email?.split('@')[0] || 'unknown';
        scope = emailPrefix;
        name = pkg.name;
    }

    // Create tarball
    const tmpFile = join(tmpdir(), `robinpath-publish-${Date.now()}.tar.gz`);
    const parentDir = dirname(targetDir);
    const dirName = basename(targetDir);

    log(`Packing @${scope}/${name}@${pkg.version}...`);

    try {
        execSync(
            `tar czf "${tmpFile}" --exclude=node_modules --exclude=.git --exclude=dist -C "${parentDir}" "${dirName}"`,
            { stdio: 'pipe' }
        );
    } catch (err) {
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
        console.error(color.red('Error:') + ` Failed to create tarball: ${err.message}`);
        process.exit(1);
    }

    // Read tarball and check size
    const tarball = readFileSync(tmpFile);
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (tarball.length > maxSize) {
        unlinkSync(tmpFile);
        console.error(color.red('Error:') + ` Package is too large (${(tarball.length / 1024 / 1024).toFixed(1)}MB). Max size is 5MB.`);
        process.exit(1);
    }

    log(color.dim(`Package size: ${(tarball.length / 1024).toFixed(1)}KB`));

    // Upload
    try {
        const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/gzip',
            'X-Package-Version': pkg.version,
        };
        if (pkg.description) headers['X-Package-Description'] = pkg.description;
        if (pkg.keywords?.length) headers['X-Package-Keywords'] = pkg.keywords.join(',');
        if (pkg.license) headers['X-Package-License'] = pkg.license;

        const res = await fetch(`${PLATFORM_URL}/v1/registry/${scope}/${name}`, {
            method: 'PUT',
            headers,
            body: tarball,
        });

        if (res.ok) {
            log(color.green('Published') + ` @${scope}/${name}@${pkg.version}`);
        } else {
            const body = await res.json().catch(() => ({}));
            const msg = body?.error?.message || `HTTP ${res.status}`;
            console.error(color.red('Error:') + ` Failed to publish: ${msg}`);
            process.exit(1);
        }
    } catch (err) {
        console.error(color.red('Error:') + ` Failed to publish: ${err.message}`);
        process.exit(1);
    } finally {
        // Clean up temp file
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
    }
}

/**
 * robinpath sync — List your published modules
 */
async function handleSync() {
    requireAuth();

    // Get username from /v1/me
    let username;
    try {
        const meRes = await platformFetch('/v1/me');
        if (!meRes.ok) {
            console.error(color.red('Error:') + ' Could not fetch account info.');
            process.exit(1);
        }
        const meBody = await meRes.json();
        const user = meBody.data || meBody;
        username = user.username || user.email?.split('@')[0] || 'unknown';
    } catch (err) {
        console.error(color.red('Error:') + ` Could not reach server: ${err.message}`);
        process.exit(1);
    }

    log(`Fetching modules for ${color.cyan(username)}...`);
    log('');

    try {
        const res = await platformFetch(`/v1/registry/search?q=${encodeURIComponent('@' + username + '/')}`);
        if (!res.ok) {
            console.error(color.red('Error:') + ` Failed to search registry (HTTP ${res.status}).`);
            process.exit(1);
        }

        const body = await res.json();
        const modules = body.data || body.modules || [];

        if (modules.length === 0) {
            log('No published modules found.');
            log(`Run ${color.cyan('robinpath publish')} to publish your first module.`);
            return;
        }

        // Print table header
        log(color.bold('  Name'.padEnd(40) + 'Version'.padEnd(12) + 'Downloads'.padEnd(12) + 'Visibility'));
        log(color.dim('  ' + '─'.repeat(72)));

        for (const mod of modules) {
            const name = (mod.scope ? `@${mod.scope}/${mod.name}` : mod.name) || mod.id || '?';
            const version = mod.version || mod.latestVersion || '-';
            const downloads = String(mod.downloads ?? mod.downloadCount ?? '-');
            const visibility = mod.visibility || (mod.isPublic === false ? 'private' : 'public');
            log(`  ${name.padEnd(38)}${version.padEnd(12)}${downloads.padEnd(12)}${visibility}`);
        }

        log('');
        log(color.dim(`${modules.length} module${modules.length !== 1 ? 's' : ''}`));
    } catch (err) {
        console.error(color.red('Error:') + ` Failed to list modules: ${err.message}`);
        process.exit(1);
    }
}

// ============================================================================
// Commands
// ============================================================================

/**
 * robinpath check <file> — Syntax checker
 */
async function handleCheck(args) {
    const jsonOutput = args.includes('--json');
    const fileArg = args.find(a => !a.startsWith('-'));
    if (!fileArg) {
        console.error(color.red('Error:') + ' check requires a file argument');
        console.error('Usage: robinpath check <file> [--json]');
        process.exit(2);
    }

    const filePath = resolveScriptPath(fileArg);
    if (!filePath) {
        if (jsonOutput) {
            console.log(JSON.stringify({ ok: false, file: fileArg, error: `File not found: ${fileArg}` }));
        } else {
            console.error(color.red('Error:') + ` File not found: ${fileArg}`);
        }
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
        if (jsonOutput) {
            console.log(JSON.stringify({ ok: true, file: fileArg }));
        } else {
            log(color.green('OK') + ` ${fileArg} — no syntax errors`);
        }
        process.exit(0);
    } catch (error) {
        if (jsonOutput) {
            // Extract line/column from error message if possible
            const lineMatch = error.message.match(/line (\d+)/i);
            const colMatch = error.message.match(/column (\d+)/i);
            console.log(JSON.stringify({
                ok: false,
                file: fileArg,
                error: error.message,
                line: lineMatch ? parseInt(lineMatch[1]) : null,
                column: colMatch ? parseInt(colMatch[1]) : null,
            }));
        } else {
            try {
                const formatted = formatErrorWithContext({ message: error.message, code: script });
                console.error(color.red('Syntax error') + ` in ${fileArg}:\n${formatted}`);
            } catch {
                console.error(color.red('Syntax error') + ` in ${fileArg}: ${error.message}`);
            }
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
    const diffMode = args.includes('--diff');
    const fileArg = args.find(a => !a.startsWith('-'));

    if (!fileArg) {
        console.error(color.red('Error:') + ' fmt requires a file or directory argument');
        console.error('Usage: robinpath fmt <file|dir> [--write] [--check] [--diff]');
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
            } else if (diffMode) {
                if (formatted !== script) {
                    const relPath = relative(process.cwd(), filePath);
                    console.log(simpleDiff(relPath, script, formatted));
                    hasUnformatted = true;
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

    if ((checkOnly || diffMode) && hasUnformatted) {
        process.exit(1);
    }
}

/**
 * Simple unified diff output (no external dependency)
 */
function simpleDiff(filePath, original, formatted) {
    const origLines = original.split('\n');
    const fmtLines = formatted.split('\n');
    const lines = [`--- ${filePath}`, `+++ ${filePath} (formatted)`];

    let i = 0, j = 0;
    while (i < origLines.length || j < fmtLines.length) {
        if (i < origLines.length && j < fmtLines.length && origLines[i] === fmtLines[j]) {
            i++; j++;
            continue;
        }
        // Find the changed region
        const startI = i, startJ = j;
        // Simple: advance both until they match again or end
        let matchFound = false;
        for (let look = 1; look < 10 && !matchFound; look++) {
            // Check if original[i+look] matches formatted[j]
            if (i + look < origLines.length && j < fmtLines.length && origLines[i + look] === fmtLines[j]) {
                matchFound = true; break;
            }
            // Check if original[i] matches formatted[j+look]
            if (j + look < fmtLines.length && i < origLines.length && origLines[i] === fmtLines[j + look]) {
                matchFound = true; break;
            }
        }
        if (!matchFound) {
            // Emit one line from each
            if (i < origLines.length) lines.push(color.red(`- ${origLines[i]}`));
            if (j < fmtLines.length) lines.push(color.green(`+ ${fmtLines[j]}`));
            i++; j++;
        } else {
            // Emit removed lines until match
            while (i < origLines.length && (j >= fmtLines.length || origLines[i] !== fmtLines[j])) {
                lines.push(color.red(`- ${origLines[i]}`));
                i++;
            }
            // Emit added lines until match
            while (j < fmtLines.length && (i >= origLines.length || origLines[i] !== fmtLines[j])) {
                lines.push(color.green(`+ ${fmtLines[j]}`));
                j++;
            }
        }
    }

    return lines.join('\n');
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
    const jsonOutput = args.includes('--json');
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
        if (jsonOutput) {
            console.log(JSON.stringify({ passed: 0, failed: 0, total: 0, results: [] }));
        } else {
            log(color.yellow('No *.test.rp files found') + (targetArg ? ` in ${targetArg}` : ''));
        }
        process.exit(0);
    }

    let passed = 0;
    let failed = 0;
    const results = [];
    const startTime = performance.now();

    for (const filePath of testFiles) {
        const relPath = relative(process.cwd(), filePath);
        const script = readFileSync(filePath, 'utf-8');
        const rp = new RobinPath();

        try {
            await rp.executeScript(script);
            passed++;
            results.push({ file: relPath, status: 'pass' });
            if (!jsonOutput) log(color.green('PASS') + '  ' + relPath);
        } catch (error) {
            failed++;
            results.push({ file: relPath, status: 'fail', error: error.message });
            if (!jsonOutput) {
                log(color.red('FAIL') + '  ' + relPath);
                let detail = '  ' + error.message;
                if (error.__formattedMessage) {
                    detail = '  ' + error.__formattedMessage.split('\n').join('\n  ');
                }
                log(color.dim(detail));
            }
        }
    }

    const total = passed + failed;
    const elapsed = (performance.now() - startTime).toFixed(0);

    if (jsonOutput) {
        console.log(JSON.stringify({ passed, failed, total, duration_ms: parseInt(elapsed), results }));
    } else {
        log('');
        const summary = `${total} test${total !== 1 ? 's' : ''}: ${passed} passed, ${failed} failed`;
        if (failed > 0) {
            log(color.red(summary) + color.dim(` (${elapsed}ms)`));
        } else {
            log(color.green(summary) + color.dim(` (${elapsed}ms)`));
        }
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
  fmt <file|dir>     Format a script (--write to overwrite, --check for CI, --diff)
  check <file>       Check syntax without executing (--json for machine output)
  ast <file>         Dump AST as JSON (--compact for minified)
  test [dir|file]    Run *.test.rp test files (--json for machine output)
  install            Install robinpath to system PATH
  uninstall          Remove robinpath from system
  login              Sign in to RobinPath Cloud via browser
  logout             Remove stored credentials
  whoami             Show current user and account info
  publish [dir]      Publish a module to the registry
  sync               List your published modules

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
  Auth file:    ~/.robinpath/auth.json

For more: https://github.com/robinpath/robinpath-cli`);
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
  --diff         Show what would change (unified diff output)

  Without flags, formatted code is printed to stdout.

EXAMPLES:
  robinpath fmt app.rp            Print formatted code to stdout
  robinpath fmt -w app.rp         Format and overwrite file
  robinpath fmt --check app.rp    Check if formatted (CI mode)
  robinpath fmt --diff app.rp     Show diff of changes
  robinpath fmt -w src/           Format all .rp/.robin files in directory
  robinpath fmt --check .         Check all files in current directory`,

        check: `robinpath check — Syntax checker

USAGE:
  robinpath check <file> [--json]

DESCRIPTION:
  Parse a RobinPath script and report syntax errors without executing.
  Shows rich error context with line numbers and caret pointers.

FLAGS:
  --json         Output result as JSON (for AI agents and tooling)
                 Success: {"ok":true,"file":"app.rp"}
                 Error:   {"ok":false,"file":"app.rp","error":"...","line":5,"column":3}

EXIT CODES:
  0    No syntax errors
  2    Syntax error found

EXAMPLES:
  robinpath check app.rp          Check single file
  robinpath check app.rp --json   Machine-readable output
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
  robinpath test [dir|file] [--json]

DESCRIPTION:
  Discover and run *.test.rp test files. Uses the built-in 'test'
  module for assertions. Each test file runs in an isolated RobinPath
  instance. If any assertion fails, the file is marked FAIL.

  Without arguments, searches the current directory recursively.

FLAGS:
  --json         Output results as JSON (for AI agents and CI)
                 {"passed":1,"failed":1,"total":2,"duration_ms":42,
                  "results":[{"file":"...","status":"pass"},
                             {"file":"...","status":"fail","error":"..."}]}

EXIT CODES:
  0    All tests passed
  1    One or more tests failed

ASSERTIONS (test module):
  test.assert ($value)            Assert value is truthy
  test.assertEqual ($a) ($b)      Assert a equals b
  test.assertTrue ($value)        Assert value is true
  test.assertFalse ($value)       Assert value is false
  test.assertContains ($arr) ($v) Assert array contains value

EXAMPLES:
  robinpath test                  Run all tests in current dir
  robinpath test --json           Machine-readable results
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

        login: `robinpath login — Sign in to RobinPath Cloud

USAGE:
  robinpath login

DESCRIPTION:
  Opens your browser to sign in via GitHub or Google. After
  authentication, a long-lived token is stored in ~/.robinpath/auth.json.
  The token is valid for 30 days.

ENVIRONMENT:
  ROBINPATH_CLOUD_URL      Override the cloud app URL (default: https://robinpath.com)
  ROBINPATH_PLATFORM_URL   Override the platform API URL`,

        logout: `robinpath logout — Remove stored credentials

USAGE:
  robinpath logout

DESCRIPTION:
  Deletes the auth token stored in ~/.robinpath/auth.json.
  You will need to run 'robinpath login' again to use cloud features.`,

        whoami: `robinpath whoami — Show current user info

USAGE:
  robinpath whoami

DESCRIPTION:
  Shows your locally stored email and name, token expiry, and
  fetches your server profile (username, tier, role) if reachable.`,

        publish: `robinpath publish — Publish a module to the registry

USAGE:
  robinpath publish [dir]

DESCRIPTION:
  Pack the target directory (default: current dir) as a tarball and upload
  it to the RobinPath registry. Requires a package.json with "name" and
  "version" fields. Scoped packages (@scope/name) are supported.

  Maximum package size: 5MB.
  Excluded from tarball: node_modules, .git, dist

EXAMPLES:
  robinpath publish                   Publish current directory
  robinpath publish ./packages/uuid   Publish a specific package`,

        sync: `robinpath sync — List your published modules

USAGE:
  robinpath sync

DESCRIPTION:
  Fetches your published modules from the registry and displays
  them in a table with name, version, downloads, and visibility.`,
    };

    const page = helpPages[command];
    if (page) {
        console.log(page);
    } else {
        console.error(color.red('Error:') + ` Unknown command: ${command}`);
        console.error('Available commands: fmt, check, ast, test, install, uninstall, login, logout, whoami, publish, sync');
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

    // login
    if (command === 'login') {
        await handleLogin();
        return;
    }

    // logout
    if (command === 'logout') {
        handleLogout();
        return;
    }

    // whoami
    if (command === 'whoami') {
        await handleWhoami();
        return;
    }

    // publish [dir]
    if (command === 'publish') {
        await handlePublish(args.slice(1));
        return;
    }

    // sync
    if (command === 'sync') {
        await handleSync();
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

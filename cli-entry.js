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
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { RobinPath, ROBINPATH_VERSION, Parser, Printer, LineIndexImpl, formatErrorWithContext } from '@wiredwp/robinpath';

// Injected by esbuild at build time via --define, fallback for dev mode
const CLI_VERSION = typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : '1.36.0';

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

const MODULES_DIR = join(homedir(), '.robinpath', 'modules');
const MODULES_MANIFEST = join(MODULES_DIR, 'modules.json');
const CACHE_DIR = join(homedir(), '.robinpath', 'cache');

/** Convert Windows path to POSIX for tar commands */
function toTarPath(p) {
    if (process.platform !== 'win32') return p;
    // C:\Users\foo → /c/Users/foo
    return p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => '/' + d.toLowerCase());
}

/**
 * Check for newer versions on GitHub
 */
async function checkForUpdates() {
    try {
        const res = await fetch('https://api.github.com/repos/wiredwp/robinpath-cli/releases/latest');
        const data = await res.json();
        const latest = data.tag_name.replace('v', '');
        if (latest !== CLI_VERSION) {
            console.log(`\n${color.yellow('⚡')} New version available: ${color.green('v' + latest)} (you have v${CLI_VERSION})`);
            console.log(`   Run ${color.cyan('robinpath update')} to upgrade\n`);
        }
    } catch {
        // silently ignore update check failures
    }
}

/**
 * Update: re-run the install script for the current platform
 */
function handleUpdate() {
    const isWindows = platform() === 'win32';
    const env = { ...process.env, ROBINPATH_CURRENT_VERSION: CLI_VERSION };
    try {
        if (isWindows) {
            execSync('powershell -NoProfile -Command "irm https://dev.robinpath.com/install.ps1 | iex"', { stdio: 'inherit', env });
        } else {
            execSync('curl -fsSL https://dev.robinpath.com/install.sh | sh', { stdio: 'inherit', env });
        }
    } catch (err) {
        console.error(color.red('Update failed:') + ` ${err.message}`);
        process.exit(1);
    }
}

/**
 * Install: copy this exe to ~/.robinpath/bin and add to PATH
 */
function handleInstall() {
    const installDir = getInstallDir();
    const isWindows = platform() === 'win32';
    const exeName = isWindows ? 'robinpath.exe' : 'robinpath';
    const rpName = isWindows ? 'rp.exe' : 'rp';
    const dest = join(installDir, exeName);
    const rpDest = join(installDir, rpName);
    const src = process.execPath;

    // Already installed in the right place?
    if (resolve(src) === resolve(dest)) {
        log(`robinpath v${CLI_VERSION} is already installed.`);
        return;
    }

    // Create directory
    mkdirSync(installDir, { recursive: true });

    // Copy binary
    copyFileSync(src, dest);

    // Copy alias binary (rp)
    copyFileSync(src, rpDest);

    // Make executable on Unix
    if (!isWindows) {
        try {
            chmodSync(dest, 0o755);
            chmodSync(rpDest, 0o755);
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
    log(`Installed robinpath v${CLI_VERSION}`);
    log(`Location: ${dest}`);
    log(`Alias:    ${rpDest} (use "rp" as shorthand)`);
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
    const rp = await createRobinPath();
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

const CLOUD_URL = process.env.ROBINPATH_CLOUD_URL || 'https://dev.robinpath.com';
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

// ============================================================================
// Module management utilities
// ============================================================================

function readModulesManifest() {
    try {
        if (!existsSync(MODULES_MANIFEST)) return {};
        return JSON.parse(readFileSync(MODULES_MANIFEST, 'utf-8'));
    } catch {
        return {};
    }
}

function writeModulesManifest(manifest) {
    if (!existsSync(MODULES_DIR)) {
        mkdirSync(MODULES_DIR, { recursive: true });
    }
    writeFileSync(MODULES_MANIFEST, JSON.stringify(manifest, null, 2), 'utf-8');
}

function getModulePath(packageName) {
    // @robinpath/slack → ~/.robinpath/modules/@robinpath/slack
    return join(MODULES_DIR, ...packageName.split('/'));
}

function parsePackageSpec(spec) {
    if (!spec) return null;
    // Handle @scope/name@version or @scope/name or name@version or name
    let fullName, version = null;

    if (spec.startsWith('@')) {
        // Scoped: @scope/name@version
        const lastAt = spec.lastIndexOf('@');
        if (lastAt > 0 && spec.indexOf('/') < lastAt) {
            fullName = spec.slice(0, lastAt);
            version = spec.slice(lastAt + 1);
        } else {
            fullName = spec;
        }
    } else {
        // Unscoped: name@version
        const atIdx = spec.indexOf('@');
        if (atIdx > 0) {
            fullName = spec.slice(0, atIdx);
            version = spec.slice(atIdx + 1);
        } else {
            fullName = spec;
        }
    }

    // Parse scope and name
    let scope, name;
    if (fullName.startsWith('@') && fullName.includes('/')) {
        const parts = fullName.slice(1).split('/');
        scope = parts[0];
        name = parts.slice(1).join('/');
    } else {
        scope = null;
        name = fullName;
    }

    return { scope, name, fullName, version };
}

/**
 * Load all installed modules from ~/.robinpath/modules/ into a RobinPath instance
 */
async function loadInstalledModules(rp) {
    const manifest = readModulesManifest();
    const entries = Object.entries(manifest);
    if (entries.length === 0) return;

    for (const [packageName, info] of entries) {
        try {
            const modDir = getModulePath(packageName);
            // Read package.json to find entry point
            let entryPoint = 'dist/index.js';
            const pkgJsonPath = join(modDir, 'package.json');
            if (existsSync(pkgJsonPath)) {
                try {
                    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
                    if (pkg.main) entryPoint = pkg.main;
                } catch { /* use default */ }
            }

            const modulePath = join(modDir, entryPoint);
            if (!existsSync(modulePath)) {
                if (FLAG_VERBOSE) logVerbose(`Module ${packageName}: entry not found at ${entryPoint}, skipping`);
                continue;
            }

            const mod = await import(pathToFileURL(modulePath).href);
            const adapter = mod.default;

            if (!adapter || !adapter.name || !adapter.functions) {
                if (FLAG_VERBOSE) logVerbose(`Module ${packageName}: invalid ModuleAdapter, skipping`);
                continue;
            }

            // Register module using public API
            rp.registerModule(adapter.name, adapter.functions);
            if (adapter.functionMetadata) {
                rp.registerModuleMeta(adapter.name, adapter.functionMetadata);
            }
            if (adapter.moduleMetadata) {
                rp.registerModuleInfo(adapter.name, adapter.moduleMetadata);
            }

            // If global, also register functions without module prefix
            if (adapter.global === true) {
                for (const [funcName, handler] of Object.entries(adapter.functions)) {
                    rp.registerBuiltin(funcName, handler);
                }
            }

            if (FLAG_VERBOSE) logVerbose(`Loaded module: ${packageName}@${info.version}`);
        } catch (err) {
            // Never fatal — warn and continue
            console.error(color.yellow('Warning:') + ` Failed to load module ${packageName}: ${err.message}`);
        }
    }
}

/**
 * Create a RobinPath instance with all installed modules loaded
 */
async function createRobinPath(opts) {
    const rp = new RobinPath(opts);
    await loadInstalledModules(rp);
    return rp;
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

            // Generate a verification code the user can match in the browser
            const code = 'ROBIN-' + Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');
            const deviceName = require('os').hostname();
            const deviceOS = process.platform;

            const loginUrl = `${CLOUD_URL}/api/auth/cli?callback=${encodeURIComponent(callbackUrl)}&code=${encodeURIComponent(code)}&device=${encodeURIComponent(deviceName)}&os=${encodeURIComponent(deviceOS)}`;

            log('Opening browser to sign in...');
            log('');
            log(`  Verification code: ${color.cyan(code)}`);
            log(`  Device: ${color.dim(deviceName)} (${color.dim(deviceOS)})`);
            log('');
            log(color.dim('Confirm this code matches in your browser.'));
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

    if (auth.expiresAt) {
        const msLeft = auth.expiresAt * 1000 - Date.now();
        const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((msLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const expiryDate = new Date(auth.expiresAt * 1000).toLocaleDateString();
        const remaining = daysLeft > 0 ? `${daysLeft}d ${hoursLeft}h remaining` : `${hoursLeft}h remaining`;
        log(`  Expires: ${expiryDate} (${remaining})`);
    } else {
        log(`  Expires: ${color.dim('(unknown)')}`);
    }

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
    const isDryRun = args.includes('--dry-run');
    const targetArg = args.find(a => !a.startsWith('-') && !a.startsWith('--org')) || '.';
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

    // Auto version bump
    if (args.includes('--patch') || args.includes('--minor') || args.includes('--major')) {
        const [major, minor, patch] = pkg.version.split('.').map(Number);
        if (args.includes('--major')) pkg.version = `${major + 1}.0.0`;
        else if (args.includes('--minor')) pkg.version = `${major}.${minor + 1}.0`;
        else pkg.version = `${major}.${minor}.${patch + 1}`;
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
        log(`Bumped version to ${color.cyan(pkg.version)}`);
    }

    // Determine visibility
    let visibility = 'public';
    if (args.includes('--private')) {
        visibility = 'private';
    } else if (args.includes('--public')) {
        visibility = 'public';
    } else {
        const orgIdx = args.indexOf('--org');
        if (orgIdx !== -1 && args[orgIdx + 1]) {
            visibility = `org:${args[orgIdx + 1]}`;
        }
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

    log(`Packing @${scope}/${name}@${pkg.version} (${visibility})...`);

    try {
        execSync(
            `tar czf "${toTarPath(tmpFile)}" --exclude=node_modules --exclude=.git --exclude=dist -C "${toTarPath(parentDir)}" "${dirName}"`,
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

    // Dry run — stop here
    if (isDryRun) {
        unlinkSync(tmpFile);
        log('');
        log(color.yellow('Dry run') + ` — would publish @${scope}/${name}@${pkg.version} as ${visibility}`);
        return;
    }

    // Upload
    try {
        const headers = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/gzip',
            'X-Package-Version': pkg.version,
            'X-Package-Visibility': visibility,
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
            log(color.green('Published') + ` @${scope}/${name}@${pkg.version} (${visibility})`);
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
// Module management commands
// ============================================================================

/**
 * robinpath add <pkg>[@version] — Install a module from the registry
 */
async function handleAdd(args) {
    const spec = args.find(a => !a.startsWith('-'));
    if (!spec) {
        console.error(color.red('Error:') + ' Usage: robinpath add <module>[@version]');
        console.error('  Example: robinpath add @robinpath/slack');
        process.exit(2);
    }

    const parsed = parsePackageSpec(spec);
    if (!parsed || !parsed.name) {
        console.error(color.red('Error:') + ` Invalid package name: ${spec}`);
        process.exit(2);
    }

    const { scope, name, fullName, version } = parsed;
    if (!scope) {
        console.error(color.red('Error:') + ' Module must be scoped (e.g. @robinpath/slack)');
        process.exit(2);
    }

    const token = requireAuth();

    // Check if already installed
    const manifest = readModulesManifest();
    if (manifest[fullName] && !args.includes('--force')) {
        const current = manifest[fullName].version;
        if (version && version === current) {
            log(`${fullName}@${current} is already installed.`);
            return;
        }
        if (!version) {
            log(color.dim(`Reinstalling ${fullName} (currently ${current})...`));
        }
    }

    // Download tarball from registry
    const versionQuery = version ? `?version=${encodeURIComponent(version)}` : '';
    log(`Installing ${fullName}${version ? '@' + version : ''}...`);

    let tarballBuffer;
    try {
        const res = await fetch(`${PLATFORM_URL}/v1/registry/${scope}/${name}/download${versionQuery}`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
            if (res.status === 404) {
                console.error(color.red('Error:') + ` Module not found: ${fullName}`);
            } else if (res.status === 401 || res.status === 403) {
                console.error(color.red('Error:') + ' Access denied. You may not have permission to install this module.');
            } else {
                const body = await res.json().catch(() => ({}));
                console.error(color.red('Error:') + ` Failed to download: ${body?.error?.message || 'HTTP ' + res.status}`);
            }
            process.exit(1);
        }

        tarballBuffer = Buffer.from(await res.arrayBuffer());
    } catch (err) {
        console.error(color.red('Error:') + ` Could not reach registry: ${err.message}`);
        process.exit(1);
    }

    // Compute integrity hash
    const integrity = 'sha256-' + createHash('sha256').update(tarballBuffer).digest('hex');

    // Cache tarball
    if (!existsSync(CACHE_DIR)) {
        mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cacheFile = join(CACHE_DIR, `${scope}-${name}-${version || 'latest'}.tar.gz`);
    writeFileSync(cacheFile, tarballBuffer);

    // Extract to modules dir
    const modDir = getModulePath(fullName);
    if (existsSync(modDir)) {
        rmSync(modDir, { recursive: true, force: true });
    }
    mkdirSync(modDir, { recursive: true });

    // Write tarball to temp, extract
    const tmpFile = join(tmpdir(), `robinpath-add-${Date.now()}.tar.gz`);
    writeFileSync(tmpFile, tarballBuffer);

    try {
        execSync(`tar xzf "${toTarPath(tmpFile)}" --strip-components=1 -C "${toTarPath(modDir)}"`, { stdio: 'pipe' });
    } catch (err) {
        // Clean up on failure
        rmSync(modDir, { recursive: true, force: true });
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
        console.error(color.red('Error:') + ` Failed to extract module: ${err.message}`);
        process.exit(1);
    }

    try { unlinkSync(tmpFile); } catch { /* ignore */ }

    // Read extracted package.json for version info
    let installedVersion = version || 'unknown';
    const pkgJsonPath = join(modDir, 'package.json');
    if (existsSync(pkgJsonPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
            installedVersion = pkg.version || installedVersion;
        } catch { /* ignore */ }
    }

    // Check for module dependencies
    if (existsSync(pkgJsonPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
            const depends = pkg.robinpath?.depends || [];
            for (const dep of depends) {
                if (!manifest[dep]) {
                    log(color.dim(`  Installing dependency: ${dep}`));
                    await handleAdd([dep]);
                }
            }
        } catch { /* ignore dependency errors */ }
    }

    // Update manifest
    const updatedManifest = readModulesManifest();
    updatedManifest[fullName] = {
        version: installedVersion,
        integrity,
        installedAt: new Date().toISOString(),
    };
    writeModulesManifest(updatedManifest);

    // Update robinpath.json if it exists in cwd
    const projectFile = resolve('robinpath.json');
    if (existsSync(projectFile)) {
        try {
            const config = JSON.parse(readFileSync(projectFile, 'utf-8'));
            if (!config.modules) config.modules = {};
            config.modules[fullName] = `^${installedVersion}`;
            writeFileSync(projectFile, JSON.stringify(config, null, 2) + '\n', 'utf-8');
        } catch { /* ignore project file errors */ }
    }

    log(color.green('Installed') + ` ${fullName}@${installedVersion}`);
}

/**
 * robinpath remove <pkg> — Uninstall a module
 */
async function handleRemove(args) {
    const spec = args.find(a => !a.startsWith('-'));
    if (!spec) {
        console.error(color.red('Error:') + ' Usage: robinpath remove <module>');
        console.error('  Example: robinpath remove @robinpath/slack');
        process.exit(2);
    }

    const parsed = parsePackageSpec(spec);
    if (!parsed || !parsed.fullName) {
        console.error(color.red('Error:') + ` Invalid package name: ${spec}`);
        process.exit(2);
    }

    const { fullName } = parsed;
    const manifest = readModulesManifest();

    if (!manifest[fullName]) {
        console.error(color.red('Error:') + ` Module not installed: ${fullName}`);
        process.exit(1);
    }

    // Remove module directory
    const modDir = getModulePath(fullName);
    if (existsSync(modDir)) {
        rmSync(modDir, { recursive: true, force: true });
    }

    // Clean up empty parent scope directory
    const scopeDir = dirname(modDir);
    try {
        const remaining = readdirSync(scopeDir);
        if (remaining.length === 0) {
            rmSync(scopeDir, { recursive: true, force: true });
        }
    } catch { /* ignore */ }

    // Update manifest
    delete manifest[fullName];
    writeModulesManifest(manifest);

    // Update robinpath.json if it exists in cwd
    const projectFile = resolve('robinpath.json');
    if (existsSync(projectFile)) {
        try {
            const config = JSON.parse(readFileSync(projectFile, 'utf-8'));
            if (config.modules && config.modules[fullName]) {
                delete config.modules[fullName];
                writeFileSync(projectFile, JSON.stringify(config, null, 2) + '\n', 'utf-8');
            }
        } catch { /* ignore project file errors */ }
    }

    log(color.green('Removed') + ` ${fullName}`);
}

/**
 * robinpath upgrade <pkg> — Upgrade a single module to the latest version
 */
async function handleUpgrade(args) {
    const spec = args.find(a => !a.startsWith('-'));
    if (!spec) {
        console.error(color.red('Error:') + ' Usage: robinpath upgrade <module>');
        console.error('  Example: robinpath upgrade @robinpath/slack');
        process.exit(2);
    }

    const parsed = parsePackageSpec(spec);
    if (!parsed || !parsed.fullName || !parsed.scope) {
        console.error(color.red('Error:') + ` Invalid package name: ${spec}`);
        process.exit(2);
    }

    const { fullName, scope, name } = parsed;
    const manifest = readModulesManifest();

    if (!manifest[fullName]) {
        console.error(color.red('Error:') + ` Module not installed: ${fullName}. Use ${color.cyan('robinpath add ' + fullName)} first.`);
        process.exit(1);
    }

    const currentVersion = manifest[fullName].version;
    log(`Checking for updates to ${fullName}@${currentVersion}...`);

    // Check latest version from registry
    try {
        const token = requireAuth();
        const res = await fetch(`${PLATFORM_URL}/v1/registry/${scope}/${name}`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
            console.error(color.red('Error:') + ` Could not check registry (HTTP ${res.status})`);
            process.exit(1);
        }

        const body = await res.json();
        const data = body.data || body;
        const latestVersion = data.latestVersion || data.version;

        if (latestVersion === currentVersion) {
            log(color.green('Already up to date') + ` ${fullName}@${currentVersion}`);
            return;
        }

        log(`Upgrading ${fullName}: ${currentVersion} → ${latestVersion}`);
        await handleAdd([fullName, '--force']);
    } catch (err) {
        console.error(color.red('Error:') + ` Upgrade failed: ${err.message}`);
        process.exit(1);
    }
}

/**
 * robinpath modules list — List installed modules
 */
async function handleModulesList() {
    const manifest = readModulesManifest();
    const entries = Object.entries(manifest);

    if (entries.length === 0) {
        log('No modules installed.');
        log(`Run ${color.cyan('robinpath add <module>')} to install your first module.`);
        return;
    }

    log(color.bold('  Name'.padEnd(40) + 'Version'.padEnd(14) + 'Installed'));
    log(color.dim('  ' + '─'.repeat(62)));

    for (const [name, info] of entries) {
        const date = info.installedAt ? info.installedAt.split('T')[0] : '-';
        log(`  ${name.padEnd(38)}${(info.version || '-').padEnd(14)}${date}`);
    }

    log('');
    log(color.dim(`${entries.length} module${entries.length !== 1 ? 's' : ''} installed`));
}

/**
 * robinpath modules upgrade — Upgrade all installed modules
 */
async function handleModulesUpgradeAll() {
    const manifest = readModulesManifest();
    const entries = Object.entries(manifest);

    if (entries.length === 0) {
        log('No modules installed.');
        return;
    }

    log(`Checking ${entries.length} module${entries.length !== 1 ? 's' : ''} for updates...\n`);

    let upgraded = 0;
    let upToDate = 0;
    let failed = 0;

    for (const [fullName, info] of entries) {
        const parsed = parsePackageSpec(fullName);
        if (!parsed || !parsed.scope) {
            failed++;
            continue;
        }

        try {
            const token = getAuthToken();
            if (!token) {
                console.error(color.red('Error:') + ' Not logged in. Run ' + color.cyan('robinpath login'));
                process.exit(1);
            }

            const res = await fetch(`${PLATFORM_URL}/v1/registry/${parsed.scope}/${parsed.name}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                log(color.yellow('Skip') + `  ${fullName} (registry error)`);
                failed++;
                continue;
            }

            const body = await res.json();
            const data = body.data || body;
            const latestVersion = data.latestVersion || data.version;

            if (latestVersion === info.version) {
                log(color.green('  ✓') + `  ${fullName}@${info.version} (up to date)`);
                upToDate++;
            } else {
                log(color.cyan('  ↑') + `  ${fullName}: ${info.version} → ${latestVersion}`);
                await handleAdd([fullName, '--force']);
                upgraded++;
            }
        } catch (err) {
            log(color.yellow('Skip') + `  ${fullName} (${err.message})`);
            failed++;
        }
    }

    log('');
    const parts = [];
    if (upgraded > 0) parts.push(color.green(`${upgraded} upgraded`));
    if (upToDate > 0) parts.push(`${upToDate} up to date`);
    if (failed > 0) parts.push(color.yellow(`${failed} failed`));
    log(parts.join(', '));
}

/**
 * robinpath modules init — Scaffold a new RobinPath module
 */
async function handleModulesInit() {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q, def) => new Promise(resolve => {
        const prompt = def ? `${q} (${def}): ` : `${q}: `;
        rl.question(prompt, answer => resolve(answer.trim() || def || ''));
    });

    log('');
    log(color.bold('  Create a new RobinPath module'));
    log(color.dim('  ' + '─'.repeat(35)));
    log('');

    const moduleName = await ask('  Module name');
    if (!moduleName) {
        console.error(color.red('Error:') + ' Module name is required');
        rl.close();
        process.exit(2);
    }

    const displayName = await ask('  Display name', moduleName.charAt(0).toUpperCase() + moduleName.slice(1));
    const description = await ask('  Description', `${displayName} integration for RobinPath`);

    log('');
    log(color.dim('  Categories: api, messaging, crm, ai, database, storage, analytics, dev-tools, utilities'));
    const category = await ask('  Category', 'utilities');

    // Auto-fill author from auth
    const auth = readAuth();
    const defaultAuthor = auth?.email || '';
    const author = await ask('  Author', defaultAuthor);
    const license = await ask('  License', 'MIT');

    const defaultScope = auth?.email?.split('@')[0] || 'robinpath';
    const scope = await ask('  Scope', defaultScope);

    rl.close();

    const fullName = `@${scope}/${moduleName}`;
    const pascalName = moduleName.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());
    const targetDir = resolve(moduleName);

    log('');
    log(`Creating ${color.cyan(fullName)}...`);

    if (existsSync(targetDir)) {
        console.error(color.red('Error:') + ` Directory already exists: ${moduleName}/`);
        process.exit(1);
    }

    // Create directories
    mkdirSync(join(targetDir, 'src'), { recursive: true });
    mkdirSync(join(targetDir, 'tests'), { recursive: true });

    // package.json
    writeFileSync(join(targetDir, 'package.json'), JSON.stringify({
        name: fullName,
        version: '0.1.0',
        description,
        author,
        license,
        type: 'module',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        exports: { '.': { import: './dist/index.js', types: './dist/index.d.ts' } },
        files: ['dist'],
        scripts: { build: 'tsc', test: `robinpath test tests/` },
        robinpath: { category, displayName },
        peerDependencies: { '@wiredwp/robinpath': '>=1.30.0' },
        devDependencies: { '@wiredwp/robinpath': '^0.30.1', typescript: '^5.6.0' },
    }, null, 2) + '\n', 'utf-8');

    // src/index.ts
    writeFileSync(join(targetDir, 'src', 'index.ts'), `import type { ModuleAdapter } from "@wiredwp/robinpath";
import {
  ${pascalName}Functions,
  ${pascalName}FunctionMetadata,
  ${pascalName}ModuleMetadata,
} from "./${moduleName}.js";

const ${pascalName}Module: ModuleAdapter = {
  name: "${moduleName}",
  functions: ${pascalName}Functions,
  functionMetadata: ${pascalName}FunctionMetadata,
  moduleMetadata: ${pascalName}ModuleMetadata,
  global: false,
};

export default ${pascalName}Module;
export { ${pascalName}Module };
`, 'utf-8');

    // src/<name>.ts
    writeFileSync(join(targetDir, 'src', `${moduleName}.ts`), `import type {
  BuiltinHandler,
  FunctionMetadata,
  ModuleMetadata,
} from "@wiredwp/robinpath";

// ─── Functions ─────────────────────────────────────────

const hello: BuiltinHandler = (args) => {
  const name = String(args[0] ?? "world");
  return \`Hello from ${moduleName}: \${name}\`;
};

const configure: BuiltinHandler = (args) => {
  const apiKey = String(args[0] ?? "");
  if (!apiKey) throw new Error("API key is required");
  return { configured: true };
};

// ─── Exports ───────────────────────────────────────────

export const ${pascalName}Functions: Record<string, BuiltinHandler> = {
  hello,
  configure,
};

export const ${pascalName}FunctionMetadata: Record<string, FunctionMetadata> = {
  hello: {
    description: "Say hello",
    parameters: [
      {
        name: "name",
        dataType: "string",
        description: "Name to greet",
        formInputType: "text",
        required: false,
        defaultValue: "world",
      },
    ],
    returnType: "string",
    returnDescription: "Greeting message",
    example: '${moduleName}.hello "Alice"',
  },
  configure: {
    description: "Configure API credentials",
    parameters: [
      {
        name: "apiKey",
        dataType: "string",
        description: "Your API key",
        formInputType: "password",
        required: true,
      },
    ],
    returnType: "object",
    returnDescription: "{ configured: true }",
    example: '${moduleName}.configure "your-api-key"',
  },
};

export const ${pascalName}ModuleMetadata: ModuleMetadata = {
  description: "${description}",
  methods: ["hello", "configure"],
  author: "${author}",
  category: "${category}",
};
`, 'utf-8');

    // tsconfig.json
    writeFileSync(join(targetDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
            target: 'ES2022',
            module: 'ES2022',
            moduleResolution: 'node16',
            declaration: true,
            declarationMap: true,
            sourceMap: true,
            outDir: 'dist',
            rootDir: 'src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
        },
        include: ['src'],
    }, null, 2) + '\n', 'utf-8');

    // tests/<name>.test.rp
    writeFileSync(join(targetDir, 'tests', `${moduleName}.test.rp`), `# ${displayName} module tests
# Run: robinpath test tests/

@desc "hello returns greeting"
do
  ${moduleName}.hello "Alice" into $result
  test.assertContains $result "Alice"
enddo

@desc "hello defaults to world"
do
  ${moduleName}.hello into $result
  test.assertContains $result "world"
enddo
`, 'utf-8');

    // README.md
    writeFileSync(join(targetDir, 'README.md'), `# ${fullName}

${description}

## Install

\`\`\`bash
robinpath add ${fullName}
\`\`\`

## Usage

\`\`\`robinpath
# Configure credentials
${moduleName}.configure "your-api-key"

# Say hello
${moduleName}.hello "Alice"
log $
\`\`\`

## Functions

| Function | Description |
|----------|-------------|
| \`configure\` | Configure API credentials |
| \`hello\` | Say hello |

## Development

\`\`\`bash
npm install
npm run build
robinpath test tests/
\`\`\`

## License

${license}
`, 'utf-8');

    // .gitignore
    writeFileSync(join(targetDir, '.gitignore'), `node_modules/
dist/
*.tgz
`, 'utf-8');

    log('');
    log(color.green('Generated:'));
    log(`  ${moduleName}/`);
    log(`  ├── package.json`);
    log(`  ├── src/`);
    log(`  │   ├── index.ts`);
    log(`  │   └── ${moduleName}.ts`);
    log(`  ├── tests/`);
    log(`  │   └── ${moduleName}.test.rp`);
    log(`  ├── tsconfig.json`);
    log(`  ├── README.md`);
    log(`  └── .gitignore`);
    log('');
    log(color.bold('Next steps:'));
    log(`  1. cd ${moduleName}`);
    log(`  2. Edit src/${moduleName}.ts — add your functions`);
    log(`  3. npm install && npm run build`);
    log(`  4. robinpath publish`);
    log('');
}

/**
 * robinpath pack — Create tarball locally without publishing
 */
async function handlePack(args) {
    const targetArg = args.find(a => !a.startsWith('-')) || '.';
    const targetDir = resolve(targetArg);

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

    if (!pkg.name || !pkg.version) {
        console.error(color.red('Error:') + ' package.json must have "name" and "version" fields');
        process.exit(2);
    }

    const safeName = pkg.name.replace(/^@/, '').replace(/\//g, '-');
    const outputFile = `${safeName}-${pkg.version}.tar.gz`;
    const outputPath = resolve(outputFile);
    const parentDir = dirname(targetDir);
    const dirName = basename(targetDir);

    log(`Packing ${pkg.name}@${pkg.version}...`);

    try {
        execSync(
            `tar czf "${toTarPath(outputPath)}" --exclude=node_modules --exclude=.git --exclude=dist --exclude="*.tar.gz" -C "${toTarPath(parentDir)}" "${dirName}"`,
            { stdio: 'pipe' }
        );
    } catch (err) {
        // tar may exit 1 with "file changed as we read it" — check if tarball was created
        if (!existsSync(outputPath)) {
            console.error(color.red('Error:') + ` Failed to create tarball: ${err.message}`);
            process.exit(1);
        }
    }

    const size = statSync(outputPath).size;
    log(color.green('Created') + ` ${outputFile} (${(size / 1024).toFixed(1)}KB)`);
}

/**
 * robinpath search <query> — Search the module registry
 */
async function handleSearch(args) {
    const query = args.filter(a => !a.startsWith('-')).join(' ');
    if (!query) {
        console.error(color.red('Error:') + ' Usage: robinpath search <query>');
        console.error('  Example: robinpath search slack');
        process.exit(2);
    }

    const category = args.find(a => a.startsWith('--category='))?.split('=')[1];
    const token = getAuthToken();

    log(`Searching for "${query}"...\n`);

    try {
        let url = `${PLATFORM_URL}/v1/registry/search?q=${encodeURIComponent(query)}`;
        if (category) url += `&category=${encodeURIComponent(category)}`;

        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(url, { headers });
        if (!res.ok) {
            console.error(color.red('Error:') + ` Search failed (HTTP ${res.status})`);
            process.exit(1);
        }

        const body = await res.json();
        const modules = body.data || body.modules || [];

        if (modules.length === 0) {
            log('No modules found.');
            return;
        }

        log(color.bold('  Name'.padEnd(35) + 'Version'.padEnd(10) + 'Description'));
        log(color.dim('  ' + '─'.repeat(72)));

        for (const mod of modules) {
            const modName = (mod.scope ? `@${mod.scope}/${mod.name}` : mod.name) || mod.id || '?';
            const ver = mod.version || mod.latestVersion || '-';
            const desc = (mod.description || '').slice(0, 35);
            log(`  ${modName.padEnd(33)}${ver.padEnd(10)}${color.dim(desc)}`);
        }

        log('');
        log(color.dim(`${modules.length} result${modules.length !== 1 ? 's' : ''}`));
    } catch (err) {
        console.error(color.red('Error:') + ` Search failed: ${err.message}`);
        process.exit(1);
    }
}

/**
 * robinpath info <pkg> — Show module details
 */
async function handleInfo(args) {
    const spec = args.find(a => !a.startsWith('-'));
    if (!spec) {
        console.error(color.red('Error:') + ' Usage: robinpath info <module>');
        console.error('  Example: robinpath info @robinpath/slack');
        process.exit(2);
    }

    const parsed = parsePackageSpec(spec);
    if (!parsed || !parsed.scope) {
        console.error(color.red('Error:') + ` Invalid package name: ${spec}`);
        process.exit(2);
    }

    const { scope, name, fullName } = parsed;
    const token = getAuthToken();

    try {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${PLATFORM_URL}/v1/registry/${scope}/${name}`, { headers });
        if (!res.ok) {
            if (res.status === 404) {
                console.error(color.red('Error:') + ` Module not found: ${fullName}`);
            } else {
                console.error(color.red('Error:') + ` Failed to fetch info (HTTP ${res.status})`);
            }
            process.exit(1);
        }

        const body = await res.json();
        const data = body.data || body;

        log('');
        log(`  ${color.bold(fullName)} ${color.cyan('v' + (data.latestVersion || data.version || '-'))}`);
        if (data.description) log(`  ${data.description}`);
        log('');
        if (data.author) log(`  Author:      ${data.author}`);
        if (data.license) log(`  License:     ${data.license}`);
        if (data.category) log(`  Category:    ${data.category}`);
        const downloads = data.downloads ?? data.downloadCount;
        if (downloads !== undefined) log(`  Downloads:   ${downloads}`);
        const visibility = data.visibility || (data.isPublic === false ? 'private' : 'public');
        log(`  Visibility:  ${visibility}`);
        if (data.keywords?.length) log(`  Keywords:    ${data.keywords.join(', ')}`);
        log('');

        // Show installed status
        const manifest = readModulesManifest();
        if (manifest[fullName]) {
            log(`  ${color.green('Installed')} v${manifest[fullName].version}`);
        } else {
            log(`  ${color.cyan('robinpath add ' + fullName)}`);
        }
        log('');
    } catch (err) {
        console.error(color.red('Error:') + ` Failed to fetch info: ${err.message}`);
        process.exit(1);
    }
}

// ============================================================================
// Project & Environment commands
// ============================================================================

/**
 * robinpath init — Create a robinpath.json project config
 */
async function handleInit(args) {
    const projectFile = resolve('robinpath.json');
    if (existsSync(projectFile) && !args.includes('--force')) {
        console.error(color.red('Error:') + ' robinpath.json already exists. Use --force to overwrite.');
        process.exit(1);
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q, def) => new Promise(resolve => {
        const prompt = def ? `${q} (${def}): ` : `${q}: `;
        rl.question(prompt, answer => resolve(answer.trim() || def || ''));
    });

    log('');
    log(color.bold('  Create a new RobinPath project'));
    log(color.dim('  ' + '─'.repeat(35)));
    log('');

    const dirName = basename(process.cwd());
    const projectName = await ask('  Project name', dirName);
    const description = await ask('  Description', '');
    const auth = readAuth();
    const author = await ask('  Author', auth?.email || '');
    const mainFile = await ask('  Entry file', 'main.rp');

    rl.close();

    const config = {
        name: projectName,
        version: '1.0.0',
        description,
        author,
        main: mainFile,
        modules: {},
        env: {},
    };

    writeFileSync(projectFile, JSON.stringify(config, null, 2) + '\n', 'utf-8');

    // Create main.rp if it doesn't exist
    const mainPath = resolve(mainFile);
    if (!existsSync(mainPath)) {
        writeFileSync(mainPath, `# ${projectName}
# Run: robinpath ${mainFile}

log "Hello from RobinPath!"
`, 'utf-8');
    }

    // Create .env if it doesn't exist
    if (!existsSync(resolve('.env'))) {
        writeFileSync(resolve('.env'), `# Add your secrets here
# SLACK_TOKEN=xoxb-...
# OPENAI_KEY=sk-...
`, 'utf-8');
    }

    // Create .gitignore if it doesn't exist
    if (!existsSync(resolve('.gitignore'))) {
        writeFileSync(resolve('.gitignore'), `.env
.robinpath/
node_modules/
`, 'utf-8');
    }

    log('');
    log(color.green('Created project:'));
    log(`  robinpath.json`);
    if (!existsSync(mainPath)) log(`  ${mainFile}`);
    log(`  .env`);
    log(`  .gitignore`);
    log('');
    log(`Run: ${color.cyan('robinpath ' + mainFile)}`);
    log('');
}

/**
 * robinpath install — Install all modules from robinpath.json
 */
async function handleProjectInstall() {
    const projectFile = resolve('robinpath.json');
    if (!existsSync(projectFile)) {
        // Fall back to system install if no robinpath.json
        handleInstall();
        return;
    }

    let config;
    try {
        config = JSON.parse(readFileSync(projectFile, 'utf-8'));
    } catch (err) {
        console.error(color.red('Error:') + ` Invalid robinpath.json: ${err.message}`);
        process.exit(2);
    }

    const modules = config.modules || {};
    const entries = Object.entries(modules);

    if (entries.length === 0) {
        log('No modules specified in robinpath.json.');
        log(`Use ${color.cyan('robinpath add <module>')} to add modules.`);
        return;
    }

    log(`Installing ${entries.length} module${entries.length !== 1 ? 's' : ''} from robinpath.json...\n`);

    const manifest = readModulesManifest();
    let installed = 0;
    let skipped = 0;
    let failed = 0;

    for (const [name, versionSpec] of entries) {
        // Check if already installed with matching version
        if (manifest[name]) {
            const current = manifest[name].version;
            // Simple check: if version spec starts with ^ or ~, accept if installed
            if (versionSpec.startsWith('^') || versionSpec.startsWith('~')) {
                log(color.green('  ✓') + `  ${name}@${current} (already installed)`);
                skipped++;
                continue;
            }
            if (current === versionSpec) {
                log(color.green('  ✓') + `  ${name}@${current} (already installed)`);
                skipped++;
                continue;
            }
        }

        try {
            // Extract exact version from spec (strip ^ or ~)
            const version = versionSpec.replace(/^[\^~]/, '');
            await handleAdd([`${name}@${version}`]);
            installed++;
        } catch (err) {
            log(color.red('  ✗') + `  ${name}: ${err.message}`);
            failed++;
        }
    }

    // Generate lock file
    const lockFile = resolve('robinpath-lock.json');
    const updatedManifest = readModulesManifest();
    const lockData = {};
    for (const [name] of entries) {
        if (updatedManifest[name]) {
            lockData[name] = {
                version: updatedManifest[name].version,
                integrity: updatedManifest[name].integrity,
            };
        }
    }
    writeFileSync(lockFile, JSON.stringify(lockData, null, 2) + '\n', 'utf-8');

    log('');
    const parts = [];
    if (installed > 0) parts.push(color.green(`${installed} installed`));
    if (skipped > 0) parts.push(`${skipped} already installed`);
    if (failed > 0) parts.push(color.red(`${failed} failed`));
    log(parts.join(', '));
    log(color.dim('Lock file written: robinpath-lock.json'));
}

/**
 * robinpath doctor — Diagnose environment
 */
async function handleDoctor() {
    log('');
    log(color.bold('  RobinPath Doctor'));
    log(color.dim('  ' + '─'.repeat(35)));
    log('');

    let issues = 0;

    // CLI version
    log(color.green('  ✓') + ` CLI version ${CLI_VERSION} (lang ${ROBINPATH_VERSION})`);

    // Install location
    const installDir = getInstallDir();
    const isWindows = platform() === 'win32';
    const binaryName = isWindows ? 'robinpath.exe' : 'robinpath';
    if (existsSync(join(installDir, binaryName))) {
        log(color.green('  ✓') + ` Installed: ${installDir}`);
    } else {
        log(color.yellow('  !') + ` Not installed to PATH. Run ${color.cyan('robinpath install')}`);
        issues++;
    }

    // Auth
    const auth = readAuth();
    const token = getAuthToken();
    if (token) {
        log(color.green('  ✓') + ` Logged in as ${auth.email || auth.name || 'unknown'}`);
        if (auth.expiresAt) {
            const remaining = Math.floor((auth.expiresAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
            if (remaining < 7) {
                log(color.yellow('  !') + ` Session expires in ${remaining} day${remaining !== 1 ? 's' : ''}`);
                issues++;
            }
        }
    } else {
        log(color.yellow('  !') + ` Not logged in. Run ${color.cyan('robinpath login')}`);
        issues++;
    }

    // Modules directory
    const manifest = readModulesManifest();
    const moduleCount = Object.keys(manifest).length;
    if (moduleCount > 0) {
        log(color.green('  ✓') + ` ${moduleCount} module${moduleCount !== 1 ? 's' : ''} installed`);

        // Check each module is valid
        for (const [name, info] of Object.entries(manifest)) {
            const modDir = getModulePath(name);
            const pkgPath = join(modDir, 'package.json');
            if (!existsSync(modDir)) {
                log(color.red('  ✗') + `   ${name}: directory missing`);
                issues++;
            } else if (!existsSync(pkgPath)) {
                log(color.red('  ✗') + `   ${name}: package.json missing`);
                issues++;
            } else {
                // Check entry point exists
                let entryPoint = 'dist/index.js';
                try {
                    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
                    if (pkg.main) entryPoint = pkg.main;
                } catch { /* use default */ }
                if (!existsSync(join(modDir, entryPoint))) {
                    log(color.red('  ✗') + `   ${name}: entry point ${entryPoint} missing`);
                    issues++;
                }
            }
        }
    } else {
        log(color.dim('  -') + ` No modules installed`);
    }

    // Project config
    const projectFile = resolve('robinpath.json');
    if (existsSync(projectFile)) {
        try {
            const config = JSON.parse(readFileSync(projectFile, 'utf-8'));
            log(color.green('  ✓') + ` Project: ${config.name || 'unnamed'} v${config.version || '?'}`);

            // Check if project modules are all installed
            const projectModules = Object.keys(config.modules || {});
            for (const mod of projectModules) {
                if (!manifest[mod]) {
                    log(color.red('  ✗') + `   Missing module: ${mod} (run ${color.cyan('robinpath install')})`);
                    issues++;
                }
            }
        } catch {
            log(color.red('  ✗') + ' Invalid robinpath.json');
            issues++;
        }
    }

    // Cache
    if (existsSync(CACHE_DIR)) {
        try {
            const cacheFiles = readdirSync(CACHE_DIR);
            const cacheSize = cacheFiles.reduce((total, f) => {
                try { return total + statSync(join(CACHE_DIR, f)).size; } catch { return total; }
            }, 0);
            log(color.dim('  -') + ` Cache: ${cacheFiles.length} files (${(cacheSize / 1024).toFixed(0)}KB)`);
        } catch { /* ignore */ }
    }

    log('');
    if (issues === 0) {
        log(color.green('  No issues found.'));
    } else {
        log(color.yellow(`  ${issues} issue${issues !== 1 ? 's' : ''} found.`));
    }
    log('');
}

/**
 * robinpath env set|list|remove — Manage environment secrets
 */
async function handleEnv(args) {
    const envPath = join(getRobinPathHome(), 'env');
    const sub = args[0];

    function readEnvFile() {
        try {
            if (!existsSync(envPath)) return {};
            const lines = readFileSync(envPath, 'utf-8').split('\n');
            const env = {};
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx > 0) {
                    env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
                }
            }
            return env;
        } catch {
            return {};
        }
    }

    function writeEnvFile(env) {
        const dir = getRobinPathHome();
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const content = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
        writeFileSync(envPath, content, 'utf-8');
        if (platform() !== 'win32') {
            try { chmodSync(envPath, 0o600); } catch { /* ignore */ }
        }
    }

    if (sub === 'set') {
        const key = args[1];
        const value = args.slice(2).join(' ');
        if (!key) {
            console.error(color.red('Error:') + ' Usage: robinpath env set <KEY> <value>');
            process.exit(2);
        }
        const env = readEnvFile();
        env[key] = value;
        writeEnvFile(env);
        log(color.green('Set') + ` ${key}`);
    } else if (sub === 'list') {
        const env = readEnvFile();
        const entries = Object.entries(env);
        if (entries.length === 0) {
            log('No environment variables set.');
            log(`Use ${color.cyan('robinpath env set <KEY> <value>')} to add one.`);
            return;
        }
        log('');
        log(color.bold('  Environment variables:'));
        log(color.dim('  ' + '─'.repeat(40)));
        for (const [key, value] of entries) {
            const masked = value.length > 4 ? value.slice(0, 2) + '•'.repeat(Math.min(value.length - 4, 20)) + value.slice(-2) : '••••';
            log(`  ${key.padEnd(25)} ${color.dim(masked)}`);
        }
        log('');
        log(color.dim(`${entries.length} variable${entries.length !== 1 ? 's' : ''}`));
        log('');
    } else if (sub === 'remove' || sub === 'delete') {
        const key = args[1];
        if (!key) {
            console.error(color.red('Error:') + ' Usage: robinpath env remove <KEY>');
            process.exit(2);
        }
        const env = readEnvFile();
        if (!env[key]) {
            console.error(color.red('Error:') + ` Variable not found: ${key}`);
            process.exit(1);
        }
        delete env[key];
        writeEnvFile(env);
        log(color.green('Removed') + ` ${key}`);
    } else {
        console.error(color.red('Error:') + ' Usage: robinpath env <set|list|remove>');
        console.error('  robinpath env set SLACK_TOKEN xoxb-...');
        console.error('  robinpath env list');
        console.error('  robinpath env remove SLACK_TOKEN');
        process.exit(2);
    }
}

/**
 * robinpath cache clean|list — Manage download cache
 */
async function handleCache(args) {
    const sub = args[0];

    if (sub === 'list') {
        if (!existsSync(CACHE_DIR)) {
            log('Cache is empty.');
            return;
        }
        try {
            const files = readdirSync(CACHE_DIR);
            if (files.length === 0) {
                log('Cache is empty.');
                return;
            }
            log('');
            log(color.bold('  Cached packages:'));
            log(color.dim('  ' + '─'.repeat(50)));
            let totalSize = 0;
            for (const file of files) {
                const size = statSync(join(CACHE_DIR, file)).size;
                totalSize += size;
                log(`  ${file.padEnd(45)} ${color.dim((size / 1024).toFixed(1) + 'KB')}`);
            }
            log('');
            log(color.dim(`${files.length} file${files.length !== 1 ? 's' : ''}, ${(totalSize / 1024).toFixed(0)}KB total`));
            log('');
        } catch (err) {
            console.error(color.red('Error:') + ` Failed to list cache: ${err.message}`);
            process.exit(1);
        }
    } else if (sub === 'clean') {
        if (!existsSync(CACHE_DIR)) {
            log('Cache is already empty.');
            return;
        }
        try {
            const files = readdirSync(CACHE_DIR);
            let totalSize = 0;
            for (const file of files) {
                totalSize += statSync(join(CACHE_DIR, file)).size;
            }
            rmSync(CACHE_DIR, { recursive: true, force: true });
            log(color.green('Cleared') + ` ${files.length} cached file${files.length !== 1 ? 's' : ''} (${(totalSize / 1024).toFixed(0)}KB freed)`);
        } catch (err) {
            console.error(color.red('Error:') + ` Failed to clean cache: ${err.message}`);
            process.exit(1);
        }
    } else {
        console.error(color.red('Error:') + ' Usage: robinpath cache <list|clean>');
        process.exit(2);
    }
}

/**
 * robinpath audit — Check installed modules for issues
 */
async function handleAudit() {
    const manifest = readModulesManifest();
    const entries = Object.entries(manifest);

    if (entries.length === 0) {
        log('No modules installed. Nothing to audit.');
        return;
    }

    log(`Auditing ${entries.length} module${entries.length !== 1 ? 's' : ''}...\n`);

    let warnings = 0;
    let ok = 0;
    const token = getAuthToken();

    for (const [fullName, info] of entries) {
        const parsed = parsePackageSpec(fullName);
        if (!parsed || !parsed.scope) {
            log(color.yellow('  !') + `  ${fullName}: invalid package name`);
            warnings++;
            continue;
        }

        try {
            const headers = {};
            if (token) headers.Authorization = `Bearer ${token}`;

            const res = await fetch(`${PLATFORM_URL}/v1/registry/${parsed.scope}/${parsed.name}`, { headers });

            if (!res.ok) {
                log(color.yellow('  !') + `  ${fullName}: could not check registry`);
                warnings++;
                continue;
            }

            const body = await res.json();
            const data = body.data || body;

            // Check if deprecated
            if (data.deprecated) {
                log(color.red('  ✗') + `  ${fullName}@${info.version} — ${color.red('deprecated')}: ${data.deprecated}`);
                warnings++;
                continue;
            }

            // Check if outdated
            const latest = data.latestVersion || data.version;
            if (latest && latest !== info.version) {
                log(color.yellow('  !') + `  ${fullName}@${info.version} → ${latest} available`);
                warnings++;
            } else {
                log(color.green('  ✓') + `  ${fullName}@${info.version}`);
                ok++;
            }
        } catch (err) {
            log(color.yellow('  !') + `  ${fullName}: ${err.message}`);
            warnings++;
        }
    }

    log('');
    if (warnings === 0) {
        log(color.green(`No issues found. ${ok} module${ok !== 1 ? 's' : ''} OK.`));
    } else {
        log(`${color.yellow(warnings + ' warning' + (warnings !== 1 ? 's' : ''))}` +
            (ok > 0 ? `, ${ok} OK` : ''));
    }
    log('');
}

/**
 * robinpath deprecate <pkg> "reason" — Mark a module as deprecated
 */
async function handleDeprecate(args) {
    const spec = args.find(a => !a.startsWith('-'));
    if (!spec) {
        console.error(color.red('Error:') + ' Usage: robinpath deprecate <module> "reason"');
        process.exit(2);
    }

    const parsed = parsePackageSpec(spec);
    if (!parsed || !parsed.scope) {
        console.error(color.red('Error:') + ` Invalid package name: ${spec}`);
        process.exit(2);
    }

    const reason = args.filter(a => a !== spec && !a.startsWith('-')).join(' ') || 'This module is deprecated';
    const { scope, name, fullName } = parsed;
    const token = requireAuth();

    log(`Deprecating ${fullName}...`);

    try {
        const res = await fetch(`${PLATFORM_URL}/v1/registry/${scope}/${name}/deprecate`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: reason }),
        });

        if (res.ok) {
            log(color.yellow('Deprecated') + ` ${fullName}: ${reason}`);
        } else {
            const body = await res.json().catch(() => ({}));
            console.error(color.red('Error:') + ` Failed to deprecate: ${body?.error?.message || 'HTTP ' + res.status}`);
            process.exit(1);
        }
    } catch (err) {
        console.error(color.red('Error:') + ` Failed to deprecate: ${err.message}`);
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
    const rp = await createRobinPath();
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
        const rp = await createRobinPath();

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
    const rp = await createRobinPath();
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
    console.log(`RobinPath v${CLI_VERSION} — Scripting language for automation and data processing

USAGE:
  robinpath [command] [flags] [file]
  rp [command] [flags] [file]          (shorthand alias)

COMMANDS:
  <file.rp>          Run a RobinPath script
  fmt <file|dir>     Format a script (--write to overwrite, --check for CI, --diff)
  check <file>       Check syntax without executing (--json for machine output)
  ast <file>         Dump AST as JSON (--compact for minified)
  test [dir|file]    Run *.test.rp test files (--json for machine output)

MODULE MANAGEMENT:
  add <pkg>[@ver]    Install a module from the registry
  remove <pkg>       Uninstall a module
  upgrade <pkg>      Upgrade a single module to latest
  search <query>     Search the module registry
  info <pkg>         Show module details
  modules list       List installed modules
  modules upgrade    Upgrade all installed modules
  modules init       Scaffold a new module (interactive wizard)
  audit              Check installed modules for issues

PROJECT:
  init               Create a robinpath.json project
  install            Install all modules from robinpath.json
  doctor             Diagnose environment and modules
  env <set|list|rm>  Manage environment secrets
  cache <list|clean> Manage download cache

SYSTEM:
  install            Install robinpath to system PATH (if no robinpath.json)
  uninstall          Remove robinpath from system
  update             Update robinpath to the latest version

CLOUD:
  login              Sign in to RobinPath Cloud via browser
  logout             Remove stored credentials
  whoami             Show current user and account info
  publish [dir]      Publish a module to the registry
  pack [dir]         Create tarball without publishing
  deprecate <pkg>    Mark a module as deprecated
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
  Modules dir:  ~/.robinpath/modules/
  History file: ~/.robinpath/history
  Auth file:    ~/.robinpath/auth.json

For more: https://dev.robinpath.com`);
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
  Opens your browser to sign in via Google. A unique verification code
  is displayed in your terminal — confirm it matches in the browser to
  complete authentication. The token is stored in ~/.robinpath/auth.json
  and is valid for 30 days.

ENVIRONMENT:
  ROBINPATH_CLOUD_URL      Override the cloud app URL (default: https://dev.robinpath.com)
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
  robinpath publish [dir] [flags]

DESCRIPTION:
  Pack the target directory (default: current dir) as a tarball and upload
  it to the RobinPath registry. Requires a package.json with "name" and
  "version" fields. Scoped packages (@scope/name) are supported.

  Maximum package size: 5MB.
  Excluded from tarball: node_modules, .git, dist

FLAGS:
  --public             Publish as public (default)
  --private            Publish as private (only you can install)
  --org <name>         Publish to an organization
  --patch              Auto-bump patch version before publish
  --minor              Auto-bump minor version before publish
  --major              Auto-bump major version before publish
  --dry-run            Validate and show what would be published

EXAMPLES:
  robinpath publish                        Publish current directory
  robinpath publish --private              Publish as private
  robinpath publish --org mycompany        Publish to org
  robinpath publish --patch                Bump 0.1.0 → 0.1.1 and publish
  robinpath publish --dry-run              Preview without uploading`,

        sync: `robinpath sync — List your published modules

USAGE:
  robinpath sync

DESCRIPTION:
  Fetches your published modules from the registry and displays
  them in a table with name, version, downloads, and visibility.`,

        add: `robinpath add — Install a module from the registry

USAGE:
  robinpath add <module>[@version]

DESCRIPTION:
  Downloads and installs a module to ~/.robinpath/modules/.
  Installed modules are automatically available in all scripts.

FLAGS:
  --force            Reinstall even if already installed

EXAMPLES:
  robinpath add @robinpath/slack          Install latest version
  robinpath add @robinpath/slack@0.2.0    Install specific version`,

        remove: `robinpath remove — Uninstall a module

USAGE:
  robinpath remove <module>

DESCRIPTION:
  Removes an installed module from ~/.robinpath/modules/ and
  updates the local manifest.

EXAMPLES:
  robinpath remove @robinpath/slack`,

        upgrade: `robinpath upgrade — Upgrade a module to the latest version

USAGE:
  robinpath upgrade <module>

DESCRIPTION:
  Checks the registry for a newer version and installs it.

EXAMPLES:
  robinpath upgrade @robinpath/slack`,

        modules: `robinpath modules — Module management subcommands

USAGE:
  robinpath modules <subcommand>

SUBCOMMANDS:
  list               List all installed modules
  upgrade            Upgrade all installed modules to latest
  init               Scaffold a new RobinPath module (interactive wizard)

EXAMPLES:
  robinpath modules list
  robinpath modules upgrade
  robinpath modules init`,

        pack: `robinpath pack — Create a tarball without publishing

USAGE:
  robinpath pack [dir]

DESCRIPTION:
  Creates a .tar.gz archive of the module, same as publish would,
  but saves it to the current directory instead of uploading.

EXAMPLES:
  robinpath pack
  robinpath pack ./my-module`,

        search: `robinpath search — Search the module registry

USAGE:
  robinpath search <query> [--category=<cat>]

DESCRIPTION:
  Searches the RobinPath module registry and displays matching modules.

EXAMPLES:
  robinpath search slack
  robinpath search crm --category=crm`,

        info: `robinpath info — Show module details

USAGE:
  robinpath info <module>

DESCRIPTION:
  Displays detailed information about a module from the registry,
  including version, author, license, downloads, and install status.

EXAMPLES:
  robinpath info @robinpath/slack`,

        init: `robinpath init — Create a new RobinPath project

USAGE:
  robinpath init [--force]

DESCRIPTION:
  Creates a robinpath.json project config file in the current directory,
  along with a main.rp entry file, .env, and .gitignore.

EXAMPLES:
  robinpath init`,

        doctor: `robinpath doctor — Diagnose environment

USAGE:
  robinpath doctor

DESCRIPTION:
  Checks CLI installation, authentication status, installed modules,
  project config, and cache. Reports any issues found.`,

        env: `robinpath env — Manage environment secrets

USAGE:
  robinpath env set <KEY> <value>
  robinpath env list
  robinpath env remove <KEY>

DESCRIPTION:
  Manages environment variables stored in ~/.robinpath/env.
  Values are masked when listed.

EXAMPLES:
  robinpath env set SLACK_TOKEN xoxb-1234
  robinpath env list
  robinpath env remove SLACK_TOKEN`,

        cache: `robinpath cache — Manage download cache

USAGE:
  robinpath cache list
  robinpath cache clean

DESCRIPTION:
  Manages the module download cache at ~/.robinpath/cache/.
  Cached tarballs speed up reinstalls and enable offline installs.

EXAMPLES:
  robinpath cache list
  robinpath cache clean`,

        audit: `robinpath audit — Check installed modules for issues

USAGE:
  robinpath audit

DESCRIPTION:
  Checks each installed module against the registry for deprecation
  warnings and available updates.`,

        deprecate: `robinpath deprecate — Mark a module as deprecated

USAGE:
  robinpath deprecate <module> "reason"

DESCRIPTION:
  Marks a published module as deprecated. Users who have it installed
  will see a warning when running 'robinpath audit'.

EXAMPLES:
  robinpath deprecate @myorg/old-module "Use @myorg/new-module instead"`,
    };

    const page = helpPages[command];
    if (page) {
        console.log(page);
    } else {
        console.error(color.red('Error:') + ` Unknown command: ${command}`);
        console.error('Available: add, remove, upgrade, search, info, modules, init, doctor, env, cache, audit, deprecate, pack, fmt, check, ast, test, install, uninstall, login, logout, whoami, publish, sync');
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
    const rp = await createRobinPath({ threadControl: true });
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

    log(`RobinPath v${CLI_VERSION}`);
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

    // Detect invoked name (robinpath or rp)
    const invokedAs = basename(process.execPath, '.exe').toLowerCase();
    const cliName = invokedAs === 'rp' ? 'rp' : 'robinpath';

    // Handle flags (can appear anywhere)
    if (args.includes('--version') || args.includes('-v')) {
        console.log(`${cliName} v${CLI_VERSION} (lang v${ROBINPATH_VERSION})`);
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

    // Module management: add, remove, upgrade, search, info, modules
    if (command === 'add') {
        await handleAdd(args.slice(1));
        return;
    }
    if (command === 'remove') {
        await handleRemove(args.slice(1));
        return;
    }
    if (command === 'upgrade') {
        await handleUpgrade(args.slice(1));
        return;
    }
    if (command === 'search') {
        await handleSearch(args.slice(1));
        return;
    }
    if (command === 'info') {
        await handleInfo(args.slice(1));
        return;
    }
    if (command === 'modules') {
        const sub = args[1];
        if (!sub || sub === 'list') {
            await handleModulesList();
        } else if (sub === 'upgrade') {
            await handleModulesUpgradeAll();
        } else if (sub === 'init') {
            await handleModulesInit();
        } else {
            console.error(color.red('Error:') + ` Unknown subcommand: modules ${sub}`);
            console.error('Available: modules list, modules upgrade, modules init');
            process.exit(2);
        }
        return;
    }
    if (command === 'pack') {
        await handlePack(args.slice(1));
        return;
    }
    if (command === 'audit') {
        await handleAudit();
        return;
    }
    if (command === 'deprecate') {
        await handleDeprecate(args.slice(1));
        return;
    }
    if (command === 'env') {
        await handleEnv(args.slice(1));
        return;
    }
    if (command === 'cache') {
        await handleCache(args.slice(1));
        return;
    }
    if (command === 'doctor') {
        await handleDoctor();
        return;
    }
    if (command === 'init') {
        await handleInit(args.slice(1));
        return;
    }

    // install — project install (if robinpath.json exists) or system install
    if (command === 'install') {
        const hasProjectFile = existsSync(resolve('robinpath.json'));
        if (hasProjectFile) {
            await handleProjectInstall();
        } else {
            handleInstall();
        }
        return;
    }
    if (command === 'uninstall') {
        handleUninstall();
        return;
    }
    if (command === 'update') {
        await handleUpdate();
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

    // Check for updates (non-blocking, before REPL)
    checkForUpdates();

    // Interactive REPL (stdin is a terminal)
    await startREPL();
}

main().catch(err => {
    console.error(color.red('Fatal:') + ` ${err.message}`);
    process.exit(1);
});

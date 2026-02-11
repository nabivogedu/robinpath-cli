/**
 * RobinPath CLI Entry Point (for standalone binary)
 * Bundled by esbuild, packaged as Node.js SEA.
 */
import { createInterface } from 'node:readline';
import { readFileSync, existsSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir, platform } from 'node:os';
import { RobinPath, ROBINPATH_VERSION } from '../robinpath/dist/index.js';

/**
 * Get the install directory for robinpath
 */
function getInstallDir() {
    const home = homedir();
    if (platform() === 'win32') {
        return join(home, '.robinpath', 'bin');
    }
    return join(home, '.robinpath', 'bin');
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
        console.log(`robinpath v${ROBINPATH_VERSION} is already installed.`);
        return;
    }

    // Create directory
    mkdirSync(installDir, { recursive: true });

    // Copy binary
    copyFileSync(src, dest);

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
            console.log(`Could not update PATH automatically.`);
            console.log(`Add this to your PATH manually: ${installDir}`);
        }
    } else {
        // Unix: suggest adding to shell profile
        const shellProfile = process.env.SHELL?.includes('zsh') ? '~/.zshrc' : '~/.bashrc';
        const exportLine = `export PATH="${installDir}:$PATH"`;
        console.log(`Add to ${shellProfile}:`);
        console.log(`  ${exportLine}`);
    }

    console.log('');
    console.log(`Installed robinpath v${ROBINPATH_VERSION}`);
    console.log(`Location: ${dest}`);
    console.log('');
    console.log('Restart your terminal, then run:');
    console.log('  robinpath --version');
}

/**
 * Uninstall: remove ~/.robinpath and clean PATH
 */
function handleUninstall() {
    const installDir = getInstallDir();
    const robinpathHome = join(homedir(), '.robinpath');
    const isWindows = platform() === 'win32';

    // Remove the directory
    if (existsSync(robinpathHome)) {
        rmSync(robinpathHome, { recursive: true, force: true });
        console.log(`Removed ${robinpathHome}`);
    } else {
        console.log('Nothing to remove.');
    }

    // Clean PATH
    if (isWindows) {
        try {
            execSync(
                `powershell -NoProfile -Command "$p = [Environment]::GetEnvironmentVariable('Path','User'); $clean = ($p -split ';' | Where-Object { $_ -notlike '*\\.robinpath\\bin*' }) -join ';'; [Environment]::SetEnvironmentVariable('Path',$clean,'User')"`,
                { encoding: 'utf-8' }
            );
            console.log('Removed from PATH');
        } catch {
            console.log(`Could not update PATH automatically.`);
            console.log(`Remove "${installDir}" from your PATH manually.`);
        }
    } else {
        console.log(`Remove the robinpath PATH line from your shell profile.`);
    }

    console.log('');
    console.log('RobinPath uninstalled. Restart your terminal.');
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
 * Execute a script and exit with proper code
 */
async function runScript(script) {
    const rp = new RobinPath();
    try {
        await rp.executeScript(script);
    } catch (error) {
        console.error(`Error: ${error.message}`);
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

async function main() {
    const args = process.argv.slice(2);

    // Handle flags (can appear anywhere)
    if (args.includes('--version') || args.includes('-v')) {
        console.log(`robinpath v${ROBINPATH_VERSION}`);
        return;
    }

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`RobinPath v${ROBINPATH_VERSION} - A scripting language for automation and data processing`);
        console.log('');
        console.log('Usage:');
        console.log('  robinpath <script.rp>           Run a RobinPath script');
        console.log('  robinpath -e \'log "hello"\'       Execute inline script');
        console.log('  robinpath                        Start interactive REPL');
        console.log('  echo \'log "hi"\' | robinpath      Pipe script via stdin');
        console.log('');
        console.log('Commands:');
        console.log('  install               Install robinpath to your system PATH');
        console.log('  uninstall             Remove robinpath from your system');
        console.log('');
        console.log('Options:');
        console.log('  -e, --eval <script>   Execute a script string');
        console.log('  -v, --version         Show version');
        console.log('  -h, --help            Show this help');
        console.log('');
        console.log('Examples:');
        console.log('  robinpath install           Install to PATH (run once)');
        console.log('  robinpath hello             Runs hello.rp (auto-resolves extension)');
        console.log('  robinpath app.rp            Runs app.rp');
        console.log('  robinpath -e "math.add 1 2"');
        console.log('  robinpath -- -weird-name.rp Use -- for files starting with -');
        return;
    }

    // Handle install / uninstall
    if (args[0] === 'install') {
        handleInstall();
        return;
    }
    if (args[0] === 'uninstall') {
        handleUninstall();
        return;
    }

    // Handle -e / --eval
    const evalIdx = args.indexOf('-e') !== -1 ? args.indexOf('-e') : args.indexOf('--eval');
    if (evalIdx !== -1) {
        const script = args[evalIdx + 1];
        if (!script) {
            console.error('Error: -e requires a script argument');
            process.exit(1);
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
        fileArg = args.find(a => !a.startsWith('-'));
    }

    // Handle file argument
    if (fileArg) {
        const filePath = resolveScriptPath(fileArg);
        if (!filePath) {
            console.error(`Error: File not found: ${fileArg}`);
            if (!extname(fileArg)) {
                console.error(`  (also tried ${fileArg}.rp and ${fileArg}.robin)`);
            }
            process.exit(1);
        }
        const script = readFileSync(filePath, 'utf-8');
        await runScript(script);
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

    // ========================================================================
    // Interactive REPL (stdin is a terminal)
    // ========================================================================
    const rp = new RobinPath({ threadControl: true });
    rp.createThread('default');

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

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: getPrompt()
    });

    console.log(`RobinPath v${ROBINPATH_VERSION}`);
    console.log('Type "help" for commands, "exit" to quit');
    console.log('');

    rl.prompt();

    rl.on('line', async (line) => {
        const trimmed = line.trim();

        if (!trimmed && accumulatedLines.length === 0) {
            rl.prompt();
            return;
        }

        if (trimmed === 'exit' || trimmed === 'quit' || trimmed === '.exit') {
            console.log('Goodbye!');
            process.exit(0);
        }

        if (accumulatedLines.length === 0 && (trimmed === 'help' || trimmed === '.help')) {
            console.log('');
            console.log('RobinPath REPL Commands:');
            console.log('  exit, quit     Exit the REPL');
            console.log('  help           Show this help');
            console.log('  clear          Clear the screen');
            console.log('  ..             Show all available commands');
            console.log('');
            console.log('Write RobinPath code and press Enter to execute.');
            console.log('Multi-line blocks (if/def/for/do) are supported.');
            console.log('Use \\ at end of line for line continuation.');
            console.log('');
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
            console.log(JSON.stringify(commands, null, 2));
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

            if (thread) {
                await thread.executeScript(finalScript);
            } else {
                await rp.executeScript(finalScript);
            }

            rl.setPrompt(getPrompt());
        } catch (error) {
            console.error(`Error: ${error.message}`);
            accumulatedLines = [];
            rl.setPrompt(getPrompt());
        }

        rl.prompt();
    });

    rl.on('close', () => {
        console.log('\nGoodbye!');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        if (accumulatedLines.length > 0) {
            console.log('\nBlock cancelled.');
            accumulatedLines = [];
            rl.setPrompt(getPrompt());
            rl.prompt();
        } else {
            console.log('\nGoodbye!');
            process.exit(0);
        }
    });
}

main().catch(err => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});

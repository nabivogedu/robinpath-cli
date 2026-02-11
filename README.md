# RobinPath CLI

Standalone command-line binary for the [RobinPath](https://github.com/nabivogedu/robinpath-cli) scripting language. No runtime dependencies needed — just one executable.

## Quick Install

### Windows (PowerShell)

```powershell
irm https://robinpath.com/install.ps1 | iex
```

### macOS / Linux

```sh
curl -fsSL https://robinpath.com/install.sh | sh
```

### Manual Install

1. Download `robinpath.exe` (Windows) or `robinpath` (macOS/Linux) from the [Releases](https://github.com/nabivogedu/robinpath-cli/releases) page.
2. Run the self-installer:

```
robinpath install
```

This copies the binary to `~/.robinpath/bin/` and adds it to your system PATH automatically.

3. Restart your terminal.
4. Verify:

```
robinpath --version
```

## Uninstall

```
robinpath uninstall
```

Removes the binary and cleans it from your PATH. Restart your terminal after.

## Usage

```
robinpath [command] [options] [file]
```

### Run a script file

```
robinpath hello.rp
```

The `.rp` and `.robin` extensions are auto-resolved, so you can also just write:

```
robinpath hello
```

### Execute inline code

```
robinpath -e "log \"Hello World\""
```

### Pipe from stdin

```
echo 'log "Hello"' | robinpath
```

### Interactive REPL

Just run `robinpath` with no arguments:

```
$ robinpath
RobinPath v0.30.0
Type "help" for commands, "exit" to quit

default> log "Hello!"
Hello!
default> math.add 2 3
5
default> exit
Goodbye!
```

## Commands

| Command     | Description                              |
|-------------|------------------------------------------|
| `install`   | Install robinpath to your system PATH    |
| `uninstall` | Remove robinpath from your system        |

## Options

| Flag              | Description              |
|-------------------|--------------------------|
| `-e`, `--eval`    | Execute a script string  |
| `-v`, `--version` | Show version             |
| `-h`, `--help`    | Show help                |

## REPL Commands

Once inside the interactive REPL:

| Command        | Description                        |
|----------------|------------------------------------|
| `help`         | Show REPL help                     |
| `exit`, `quit` | Exit the REPL                      |
| `clear`        | Clear the screen                   |
| `..`           | List all available commands        |
| `\` at end     | Continue on next line (multi-line) |

Multi-line blocks (`if`, `def`, `for`, `do`) are detected automatically — the REPL will show `...` and wait for the block to close.

## Examples

```sh
# Run a script
robinpath app.rp

# Inline one-liner
robinpath -e "log \"2 + 2 =\"; log math.add 2 2"

# Auto-resolve extension (runs hello.rp or hello.robin)
robinpath hello

# Files starting with a dash
robinpath -- -weird-name.rp

# Check version
robinpath -v
```

## Install Location

| OS      | Path                                |
|---------|-------------------------------------|
| Windows | `%USERPROFILE%\.robinpath\bin\`     |
| macOS   | `~/.robinpath/bin/`                 |
| Linux   | `~/.robinpath/bin/`                 |

## Building from Source

Requires Node.js 22+.

```sh
# 1. Build the robinpath engine (from workspace root)
cd robinpath && npm run build && cd ../robinpath-cli

# 2. Bundle into single file
npx esbuild cli-entry.js --bundle --platform=node --format=cjs --target=node22 --outfile=dist/robinpath-cli.cjs

# 3. Generate SEA blob
node --experimental-sea-config sea-config.json

# 4. Create the binary
# Windows:
cp "$(node -e "process.stdout.write(process.execPath)")" dist/robinpath.exe
npx postject dist/robinpath.exe NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# macOS/Linux:
cp "$(node -e "process.stdout.write(process.execPath)")" dist/robinpath
npx postject dist/robinpath NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
chmod +x dist/robinpath
```

Or use the build script (macOS/Linux):

```sh
./build.sh
```

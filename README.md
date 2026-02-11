# RobinPath CLI

Standalone command-line binary for the RobinPath scripting language. No runtime dependencies needed — just one executable.

## Install

### Windows

Open **PowerShell** and run:

```powershell
irm https://raw.githubusercontent.com/nabivogedu/robinpath-cli/main/install.ps1 | iex
```

Then **restart your terminal** and verify:

```
robinpath --version
```

### macOS

Open **Terminal** and run:

```sh
curl -fsSL https://raw.githubusercontent.com/nabivogedu/robinpath-cli/main/install.sh | sh
```

Then restart your terminal or run:

```sh
source ~/.zshrc
```

Verify:

```
robinpath --version
```

> Works on both Apple Silicon (M1/M2/M3/M4) and Intel Macs.

### Linux

Open a terminal and run:

```sh
curl -fsSL https://raw.githubusercontent.com/nabivogedu/robinpath-cli/main/install.sh | sh
```

Then restart your terminal or run:

```sh
source ~/.bashrc
```

Verify:

```
robinpath --version
```

### Manual Install

If you prefer to install manually:

1. Download the binary for your OS from the [Releases](https://github.com/nabivogedu/robinpath-cli/releases) page:
   - **Windows** — `robinpath-windows-x64.exe`
   - **macOS** — `robinpath-macos-arm64`
   - **Linux** — `robinpath-linux-x64`

2. Run the self-installer:

```
./robinpath install
```

This copies the binary to `~/.robinpath/bin/` and adds it to your PATH automatically.

3. Restart your terminal.

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

```sh
echo 'log "Hello"' | robinpath
```

### Interactive REPL

Run `robinpath` with no arguments to start the REPL:

```
$ robinpath
RobinPath v0.40.0
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

## Supported Platforms

| Platform         | Binary                      | Runner       |
|------------------|-----------------------------|--------------|
| Windows x64      | `robinpath-windows-x64.exe` | Free         |
| Linux x64        | `robinpath-linux-x64`       | Free         |
| macOS ARM64      | `robinpath-macos-arm64`     | Free         |
| macOS Intel x64  | Via Rosetta (uses ARM64)    | —            |

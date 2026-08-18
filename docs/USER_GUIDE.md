# User Guide

## Getting Started

### Installation

1. Download the latest release from [GitHub Releases](https://github.com/YOUR_USERNAME/WingetInterfaceAndMore/releases)
2. Run the installer (.msi for Windows, .dmg for macOS, .AppImage for Linux)
3. Launch **WinGet System Manager**

### First Launch

When you first open the app, you'll see the main interface with:

- **Mode tabs** at the top: Install, Upgrade, Uninstall, GitHub
- **Search bar** in the center
- **AI Chat** panel on the right

---

## Core Features

### 🔍 Search & Install Packages

1. Make sure you're on the **Install** tab
2. Type a package name in the search bar (e.g., "vscode")
3. Press Enter or click Search
4. Click **Install** on any package card
5. Follow the installation progress in the status bar

### ⬆️ Upgrade Packages

1. Click the **Upgrade** tab
2. The app automatically scans for upgradable packages
3. Click **Upgrade** on individual packages, or
4. Select multiple packages and use **Bulk Upgrade**

### 🗑️ Uninstall Packages

1. Click the **Uninstall** tab
2. Your installed packages are listed
3. Click **Uninstall** on the package you want to remove

### 🐙 GitHub Integration

1. Click the **GitHub** tab
2. Search for repositories
3. Clone repos or install from releases directly

---

## AI Features

### 💬 AI Chat

The AI assistant can help you:

- Find the best packages for your needs
- Compare similar applications
- Generate installation scripts
- Troubleshoot issues

**Example prompts:**

- "What's the best code editor for Python development?"
- "Compare VSCode vs Sublime Text vs Atom"
- "Create a script to install my development environment"

### 🔧 AI Providers

Configure your preferred AI in **Settings → AI**:

- **Gemini** (Cloud) - Requires API key
- **Ollama** (Local) - Free, runs on your machine
- **OpenAI** (Cloud) - Requires API key

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Switch to Install mode |
| `Ctrl+2` | Switch to Upgrade mode |
| `Ctrl+3` | Switch to Uninstall mode |
| `Ctrl+4` | Switch to GitHub mode |
| `Ctrl+F` | Focus search box |
| `Ctrl+,` | Open Settings |
| `Ctrl+/` | Open Help |
| `Ctrl+H` | Open History |
| `Escape` | Close current modal |

---

## Package Managers

The app supports multiple package managers:

| Manager | Platform | Description |
|---------|----------|-------------|
| **winget** | Windows | Microsoft's official package manager |
| **Chocolatey** | Windows | Community package manager |
| **Scoop** | Windows | Developer-focused manager |
| **Homebrew** | macOS/Linux | The macOS package manager |
| **APT** | Linux | Debian/Ubuntu package manager |

Switch between managers in **Settings → General**.

---

## Troubleshooting

### "Administrator privileges required"

Some packages need admin rights to install. Right-click the app and select **Run as Administrator**.

### "Package not found"

Try:

- Check the spelling
- Use a different package manager
- Search on the GitHub tab for the source

### AI not responding

- Check your API key in Settings
- Verify your internet connection
- For Ollama, ensure it's running locally

---

## Tips & Tricks

1. **Compare packages** - Hold Ctrl and click multiple packages, then click Compare
2. **Favorites** - Star packages you frequently use
3. **History** - View your installation history with Ctrl+H
4. **Themes** - Customize colors in Settings → Appearance

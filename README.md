# Chloe

<div align="center">
  <img src="resources/icon.png" alt="Chloe Logo" width="128" height="128">
  
  **Your intelligent email companion**
  
  An Electron application with React and TypeScript
  
  [![GitHub Repository](https://img.shields.io/badge/GitHub-ArEnSc%2FChloe-blue?style=flat-square&logo=github)](https://github.com/ArEnSc/Chloe)
</div>

## Features

- 📧 **Gmail Integration** - Seamlessly connect and manage your Gmail inbox
- 🤖 **LM Studio Support** - Chat with local LLMs for email assistance
- 🔄 **Real-time Sync** - Automatic email synchronization
- 🎯 **Smart Labels** - Intelligent email categorization
- 🌓 **Dark/Light Mode** - Comfortable viewing in any environment
- 💾 **Local Storage** - Your data stays on your device with Realm DB

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Gmail Authentication

To connect your Gmail account:

```bash
$ npm run auth:gmail
```

This will:

1. Open your browser for Google authentication
2. Generate a refresh token for Gmail API access
3. Optionally update your `.env` file automatically

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

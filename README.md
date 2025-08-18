# Chloe

Your intelligent email companion - An Electron application with React and TypeScript

**Repository**: [https://github.com/ArEnSc/Puppy-Mail](https://github.com/ArEnSc/Puppy-Mail)

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

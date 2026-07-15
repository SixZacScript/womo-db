# WOMO DB

Desktop MongoDB manager built with Tauri 2.x

## Tech Stack

- **Desktop Shell**: Tauri 2.x
- **Frontend**: React + TypeScript
- **Backend/Native Layer**: Rust
- **Database**: MongoDB (official Rust driver)
- **Target Platforms**: macOS (Intel + Apple Silicon), Windows, Linux

## Prerequisites

- [Rust](https://www.rust-lang.org/learn/get-started#installing-rust)
- [Node.js](https://nodejs.org/) (v18+)
- MongoDB connection string

## Development

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

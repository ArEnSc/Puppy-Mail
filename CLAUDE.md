# Claude Instructions for Chloe (EmailAgent)

## Project Overview

Chloe is an intelligent email companion built with Electron, providing AI-powered email management features through LM Studio integration. The application combines a modern React frontend with a robust Electron backend for comprehensive email workflow automation.

## Project Structure

```
D:\Chloe\
├── src/
│   ├── main/                    # Electron main process
│   │   ├── auth/                # Authentication services
│   │   ├── db/                  # Realm database layer
│   │   ├── ipc/                 # IPC handlers
│   │   ├── services/            # Mail action services
│   │   └── utils/               # Utilities
│   ├── renderer/                # React frontend
│   │   └── src/
│   │       ├── components/      # React components
│   │       │   ├── email/       # Email-specific components
│   │       │   ├── ui/          # Shadcn UI components
│   │       │   └── magicui/     # Custom UI effects
│   │       ├── hooks/           # Custom React hooks
│   │       ├── lib/             # Utility libraries
│   │       ├── store/           # Zustand stores
│   │       └── shared/          # Shared constants/utils
│   ├── workflow/                # Workflow automation engine
│   │   ├── agent/               # AI workflow builder
│   │   ├── debug/               # Debugging tools
│   │   ├── engine/              # Core workflow engine
│   │   ├── standalone/          # CLI tools
│   │   └── storage/             # Workflow persistence
│   └── scripts/                 # Utility scripts
├── build/                       # Build resources
└── resources/                   # App resources

```

## Technology Stack

### Core Dependencies

- **Electron** (v37.2.3) - Desktop application framework
- **React** (v19.1.0) - UI framework
- **TypeScript** (v5.8.3) - Type safety
- **Vite** (v7.0.5) - Build tool
- **Electron Vite** (v4.0.0) - Electron-specific Vite configuration

### Frontend

- **Zustand** (v5.0.7) - State management
- **Tailwind CSS** (v3.4.17) - Styling
- **Shadcn/ui** - Component library (Radix UI based)
- **Lucide React** (v0.539.0) - Icons
- **DOMPurify** (v3.2.6) - HTML sanitization
- **date-fns** (v4.1.0) - Date utilities

### Backend

- **Realm** (v20.2.0) - Local database
- **Google APIs** (v156.0.0) - Gmail integration
- **Node-cron** (v4.2.1) - Scheduled tasks
- **RxJS** (v7.8.2) - Reactive programming

### Development Tools

- **ESLint** (v9.31.0) - Linting
- **Prettier** (v3.6.2) - Code formatting
- **TSX** (v4.20.4) - TypeScript execution

## Key Architecture Decisions

### Frontend (Renderer Process)

- **React with TypeScript** for type-safe UI development
- **Zustand** for lightweight state management
- **Tailwind CSS** with custom configuration for consistent styling
- **Shadcn/ui components** for pre-built, accessible UI elements
- **IPC communication** wrapped in utility functions for clean API

### Backend (Main Process)

- **Electron with TypeScript** for desktop integration
- **Realm database** for local email data persistence
- **Gmail API** via OAuth 2.0 for email operations
- **LM Studio integration** for local AI features (port 1234)
- **Workflow Engine** for automated email processing

### Workflow Engine

- **Standalone capability** - Can run independently via CLI
- **Type-safe workflow definitions** with TypeScript
- **Comprehensive debugging** with built-in logger and visualizer
- **Flexible triggers** - Email events, timers, manual
- **Mail action functions** - Send, schedule, label, analyze

## Available Scripts

### Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Run built application

### Code Quality

- `npm run lint` - Run ESLint
- `npm run lint -- --fix` - Auto-fix linting issues
- `npm run typecheck` - Check TypeScript types
- `npm run format` - Format with Prettier

### Testing & Debugging

- `npm run auth:gmail` - Setup Gmail authentication
- `npm run test:email` - Test email fetching
- `npm run test:workflow` - Run workflow tests
- `npm run workflow:cli` - Interactive workflow CLI
- `npm run workflow:debug` - Debug workflow execution

### Build & Deploy

- `npm run build:win` - Build for Windows
- `npm run build:mac` - Build for macOS
- `npm run build:linux` - Build for Linux

## Important Guidelines

### When Making Changes

1. **Always test before committing** - The app should run without errors
2. **Use the IPC wrapper** (`src/renderer/src/lib/ipc.ts`) instead of direct `window.electron?.ipcRenderer` calls
3. **Use constants** from `src/renderer/src/shared/constants.ts` instead of hardcoding values
4. **Use error handler** from `src/renderer/src/shared/appLogger.ts` for consistent error handling
5. **Follow existing patterns** - Check neighboring files for conventions

### Code Quality Standards

1. **Type Safety**
   - Always annotate function parameters and return types
   - Avoid using `any` type - use specific types or generics
   - Define interfaces for complex objects
   - Use type guards for runtime validation
   - Example:

     ```typescript
     // Good
     function calculateTotal(items: Item[]): number {
       return items.reduce((sum, item) => sum + item.price, 0)
     }

     // Bad
     function calculateTotal(items) {
       return items.reduce((sum, item) => sum + item.price, 0)
     }
     ```

2. **Use Pure Functions**
   - Prefer pure functions without side effects where possible
   - Extract business logic into pure functions
   - Keep UI components focused on rendering
   - Example:

     ```typescript
     // Pure function
     const filterEmailsByLabel = (emails: Email[], label: string): Email[] =>
       emails.filter((email) => email.labels.includes(label))

     // Use in component
     const filteredEmails = filterEmailsByLabel(emails, 'inbox')
     ```

3. **Pre-commit Checklist**
   - Run `npm run lint` and fix all errors
   - Run `npm run lint -- --fix` to auto-fix formatting
   - Run `npm run typecheck` to ensure type safety
   - Test the app locally with `npm run dev`
   - Ensure no console errors in browser
   - Check that all features work as expected
   - Only then commit changes

### File Organization

#### Main Process Files

- `src/main/index.ts` - Entry point, window management
- `src/main/googleAuth.ts` - Gmail OAuth implementation
- `src/main/emailManager.ts` - Email operations coordinator
- `src/main/db/database.ts` - Realm database interface
- `src/main/lmStudioService.ts` - AI integration

#### Renderer Process Files

- `src/renderer/src/App.tsx` - Root component
- `src/renderer/src/components/email/EmailLayout.tsx` - Main email UI
- `src/renderer/src/store/emailStore.ts` - Email state management
- `src/renderer/src/store/settingsStore.ts` - Settings persistence
- `src/renderer/src/lib/ipc.ts` - IPC communication wrapper

#### Workflow Engine Files

- `src/workflow/WorkflowService.ts` - Main workflow API
- `src/workflow/engine/WorkflowEngine.ts` - Execution engine
- `src/workflow/agent/WorkflowStepBuilder.ts` - AI workflow builder
- `src/workflow/debug/WorkflowDebugger.ts` - Debugging tools

### Common Issues & Solutions

- **White screen**: Usually caused by runtime errors - check browser DevTools console
- **Process is not defined**: Use `import.meta.env` instead of `process.env` in renderer
- **IPC errors**: Ensure channel is defined in both main and preload
- **TypeScript errors**: Run `npm run typecheck` to identify issues
- **Build failures**: Clear `node_modules` and reinstall dependencies

### Development Workflow

1. Run `npm run dev` to start development server
2. Make changes and test in the running app
3. Check browser DevTools for errors
4. Run `npm run lint` and fix issues
5. Run `npm run typecheck` for type safety
6. Test all affected features
7. Commit with descriptive message

### Configuration Files

- `electron.vite.config.ts` - Vite configuration for Electron
- `tailwind.config.js` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration (references sub-configs)
- `eslint.config.mjs` - ESLint rules
- `electron-builder.yml` - Build configuration

### Path Aliases

- `@renderer` → `src/renderer/src`
- `@` → `src/renderer/src`

### AI Integration

- **LM Studio** runs locally on port 1234
- Auto-connects on app start if previously configured
- Status displayed in top bar
- Chat interface in Automated Tasks section
- Workflow engine can use AI for email analysis

### Database

- **Realm database** stored in app data directory
- Email data persists locally
- Can be cleared via Settings > Data Management
- Automatic sync with Gmail

### Workflow Automation

The workflow engine supports:

- **Email triggers** - React to incoming emails
- **Timer triggers** - Scheduled workflows
- **Mail actions** - Send, label, analyze emails
- **AI analysis** - LLM-powered email processing
- **Debug tools** - Comprehensive logging and visualization

## Testing Checklist

- [ ] App starts without errors
- [ ] No console errors in browser DevTools
- [ ] Email sync works correctly
- [ ] LM Studio connection successful
- [ ] Settings persist after restart
- [ ] Workflows execute as expected
- [ ] UI responsive and functional

## Security Considerations

- Never commit secrets or API keys
- Use environment variables for sensitive data
- Sanitize HTML content with DOMPurify
- Validate all IPC inputs
- Use HTTPS for external connections

# Important Instruction Reminders

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files over creating new ones
- NEVER proactively create documentation files (\*.md) unless explicitly requested
- Follow existing code patterns and conventions
- Maintain type safety throughout the codebase
- Test thoroughly before suggesting commits

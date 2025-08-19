# Claude Instructions for EmailAgent

## Project Overview

EmailAgent is an Electron-based email client with AI-powered features using LM Studio for local LLM integration.

## Key Architecture Decisions

### Frontend (Renderer Process)

- React with TypeScript
- Zustand for state management
- Tailwind CSS for styling
- Shadcn/ui components
- IPC communication wrapped in utility functions

### Backend (Main Process)

- Electron with TypeScript
- Realm for local database
- Gmail API integration via OAuth
- LM Studio integration for AI features

## Important Guidelines

### When Making Changes

1. **Always test before committing** - The app should run without errors
2. **Use the IPC wrapper** (`src/renderer/src/lib/ipc.ts`) instead of direct `window.electron?.ipcRenderer` calls
3. **Use constants** from `src/renderer/src/shared/constants.ts` instead of hardcoding values
4. **Use error handler** from `src/renderer/src/shared/errorHandler.ts` for consistent error handling

### Code Quality Standards

1. **Type Safety**
   - Always annotate function parameters and return types
   - Avoid using `any` type - use specific types or generics
   - Define interfaces for complex objects
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
   - Only then commit and push

### Common Issues

- **White screen**: Usually caused by runtime errors - check browser console
- **Process is not defined**: Use `import.meta.env` instead of `process.env` in renderer process
- **IPC errors**: Ensure the channel is defined in both main and renderer processes

### Development Workflow

1. Run `npm run dev` to start the development server
2. Run `npm run lint` before committing
3. Use `npm run lint -- --fix` to auto-fix formatting issues
4. Run `npm run typecheck` to ensure type safety

### AI Integration

- LM Studio runs locally on port 1234
- Auto-connects on app start if previously configured
- Status shown in the top bar
- Chat interface available in Automated Tasks section

### Database

- Realm database stored in app data directory
- Email data persists locally
- Can be cleared via Settings > Data Management

## Testing Checklist

- [ ] App starts without errors
- [ ] No console errors in browser
- [ ] Email sync works
- [ ] LM Studio connection works
- [ ] Settings persist after restart

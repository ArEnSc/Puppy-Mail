#!/usr/bin/env node

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require('child_process')

// Directories to process
const dirsToProcess = ['src', 'scripts']

// File extensions to process
const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.yml', '.yaml', '.css', '.html']

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fixLineEndings(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const fixedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  if (content !== fixedContent) {
    fs.writeFileSync(filePath, fixedContent, 'utf8')
    console.log(`Fixed: ${filePath}`)
    return true
  }
  return false
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function processDirectory(dir) {
  let fixedCount = 0

  const files = fs.readdirSync(dir, { withFileTypes: true })

  for (const file of files) {
    const fullPath = path.join(dir, file.name)

    if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
      fixedCount += processDirectory(fullPath)
    } else if (file.isFile()) {
      const ext = path.extname(file.name)
      if (extensions.includes(ext)) {
        if (fixLineEndings(fullPath)) {
          fixedCount++
        }
      }
    }
  }

  return fixedCount
}

console.log('Fixing line endings in project files...\n')

let totalFixed = 0
for (const dir of dirsToProcess) {
  if (fs.existsSync(dir)) {
    console.log(`Processing ${dir}/...`)
    totalFixed += processDirectory(dir)
  }
}

if (totalFixed > 0) {
  console.log(`\n✅ Fixed line endings in ${totalFixed} file(s)`)
  console.log('\nRunning Prettier to ensure consistent formatting...')

  try {
    execSync('npm run format', { stdio: 'inherit' })
  } catch {
    console.log('Note: Run "npm run format" manually if needed')
  }
} else {
  console.log('\n✅ All files already have correct line endings!')
}

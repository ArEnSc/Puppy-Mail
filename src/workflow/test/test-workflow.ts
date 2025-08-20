#!/usr/bin/env node

/**
 * Simple Node.js script to test the workflow engine
 * Run with: npx ts-node src/workflow/test/test-workflow.ts
 */

import { runStandaloneWorkflow } from '../standalone/run-workflow'

console.log('Starting workflow engine test...\n')

runStandaloneWorkflow()
  .then(() => {
    console.log('\n✅ Test completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })

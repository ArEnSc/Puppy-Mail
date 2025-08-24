/**
 * Simple chat bot with LM Studio tools using act()
 * Run with: npx tsx src/workflow/test/test-imported-tools.ts
 */

import { LMStudioClient, Chat } from '@lmstudio/sdk'
import { emailTools } from '../../main/tools/emailTools'
import * as readline from 'readline/promises'
import chalk from 'chalk'
import { ToolCallRequest, ToolCallResult } from '@lmstudio/sdk'
async function main(): Promise<void> {
  console.log(chalk.bold.cyan('🚀 LM Studio Chat Bot with Email Tools\n'))

  const client = new LMStudioClient({
    baseUrl: 'ws://localhost:1234'
  })

  const models = await client.llm.listLoaded()
  if (models.length === 0) {
    console.log(chalk.red('❌ No models loaded in LM Studio'))
    return
  }

  const model = models[0]
  console.log(chalk.green(`✅ Connected to: ${model.identifier}`))
  console.log(chalk.blue(`📧 Tools: ${emailTools.map((t) => t.name).join(', ')}\n`))

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  // Create a chat instance
  const chat = Chat.empty()
  chat.append(
    'system',
    'You are an email assistant. Use the available tools to help manage emails.'
  )

  // Main chat loop
  let roundNumber = 0
  while (true) {
    const input = await rl.question(chalk.yellow('\nYou: '))

    if (input.toLowerCase() === 'exit') {
      console.log(chalk.magenta('Goodbye! 👋'))
      break
    }

    roundNumber++

    // Append user input to chat
    chat.append('user', input)
    console.log(chalk.gray(`📝 User message added to chat`))

    process.stdout.write(chalk.green('\n🤖 Bot: '))

    let toolCallCount = 0
    let fragmentCount = 0
    let messageCount = 0

    // Use act() to handle tool calling automatically
    await model.act(chat, emailTools, {
      onRoundStart: (round) => {
        console.log(chalk.cyan.bold(`\n${'═'.repeat(50)}`))
        console.log(chalk.cyan.bold(`🔄 [Round ${round}] START`))
        console.log(chalk.cyan.bold(`${'═'.repeat(50)}\n`))
      },
      onRoundEnd: (round) => {
        console.log(chalk.cyan.bold(`\n${'═'.repeat(50)}`))
        console.log(chalk.cyan.bold(`✓ [Round ${round}] END`))
        console.log(chalk.cyan.bold(`${'═'.repeat(50)}\n`))
      },
      onMessage: (message) => {
        messageCount++
        console.log(
          chalk.magenta(`\n\n💬 [Message ${messageCount} Complete] Role: ${message.getRole()}`)
        )
        chat.append(message)

        // If this is the assistant's final message, show it
        if (message.getRole() === 'assistant' && typeof message.getText() === 'string') {
          console.log(chalk.green('🤖 Final Response: ') + chalk.white(message.getText()))
        }
      },

      onPredictionCompleted: () => {
        console.log(chalk.blue(`\n📝 Prediction completed`))
      },
      onPredictionFragment: ({ content }) => {
        fragmentCount++
        process.stdout.write(content)
      },
      onToolCallRequestStart: (roundIndex, callId, info) => {
        toolCallCount++
        console.log(chalk.yellow(`\n\n${'─'.repeat(40)}`))
        console.log(chalk.yellow.bold(`🔧 [Round ${roundIndex}, Call ${callId}] REQUEST START`))
        if (info.toolCallId) {
          console.log(chalk.yellow(`   Tool Call ID: ${chalk.gray(info.toolCallId)}`))
        }
        console.log(chalk.yellow(`${'─'.repeat(40)}`))
      },
      onToolCallRequestNameReceived: (roundIndex, callId, name) => {
        console.log(
          chalk.cyan(`📛 [Round ${roundIndex}, Call ${callId}] Tool Name: ${chalk.white(name)}`)
        )
      },
      onToolCallRequestEnd: (roundIndex, callId, info) => {
        console.log(chalk.yellow(`\n${'─'.repeat(40)}`))
        console.log(chalk.yellow.bold(`📝 [Round ${roundIndex}, Call ${callId}] REQUEST END`))
        console.log(chalk.yellow(`   Tool: ${chalk.white(info.toolCallRequest.name)}`))
        console.log(
          chalk.yellow(
            `   Arguments: ${chalk.white(JSON.stringify(info.toolCallRequest.arguments, null, 2))}`
          )
        )
        if (info.isQueued) {
          console.log(chalk.yellow(`   Status: ${chalk.red('QUEUED')}`))
        }
        if (info.rawContent) {
          console.log(
            chalk.yellow(
              `   Raw: ${chalk.gray(info.rawContent.substring(0, 100))}${info.rawContent.length > 100 ? '...' : ''}`
            )
          )
        }
        console.log(chalk.yellow(`${'─'.repeat(40)}`))
      },
      onToolCallRequestFinalized: (roundIndex, callId, info) => {
        console.log(chalk.blue(`\n${'─'.repeat(40)}`))
        console.log(chalk.blue.bold(`📋 [Round ${roundIndex}, Call ${callId}] REQUEST FINALIZED`))
        console.log(chalk.blue(`   Tool: ${chalk.white(info.toolCallRequest.name)}`))
        console.log(
          chalk.blue(
            `   Arguments: ${chalk.white(JSON.stringify(info.toolCallRequest.arguments, null, 2))}`
          )
        )
        if (info.rawContent) {
          console.log(
            chalk.blue(
              `   Raw Output: ${chalk.gray(info.rawContent.substring(0, 100))}${info.rawContent.length > 100 ? '...' : ''}`
            )
          )
        }
        console.log(chalk.blue(`   Status: Ready for execution`))
        console.log(chalk.blue(`${'─'.repeat(40)}`))
      }
    })

    console.log(chalk.gray(`\n📊 Round ${roundNumber} Stats:`))
    console.log(chalk.gray(`   • Fragments: ${fragmentCount}`))
    console.log(chalk.gray(`   • Tool Calls: ${toolCallCount}`))
    console.log(chalk.gray(`   • Messages: ${messageCount}`))

    // Display all messages in the chat history
    console.log(chalk.cyan.bold(`\n${'═'.repeat(50)}`))
    console.log(chalk.cyan.bold(`💬 CHAT HISTORY (${chat.getLength()} messages)`))
    console.log(chalk.cyan.bold(`${'═'.repeat(50)}`))

    chat.getMessagesArray().forEach((msg, index) => {
      const roleColor =
        msg.getRole() === 'system'
          ? chalk.blue
          : msg.getRole() === 'user'
            ? chalk.yellow
            : msg.getRole() === 'assistant'
              ? chalk.green
              : chalk.red

      console.log(
        chalk.dim(`\n[${index + 1}]`) + ' ' + roleColor.bold(`${msg.getRole().toUpperCase()}:`)
      )

      if (typeof msg.getText() === 'string') {
        // Truncate long messages for readability
        const content = msg.getText()
        console.log(chalk.white(`   ${content}`))
      }

      msg.getToolCallResults().forEach((item: ToolCallResult) => {
        console.log(chalk.red(`   🔧 Tool Call: ${item.content || 'unknown'}`))
      })
      // Handle tool calls or multi-part getText()
      msg.getToolCallRequests().forEach((item: ToolCallRequest) => {
        console.log(chalk.magenta(`   🔧 Tool Call: ${item.name || 'unknown'}`))
      })
    })

    console.log(chalk.cyan.bold(`\n${'═'.repeat(50)}`))
  }

  rl.close()
}

main().catch(console.error)

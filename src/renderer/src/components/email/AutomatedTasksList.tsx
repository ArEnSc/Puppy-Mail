import React, { useState } from 'react'
import { useEmailStore } from '@/store/emailStore'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Play, Square, X, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

interface TaskRun {
  id: string
  taskId: string
  taskName: string
  status: 'running' | 'completed' | 'cancelled'
  startTime: Date
  endTime?: Date
}

export function AutomatedTasksList(): React.JSX.Element {
  const { selectedAutomatedTask } = useEmailStore()
  const [taskRuns, setTaskRuns] = useState<TaskRun[]>([
    {
      id: '1',
      taskId: 'daily-summary',
      taskName: 'Daily Summary',
      status: 'running',
      startTime: new Date(Date.now() - 120000)
    },
    {
      id: '2',
      taskId: 'daily-summary',
      taskName: 'Daily Summary',
      status: 'completed',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() - 3000000)
    },
    {
      id: '3',
      taskId: 'email-cleanup',
      taskName: 'Email Cleanup',
      status: 'running',
      startTime: new Date(Date.now() - 300000)
    },
    {
      id: '4',
      taskId: 'daily-summary',
      taskName: 'Daily Summary',
      status: 'completed',
      startTime: new Date(Date.now() - 90000000),
      endTime: new Date(Date.now() - 89400000)
    },
    {
      id: '5',
      taskId: 'email-cleanup',
      taskName: 'Email Cleanup',
      status: 'cancelled',
      startTime: new Date(Date.now() - 7200000),
      endTime: new Date(Date.now() - 6900000)
    },
    {
      id: '6',
      taskId: 'daily-summary',
      taskName: 'Daily Summary',
      status: 'completed',
      startTime: new Date(Date.now() - 176400000),
      endTime: new Date(Date.now() - 175800000)
    },
    {
      id: '7',
      taskId: 'email-cleanup',
      taskName: 'Email Cleanup',
      status: 'completed',
      startTime: new Date(Date.now() - 86400000),
      endTime: new Date(Date.now() - 85500000)
    },
    {
      id: '8',
      taskId: 'daily-summary',
      taskName: 'Daily Summary',
      status: 'cancelled',
      startTime: new Date(Date.now() - 172800000),
      endTime: new Date(Date.now() - 172500000)
    },
    {
      id: '9',
      taskId: 'email-cleanup',
      taskName: 'Email Cleanup',
      status: 'completed',
      startTime: new Date(Date.now() - 259200000),
      endTime: new Date(Date.now() - 258000000)
    },
    {
      id: '10',
      taskId: 'daily-summary',
      taskName: 'Daily Summary',
      status: 'completed',
      startTime: new Date(Date.now() - 345600000),
      endTime: new Date(Date.now() - 344400000)
    }
  ])
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)

  const handleStart = (): void => {
    if (selectedAutomatedTask) {
      const taskName = selectedAutomatedTask === 'daily-summary' ? 'Daily Summary' : 'Email Cleanup'
      const newRun: TaskRun = {
        id: Date.now().toString(),
        taskId: selectedAutomatedTask,
        taskName,
        status: 'running',
        startTime: new Date()
      }
      setTaskRuns([newRun, ...taskRuns])
    }
  }

  const handleCancel = (runId: string): void => {
    setTaskRuns(
      taskRuns.map((run) =>
        run.id === runId ? { ...run, status: 'cancelled', endTime: new Date() } : run
      )
    )
  }

  const handleDelete = (runId: string): void => {
    setTaskRuns(taskRuns.filter((run) => run.id !== runId))
    setDeleteTaskId(null)
  }

  const formatDuration = (start: Date, end?: Date): string => {
    const endTime = end || new Date()
    const duration = endTime.getTime() - start.getTime()
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const filteredRuns = selectedAutomatedTask
    ? taskRuns.filter((run) => run.taskId === selectedAutomatedTask)
    : taskRuns

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {selectedAutomatedTask === 'daily-summary' && 'Chat'}
            {selectedAutomatedTask === 'email-cleanup' && 'Automated Plans'}
            {!selectedAutomatedTask && 'All Tasks'}
          </h2>
          {selectedAutomatedTask && (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={filteredRuns.some((run) => run.status === 'running')}
            >
              <Play className="mr-2 h-4 w-4" />
              {selectedAutomatedTask === 'email-cleanup' ? 'Create Plan' : 'Start'}
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {filteredRuns.map((run) => (
            <div
              key={run.id}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{run.taskName}</h3>
                  {run.status === 'running' && (
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Running
                    </div>
                  )}
                  {run.status === 'completed' && (
                    <span className="text-sm text-muted-foreground">Completed</span>
                  )}
                  {run.status === 'cancelled' && (
                    <span className="text-sm text-orange-600">Cancelled</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Started: {run.startTime.toLocaleTimeString()} • Duration:{' '}
                  {formatDuration(run.startTime, run.endTime)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {run.status === 'running' && (
                  <Button size="sm" variant="outline" onClick={() => handleCancel(run.id)}>
                    <Square className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setDeleteTaskId(run.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task Run</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task run? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTaskId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTaskId && handleDelete(deleteTaskId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

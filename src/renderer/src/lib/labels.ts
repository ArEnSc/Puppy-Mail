// Label configuration for custom labels with colors
export interface LabelConfig {
  name: string
  color: string
  bgColor: string
  textColor: string
}

// Default label configurations
export const DEFAULT_LABELS: Record<string, LabelConfig> = {
  inbox: {
    name: 'Inbox',
    color: 'blue',
    bgColor: 'bg-blue-100 dark:bg-blue-950',
    textColor: 'text-blue-700 dark:text-blue-300'
  },
  important: {
    name: 'Important',
    color: 'yellow',
    bgColor: 'bg-yellow-100 dark:bg-yellow-950',
    textColor: 'text-yellow-700 dark:text-yellow-300'
  },
  sent: {
    name: 'Sent',
    color: 'green',
    bgColor: 'bg-green-100 dark:bg-green-950',
    textColor: 'text-green-700 dark:text-green-300'
  },
  draft: {
    name: 'Draft',
    color: 'gray',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300'
  },
  spam: {
    name: 'Spam',
    color: 'red',
    bgColor: 'bg-red-100 dark:bg-red-950',
    textColor: 'text-red-700 dark:text-red-300'
  },
  trash: {
    name: 'Trash',
    color: 'gray',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300'
  },
  starred: {
    name: 'Starred',
    color: 'yellow',
    bgColor: 'bg-yellow-100 dark:bg-yellow-950',
    textColor: 'text-yellow-700 dark:text-yellow-300'
  },
  unread: {
    name: 'Unread',
    color: 'blue',
    bgColor: 'bg-blue-100 dark:bg-blue-950',
    textColor: 'text-blue-700 dark:text-blue-300'
  },
  // Gmail categories
  category_personal: {
    name: 'Personal',
    color: 'purple',
    bgColor: 'bg-purple-100 dark:bg-purple-950',
    textColor: 'text-purple-700 dark:text-purple-300'
  },
  category_social: {
    name: 'Social',
    color: 'blue',
    bgColor: 'bg-blue-100 dark:bg-blue-950',
    textColor: 'text-blue-700 dark:text-blue-300'
  },
  category_promotions: {
    name: 'Promotions',
    color: 'green',
    bgColor: 'bg-green-100 dark:bg-green-950',
    textColor: 'text-green-700 dark:text-green-300'
  },
  category_updates: {
    name: 'Updates',
    color: 'orange',
    bgColor: 'bg-orange-100 dark:bg-orange-950',
    textColor: 'text-orange-700 dark:text-orange-300'
  },
  category_forums: {
    name: 'Forums',
    color: 'indigo',
    bgColor: 'bg-indigo-100 dark:bg-indigo-950',
    textColor: 'text-indigo-700 dark:text-indigo-300'
  }
}

// Function to get label config with fallback for custom labels
export function getLabelConfig(label: string): LabelConfig {
  const labelKey = label.toLowerCase().replace(/\s+/g, '_')

  if (DEFAULT_LABELS[labelKey]) {
    return DEFAULT_LABELS[labelKey]
  }

  // Generate a color for custom labels based on the label name
  const colors = [
    { bg: 'bg-pink-100 dark:bg-pink-950', text: 'text-pink-700 dark:text-pink-300' },
    { bg: 'bg-indigo-100 dark:bg-indigo-950', text: 'text-indigo-700 dark:text-indigo-300' },
    { bg: 'bg-teal-100 dark:bg-teal-950', text: 'text-teal-700 dark:text-teal-300' },
    { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300' },
    { bg: 'bg-violet-100 dark:bg-violet-950', text: 'text-violet-700 dark:text-violet-300' },
    { bg: 'bg-emerald-100 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300' }
  ]

  // Use label hash to consistently assign colors
  const hash = label.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colorIndex = hash % colors.length
  const color = colors[colorIndex]

  return {
    name: label.charAt(0).toUpperCase() + label.slice(1),
    color: 'custom',
    bgColor: color.bg,
    textColor: color.text
  }
}

// 学年番号 → モード変換
// 1-3: 低学年, 4-6: 高学年, 7-9: 中学生
export type GradeMode = 'low' | 'mid' | 'high'

export function getGradeMode(gradeNum: number | null | undefined): GradeMode {
  if (!gradeNum) return 'mid'
  if (gradeNum <= 3) return 'low'
  if (gradeNum <= 6) return 'mid'
  return 'high'
}

export function getGradeLabel(gradeNum: number | null | undefined): string {
  if (!gradeNum) return ''
  if (gradeNum <= 6) return `小学${gradeNum}年生`
  return `中学${gradeNum - 6}年生`
}

// モード別設定
export const GRADE_CONFIG = {
  low: {
    label: '低学年モード',
    ruby: true,
    darkMode: false,
    freeText: false,
    timeInput: false,   // 時間入力なし
    stampOnly: true,    // スタンプのみ
    fontSize: 'text-lg',
    colors: {
      primary: 'from-yellow-400 to-orange-400',
      bg: 'bg-yellow-50',
      button: 'bg-yellow-400 text-white',
    },
    // ひらがな変換マップ
    labels: {
      plan:     'けいかく',
      do:       'べんきょうする',
      see:      'ふりかえり',
      done:     'できた！',
      notDone:  'できなかった',
      schedule: 'きょうのべんきょう',
      point:    'ポイント',
    }
  },
  mid: {
    label: '高学年モード',
    ruby: true,
    darkMode: false,
    freeText: false,
    timeInput: true,
    stampOnly: false,
    fontSize: 'text-base',
    colors: {
      primary: 'from-blue-500 to-indigo-500',
      bg: 'bg-blue-50',
      button: 'bg-blue-500 text-white',
    },
    labels: {
      plan:     '計画',
      do:       '学習する',
      see:      '振り返り',
      done:     '完了',
      notDone:  '未完了',
      schedule: '今日の学習',
      point:    'XP',
    }
  },
  high: {
    label: '中学生モード',
    ruby: false,
    darkMode: true,
    freeText: true,
    timeInput: true,
    stampOnly: false,
    fontSize: 'text-sm',
    colors: {
      primary: 'from-gray-700 to-gray-900',
      bg: 'bg-gray-900',
      button: 'bg-gray-700 text-white',
    },
    labels: {
      plan:     '計画',
      do:       '学習',
      see:      '振り返り・分析',
      done:     '完了',
      notDone:  '未完了',
      schedule: '本日のスケジュール',
      point:    'XP',
    }
  },
} as const
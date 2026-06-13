import type { FormEvent } from 'react'
import { getDefaultDepartureDate } from '../lib/congestionTime'
import './DepartureTimePicker.css'

interface DepartureTimePickerProps {
  date: string
  time: string
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
  onSubmit: () => void
  onResetToNow: () => void
  loading?: boolean
}

export function DepartureTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  onSubmit,
  onResetToNow,
  loading = false,
}: DepartureTimePickerProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <form className="departure-picker" onSubmit={handleSubmit}>
      <div className="departure-picker__fields">
        <label className="departure-picker__field">
          <span className="departure-picker__label">출발 날짜</span>
          <input
            type="date"
            value={date}
            min={getDefaultDepartureDate()}
            onChange={(event) => onDateChange(event.target.value)}
            required
          />
        </label>
        <label className="departure-picker__field">
          <span className="departure-picker__label">출발 시간</span>
          <input
            type="time"
            value={time}
            step={600}
            onChange={(event) => onTimeChange(event.target.value)}
            required
          />
        </label>
      </div>
      <div className="departure-picker__actions">
        <button type="submit" className="departure-picker__button" disabled={loading}>
          이 시간대 혼잡도 보기
        </button>
        <button
          type="button"
          className="departure-picker__button departure-picker__button--secondary"
          disabled={loading}
          onClick={onResetToNow}
        >
          현재 시간으로 돌아가기
        </button>
      </div>
    </form>
  )
}

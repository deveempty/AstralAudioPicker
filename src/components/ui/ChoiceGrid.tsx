import { FiCheck } from 'react-icons/fi'

interface Choice { value: string; label: string; description?: string }
interface Props {
  label: string
  value: string
  options: Choice[]
  onChange: (value: string) => void
  disabled?: boolean
  compact?: boolean
}

/** Visible, keyboard-accessible alternatives to small finite select menus. */
export default function ChoiceGrid({ label, value, options, onChange, disabled, compact }: Props) {
  return <fieldset className={`astral-choice-field${compact ? ' astral-choice-compact' : ''}`} disabled={disabled}>
    <legend>{label}</legend>
    <div className="astral-choice-grid">
      {options.map(option => <button key={option.value} type="button" className="astral-choice"
        aria-pressed={option.value === value} disabled={disabled} onClick={() => onChange(option.value)}>
        <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
        <FiCheck aria-hidden="true" className="astral-choice-check" />
      </button>)}
    </div>
  </fieldset>
}

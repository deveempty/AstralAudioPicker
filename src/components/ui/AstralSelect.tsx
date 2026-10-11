import { useEffect, useId, useRef, useState } from 'react'
import { Box, Text, chakra } from '@chakra-ui/react'
import { FiCheck, FiChevronDown } from 'react-icons/fi'

export interface AstralSelectOption { value: string; label: string; description?: string }
interface AstralSelectProps {
  value: string
  options: AstralSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel: string
  disabled?: boolean
}

export default function AstralSelect({ value, options, onChange, placeholder = 'Seleccionar', ariaLabel, disabled }: AstralSelectProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find(option => option.value === value)

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const choose = (nextValue: string) => { onChange(nextValue); setOpen(false) }
  const keyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') setOpen(false)
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(current => !current) }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && options.length) {
      event.preventDefault()
      const current = Math.max(0, options.findIndex(option => option.value === value))
      const offset = event.key === 'ArrowDown' ? 1 : -1
      choose(options[(current + offset + options.length) % options.length].value)
    }
  }

  return <Box ref={root} position="relative" w="100%">
    <chakra.button type="button" display="flex" w="100%" h="42px" px="3" alignItems="center" justifyContent="space-between" gap="3" borderRadius="9px" bg="#100d13" border="1px solid" borderColor={open ? '#9b4dff' : 'rgba(255,255,255,.1)'} color={selected ? 'white' : 'whiteAlpha.400'} cursor={disabled ? 'not-allowed' : 'pointer'} opacity={disabled ? .45 : 1} transition="160ms" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} disabled={disabled} onClick={() => setOpen(current => !current)} onKeyDown={keyDown} _hover={disabled ? {} : { borderColor: 'rgba(155,77,255,.6)', bg: '#17121c' }} _focusVisible={{ outline: 'none', boxShadow: '0 0 0 3px rgba(155,77,255,.22)' }}>
      <Text fontSize="13px" fontWeight="600" truncate>{selected?.label ?? placeholder}</Text><Box color="whiteAlpha.500" transform={open ? 'rotate(180deg)' : 'none'} transition="160ms"><FiChevronDown /></Box>
    </chakra.button>
    {open ? <Box id={listId} role="listbox" position="absolute" zIndex="80" top="calc(100% + 6px)" left="0" right="0" maxH="230px" overflowY="auto" p="1.5" borderRadius="10px" bg="#100d13" border="1px solid rgba(155,77,255,.28)" boxShadow="0 20px 50px rgba(0,0,0,.6)" css={{ '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { background: 'rgba(155,77,255,.4)' } }}>
      {options.map(option => <chakra.button key={option.value} role="option" aria-selected={option.value === value} type="button" display="flex" w="100%" minH="38px" px="2.5" py="2" alignItems="center" gap="2" borderRadius="7px" textAlign="left" color="white" bg={option.value === value ? 'rgba(155,77,255,.13)' : 'transparent'} _hover={{ bg: 'rgba(255,255,255,.055)' }} onClick={() => choose(option.value)}>
        <Box w="14px" color="purple.300">{option.value === value ? <FiCheck /> : null}</Box><Box minW="0"><Text fontSize="12px" fontWeight="650" truncate>{option.label}</Text>{option.description ? <Text color="whiteAlpha.350" fontSize="10px" truncate>{option.description}</Text> : null}</Box>
      </chakra.button>)}
    </Box> : null}
  </Box>
}

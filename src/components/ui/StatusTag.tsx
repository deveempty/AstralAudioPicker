import type { ReactNode } from 'react'
import { Flex } from '@chakra-ui/react'

type Tone = 'purple' | 'blue' | 'yellow' | 'green' | 'red' | 'orange' | 'neutral'
interface StatusTagProps { children: ReactNode; tone?: Tone; icon?: ReactNode }

const colors: Record<Tone, { color: string; background: string; border: string }> = {
  purple: { color: '#c4a7ff', background: 'rgba(155,77,255,.1)', border: 'rgba(155,77,255,.45)' },
  blue: { color: '#60a5fa', background: 'rgba(59,130,246,.1)', border: 'rgba(59,130,246,.42)' },
  yellow: { color: '#facc15', background: 'rgba(234,179,8,.1)', border: 'rgba(234,179,8,.42)' },
  green: { color: '#4ade80', background: 'rgba(34,197,94,.1)', border: 'rgba(34,197,94,.42)' },
  red: { color: '#fb7185', background: 'rgba(239,68,68,.1)', border: 'rgba(239,68,68,.42)' },
  orange: { color: '#fb923c', background: 'rgba(249,115,22,.1)', border: 'rgba(249,115,22,.42)' },
  neutral: { color: '#b8b2bf', background: 'rgba(255,255,255,.045)', border: 'rgba(255,255,255,.13)' },
}

export default function StatusTag({ children, tone = 'neutral', icon }: StatusTagProps) {
  const style = colors[tone]
  return <Flex as="span" display="inline-flex" align="center" gap="1" h="21px" px="7px" borderRadius="6px" color={style.color} bg={style.background} border="1px solid" borderColor={style.border} fontSize="10px" lineHeight="1" fontWeight="650" flexShrink="0">{icon}{children}</Flex>
}

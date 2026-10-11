import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Box, Flex, chakra } from '@chakra-ui/react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface AstralButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  icon?: ReactNode
  trailingIcon?: ReactNode
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

const sizes: Record<Size, { height: string; paddingX: string; fontSize: string; minWidth: string }> = {
  sm: { height: '32px', paddingX: '12px', fontSize: '12px', minWidth: '58px' },
  md: { height: '40px', paddingX: '16px', fontSize: '13px', minWidth: '86px' },
  lg: { height: '46px', paddingX: '20px', fontSize: '14px', minWidth: '110px' },
}

export default function AstralButton({ children, icon, trailingIcon, variant = 'primary', size = 'md', fullWidth, disabled, ...props }: AstralButtonProps) {
  const primary = variant === 'primary'
  const danger = variant === 'danger'
  const ghost = variant === 'ghost'
  return <chakra.button
    type={props.type ?? 'button'}
    position="relative"
    w={fullWidth ? '100%' : 'fit-content'}
    minW={fullWidth ? undefined : sizes[size].minWidth}
    h={sizes[size].height}
    borderRadius="7px"
    border="1px solid"
    borderColor={primary ? '#8f49e8' : danger ? 'rgba(251,113,133,.5)' : ghost ? 'transparent' : 'rgba(255,255,255,.11)'}
    bg={primary ? 'rgba(168,85,247,.13)'  : danger ? 'rgba(251,113,133,.1)' : ghost ? 'transparent' : '#121213'}
    color={danger ? 'red.300' : 'white'}
    cursor={disabled ? 'not-allowed' : 'pointer'}
    opacity={disabled ? .42 : 1}
    boxShadow="none"
    textAlign="center"
    transition="background-color 160ms ease, border-color 160ms ease"
    _hover={disabled ? {} : { bg: primary ? '#141019' : danger ? 'rgba(251,113,133,.14)' : ghost ? 'rgba(255,255,255,.04)' : '#17121c', borderColor: primary ? '#a662fa' : danger ? 'red.300' : 'rgba(155,77,255,.55)', boxShadow: 'none' }}
    _active={disabled ? {} : { bg: '#21182d' }}
    _focusVisible={{ outline: 'none', boxShadow: '0 0 0 3px rgba(155,77,255,.28)' }}
    disabled={disabled}
    {...props}
  >
    <Flex w="100%" h="100%" px={sizes[size].paddingX} align="center" justify="center" gap="2" borderRadius="9px" bg="transparent" fontSize={sizes[size].fontSize} fontWeight="600" lineHeight="1" textAlign="center" whiteSpace="nowrap">
      {icon}<Box as="span">{children}</Box>{trailingIcon}
    </Flex>
  </chakra.button>
}

import { useState, useEffect } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { useI18n } from '../i18n'

const MotionBox = motion.create(Box)

type ChannelConfig = 'stereo' | '7.1'

interface ChannelConfigControlProps {
  disabled?: boolean
  compact?: boolean
  fixed16ch?: boolean
}

export default function ChannelConfigControl({ disabled, compact = false, fixed16ch = false }: ChannelConfigControlProps) {
  const { t } = useI18n()
  const [config, setConfig] = useState<ChannelConfig | null>(null)
  const [loading, setLoading] = useState(true)

  // Load current channel config on mount
  useEffect(() => {
    const loadConfig = async () => {
      if (!window.electronAPI?.getChannelConfig) {
        setConfig('stereo')
        setLoading(false)
        return
      }
      try {
        const currentConfig = await window.electronAPI.getChannelConfig()
        setConfig(currentConfig || 'stereo')
      } catch (err) {
        console.error('Failed to load channel config:', err)
        setConfig('stereo')
      }
      setLoading(false)
    }
    loadConfig()
  }, [])

  const handleChange = async (newConfig: ChannelConfig) => {
    if (!window.electronAPI?.setChannelConfig || disabled || loading || newConfig === config) return
    const previousConfig = config
    setLoading(true)
    setConfig(newConfig)
    try {
      const success = await window.electronAPI.setChannelConfig(newConfig)
      if (!success) {
        setConfig(previousConfig) // Revert on failure
      }
    } catch (err) {
      console.error('Failed to set channel config:', err)
      setConfig(previousConfig) // Revert on failure
    }
    setLoading(false)
  }

  if (compact) {
    return <Box w="142px" flexShrink="0">
      <Flex mb="1.5" align="center" justify="space-between"><Text color="whiteAlpha.350" fontSize="9px" fontWeight="700" letterSpacing="wide">{t('audio.outputChannels')}</Text>{fixed16ch ? <Text color="purple.300" fontSize="8px" fontWeight="800">{t('audio.fixed16ch')}</Text> : null}</Flex>
      <Flex p="1" gap="1" borderRadius="9px" bg="#100d13" border="1px solid rgba(255,255,255,.075)" opacity={fixed16ch ? .5 : 1}>
        {(['stereo', '7.1'] as const).map(value => {
          const selected = !fixed16ch && config === value
          const blocked = disabled || loading || fixed16ch
          return <Box key={value} as="button" flex="1" h="28px" borderRadius="6px" bg={selected ? 'rgba(155,77,255,.2)' : 'transparent'} border="1px solid" borderColor={selected ? 'rgba(155,77,255,.55)' : 'transparent'} color={selected ? 'white' : 'whiteAlpha.400'} cursor={blocked ? 'not-allowed' : 'pointer'} opacity={disabled || loading ? .55 : 1} aria-disabled={blocked} onClick={() => handleChange(value)} transition="150ms" _hover={blocked ? {} : { color: 'white', bg: selected ? 'rgba(155,77,255,.24)' : 'rgba(255,255,255,.04)' }}>
            <Text fontSize="10px" fontWeight="750">{value === 'stereo' ? t('audio.stereo') : '7.1'}</Text>
          </Box>
        })}
      </Flex>
    </Box>
  }

  return (
    <MotionBox
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      p="4"
      bg="rgba(0, 0, 0, 0.3)"
      border="1px solid"
      borderColor="whiteAlpha.200"
      borderRadius="xl"
    >
      <Text
        fontSize="xs"
        fontWeight="bold"
        color="whiteAlpha.700"
        letterSpacing="wider"
        mb="3"
      >
        {t('audio.channelConfig')}
      </Text>

      <Flex gap="2">
        <Box
          as="button"
          flex="1"
          py="2"
          px="4"
          bg={config === 'stereo' ? 'purple.600' : 'rgba(0, 0, 0, 0.4)'}
          border="1px solid"
          borderColor={config === 'stereo' ? 'purple.400' : 'whiteAlpha.200'}
          borderRadius="lg"
          cursor={disabled || loading ? 'not-allowed' : 'pointer'}
          opacity={disabled || loading ? 0.6 : 1}
          onClick={() => handleChange('stereo')}
          _hover={{ borderColor: disabled || loading ? undefined : 'purple.400' }}
          transition="all 0.2s"
        >
          <Text
            color="white"
            fontSize="sm"
            fontWeight={config === 'stereo' ? 'bold' : 'medium'}
          >
            {t('audio.stereo')}
          </Text>
        </Box>

        <Box
          as="button"
          flex="1"
          py="2"
          px="4"
          bg={config === '7.1' ? 'purple.600' : 'rgba(0, 0, 0, 0.4)'}
          border="1px solid"
          borderColor={config === '7.1' ? 'purple.400' : 'whiteAlpha.200'}
          borderRadius="lg"
          cursor={disabled || loading ? 'not-allowed' : 'pointer'}
          opacity={disabled || loading ? 0.6 : 1}
          onClick={() => handleChange('7.1')}
          _hover={{ borderColor: disabled || loading ? undefined : 'purple.400' }}
          transition="all 0.2s"
        >
          <Text
            color="white"
            fontSize="sm"
            fontWeight={config === '7.1' ? 'bold' : 'medium'}
          >
            {t('audio.surround71')}
          </Text>
        </Box>
      </Flex>
    </MotionBox>
  )
}

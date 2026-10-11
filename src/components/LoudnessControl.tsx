import { useState, useEffect } from 'react'
import { Box, Flex, Text, Switch, Slider } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import type { LoudnessSettings } from '../types/electron'
import { useI18n } from '../i18n'

const MotionBox = motion.create(Box)

interface LoudnessControlProps {
  disabled?: boolean
  deviceId?: string
}

export default function LoudnessControl({ disabled, deviceId }: LoudnessControlProps) {
  const { t } = useI18n()
  const [settings, setSettings] = useState<LoudnessSettings>({
    enabled: false,
    releaseTime: 50
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (deviceId) void loadSettings()
  }, [deviceId])

  const loadSettings = async () => {
    if (!window.electronAPI?.getLoudnessSettings || !deviceId) return
    setLoading(true)
    try {
      const result = await window.electronAPI.getLoudnessSettings(deviceId)
      setSettings(result)
    } catch (err) {
      console.error('Failed to load loudness settings:', err)
    }
    setLoading(false)
  }

  const handleToggle = async () => {
    if (!window.electronAPI?.setLoudnessEnabled || disabled || loading || !deviceId) return
    const newEnabled = !settings.enabled
    setSettings(prev => ({ ...prev, enabled: newEnabled }))
    try {
      const success = await window.electronAPI.setLoudnessEnabled(deviceId, newEnabled)
      if (!success) setSettings(prev => ({ ...prev, enabled: !newEnabled }))
    } catch (err) {
      console.error('Failed to toggle loudness:', err)
      setSettings(prev => ({ ...prev, enabled: !newEnabled }))
    }
  }

  const handleReleaseTimeChange = async (value: number) => {
    if (!window.electronAPI?.setLoudnessReleaseTime || disabled || loading) return
    setSettings(prev => ({ ...prev, releaseTime: value }))
  }

  const handleReleaseTimeCommit = async (value: number) => {
    if (!window.electronAPI?.setLoudnessReleaseTime || disabled || loading || !deviceId) return
    try {
      const success = await window.electronAPI.setLoudnessReleaseTime(deviceId, value)
      if (!success) await loadSettings()
    } catch (err) {
      console.error('Failed to set release time:', err)
    }
  }

  const getReleaseTimeLabel = (value: number): string => {
    if (value < 33) return t('audio.short').toUpperCase()
    if (value < 66) return t('audio.normal').toUpperCase()
    return t('audio.long').toUpperCase()
  }

  return (
    <MotionBox
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      mb="4"
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
        {t('audio.loudness')}
      </Text>

      <Flex align="center" justify="space-between" mb="4">
        <Flex align="center" gap="3">
          <Switch.Root
            checked={settings.enabled}
            onCheckedChange={handleToggle}
            disabled={disabled || loading}
            colorPalette="purple"
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Root>
          <Text
            fontSize="sm"
            fontWeight="bold"
            color={settings.enabled ? 'green.400' : 'whiteAlpha.500'}
          >
            {t(settings.enabled ? 'common.on' : 'common.off').toUpperCase()}
          </Text>
        </Flex>
      </Flex>

      {settings.enabled && (
        <Box>
          <Flex justify="space-between" align="center" mb="2">
            <Text fontSize="xs" color="whiteAlpha.600">{t('audio.releaseTime')}</Text>
            <Text fontSize="sm" fontWeight="bold" color="purple.300">
              {getReleaseTimeLabel(settings.releaseTime)}
            </Text>
          </Flex>
          <Slider.Root
            value={[settings.releaseTime]}
            onValueChange={(e) => handleReleaseTimeChange(e.value[0])}
            onValueChangeEnd={(e) => handleReleaseTimeCommit(e.value[0])}
            min={0}
            max={100}
            step={1}
            disabled={disabled || loading}
          >
            <Slider.Control>
              <Slider.Track bg="whiteAlpha.200" h="2" borderRadius="full">
                <Slider.Range bg="yellow.400" />
              </Slider.Track>
              <Slider.Thumb index={0} boxSize="4" bg="white" boxShadow="md" />
            </Slider.Control>
          </Slider.Root>
          <Flex justify="space-between" mt="1">
            <Text fontSize="xs" color="whiteAlpha.400">{t('audio.short')}</Text>
            <Text fontSize="xs" color="whiteAlpha.400">{t('audio.long')}</Text>
          </Flex>
        </Box>
      )}
    </MotionBox>
  )
}

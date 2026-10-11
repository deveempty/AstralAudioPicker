import { useState, useEffect } from 'react'
import { Box, Flex, Text, Slider, Switch } from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../i18n'

const MotionBox = motion.create(Box)

interface PreampControlProps {
  filterName: string | null
  disabled?: boolean
  configVersion?: 'v1' | 'aiwv2' | 'aiwv5'
}

export default function PreampControl({ filterName, disabled, configVersion = 'v1' }: PreampControlProps) {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(false)
  const [value, setValue] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (filterName) {
      loadPreampSettings()
    }
  }, [filterName, configVersion])

  const loadPreampSettings = async () => {
    if (!filterName || !window.electronAPI?.getPreampSettings) return
    setLoading(true)
    try {
      const settings = await window.electronAPI.getPreampSettings(filterName, configVersion)
      setEnabled(settings.enabled)
      setValue(settings.value)
    } catch (err) {
      console.error('Failed to load preamp settings:', err)
    }
    setLoading(false)
  }

  const handleToggle = async () => {
    if (!filterName || loading || disabled) return
    const newEnabled = !enabled
    setEnabled(newEnabled)
    await window.electronAPI.setPreampSettings(filterName, newEnabled, value, configVersion)
  }

  const handleSliderChange = (val: number) => {
    setValue(val)
  }

  const handleSliderEnd = async (val: number) => {
    if (!filterName || disabled) return
    await window.electronAPI.setPreampSettings(filterName, enabled, val, configVersion)
  }

  if (!filterName) {
    return null
  }

  return (
    <Box>
      <Flex
        px="3"
        py="2.5"
        bg="rgba(0, 0, 0, 0.4)"
        border="1px solid"
        borderColor={enabled ? 'purple.500' : 'whiteAlpha.200'}
        borderRadius="lg"
        justify="space-between"
        align="center"
        cursor="pointer"
        onClick={handleToggle}
        _hover={{ borderColor: enabled ? 'purple.400' : 'whiteAlpha.300' }}
        transition="all 0.2s"
      >
        <Flex align="center" gap="3">
          <Text fontSize="xs" fontWeight="bold" color="whiteAlpha.700" letterSpacing="wider">
            {t('preamp.label')}
          </Text>
          {enabled && (
            <Text fontSize="sm" fontWeight="bold" color="purple.300">
              {value.toFixed(1)} dB
            </Text>
          )}
        </Flex>
        <Flex align="center" gap="2">
          <Text fontSize="xs" color={enabled ? 'purple.300' : 'whiteAlpha.500'}>
            {t(enabled ? 'common.on' : 'common.off').toUpperCase()}
          </Text>
          <Switch.Root
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={loading || disabled}
            colorPalette="purple"
            size="sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Root>
        </Flex>
      </Flex>

      <AnimatePresence>
        {enabled && (
          <MotionBox
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            overflow="hidden"
          >
            <Box
              mt="2"
              p="4"
              bg="rgba(0, 0, 0, 0.3)"
              borderRadius="lg"
              border="1px solid"
              borderColor="whiteAlpha.200"
            >
              <Flex align="center" gap="4">
                <Box flex="1">
                  <Slider.Root
                    value={[value]}
                    onValueChange={(details) => handleSliderChange(details.value[0])}
                    onValueChangeEnd={(details) => handleSliderEnd(details.value[0])}
                    min={-30}
                    max={10}
                    step={0.5}
                    disabled={loading || disabled}
                  >
                    <Slider.Control>
                      <Slider.Track bg="whiteAlpha.200" h="2" borderRadius="full">
                        <Slider.Range bg="purple.500" />
                      </Slider.Track>
                      <Slider.Thumb
                        index={0}
                        boxSize="4"
                        bg="purple.400"
                        border="2px solid"
                        borderColor="purple.200"
                        _hover={{ transform: 'scale(1.1)' }}
                        transition="all 0.15s"
                      >
                        <Slider.HiddenInput />
                      </Slider.Thumb>
                    </Slider.Control>
                  </Slider.Root>
                </Box>
                <Text fontSize="sm" fontWeight="bold" color="purple.300" minW="60px" textAlign="right">
                  {value.toFixed(1)} dB
                </Text>
              </Flex>
              <Flex justify="space-between" mt="1">
                <Text fontSize="xs" color="whiteAlpha.400">-30 dB</Text>
                <Text fontSize="xs" color="whiteAlpha.400">+10 dB</Text>
              </Flex>
            </Box>
          </MotionBox>
        )}
      </AnimatePresence>
    </Box>
  )
}

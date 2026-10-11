import { useState, useEffect, useRef } from 'react'
import { Box, Flex, Text, Icon } from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiSpeakerWave, HiChevronDown, HiArrowPath } from 'react-icons/hi2'
import type { AudioDevice } from '../types/electron'
import { useI18n } from '../i18n'

const MotionBox = motion.create(Box)

interface DeviceSelectorProps {
  disabled?: boolean
  onDeviceChange?: (device: AudioDevice | null) => void
}

export default function DeviceSelector({ disabled, onDeviceChange }: DeviceSelectorProps) {
  const { t } = useI18n()
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<AudioDevice | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadDevices()
  }, [])

  useEffect(() => {
    onDeviceChange?.(selectedDevice)
  }, [selectedDevice, onDeviceChange])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadDevices = async () => {
    if (!window.electronAPI?.getAudioDevices) return
    setLoading(true)
    try {
      const deviceList = await window.electronAPI.getAudioDevices()
      setDevices(deviceList)
      const defaultDevice = deviceList.find(d => d.isDefault) || deviceList[0]
      setSelectedDevice(defaultDevice || null)
    } catch (err) {
      console.error('Failed to load devices:', err)
    }
    setLoading(false)
  }

  const handleSelect = (device: AudioDevice) => {
    setSelectedDevice(device)
    setIsOpen(false)
    // Future: will send to Voicemeeter
  }

  return (
    <Box mb="4">
      <Flex align="center" mb="2" gap="2">
        <Text
          fontSize="xs"
          fontWeight="bold"
          color="whiteAlpha.700"
          letterSpacing="wider"
        >
          {t('audio.device')}
        </Text>
        <Box
          as="button"
          onClick={loadDevices}
          p="1"
          borderRadius="full"
          cursor={(loading || disabled) ? 'not-allowed' : 'pointer'}
          opacity={(loading || disabled) ? 0.5 : 1}
          _hover={{ bg: 'whiteAlpha.100' }}
          transition="all 0.2s"
        >
          <Icon 
            as={HiArrowPath} 
            color="whiteAlpha.600" 
            boxSize="3.5"
            css={loading ? { animation: 'spin 1s linear infinite' } : {}}
          />
        </Box>
      </Flex>

      <Box ref={dropdownRef} position="relative">
        <Flex
          as="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          w="100%"
          px="3"
          py="2.5"
          bg="rgba(0, 0, 0, 0.4)"
          border="1px solid"
          borderColor={isOpen ? 'purple.500' : 'whiteAlpha.200'}
          borderRadius="lg"
          align="center"
          justify="space-between"
          cursor={disabled ? 'not-allowed' : 'pointer'}
          opacity={disabled ? 0.6 : 1}
          _hover={{ borderColor: disabled ? 'whiteAlpha.200' : 'purple.400' }}
          transition="all 0.2s"
        >
          <Flex align="center" gap="3" flex="1" minW="0">
            <Icon as={HiSpeakerWave} color="purple.400" boxSize="5" flexShrink={0} />
            <Box textAlign="left" minW="0" flex="1">
              <Text color="white" fontSize="sm" fontWeight="medium" truncate>
                {selectedDevice?.name || t('audio.noDevice')}
              </Text>
            </Box>
          </Flex>
          <Icon
            as={HiChevronDown}
            color="whiteAlpha.600"
            boxSize="5"
            transform={isOpen ? 'rotate(180deg)' : 'rotate(0deg)'}
            transition="transform 0.2s"
          />
        </Flex>

        <AnimatePresence>
          {isOpen && (
            <MotionBox
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              position="absolute"
              top="calc(100% + 4px)"
              left="0"
              right="0"
              bg="rgba(15, 10, 25, 0.98)"
              border="1px solid"
              borderColor="purple.500"
              borderRadius="lg"
              overflow="hidden"
              zIndex="dropdown"
              maxH="200px"
              overflowY="auto"
              boxShadow="0 10px 40px rgba(0, 0, 0, 0.5)"
              css={{
                '&::-webkit-scrollbar': { width: '4px' },
                '&::-webkit-scrollbar-thumb': { background: 'rgba(139, 92, 246, 0.3)', borderRadius: '2px' },
              }}
            >
              {devices.map((device) => (
                <Box
                  key={device.id}
                  as="button"
                  w="100%"
                  px="3"
                  py="2.5"
                  textAlign="left"
                  bg={selectedDevice?.id === device.id ? 'rgba(139, 92, 246, 0.2)' : 'transparent'}
                  _hover={{ bg: 'rgba(139, 92, 246, 0.15)' }}
                  onClick={() => handleSelect(device)}
                  transition="background 0.15s"
                >
                  <Flex align="center" gap="3">
                    <Icon as={HiSpeakerWave} color="purple.400" boxSize="4" />
                    <Text color="white" fontSize="sm" truncate>
                      {device.name}
                    </Text>
                  </Flex>
                </Box>
              ))}
            </MotionBox>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  )
}

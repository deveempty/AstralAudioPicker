import { useState, useEffect, useRef } from 'react'
import { Box, Flex, Text, Icon } from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiAdjustmentsHorizontal, HiChevronDown, HiArrowPath } from 'react-icons/hi2'
import type { FilterInfo } from '../types/electron'
import { useI18n } from '../i18n'

const MotionBox = motion.create(Box)

interface FilterSelectorProps {
  disabled?: boolean
  onFilterChange?: (filter: FilterInfo | null) => void
  configVersion?: 'v1' | 'aiwv2'
}

export default function FilterSelector({ disabled, onFilterChange, configVersion = 'v1' }: FilterSelectorProps) {
  const { t } = useI18n()
  const [filters, setFilters] = useState<FilterInfo[]>([])
  const [selectedFilter, setSelectedFilter] = useState<FilterInfo | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadFilters()
  }, [configVersion])

  useEffect(() => {
    onFilterChange?.(selectedFilter)
  }, [selectedFilter, onFilterChange])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadFilters = async () => {
    if (!window.electronAPI?.getFilterFiles) return
    setLoading(true)
    try {
      const filterList = await window.electronAPI.getFilterFiles(configVersion)
      setFilters(filterList)

      // Get current selection from config file (at_v1.txt or aiw_v3.txt)
      const currentFilter = await window.electronAPI.getCurrentFilter(configVersion)
      if (currentFilter) {
        const found = filterList.find(f => f.name === currentFilter)
        setSelectedFilter(found || null)
      } else {
        setSelectedFilter(null)
      }
    } catch (err) {
      console.error('Failed to load filters:', err)
    }
    setLoading(false)
  }

  const handleSelect = async (filter: FilterInfo) => {
    setSelectedFilter(filter)
    setIsOpen(false)
    // Update config file (at_v1.txt or aiw_v3.txt)
    await window.electronAPI.setCurrentFilter(filter.name, configVersion)
  }

  return (
    <Box>
      <Flex align="center" mb="2" gap="2">
        <Text fontSize="xs" fontWeight="600" color="purple.300" letterSpacing="wider" textTransform="uppercase">
          {t('audio.eqFilter')}
        </Text>
        <Box
          as="button"
          onClick={loadFilters}
          p="1.5"
          borderRadius="full"
          cursor={(loading || disabled) ? 'not-allowed' : 'pointer'}
          opacity={(loading || disabled) ? 0.5 : 1}
          _hover={{ bg: 'rgba(139, 92, 246, 0.15)' }}
          transition="all 0.2s"
        >
          <Icon as={HiArrowPath} color="purple.400" boxSize="3.5"
            css={loading ? { animation: 'spin 1s linear infinite' } : {}}
          />
        </Box>
      </Flex>

      <Box ref={dropdownRef} position="relative">
        <Flex
          as="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          w="100%" px="4" py="3"
          bg="rgba(0, 0, 0, 0.25)"
          backdropFilter="blur(10px)"
          border="1px solid"
          borderColor={isOpen ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255, 255, 255, 0.08)'}
          borderRadius="12px"
          align="center" justify="space-between"
          cursor={disabled ? 'not-allowed' : 'pointer'}
          opacity={disabled ? 0.6 : 1}
          _hover={{ borderColor: disabled ? 'rgba(255, 255, 255, 0.08)' : 'rgba(139, 92, 246, 0.3)' }}
          transition="all 0.2s"
        >
          <Flex align="center" gap="3" flex="1" minW="0">
            <Icon as={HiAdjustmentsHorizontal} color="purple.400" boxSize="5" flexShrink={0} />
            <Box textAlign="left" minW="0" flex="1">
              <Text color="white" fontSize="sm" fontWeight="500" truncate>
                {selectedFilter?.name || t('audio.noFilter')}
              </Text>
            </Box>
          </Flex>
          <Icon as={HiChevronDown} color="whiteAlpha.500" boxSize="4"
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
              position="absolute" top="calc(100% + 4px)" left="0" right="0"
              bg="rgba(15, 10, 25, 0.95)"
              backdropFilter="blur(20px)"
              border="1px solid rgba(139, 92, 246, 0.25)"
              borderRadius="12px"
              overflow="hidden" zIndex="dropdown" maxH="200px" overflowY="auto"
              boxShadow="0 15px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(139, 92, 246, 0.1)"
              css={{
                '&::-webkit-scrollbar': { width: '4px' },
                '&::-webkit-scrollbar-thumb': { background: 'rgba(139, 92, 246, 0.3)', borderRadius: '2px' },
              }}
            >
              {filters.map((filter) => (
                <Box key={filter.filename} as="button" w="100%" px="4" py="2.5" textAlign="left"
                  bg={selectedFilter?.name === filter.name ? 'rgba(139, 92, 246, 0.15)' : 'transparent'}
                  _hover={{ bg: 'rgba(139, 92, 246, 0.1)' }}
                  onClick={() => handleSelect(filter)}
                  transition="background 0.15s"
                >
                  <Flex align="center" gap="3">
                    <Icon as={HiAdjustmentsHorizontal} color="purple.400" boxSize="4" />
                    <Text color="white" fontSize="sm" truncate>{filter.name}</Text>
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

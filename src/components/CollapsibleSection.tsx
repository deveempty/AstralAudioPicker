import { ReactNode } from 'react'
import { Box, Flex, Text, Icon } from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import { HiChevronDown } from 'react-icons/hi2'
import { LuSettings2 } from 'react-icons/lu'

const MotionBox = motion.create(Box)

interface CollapsibleSectionProps {
  title: string
  isExpanded: boolean
  onToggle: () => void
  summary?: ReactNode
  children: ReactNode
  accentColor?: string
}

export default function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  summary,
  children,
  accentColor = 'purple'
}: CollapsibleSectionProps) {
  return (
    <Box mb="3">
      {/* Header - Glassmorphism style */}
      <Flex
        as="button"
        onClick={onToggle}
        w="100%"
        px="4"
        py="3"
        bg={isExpanded
          ? 'rgba(139, 92, 246, 0.1)'
          : 'rgba(0, 0, 0, 0.2)'
        }
        backdropFilter="blur(10px)"
        border="1px solid"
        borderColor={isExpanded ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)'}
        borderRadius={isExpanded ? '14px 14px 0 0' : '14px'}
        align="center"
        justify="space-between"
        cursor="pointer"
        _hover={{
          borderColor: isExpanded ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255, 255, 255, 0.1)',
          bg: isExpanded
            ? 'rgba(139, 92, 246, 0.12)'
            : 'rgba(0, 0, 0, 0.3)'
        }}
        transition="all 0.2s"
      >
        <Flex align="center" gap="2">
          <Icon
            as={LuSettings2}
            color={isExpanded ? `${accentColor}.400` : 'whiteAlpha.400'}
            boxSize="4"
          />
          <Text
            fontSize="xs"
            fontWeight="600"
            color={isExpanded ? `${accentColor}.300` : 'whiteAlpha.500'}
            letterSpacing="wider"
            textTransform="uppercase"
          >
            {title}
          </Text>
          <Icon
            as={HiChevronDown}
            color={isExpanded ? `${accentColor}.400` : 'whiteAlpha.400'}
            boxSize="4"
            transform={isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'}
            transition="transform 0.2s"
          />
        </Flex>

        {/* Summary - Only shown when collapsed */}
        <AnimatePresence mode="wait">
          {!isExpanded && summary && (
            <MotionBox
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              {summary}
            </MotionBox>
          )}
        </AnimatePresence>
      </Flex>

      {/* Content - Glassmorphism expandable panel */}
      <AnimatePresence>
        {isExpanded && (
          <MotionBox
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            overflow="hidden"
          >
            <Box
              p="4"
              bg="rgba(0, 0, 0, 0.15)"
              backdropFilter="blur(8px)"
              border="1px solid"
              borderTop="none"
              borderColor="rgba(139, 92, 246, 0.2)"
              borderRadius="0 0 14px 14px"
            >
              {children}
            </Box>
          </MotionBox>
        )}
      </AnimatePresence>
    </Box>
  )
}


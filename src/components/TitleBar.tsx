import { Flex, Text, Image } from '@chakra-ui/react'
import { FiMinus, FiX } from 'react-icons/fi'
import appLogo from '../assets/applogo.png'
import { useI18n, type Language } from '../i18n'

export default function TitleBar() {
  const { language, setLanguage, t } = useI18n()
  return (
    <Flex
      position="fixed"
      top="0"
      left="0"
      right="0"
      h="44px"
      bg="#080809"
      borderTopRadius="18px"
      borderBottom="1px solid rgba(255,255,255,.07)"
      alignItems="center"
      justifyContent="space-between"
      px="4"
      zIndex="9999"
      css={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <Flex alignItems="center" gap="2">
        <Image src={appLogo} alt="" h="22px" w="22px" objectFit="contain" />
        <Text fontSize="xs" fontWeight="500" color="#a3a3a3">
          Astral Audio
        </Text>
        <Text
          px="1.5"
          py="0.5"
          borderRadius="5px"
          bg="rgba(155,77,255,.12)"
          border="1px solid rgba(155,77,255,.22)"
          fontSize="9px"
          fontWeight="700"
          color="purple.200"
        >
          v{__APP_VERSION__}
        </Text>
      </Flex>

      <Flex gap="0" css={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Flex mr="2" p="1" gap="1" align="center" borderRadius="7px" bg="rgba(255,255,255,.035)" border="1px solid rgba(255,255,255,.07)">
          {(['en', 'es'] as Language[]).map(option => <Flex key={option} as="button" h="20px" px="2" align="center" justify="center" borderRadius="5px" bg={language === option ? 'rgba(155,77,255,.25)' : 'transparent'} color={language === option ? 'white' : 'whiteAlpha.450'} fontSize="9px" fontWeight="800" cursor="pointer" title={t(option === 'en' ? 'language.english' : 'language.spanish')} onClick={() => setLanguage(option)}>{option.toUpperCase()}</Flex>)}
        </Flex>
        <Flex
          as="button"
          w="28px"
          h="28px"
          align="center"
          justify="center"
          cursor="pointer"
          borderRadius="md"
          color="whiteAlpha.600"
          transition="all 0.15s"
          aria-label={t('common.minimize')}
          title={t('common.minimize')}
          _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
          onClick={() => window.electronAPI?.minimize()}
        >
          <FiMinus size={12} />
        </Flex>
        <Flex
          as="button"
          w="28px"
          h="28px"
          align="center"
          justify="center"
          cursor="pointer"
          borderRadius="md"
          color="whiteAlpha.600"
          transition="all 0.15s"
          aria-label={t('common.close')}
          title={t('common.close')}
          _hover={{ bg: 'red.500', color: 'white' }}
          onClick={() => window.electronAPI?.close()}
        >
          <FiX size={12} />
        </Flex>
      </Flex>
    </Flex>
  )
}

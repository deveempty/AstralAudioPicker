import React from 'react'
import {createRoot} from 'react-dom/client'
import {ChakraProvider,Box} from '@chakra-ui/react'
import {system} from '../src/theme'
import {I18nProvider} from '../src/i18n'
import AudioUpgradeNotice from '../src/components/AudioUpgradeNotice'
createRoot(document.getElementById('root')!).render(<ChakraProvider value={system}><I18nProvider><Box bg="#020204" minH="100vh"><AudioUpgradeNotice openRouting={()=>{}}/></Box></I18nProvider></ChakraProvider>)

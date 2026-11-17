import React from 'react'
import {createRoot} from 'react-dom/client'
import {ChakraProvider,Box} from '@chakra-ui/react'
import {system} from '../src/theme'
import {I18nProvider} from '../src/i18n'
import Loudness16Control from '../src/components/Loudness16Control'
createRoot(document.getElementById('root')!).render(<ChakraProvider value={system}><I18nProvider><Box p="8"><Loudness16Control/></Box></I18nProvider></ChakraProvider>)

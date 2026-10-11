// Replaced at build time. Normal builds always require authentication.
declare const __AUDIO_LOCAL_TEST__: boolean
export const audioLocalTest = typeof __AUDIO_LOCAL_TEST__ !== 'undefined' && __AUDIO_LOCAL_TEST__

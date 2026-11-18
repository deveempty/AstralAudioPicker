export declare const audioErrors: {
    readonly AMBIGUOUS_RECONCILIATION: {
        readonly code: "AA-103";
        readonly en: "The Cosmic configuration contains a block that could not be updated safely. Open a support ticket and attach config.txt from Equalizer APO.";
        readonly es: "La configuración de Cosmic contiene un bloque que no se pudo actualizar con seguridad. Abre un ticket y adjunta config.txt de Equalizer APO.";
    };
    readonly APO_ENDPOINT_UNAVAILABLE: {
        readonly code: "AA-305";
        readonly en: "The 7.1 or 16-channel cable is missing or cannot be identified uniquely. Check the cable installation.";
        readonly es: "Falta el cable 7.1 o el de 16 canales, o no se puede identificar de forma única. Revisa la instalación de los cables.";
    };
    readonly APO_COMPONENT_UNAVAILABLE: {
        readonly code: "AA-306";
        readonly en: "Equalizer APO components are missing or unregistered. Repair its installation, then retry.";
        readonly es: "Faltan componentes o registros de Equalizer APO. Repara su instalación y reintenta.";
    };
    readonly APO_ORIGINAL_EFFECTS_UNKNOWN: {
        readonly code: "AA-307";
        readonly en: "The original cable effects could not be recovered safely. Open a support ticket; no substitute effects were installed.";
        readonly es: "No se pudieron recuperar con seguridad los efectos originales del cable. Abre un ticket; no se instalaron efectos sustitutos.";
    };
    readonly APO_REPAIR_FAILED: {
        readonly code: "AA-308";
        readonly en: "Automatic APO repair could not be verified. Retry or open a support ticket with this code.";
        readonly es: "No se pudo verificar la reparación automática de APO. Reintenta o abre un ticket con este código.";
    };
    readonly APO_REPAIR_CONFLICT: {
        readonly code: "AA-309";
        readonly en: "Audio settings changed during repair. Close the APO selector and retry.";
        readonly es: "Los ajustes de audio cambiaron durante la reparación. Cierra el selector de APO y reintenta.";
    };
    readonly APO_REPAIR_ROLLBACK_FAILED: {
        readonly code: "AA-310";
        readonly en: "APO recovery needs assistance. The backup was retained. Open a support ticket before making more changes.";
        readonly es: "La recuperación de APO necesita asistencia. Se conservó el respaldo. Abre un ticket antes de hacer más cambios.";
    };
    readonly APO_RESTART_FAILED: {
        readonly code: "AA-311";
        readonly en: "Windows could not restart the affected audio cable. Restart Windows, then retry.";
        readonly es: "Windows no pudo reiniciar el cable de audio afectado. Reinicia Windows y reintenta.";
    };
    readonly APO_REPAIR_ELEVATION_FAILED: {
        readonly code: "AA-312";
        readonly en: "Administrator permission is needed to repair the audio cable. Retry and accept the Windows permission prompt.";
        readonly es: "Se necesitan permisos de administrador para reparar el cable de audio. Reintenta y acepta la solicitud de Windows.";
    };
    readonly UNKNOWN: {
        readonly code: "AA-100";
        readonly en: "Audio preparation could not finish. Retry or open a support ticket.";
        readonly es: "No se pudo completar la preparación del audio. Reintenta o abre un ticket de soporte.";
    };
    readonly COSMIC_INSTALL_BUSY: {
        readonly code: "AA-101";
        readonly en: "Another Cosmic preparation is running. Wait and retry.";
        readonly es: "Hay otra preparación de Cosmic en curso. Espera y reintenta.";
    };
    readonly COSMIC_LOCK_RECOVERY_REQUIRED: {
        readonly code: "AA-102";
        readonly en: "An interrupted Cosmic installation needs recovery. Open a support ticket.";
        readonly es: "Una instalación interrumpida de Cosmic necesita recuperación. Abre un ticket de soporte.";
    };
    readonly AUTO_EQ_TARGET_MISSING: {
        readonly code: "AA-201";
        readonly en: "A required equalization target is missing. Retry the audio update.";
        readonly es: "Falta un target de ecualización necesario. Reintenta la actualización de audio.";
    };
    readonly AUTO_EQ_MEASUREMENT_INVALID: {
        readonly code: "AA-202";
        readonly en: "The selected headphone measurement cannot be read or has insufficient data.";
        readonly es: "La medición de tus audífonos no se puede leer o no tiene suficientes datos.";
    };
    readonly AUTO_EQ_TARGET_INVALID: {
        readonly code: "AA-203";
        readonly en: "An equalization target has invalid or insufficient data.";
        readonly es: "Un target de ecualización tiene datos inválidos o insuficientes.";
    };
    readonly HEADPHONE_SELECTION_REQUIRED: {
        readonly code: "AA-204";
        readonly en: "Your previous headphone selection could not be identified uniquely. Select your headphones in AutoEQ.";
        readonly es: "No se pudo identificar de forma única tu selección anterior. Selecciona tus audífonos en AutoEQ.";
    };
    readonly APO_CHAIN_UNCONFIRMED: {
        readonly code: "AA-301";
        readonly en: "An audio cable processing chain could not be verified. Retry automatic repair or open a support ticket.";
        readonly es: "No se pudo verificar la cadena de un cable de audio. Reintenta la reparación automática o abre un ticket.";
    };
    readonly LOUDNESS_READBACK_FAILED: {
        readonly code: "AA-302";
        readonly en: "Loudness EQ could not be confirmed on the 16-channel cable.";
        readonly es: "No se pudo confirmar Loudness EQ en el cable de 16 canales.";
    };
    readonly RELAY_ROUTE_UNCONFIRMED: {
        readonly code: "AA-401";
        readonly en: "The audio input or headphone output is not ready. Review Audio routing and retry.";
        readonly es: "La entrada de audio o la salida de audífonos no está lista. Revisa Enrutamiento de audio y reintenta.";
    };
    readonly AUDIO_PREPARATION_BUSY: {
        readonly code: "AA-402";
        readonly en: "Audio preparation is still running. Wait before changing settings.";
        readonly es: "La preparación del audio sigue en curso. Espera antes de cambiar los ajustes.";
    };
    readonly PREPARATION_INTERRUPTED: {
        readonly code: "AA-501";
        readonly en: "The previous preparation was interrupted. Retry to verify and resume it.";
        readonly es: "La preparación anterior se interrumpió. Reintenta para verificarla y continuar.";
    };
    readonly AUTO_EQ_OUTPUT_INVALID: {
        readonly code: "AA-205";
        readonly en: "The generated EQ did not pass validation. Your previous EQ has been kept.";
        readonly es: "La EQ generada no pasó la validación. Se conservó tu EQ anterior.";
    };
    readonly AUTO_EQ_ROLLBACK_INCOMPLETE: {
        readonly code: "AA-206";
        readonly en: "EQ recovery needs assistance. Open a support ticket before changing profiles.";
        readonly es: "La recuperación de EQ necesita asistencia. Abre un ticket antes de cambiar perfiles.";
    };
    readonly AUTO_EQ_BUSY: {
        readonly code: "AA-207";
        readonly en: "Another EQ is being generated. Wait for it to finish and retry.";
        readonly es: "Se está generando otra EQ. Espera a que termine y reintenta.";
    };
    readonly AUDIO_CONFIG_INVALID: {
        readonly code: "AA-303";
        readonly en: "Audio configuration references missing or invalid files. Open a support ticket.";
        readonly es: "La configuración de audio apunta a archivos ausentes o inválidos. Abre un ticket de soporte.";
    };
    readonly RELAY_INSTALL_REQUIRED: {
        readonly code: "AA-403";
        readonly en: "The audio engine is not installed. Install it to continue.";
        readonly es: "Falta el motor de audio. Instálalo para continuar.";
    };
    readonly RELAY_RESTART_REQUIRED: {
        readonly code: "AA-404";
        readonly en: "Windows needs to restart to finish installing the audio engine.";
        readonly es: "Windows necesita reiniciarse para terminar la instalación del motor de audio.";
    };
    readonly RELAY_STARTUP_CONFLICT: {
        readonly code: "AA-405";
        readonly en: "Another startup configuration needs review. Open a support ticket.";
        readonly es: "Hay otra configuración de inicio que requiere revisión. Abre un ticket de soporte.";
    };
    readonly RELAY_CONFIGURATION_CHANGED: {
        readonly code: "AA-406";
        readonly en: "The previous audio route could not be preserved. Review Audio routing, then retry.";
        readonly es: "No se pudo conservar la ruta de audio anterior. Revisa Enrutamiento de audio y reintenta.";
    };
    readonly LOUDNESS_WRITE_OR_RESTART_FAILED: {
        readonly code: "AA-304";
        readonly en: "Windows could not apply Loudness EQ or reconnect the cable. Retry or open a support ticket.";
        readonly es: "Windows no pudo aplicar Loudness EQ o reconectar el cable. Reintenta o abre un ticket.";
    };
    readonly LOUDNESS_RELAY_RESTART_FAILED: {
        readonly code: "AA-407";
        readonly en: "The cable changed, but Relay could not reconnect. Review Audio routing.";
        readonly es: "El cable cambió, pero Relay no pudo reconectarse. Revisa Enrutamiento de audio.";
    };
};
export declare function audioError(raw: string | undefined): {
    readonly code: "AA-103";
    readonly en: "The Cosmic configuration contains a block that could not be updated safely. Open a support ticket and attach config.txt from Equalizer APO.";
    readonly es: "La configuración de Cosmic contiene un bloque que no se pudo actualizar con seguridad. Abre un ticket y adjunta config.txt de Equalizer APO.";
} | {
    readonly code: "AA-305";
    readonly en: "The 7.1 or 16-channel cable is missing or cannot be identified uniquely. Check the cable installation.";
    readonly es: "Falta el cable 7.1 o el de 16 canales, o no se puede identificar de forma única. Revisa la instalación de los cables.";
} | {
    readonly code: "AA-306";
    readonly en: "Equalizer APO components are missing or unregistered. Repair its installation, then retry.";
    readonly es: "Faltan componentes o registros de Equalizer APO. Repara su instalación y reintenta.";
} | {
    readonly code: "AA-307";
    readonly en: "The original cable effects could not be recovered safely. Open a support ticket; no substitute effects were installed.";
    readonly es: "No se pudieron recuperar con seguridad los efectos originales del cable. Abre un ticket; no se instalaron efectos sustitutos.";
} | {
    readonly code: "AA-308";
    readonly en: "Automatic APO repair could not be verified. Retry or open a support ticket with this code.";
    readonly es: "No se pudo verificar la reparación automática de APO. Reintenta o abre un ticket con este código.";
} | {
    readonly code: "AA-309";
    readonly en: "Audio settings changed during repair. Close the APO selector and retry.";
    readonly es: "Los ajustes de audio cambiaron durante la reparación. Cierra el selector de APO y reintenta.";
} | {
    readonly code: "AA-310";
    readonly en: "APO recovery needs assistance. The backup was retained. Open a support ticket before making more changes.";
    readonly es: "La recuperación de APO necesita asistencia. Se conservó el respaldo. Abre un ticket antes de hacer más cambios.";
} | {
    readonly code: "AA-311";
    readonly en: "Windows could not restart the affected audio cable. Restart Windows, then retry.";
    readonly es: "Windows no pudo reiniciar el cable de audio afectado. Reinicia Windows y reintenta.";
} | {
    readonly code: "AA-312";
    readonly en: "Administrator permission is needed to repair the audio cable. Retry and accept the Windows permission prompt.";
    readonly es: "Se necesitan permisos de administrador para reparar el cable de audio. Reintenta y acepta la solicitud de Windows.";
} | {
    readonly code: "AA-100";
    readonly en: "Audio preparation could not finish. Retry or open a support ticket.";
    readonly es: "No se pudo completar la preparación del audio. Reintenta o abre un ticket de soporte.";
} | {
    readonly code: "AA-101";
    readonly en: "Another Cosmic preparation is running. Wait and retry.";
    readonly es: "Hay otra preparación de Cosmic en curso. Espera y reintenta.";
} | {
    readonly code: "AA-102";
    readonly en: "An interrupted Cosmic installation needs recovery. Open a support ticket.";
    readonly es: "Una instalación interrumpida de Cosmic necesita recuperación. Abre un ticket de soporte.";
} | {
    readonly code: "AA-201";
    readonly en: "A required equalization target is missing. Retry the audio update.";
    readonly es: "Falta un target de ecualización necesario. Reintenta la actualización de audio.";
} | {
    readonly code: "AA-202";
    readonly en: "The selected headphone measurement cannot be read or has insufficient data.";
    readonly es: "La medición de tus audífonos no se puede leer o no tiene suficientes datos.";
} | {
    readonly code: "AA-203";
    readonly en: "An equalization target has invalid or insufficient data.";
    readonly es: "Un target de ecualización tiene datos inválidos o insuficientes.";
} | {
    readonly code: "AA-204";
    readonly en: "Your previous headphone selection could not be identified uniquely. Select your headphones in AutoEQ.";
    readonly es: "No se pudo identificar de forma única tu selección anterior. Selecciona tus audífonos en AutoEQ.";
} | {
    readonly code: "AA-301";
    readonly en: "An audio cable processing chain could not be verified. Retry automatic repair or open a support ticket.";
    readonly es: "No se pudo verificar la cadena de un cable de audio. Reintenta la reparación automática o abre un ticket.";
} | {
    readonly code: "AA-302";
    readonly en: "Loudness EQ could not be confirmed on the 16-channel cable.";
    readonly es: "No se pudo confirmar Loudness EQ en el cable de 16 canales.";
} | {
    readonly code: "AA-401";
    readonly en: "The audio input or headphone output is not ready. Review Audio routing and retry.";
    readonly es: "La entrada de audio o la salida de audífonos no está lista. Revisa Enrutamiento de audio y reintenta.";
} | {
    readonly code: "AA-402";
    readonly en: "Audio preparation is still running. Wait before changing settings.";
    readonly es: "La preparación del audio sigue en curso. Espera antes de cambiar los ajustes.";
} | {
    readonly code: "AA-501";
    readonly en: "The previous preparation was interrupted. Retry to verify and resume it.";
    readonly es: "La preparación anterior se interrumpió. Reintenta para verificarla y continuar.";
} | {
    readonly code: "AA-205";
    readonly en: "The generated EQ did not pass validation. Your previous EQ has been kept.";
    readonly es: "La EQ generada no pasó la validación. Se conservó tu EQ anterior.";
} | {
    readonly code: "AA-206";
    readonly en: "EQ recovery needs assistance. Open a support ticket before changing profiles.";
    readonly es: "La recuperación de EQ necesita asistencia. Abre un ticket antes de cambiar perfiles.";
} | {
    readonly code: "AA-207";
    readonly en: "Another EQ is being generated. Wait for it to finish and retry.";
    readonly es: "Se está generando otra EQ. Espera a que termine y reintenta.";
} | {
    readonly code: "AA-303";
    readonly en: "Audio configuration references missing or invalid files. Open a support ticket.";
    readonly es: "La configuración de audio apunta a archivos ausentes o inválidos. Abre un ticket de soporte.";
} | {
    readonly code: "AA-403";
    readonly en: "The audio engine is not installed. Install it to continue.";
    readonly es: "Falta el motor de audio. Instálalo para continuar.";
} | {
    readonly code: "AA-404";
    readonly en: "Windows needs to restart to finish installing the audio engine.";
    readonly es: "Windows necesita reiniciarse para terminar la instalación del motor de audio.";
} | {
    readonly code: "AA-405";
    readonly en: "Another startup configuration needs review. Open a support ticket.";
    readonly es: "Hay otra configuración de inicio que requiere revisión. Abre un ticket de soporte.";
} | {
    readonly code: "AA-406";
    readonly en: "The previous audio route could not be preserved. Review Audio routing, then retry.";
    readonly es: "No se pudo conservar la ruta de audio anterior. Revisa Enrutamiento de audio y reintenta.";
} | {
    readonly code: "AA-304";
    readonly en: "Windows could not apply Loudness EQ or reconnect the cable. Retry or open a support ticket.";
    readonly es: "Windows no pudo aplicar Loudness EQ o reconectar el cable. Reintenta o abre un ticket.";
} | {
    readonly code: "AA-407";
    readonly en: "The cable changed, but Relay could not reconnect. Review Audio routing.";
    readonly es: "El cable cambió, pero Relay no pudo reconectarse. Revisa Enrutamiento de audio.";
};
export declare function audioErrorKey(error: unknown): string;

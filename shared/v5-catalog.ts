export type V5Game='BO7'|'MW4'
export type V5Hrir='Native'|'KEMAR'|'KU100'
export function parseV5Preset(filename:string){
 const mw4=/^MW4_V1_16ch_(ClassicLE(?:Raw)?(?:Plus)?|TheaterClear(?:Plus)?)-(StockGun|ExtraHiGun|HiGun|MedGun|LoGun|UltraLoGun)_HRIR-(KEMAR|KU100)\.txt$/i.exec(filename)
 if(mw4)return {game:'MW4' as const,profile:mw4[1],weaponTuning:mw4[2],hrir:mw4[3].toUpperCase() as V5Hrir}
 const legacy=/^BO7_V5_16ch_([a-z0-9_]+)-([a-z0-9_]+)\.txt$/i.exec(filename)
 return legacy?{game:'BO7' as const,profile:legacy[1],weaponTuning:legacy[2],hrir:'Native' as const}:null
}

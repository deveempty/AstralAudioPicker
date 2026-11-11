import {createInterface} from 'node:readline/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export async function chooseRequired(args, {interactive, ask, log=console.log}) {
  const flags=args.filter(arg=>arg==='--required'||arg==='--optional');
  if(flags.length>1||args.some(arg=>!['--required','--optional','--dry-run'].includes(arg))) {
    throw Error('Usa --required o --optional, y opcionalmente --dry-run.');
  }
  if(flags.length)return flags[0]==='--required';
  if(!interactive)throw Error('Sin terminal interactiva: indica --required o --optional. No se inicio el release.');
  log('\nTipo de actualizacion:\n  1) Normal: permite seguir usando la app.\n  2) Obligatoria: bloquea versiones anteriores hasta actualizar.\n  Q) Cancelar\nUna release normal conserva los requisitos obligatorios anteriores.\n');
  while(true) {
    const answer=(await ask('Elige [1]: ')).trim().toLowerCase();
    if(answer===''||answer==='1')return false;
    if(answer==='2')return true;
    if(answer==='q')throw Error('Release cancelado.');
    log('Elige 1, 2 o Q.');
  }
}

async function main() {
  const args=process.argv.slice(2);
  let prompt;
  try {
    const required=await chooseRequired(args, {
      interactive:!!process.stdin.isTTY&&!!process.stdout.isTTY,
      ask:question=>{
        prompt??=createInterface({input:process.stdin,output:process.stdout});
        return prompt.question(question);
      },
    });
    prompt?.close();
    console.log(`\nActualizacion ${required?'OBLIGATORIA':'NORMAL'}.`);
    if(args.includes('--dry-run')) {console.log('Simulacion: sin compilar, modificar archivos ni publicar.');return;}
    if(!process.env.npm_execpath)throw Error('Ejecuta npm run release.');
    const child=spawn(process.execPath,[process.env.npm_execpath,'run','release:execute'],{
      cwd:fileURLToPath(new URL('..',import.meta.url)),stdio:'inherit',shell:false,
      env:{...process.env,ASTRAL_REQUIRED_UPDATE:required?'1':'0'},
    });
    await new Promise((resolve,reject)=>{
      child.on('error',reject);
      child.on('exit',(code,signal)=>code===0?resolve():reject(Error(`Release detenido (${signal??code}).`)));
    });
  } finally {prompt?.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}

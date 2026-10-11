import fs from 'node:fs';
﻿import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';export default defineConfig({plugins:[react()],define:{__APP_VERSION__:JSON.stringify(JSON.parse(fs.readFileSync('package.json','utf8')).version)},server:{host:'127.0.0.1',port:18746,strictPort:true}});

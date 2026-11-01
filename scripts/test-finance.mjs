import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'monthly-balance-tests-'));
try{const output=join(dir,'test.mjs');await build({entryPoints:['tests/finance.test.ts'],bundle:true,platform:'node',format:'esm',outfile:output});await import(output)}finally{await rm(dir,{recursive:true,force:true})}

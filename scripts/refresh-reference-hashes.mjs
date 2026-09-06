import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../web/src/templates/ordination/',import.meta.url);
const input=JSON.parse(await readFile(new URL('example-inputs.json',root),'utf8'));
const reference=JSON.parse(await readFile(new URL('reference-results.json',root),'utf8'));
for(const [method,variants]of Object.entries(reference))for(const [variant,value]of Object.entries(variants)){const {dataset,params}=input[method][variant];value.method=method;value.params=params;value.inputHash=createHash('sha256').update(JSON.stringify({dataset,method,params})).digest('hex');}
await writeFile(new URL('reference-results.json',root),JSON.stringify(reference,null,2)+'\n');
console.log(Object.keys(reference).length+' methods, real reference hashes refreshed');
